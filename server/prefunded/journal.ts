import {
  mkdir,
  open,
  readdir,
  readFile,
  lstat,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
export interface JournalEntry {
  sequence: number;
  previousDigest: string;
  kind: "DISCOVERY" | "PROPOSAL" | "REVIEW" | "STOP";
  at: string;
  data: unknown;
  digest: string;
}
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Cross-process exclusion and fsynced, hash chained, create-only records. Missing/corrupt records or a
 * stranded lock fail closed. Filesystem administrators remain in the trust boundary; this is not WORM storage.
 */
export class EvidenceJournal {
  constructor(readonly directory: string) {}
  async transaction<T>(
    work: (
      entries: readonly JournalEntry[],
      append: (
        kind: JournalEntry["kind"],
        data: unknown,
      ) => Promise<JournalEntry>,
    ) => Promise<T>,
  ): Promise<T> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (
      !(await lstat(this.directory)).isDirectory() ||
      (await lstat(this.directory)).isSymbolicLink()
    )
      throw Error("ARCHIVE_UNSAFE");
    const lock = path.join(this.directory, ".lock");
    try {
      await mkdir(lock, { mode: 0o700 });
    } catch {
      throw Error("ARCHIVE_BUSY_OR_LOCKED");
    }
    try {
      const files = (await readdir(this.directory))
        .filter((f) => /^\d{8}\.json$/.test(f))
        .sort();
      if (files.length > 2000) throw Error("ARCHIVE_CAPACITY_REACHED");
      const entries: JournalEntry[] = [];
      let previousDigest = "0".repeat(64);
      let archiveBytes = 0;
      for (const [index, file] of files.entries()) {
        if (file !== String(index + 1).padStart(8, "0") + ".json")
          throw Error("ARCHIVE_CORRUPTED");
        const location = path.join(this.directory, file),
          stat = await lstat(location);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 131072)
          throw Error("ARCHIVE_CORRUPTED");
        archiveBytes += stat.size;
        if (archiveBytes > 16 * 1024 * 1024)
          throw Error("ARCHIVE_CAPACITY_REACHED");
        const entry = JSON.parse(
          await readFile(location, "utf8"),
        ) as JournalEntry;
        const { digest, ...payload } = entry;
        if (
          entry.sequence !== index + 1 ||
          entry.previousDigest !== previousDigest ||
          digest !== hash(payload)
        )
          throw Error("ARCHIVE_CORRUPTED");
        entries.push(entry);
        previousDigest = digest;
      }
      const append = async (kind: JournalEntry["kind"], data: unknown) => {
        const payload = {
          sequence: entries.length + 1,
          previousDigest,
          kind,
          at: new Date().toISOString(),
          data,
        };
        const entry = { ...payload, digest: hash(payload) },
          bytes = JSON.stringify(entry);
        if (
          Buffer.byteLength(bytes) > 131072 ||
          entry.sequence > 2000 ||
          archiveBytes + Buffer.byteLength(bytes) > 16 * 1024 * 1024
        )
          throw Error("ARCHIVE_CAPACITY_REACHED");
        const target = path.join(
            this.directory,
            String(entry.sequence).padStart(8, "0") + ".json",
          ),
          temporary = path.join(lock, "pending");
        const handle = await open(temporary, "wx", 0o400);
        try {
          await handle.writeFile(bytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
        // Lock protects rename; fail on pre-existing destinations, including unexpected files.
        try {
          await lstat(target);
          throw Error("ARCHIVE_CONFLICT");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await rename(temporary, target);
        const directory = await open(this.directory, "r");
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
        entries.push(entry);
        archiveBytes += Buffer.byteLength(bytes);
        previousDigest = entry.digest;
        return entry;
      };
      return await work(entries, append);
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}
