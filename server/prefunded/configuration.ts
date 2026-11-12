import { defaultPolicy, type QualificationPolicy } from "./model.js";
/** Non-secret, fail-closed screening configuration. No financial activation option exists. */
export function configuredHunterPolicy(
  env: Record<string, string | undefined>,
): QualificationPolicy {
  const read = (name: string, fallback: number, min: number, max: number) => {
    const raw = env[name];
    if (raw === undefined) return fallback;
    if (!/^[0-9]{1,13}$/.test(raw)) throw Error("INVALID_HUNTER_POLICY");
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max)
      throw Error("INVALID_HUNTER_POLICY");
    return value;
  };
  return {
    minNetMinor: read(
      "PREFUNDED_MIN_NET_MINOR",
      defaultPolicy.minNetMinor,
      1,
      1e12,
    ),
    minMarginBps: read(
      "PREFUNDED_MIN_MARGIN_BPS",
      defaultPolicy.minMarginBps,
      1,
      10000,
    ),
    maxEvidenceAgeMs: read(
      "PREFUNDED_MAX_EVIDENCE_AGE_MS",
      defaultPolicy.maxEvidenceAgeMs,
      1,
      300000,
    ),
  };
}
