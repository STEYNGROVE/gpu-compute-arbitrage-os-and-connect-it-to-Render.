import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EnterpriseRfqAdapter,
  validateBatch,
} from "../server/prefunded/adapters.js";
import { compareWholesale } from "../server/prefunded/matching.js";
import { createHunterSnapshotSession } from "../src/services/hunterSnapshotSession.js";
import type { JobPlan, Offer } from "../server/prefunded/model.js";
import { loadDevelopmentMigrationEnvironment } from "../scripts/migrationEnvironment.js";
const plan: JobPlan = {
  opportunityId: "sam:test-order",
  accountId: "customer-fixture",
  offerId: "vast:fixture",
  provider: "vast",
  currency: "USD",
  maximumPriceMinor: 12000,
  committedPriceMinor: 10000,
  fundedMinor: 10000,
  funding: "FUNDED",
  durationHours: 1,
  gpuModel: "H100",
  gpuCount: 1,
  vramGb: 80,
  bandwidthMbps: 100,
  region: "US",
  uptimeBps: 9900,
  workloadReference: "https://example.org/workload",
  rentalMinor: 100,
  setupMinor: 0,
  commissionMinor: 0,
  transactionMinor: 0,
  conversionMinor: 0,
  slippageMinor: 0,
  networkMinor: 0,
  storageMinor: 0,
  transferMinor: 0,
  contingencyMinor: 100,
  taxMinor: 0,
};
const now = Date.now();
const offer = (id: string, time = now): Offer => ({
  id,
  provider: "vast",
  sourceUrl: "https://cloud.vast.ai/api/v0/bundles/",
  retrievedAt: new Date(time).toISOString(),
  expiresAt: new Date(time + 60000).toISOString(),
  evidenceDigest: "a".repeat(64),
  model: "H100",
  gpuCount: 1,
  hourlyUsd: 10,
  availability: "OBSERVED",
});
test("expired, missing, invalid and timezone-ambiguous SAM notices cannot poison valid batch", async () => {
  const dates = [
    new Date(now - 60000).toISOString(),
    undefined,
    "bad-date",
    "2026-02-30T00:00:00Z",
    "2030-01-01T12:00:00",
    new Date(now + 3600000).toISOString(),
    "2030-01-01T12:00:00+02:00",
  ];
  const b = await new EnterpriseRfqAdapter(async () => ({
    sourceUrl: "https://api.sam.gov/opportunities/v2/search",
    retrievedAt: new Date().toISOString(),
    data: {
      opportunitiesData: dates.map((responseDeadLine, i) => ({
        noticeId: "notice-" + i,
        active: "Yes",
        title: "GPU RFQ",
        responseDeadLine,
      })),
    },
  })).discover("synthetic", "11/01/2026", "11/12/2026");
  assert.equal(b.candidates.length, 2);
  assert.doesNotThrow(() => validateBatch(b));
  assert(b.candidates.every((c) => c.funding === "UNVERIFIED"));
});
test("newest valid observations are selected before 500 cap without mutating original or promoting invalid future dates", () => {
  const old = Array.from({ length: 600 }, (_, i) =>
    offer("vast:old-" + i, now - 120000),
  );
  const fresh = offer("vast:fresh", now);
  const invalid = { ...offer("vast:invalid"), retrievedAt: "invalid" };
  const future = offer("vast:future", now + 1);
  const source = [...old, invalid, future, fresh];
  const r = compareWholesale(plan, source, undefined, now);
  assert.equal(r.length, 500);
  assert.equal(r[0].offerId, fresh.id);
  assert.equal(r[0].screeningPassed, true);
  assert.equal(source[0], old[0]);
  assert(!r.some((x) => x.offerId === invalid.id || x.offerId === future.id));
});
test("screening pass outranks cheaper mismatches; equal timestamps and net remain stable", () => {
  const bad = Array.from({ length: 12 }, (_, i) => ({
    ...offer("vast:bad-" + i),
    model: "WRONG",
    hourlyUsd: 0.01,
  }));
  const valid = offer("vast:valid");
  const equal = offer("vast:equal");
  const r = compareWholesale(plan, [...bad, valid, equal], undefined, now);
  assert.equal(r[0].offerId, valid.id);
  assert.equal(r[1].offerId, equal.id);
  assert.equal(r[0].financialExecutionAllowed, false);
});
const snapshot = {
  mode: "READ_ONLY",
  financialExecutionAllowed: false,
  ...Object.fromEntries(
    [
      "verifiedOpportunities",
      "rejectedOpportunities",
      "approvalQueue",
      "candidates",
      "wholesaleMatches",
      "indicativeComparisons",
      "reviews",
      "restrictedNetworks",
      "audit",
    ].map((k) => [k, []]),
  ),
};
test("dashboard mount/refresh session coalesces pending requests and accepts empty review queue", async () => {
  let resolve!: (v: Response) => void,
    calls = 0;
  const data: unknown[] = [],
    busy: boolean[] = [];
  const s = createHunterSnapshotSession({
    fetcher: (async () => {
      calls++;
      return new Promise((r) => (resolve = r));
    }) as typeof fetch,
    onData: (v) => data.push(v),
    onBusy: (v) => busy.push(v),
    onError: () => {},
  });
  const mount = s.run(),
    refresh = s.run();
  assert.equal(mount, refresh);
  assert.equal(calls, 1);
  resolve(new Response(JSON.stringify(snapshot)));
  assert.equal(await mount, true);
  assert.equal(data.length, 1);
  assert.deepEqual(busy, [true, false]);
  s.close();
});
test("unmount aborts work and prevents state updates; expiry clears sensitive stale data without exposing API bodies", async () => {
  let resolve!: (v: Response) => void, signal: AbortSignal;
  const changes: unknown[] = [];
  const s = createHunterSnapshotSession({
    fetcher: (async (_u, options) => {
      signal = options.signal;
      return new Promise((r) => (resolve = r));
    }) as typeof fetch,
    onData: (v) => changes.push(v),
    onBusy: (v) => changes.push(v),
    onError: (v) => changes.push(v),
  });
  const promise = s.run();
  s.close();
  const before = changes.length;
  resolve(new Response(JSON.stringify(snapshot)));
  assert.equal(await promise, false);
  assert(signal!.aborted);
  assert.equal(changes.length, before);
  const errors: string[] = [],
    values: unknown[] = [];
  const expired = createHunterSnapshotSession({
    fetcher: (async () =>
      new Response("PRIVATE_DETAIL", { status: 401 })) as typeof fetch,
    onData: (v) => values.push(v),
    onBusy: () => {},
    onError: (v) => errors.push(v),
  });
  assert.equal(await expired.run(), false);
  assert.deepEqual(values, [null]);
  assert(errors.some((e) => e.includes("session expired")));
  assert(!JSON.stringify(errors).includes("PRIVATE_DETAIL"));
  expired.close();
});
test("dashboard rejects unsafe response and never retries a mutation automatically", async () => {
  let calls = 0;
  const errors: string[] = [];
  const s = createHunterSnapshotSession({
    fetcher: (async () => {
      calls++;
      return new Response(
        JSON.stringify({ ...snapshot, financialExecutionAllowed: true }),
      );
    }) as typeof fetch,
    onData: () => {},
    onBusy: () => {},
    onError: (v) => errors.push(v),
  });
  assert.equal(await s.run("/review", { digest: "synthetic" }), false);
  assert.equal(calls, 2);
  assert(errors.some(Boolean));
  s.close();
  assert.equal(await s.run(), false);
  assert.equal(calls, 2);
});
test("only explicit local development loads env files; test/staging/production/Render/CI never do", () => {
  for (const NODE_ENV of ["test", "staging", "production", undefined])
    assert.equal(loadDevelopmentMigrationEnvironment({ NODE_ENV }), false);
  assert.equal(
    loadDevelopmentMigrationEnvironment({
      NODE_ENV: "development",
      RENDER: "true",
    }),
    false,
  );
  assert.equal(
    loadDevelopmentMigrationEnvironment({
      NODE_ENV: "development",
      CI: "true",
    }),
    false,
  );
});

test("public certification does not require historical revenue; financial modes have no activation switch", async () => {
  const { certifyLaunchModes, publicLaunchGates, releaseOperatingMode } =
    await import("../server/launchRecovery/modes.js");
  assert.equal(certifyLaunchModes({}).publicCommercialLaunch.decision, "NO-GO");
  const gates = Object.fromEntries(
    publicLaunchGates.map((gate) => [
      gate,
      {
        status: "VERIFIED" as const,
        independent: true,
        evidence: "fixture-independent-evidence-not-production",
      },
    ]),
  );
  const decision = certifyLaunchModes(gates);
  assert.equal(decision.publicCommercialLaunch.decision, "GO");
  assert.equal(
    decision.publicCommercialLaunch.historicalRevenueRequired,
    false,
  );
  assert.equal(decision.verifiedOrderOperations.activationAllowed, false);
  assert.equal(decision.automatedFinancialExecution.activationAllowed, false);
  for (const mode of [
    "VERIFIED_ORDER_OPERATIONS",
    "AUTOMATED_FINANCIAL_EXECUTION",
    "LIVE",
  ]) {
    const state = releaseOperatingMode(mode);
    assert.equal(state.configurationAccepted, false);
    assert.equal(state.financialExecutionAllowed, false);
  }
  gates.database.independent = false;
  assert.equal(
    certifyLaunchModes(gates).publicCommercialLaunch.decision,
    "NO-GO",
  );
});

test("Akash unsupported service uses only the documented read-only compatibility query and never verifies funding", async () => {
  const { AkashDiscoveryAdapter } =
    await import("../server/prefunded/adapters.js");
  const operations: string[] = [];
  const adapter = new AkashDiscoveryAdapter(async (request) => {
    operations.push(request.operation);
    if (request.operation === "akashDeployments")
      throw Error("SOURCE_HTTP_501");
    return {
      sourceUrl: "https://api.akashnet.net/akash",
      retrievedAt: new Date().toISOString(),
      data:
        request.operation === "akashOrders"
          ? {
              orders: [
                {
                  id: { owner: "akash1fixture", dseq: "1", gseq: 1, oseq: 1 },
                  state: "open",
                  spec: {
                    resources: [
                      {
                        resource: { gpu: { units: { val: "1" } } },
                        count: 1,
                        price: { amount: "1", denom: "uakt" },
                      },
                    ],
                  },
                },
              ],
            }
          : { deployments: [] },
    };
  });
  const batch = await adapter.discover();
  assert.deepEqual(operations, [
    "akashOrders",
    "akashDeployments",
    "akashDeploymentsV1Beta4",
  ]);
  assert.equal(batch.candidates[0].funding, "UNVERIFIED");
  assert.equal(batch.financialExecutionAllowed, false);
  const failures: string[] = [];
  await assert.rejects(() =>
    new AkashDiscoveryAdapter(async (request) => {
      failures.push(request.operation);
      throw Error("SOURCE_READ_FAILED");
    }).discover(),
  );
  assert.deepEqual(failures, ["akashOrders"]);
});

test("migration CLI actually loads development-only .env gates without bootstrap and never loads them in test/staging/production", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } =
    await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const directory = mkdtempSync(path.join(tmpdir(), "migration-env-")),
    script = path.resolve("scripts/migrateDatabase.ts");
  mkdirSync(path.join(directory, "supabase", "migrations"), {
    recursive: true,
  });
  writeFileSync(
    path.join(directory, "supabase", "migrations", "fixture.sql"),
    "SELECT 1;",
  );
  writeFileSync(
    path.join(directory, ".env"),
    "DB_MIGRATION_EXECUTE=EXPLICITLY_AUTHORIZED\n",
  );
  try {
    for (const NODE_ENV of ["development", "test", "staging", "production"]) {
      const env = { ...process.env, NODE_ENV };
      for (const key of Object.keys(env))
        if (
          key.startsWith("DB_MIGRATION_") ||
          [
            "RENDER",
            "CI",
            "DATABASE_URL",
            "DIRECT_URL",
            "SUPABASE_DB_URL",
            "POSTGRES_URL",
          ].includes(key)
        )
          delete env[key];
      const result = spawnSync(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), script],
        { cwd: directory, env, encoding: "utf8", timeout: 10000 },
      );
      assert.ifError(result.error);
      if (NODE_ENV === "development") {
        assert.equal(result.status, 1);
        assert.match(result.stderr, /MIGRATION_BLOCKED/);
      } else {
        assert.equal(result.status, 0);
        assert.match(result.stdout, /VALIDATION ONLY/);
      }
      assert(!result.stdout.includes("[BOOTSTRAP]"));
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy Akash estimator cannot fabricate inventory, spot prices or a live wholesale quote", async () => {
  const { AkashProvider } =
    await import("../server/providers/akashProvider.js");
  const provider = new AkashProvider();
  assert.deepEqual(await provider.discoverGPUs(), []);
  assert.deepEqual(await provider.getLivePricing(), []);
});
test("shared supplier transport never propagates raw upstream credentials in errors", async () => {
  const { VastAiProvider } =
    await import("../server/providers/vastProvider.js");
  const provider = new VastAiProvider();
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw Error("Authorization: Bearer PRIVATE_SUPPLIER_VALUE");
  }) as typeof fetch;
  try {
    await assert.rejects(
      (provider as any).safeFetch("https://cloud.vast.ai/api/v0/bundles/"),
      (e: Error) =>
        e.message.includes("SUPPLIER_NETWORK_UNAVAILABLE") &&
        !e.message.includes("PRIVATE_SUPPLIER_VALUE"),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("enterprise lead context preserves published organization and deadline while refusing invented budget, requirements or eligibility", async () => {
  const b = await new EnterpriseRfqAdapter(async () => ({
    sourceUrl: "https://api.sam.gov/opportunities/v2/search",
    retrievedAt: new Date().toISOString(),
    data: {
      opportunitiesData: [
        {
          noticeId: "real-source-fixture",
          active: "Yes",
          title: "GPU RFQ",
          fullParentPathName: "Published fixture agency",
          responseDeadLine: new Date(Date.now() + 3600000).toISOString(),
          typeOfSetAsideDescription: "Published fixture category",
        },
      ],
    },
  })).discover("synthetic", "11/01/2026", "11/12/2026");
  const context = b.candidates[0].leadContext!;
  assert.equal(context.organization, "Published fixture agency");
  assert.equal(context.budgetMinor, null);
  assert.equal(context.gpuRequirements, null);
  assert.equal(context.qualificationStatus, "UNVERIFIED");
  assert.equal(context.contactRoute, b.candidates[0].sourceUrl);
  assert.equal(b.candidates[0].funding, "UNVERIFIED");
});

test("catalog window also includes a freshly reobserved historical offer ID ahead of 500 older records", async () => {
  const { selectRecentOffers } =
    await import("../server/prefunded/matching.js");
  const old = Array.from({ length: 600 }, (_, i) =>
    offer("vast:history-" + i, now - 120000),
  );
  const map = new Map(old.map((item) => [item.id, item]));
  const refreshed = {
    ...old[0],
    retrievedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60000).toISOString(),
  };
  map.set(refreshed.id, refreshed);
  const values = [...map.values()];
  const selected = selectRecentOffers(values, now);
  assert.equal(selected.length, 500);
  assert.equal(selected[0], refreshed);
  assert.equal(values[1], old[1]);
  assert.equal(
    compareWholesale(plan, values, undefined, now)[0].offerId,
    refreshed.id,
  );
});

test("legacy Lightning never substitutes static examples for failed live supplier data", async () => {
  const { LightningProvider } =
    await import("../server/providers/lightningProvider.js");
  const provider = new LightningProvider();
  const previous = {
    LIGHTNING_API_KEY: process.env.LIGHTNING_API_KEY,
    LIGHTNING_USER_ID: process.env.LIGHTNING_USER_ID,
  };
  process.env.LIGHTNING_API_KEY = "synthetic-read-key";
  process.env.LIGHTNING_USER_ID = "synthetic-user";
  (provider as any).safeFetch = async () => new Response("{}", { status: 503 });
  try {
    assert.deepEqual(await provider.discoverGPUs(), []);
    assert.deepEqual(await provider.getLivePricing(), []);
  } finally {
    for (const [key, value] of Object.entries(previous))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});
test("missing Hyperstack prices cannot be calculated from GPU count; genuine hourly rows retain unknown costs and stock", async () => {
  const { HyperstackProvider } =
    await import("../server/providers/hyperstackProvider.js");
  const p = new HyperstackProvider(),
    previous = process.env.HYPERSTACK_API_KEY;
  process.env.HYPERSTACK_API_KEY = "synthetic-read-key";
  (p as any).safeFetch = async () =>
    new Response(
      JSON.stringify({
        flavors: [
          {
            id: "missing-price",
            gpu_name: "H100",
            gpu_memory: 80,
            gpu_count: 8,
          },
          {
            id: "published-price",
            gpu_name: "H100",
            gpu_memory: 80,
            gpu_count: 1,
            cost_per_hr: 2,
          },
        ],
      }),
    );
  try {
    const rows = await p.getLivePricing();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].hourlyPrice, 2);
    assert.equal(rows[0].startupCost, null);
    assert.equal(rows[0].cpuPriceHourly, null);
    assert.equal(rows[0].spotPriceHourly, undefined);
    assert.equal(rows[0].additionalChargesVerified, false);
    assert.equal(rows[0].availability, "UNKNOWN");
  } finally {
    if (previous === undefined) delete process.env.HYPERSTACK_API_KEY;
    else process.env.HYPERSTACK_API_KEY = previous;
  }
});
test("manual payment booleans and customer max-price budgets cannot pass financial preflight or trigger supplier calls", async () => {
  const { providerRegistry } =
    await import("../server/providers/providerRegistry.js");
  const result = await providerRegistry.executePreflightChecklist({
    providerId: "vast_ai",
    gpuModel: "H100",
    maxHourlyPriceUsd: 1,
    expectedRevenueUsd: 10000,
    jobDurationHours: 1,
    customerPaymentAuthorized: true,
    maxCostLimitUsd: 1000,
    maxLossLimitUsd: 0,
  });
  assert.equal(result.pass, false);
  assert(
    result.reasons.includes(
      "INDEPENDENT_PAYMENT_AND_FIRM_ALL_IN_SUPPLIER_QUOTE_REQUIRED",
    ),
  );
});

test("supplier connectivity cannot certify production readiness or turn unknown costs into free charges", async () => {
  const { ProviderRegistry } =
    await import("../server/providers/providerRegistry.js");
  const registry = new ProviderRegistry();
  (registry as any).providers = new Map([
    [
      "vast_ai",
      {
        id: "vast_ai",
        name: "Synthetic fixture",
        healthCheck: async () => ({
          providerId: "vast_ai",
          authenticated: true,
          status: "LIVE",
        }),
      },
    ],
  ]);
  const method = Object.getOwnPropertyNames(ProviderRegistry.prototype).find(
    (name) => /readiness/i.test(name),
  );
  assert(method, "readiness API exists");
  const report = await (registry as any)[method!]();
  assert.equal(report.overallProductionReady, false);
  assert.equal(report.readinessScope, "CONNECTIVITY_ONLY");
  assert.equal(report.financialExecutionAllowed, false);
});
