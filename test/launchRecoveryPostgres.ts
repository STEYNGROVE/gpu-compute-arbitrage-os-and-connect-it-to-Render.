import assert from "node:assert/strict";
import pg from "pg";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
const raw = process.env.TEST_DATABASE_URL;
if (
  !raw ||
  process.env.NODE_ENV !== "test" ||
  process.env.ALLOW_ISOLATED_GPU_DB_TEST !== "YES" ||
  process.env.RENDER ||
  process.env.DATABASE_URL
)
  throw Error("ISOLATED_FIXTURE_REQUIRED");
const target = new URL(raw);
if (
  target.hostname !== "127.0.0.1" ||
  target.username !== "phase16_testowner" ||
  target.pathname !== "/phase16_test" ||
  !target.port
)
  throw Error("ISOLATED_FIXTURE_REQUIRED");
const admin = new pg.Client({ connectionString: raw }),
  suffix = randomBytes(4).toString("hex");
const names = ["fresh", "restore", "incompatible"].map(
    (n) => "recovery_" + n + "_" + suffix,
  ),
  created: string[] = [];
const directory = mkdtempSync(path.join(tmpdir(), "launch-recovery-"));
const clients: pg.Client[] = [];
const prereq = "20261109999999_commercial_intake_prerequisites";
const baseEnv = {
  ...process.env,
  NODE_ENV: "test",
  DISABLE_JSON_PERSISTENCE: "true",
};
for (const name of [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_DB_URL",
  "POSTGRES_URL",
  "RENDER",
  "DB_MIGRATION_EXECUTE",
  "DB_MIGRATION_TARGET",
  "DB_MIGRATION_TARGET_CONFIRM",
  "DATABASE_SSL_CA",
])
  delete baseEnv[name];
const connection = (name: string) => {
  const url = new URL(raw);
  url.pathname = "/" + name;
  return url.href;
};
const run = (name: string, changes: Record<string, string> = {}) => {
  const env = {
    ...baseEnv,
    DATABASE_URL: connection(name),
    DB_MIGRATION_EXECUTE: "EXPLICITLY_AUTHORIZED",
    DB_MIGRATION_TARGET: "ISOLATED_LAUNCH_RECOVERY",
    DB_MIGRATION_TARGET_CONFIRM: "ISOLATED_LAUNCH_RECOVERY",
    DB_MIGRATION_EXPECT_DATABASE: name,
    DB_MIGRATION_EXPECT_PORT: target.port,
    DB_MIGRATION_EXPECT_SERVER_ADDRESS: "127.0.0.1",
    DB_MIGRATION_EXPECT_TRANSPORT: "tcp",
    ...changes,
  };
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/migrateDatabase.ts"],
    { env, encoding: "utf8", timeout: 90000 },
  );
  assert.ifError(r.error);
  assert(!(r.stdout + r.stderr).includes(decodeURIComponent(target.password)));
  return r;
};
let passed = 0;
async function check(name: string, work: () => Promise<void>) {
  await work();
  passed++;
  console.log("RECOVERY_PG_PASS " + name);
}
const connect = async (name: string) => {
  await admin.query('CREATE DATABASE "' + name + '"');
  created.push(name);
  const c = new pg.Client({ connectionString: connection(name) });
  await c.connect();
  clients.push(c);
  return c;
};
const tables = [
  "commercial_quote_requests",
  "customer_intelligence_leads",
  "gpu_hunter_opportunities",
  "preapproved_workload_evidence",
];
try {
  await admin.connect();
  const fresh = await connect(names[0]);
  await check("fresh bootstrap requires explicit additional gate", async () => {
    const r = run(names[0]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /MIGRATION_PREFLIGHT_FAILED/);
    assert.equal(
      (await fresh.query("SELECT to_regclass('public.schema_migrations') AS t"))
        .rows[0].t,
      null,
    );
  });
  await check(
    "complete fresh migration installation in dependency order",
    async () => {
      const r = run(names[0], {
        DB_MIGRATION_FRESH_INSTALL: "EXPLICITLY_AUTHORIZED",
      });
      assert.equal(r.status, 0, r.stderr);
      const expected = readdirSync("supabase/migrations").filter((f) =>
        f.endsWith(".sql"),
      ).length;
      assert.equal(
        (await fresh.query("SELECT count(*)::int AS n FROM schema_migrations"))
          .rows[0].n,
        expected,
      );
      for (const t of tables)
        assert(
          (await fresh.query("SELECT to_regclass($1) AS t", ["public." + t]))
            .rows[0].t,
        );
      assert(
        (
          await fresh.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name='acquisition_leads' AND column_name='published_at'",
          )
        ).rowCount,
      );
    },
  );
  await fresh.query(
    "INSERT INTO commercial_quote_requests(id,company,contact_name,email,workload,gpu_model,gpu_count,hours,notes) VALUES('00000000-0000-4000-8000-000000000001','Synthetic fixture','Fixture','fixture@example.org','AI_INFERENCE','H100',1,1,'synthetic no revenue')",
  );
  await check(
    "repeated runner is idempotent and preserves existing metadata",
    async () => {
      assert.equal(run(names[0]).status, 0);
      assert.equal(
        (
          await fresh.query(
            "SELECT count(*)::int AS n FROM commercial_quote_requests",
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check(
    "legacy recorded v5 accepts only the explicit new prerequisite backfill",
    async () => {
      await fresh.query("DELETE FROM schema_migrations WHERE version=$1", [
        prereq,
      ]);
      assert.equal(run(names[0]).status, 0);
      assert.equal(
        (
          await fresh.query(
            "SELECT count(*)::int AS n FROM schema_migrations WHERE version=$1",
            [prereq],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await fresh.query(
            "SELECT count(*)::int AS n FROM commercial_quote_requests",
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check(
    "application readiness verifies all commercial tables and schema checksums",
    async () => {
      const { PostgresDatabaseService } =
        await import("../server/pgDatabase.js");
      const s = new PostgresDatabaseService();
      try {
        const env = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
          await s.verifySchemaReadiness(fresh as unknown as pg.PoolClient);
        } finally {
          process.env.NODE_ENV = env;
        }
      } finally {
        await s.close();
      }
    },
  );
  await check(
    "RLS and downstream foreign keys survive complete schema installation",
    async () => {
      for (const t of tables)
        assert.equal(
          (
            await fresh.query(
              "SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass",
              ["public." + t],
            )
          ).rows[0].relrowsecurity,
          true,
        );
      await assert.rejects(
        fresh.query(
          "INSERT INTO commercial_verification(request_id) VALUES('00000000-0000-4000-8000-000000000099')",
        ),
        (e: any) => e.code === "23503",
      );
    },
  );
  await check(
    "commercial bounds reject negative resources without changing existing rows",
    async () => {
      await assert.rejects(
        fresh.query(
          "UPDATE commercial_quote_requests SET gpu_count=0 WHERE id='00000000-0000-4000-8000-000000000001'",
        ),
        (e: any) => e.code === "23514",
      );
      assert.equal(
        (await fresh.query("SELECT gpu_count FROM commercial_quote_requests"))
          .rows[0].gpu_count,
        1,
      );
    },
  );
  await check(
    "pg_dump and isolated restore preserve data, history and constraints",
    async () => {
      const started = Date.now(),
        artifact = path.join(directory, "synthetic.dump");
      await admin.query('CREATE DATABASE "' + names[1] + '"');
      created.push(names[1]);
      const env = {
        ...baseEnv,
        PGPASSWORD: decodeURIComponent(target.password),
        PGSSLMODE: process.env.TEST_DATABASE_SSL_CA ? "verify-full" : "prefer",
        PGSSLROOTCERT: process.env.TEST_DATABASE_SSL_CA,
      };
      const args = [
        "-h",
        target.hostname,
        "-p",
        target.port,
        "-U",
        target.username,
      ];
      for (const [cmd, args2] of [
        ["pg_dump", [...args, "-Fc", "-f", artifact, names[0]]],
        [
          "pg_restore",
          [
            ...args,
            "--exit-on-error",
            "--no-owner",
            "--no-acl",
            "-d",
            names[1],
            artifact,
          ],
        ],
      ] as const) {
        const r = spawnSync(cmd, args2, {
          env,
          encoding: "utf8",
          timeout: 60000,
        });
        assert.equal(r.status, 0, cmd + " failed in isolated fixture");
      }
      const restored = new pg.Client({
        connectionString: connection(names[1]),
      });
      await restored.connect();
      clients.push(restored);
      assert.equal(
        (
          await restored.query(
            "SELECT count(*)::int AS n FROM commercial_quote_requests",
          )
        ).rows[0].n,
        1,
      );
      assert.deepEqual(
        (
          await restored.query(
            "SELECT version,checksum FROM schema_migrations ORDER BY version",
          )
        ).rows,
        (
          await fresh.query(
            "SELECT version,checksum FROM schema_migrations ORDER BY version",
          )
        ).rows,
      );
      console.log(
        "RECOVERY_FIXTURE_BACKUP_RESTORE_MS " + (Date.now() - started),
      );
    },
  );
  await check(
    "arbitrary history holes still reject with no auto-repair",
    async () => {
      await fresh.query(
        "DELETE FROM schema_migrations WHERE version='20261001000000_production_financial_authority'",
      );
      const r = run(names[0]);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /MIGRATION_PREFLIGHT_FAILED/);
    },
  );
  const bad = await connect(names[2]);
  await bad.query(
    "CREATE TABLE commercial_quote_requests(id text PRIMARY KEY)",
  );
  await check(
    "incompatible legacy table fails before recording prerequisite or deleting data",
    async () => {
      const r = run(names[2], {
        DB_MIGRATION_FRESH_INSTALL: "EXPLICITLY_AUTHORIZED",
      });
      assert.equal(r.status, 1);
      assert.equal(
        (
          await bad.query(
            "SELECT count(*)::int AS n FROM schema_migrations WHERE version=$1",
            [prereq],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await bad.query(
            "SELECT data_type FROM information_schema.columns WHERE table_name='commercial_quote_requests' AND column_name='id'",
          )
        ).rows[0].data_type,
        "text",
      );
    },
  );
  console.log(
    "RECOVERY_POSTGRES_COUNTS " + JSON.stringify({ passed, failed: 0 }),
  );
} finally {
  for (const c of clients) await c.end();
  for (const name of created.reverse())
    await admin.query('DROP DATABASE "' + name + '"');
  await admin.end();
  rmSync(directory, { recursive: true, force: true });
}
