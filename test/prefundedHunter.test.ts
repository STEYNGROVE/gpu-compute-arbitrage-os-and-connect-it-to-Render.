import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, writeFile, readdir, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import {
  EvidenceAuthority,
  receiptBytes,
  type EvidenceReceipt,
} from "../server/phase20/evidence.js";
import {
  qualify,
  planDigest,
  type JobPlan,
  type PlanEvidence,
} from "../server/prefunded/model.js";
import { EvidenceJournal } from "../server/prefunded/journal.js";
import { PrefundedHunter } from "../server/prefunded/service.js";
import { registerPrefundedHunter } from "../server/prefunded/routes.js";
import {
  AkashDiscoveryAdapter,
  EnterpriseRfqAdapter,
  VastWholesaleAdapter,
  RunpodWholesaleAdapter,
  validateBatch,
  type DiscoveryBatch,
} from "../server/prefunded/adapters.js";
import {
  readOfficial,
  type ReadTransport,
} from "../server/prefunded/transport.js";
const keys = generateKeyPairSync("ed25519");
const authority = new EvidenceAuthority(
  new Map([
    [
      "test-collector",
      {
        publicKeyPem: keys.publicKey
          .export({ type: "spki", format: "pem" })
          .toString(),
        kinds: [
          "CONTRACT",
          "PAYMENT",
          "REQUIREMENT",
          "APPROVAL",
          "SUPPLIER",
          "QUOTE",
        ] as const,
      },
    ],
  ]),
  "INDEPENDENT",
);
const now = Date.now();
const plan: JobPlan = {
  opportunityId: "sam:notice-0001",
  accountId: "customer-0001",
  offerId: "vast:offer-0001",
  provider: "vast",
  currency: "USD",
  maximumPriceMinor: 15000,
  committedPriceMinor: 10000,
  fundedMinor: 10000,
  funding: "FUNDED",
  durationHours: 10,
  gpuModel: "H100",
  gpuCount: 1,
  vramGb: 80,
  bandwidthMbps: 1000,
  region: "US",
  uptimeBps: 9900,
  workloadReference: "https://customer.example/workload-0001",
  rentalMinor: 3000,
  setupMinor: 100,
  commissionMinor: 200,
  transactionMinor: 100,
  conversionMinor: 50,
  slippageMinor: 50,
  networkMinor: 100,
  storageMinor: 100,
  transferMinor: 100,
  contingencyMinor: 500,
  taxMinor: 200,
};
const sourceDigest = "a".repeat(64),
  offerDigest = "b".repeat(64);
function fixture(p: JobPlan = structuredClone(plan), observed = now) {
  const facts: Record<
    keyof PlanEvidence,
    Record<string, string | number | boolean>
  > = {
    contract: {
      contractuallyCommitted: true,
      customerApproved: true,
      currency: p.currency,
      committedPriceMinor: p.committedPriceMinor,
      discoveryDigest: sourceDigest,
    },
    funding: {
      fundsReserved: true,
      fundingState: p.funding,
      amountMinor: p.fundedMinor,
      currency: p.currency,
      externalEventId: "funding-event-0001",
    },
    requirements: { fulfillmentVerified: true },
    eligibility: {
      eligible: true,
      subcontractingPermitted: true,
      provider: p.provider,
      termsReference: "https://supplier.example/terms",
    },
    supplier: {
      available: true,
      priceFirm: true,
      offerId: p.offerId,
      provider: p.provider,
      rentalMinor: p.rentalMinor,
      currency: p.currency,
      coveredHours: p.durationHours,
      discoveryDigest: offerDigest,
    },
    costs: {
      allCostsIncluded: true,
      taxReviewed: true,
      fxVerified: true,
      currency: p.currency,
    },
  };
  const kinds = {
    contract: "CONTRACT",
    funding: "PAYMENT",
    requirements: "REQUIREMENT",
    eligibility: "APPROVAL",
    supplier: "SUPPLIER",
    costs: "QUOTE",
  } as const;
  const evidence = {} as PlanEvidence;
  for (const name of Object.keys(kinds) as (keyof PlanEvidence)[]) {
    const receipt: EvidenceReceipt = {
      issuer: "test-collector",
      signature: "",
      payload: {
        kind: kinds[name],
        subjectId: p.opportunityId,
        accountId: p.accountId,
        origin: "INDEPENDENT_READ_ONLY",
        sourceUrl: "https://collector.example/receipts",
        observedAt: new Date(observed).toISOString(),
        expiresAt: new Date(observed + 60000).toISOString(),
        facts: { planDigest: planDigest(p), ...facts[name] },
      },
    };
    receipt.signature = sign(
      null,
      Buffer.from(receiptBytes(receipt)),
      keys.privateKey,
    ).toString("base64");
    evidence[name] = receipt;
  }
  return { plan: p, evidence };
}
function batch(): DiscoveryBatch {
  return {
    adapter: "test",
    candidates: [
      {
        id: plan.opportunityId,
        source: "enterprise",
        sourceUrl: "https://sam.gov/opp/notice-0001/view",
        retrievedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 60000).toISOString(),
        evidenceDigest: sourceDigest,
        title: "Synthetic GPU test requirement",
        funding: "UNVERIFIED",
      },
    ],
    offers: [
      {
        id: plan.offerId,
        provider: "vast",
        sourceUrl: "https://cloud.vast.ai/api/v0/bundles/",
        retrievedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 60000).toISOString(),
        evidenceDigest: offerDigest,
        model: "H100",
        gpuCount: 1,
        hourlyUsd: 3,
        availability: "OBSERVED",
      },
    ],
    evidence: {
      sourceUrl: "https://sam.gov/opportunities",
      retrievedAt: new Date(now).toISOString(),
      responseDigest: sourceDigest,
      notes: "SYNTHETIC TEST ONLY",
    },
    truncated: false,
    financialExecutionAllowed: false,
  };
}
async function lab(
  work: (hunter: PrefundedHunter, directory: string) => Promise<void>,
  trusted = true,
) {
  const directory = await mkdtemp(path.join(tmpdir(), "prefunded-test-"));
  try {
    await work(
      new PrefundedHunter(
        new EvidenceJournal(directory),
        trusted ? authority : new EvidenceAuthority(),
      ),
      directory,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test("all costs reduce committed revenue; contract maximum is never revenue", () => {
  const f = fixture(),
    r = qualify(f.plan, f.evidence, authority, undefined, now);
  assert.equal(r.totalCostMinor, 4500);
  assert.equal(r.estimatedNetMinor, 5500);
  assert.equal(r.projectedRevenueMinor, 10000);
  assert.equal(r.status, "QUALIFIED_FOR_OWNER_REVIEW");
  assert.equal(r.financialExecutionAllowed, false);
  assert.equal(r.realizedRevenueMinor, null);
});
test("default trust, forged signature, altered amount, simulation, stale, future and account mismatch fail closed", () => {
  for (const mode of [
    "default",
    "forged",
    "altered",
    "simulation",
    "stale",
    "future",
    "account",
  ]) {
    const f = fixture();
    if (mode === "forged") f.evidence.funding.signature = "x".repeat(88);
    if (mode === "altered") f.plan.rentalMinor++;
    if (mode === "simulation") f.evidence.funding.payload.origin = "SIMULATION";
    if (mode === "account")
      f.evidence.funding.payload.accountId = "other-account";
    const r = qualify(
      f.plan,
      f.evidence,
      mode === "default" ? new EvidenceAuthority() : authority,
      undefined,
      mode === "stale" ? now + 60000 : mode === "future" ? now - 1 : now,
    );
    assert.equal(r.status, "REJECTED", mode);
  }
});
test("unknown costs, nonfinite numbers, unsupported currency and invalid thresholds reject", () => {
  for (const field of ["taxMinor", "rentalMinor", "durationHours"]) {
    const p = { ...plan, [field]: NaN };
    assert.throws(() => fixture(p));
  }
  const f = fixture();
  assert.throws(() =>
    qualify({ ...f.plan, taxMinor: undefined }, f.evidence, authority),
  );
  assert.throws(() =>
    qualify({ ...f.plan, currency: "JPY" }, f.evidence, authority),
  );
  assert.throws(() =>
    qualify(f.plan, f.evidence, authority, {
      minNetMinor: 0,
      minMarginBps: 0,
      maxEvidenceAgeMs: 1,
    }),
  );
});
test("funding stages never substitute for job-specific reserved funds", () => {
  for (const funding of ["UNVERIFIED", "SETTLED", "PAID"] as const) {
    const f = fixture({ ...plan, funding });
    assert(
      qualify(f.plan, f.evidence, authority, undefined, now).reasons.includes(
        "FUNDING_NOT_SECURED_FOR_JOB",
      ),
    );
  }
  const f = fixture({ ...plan, fundedMinor: 1 });
  assert.equal(
    qualify(f.plan, f.evidence, authority, undefined, now).status,
    "REJECTED",
  );
});
test("negative net and net margin threshold reject even with positive gross spread", () => {
  const f = fixture({ ...plan, contingencyMinor: 9000 });
  assert(
    qualify(f.plan, f.evidence, authority, undefined, now).reasons.includes(
      "NET_PROFIT_BELOW_THRESHOLD",
    ),
  );
});
test("archive persists rejection and immutable snapshots, deduplicates discovery and orders", async () =>
  lab(async (hunter) => {
    assert.equal(
      (await hunter.recordDiscovery(batch())).code,
      "EVIDENCE_ARCHIVED",
    );
    assert.equal(
      (await hunter.recordDiscovery(batch())).code,
      "DUPLICATE_EVIDENCE",
    );
    const f = fixture();
    assert.equal((await hunter.propose(f, now)).status, "REJECTED");
    await assert.rejects(() => hunter.propose(f, now), /DUPLICATE_ORDER/);
    const s = await hunter.snapshot(now);
    assert.equal(s.rejectedOpportunities.length, 1);
    assert.equal(s.realizedRevenue.amountMinor, null);
    await assert.rejects(
      () =>
        hunter.review(s.rejectedOpportunities[0].digest, "APPROVE_REVIEW", now),
      /REVIEW_BLOCKED/,
    );
  }, false));
test("trusted evidence, quote binding, owner decision and recheck on expiration", async () =>
  lab(async (hunter) => {
    await hunter.recordDiscovery(batch());
    const r = await hunter.propose(fixture(), now);
    assert.equal(r.status, "QUALIFIED_FOR_OWNER_REVIEW");
    assert.equal((await hunter.snapshot(now)).approvalQueue.length, 1);
    assert.equal(
      (await hunter.review(r.digest, "APPROVE_REVIEW", now))
        .financialExecutionAllowed,
      false,
    );
    await assert.rejects(
      () => hunter.review(r.digest, "APPROVE_REVIEW", now),
      /ALREADY_REVIEWED/,
    );
    assert.equal(
      (await hunter.snapshot(now + 60000)).verifiedOpportunities.length,
      0,
    );
  }));
test("missing source or mismatch cannot qualify; review cannot authorize expired evidence", async () =>
  lab(async (hunter) => {
    const r = await hunter.propose(fixture(), now);
    assert(r.reasons.includes("FRESH_DISCOVERED_ORDER_REQUIRED"));
    await assert.rejects(() => hunter.review(r.digest, "APPROVE_REVIEW", now));
  }));
test("funding event cannot fund two orders and stale reviews cannot pass", async () =>
  lab(async (hunter) => {
    await hunter.recordDiscovery(batch());
    const r = await hunter.propose(fixture(), now);
    await assert.rejects(
      () =>
        hunter.propose(
          fixture({ ...plan, opportunityId: "sam:notice-0002" }),
          now,
        ),
      /DUPLICATE_FUNDING_EVENT/,
    );
    await assert.rejects(
      () => hunter.review(r.digest, "APPROVE_REVIEW", now + 60000),
      /REVIEW_BLOCKED/,
    );
  }));
test("concurrent independent journal writers produce at most one order and valid audit chain", async () =>
  lab(async (hunter, directory) => {
    await hunter.recordDiscovery(batch());
    const other = new PrefundedHunter(
      new EvidenceJournal(directory),
      authority,
    );
    const results = await Promise.allSettled([
      hunter.propose(fixture(), now),
      other.propose(fixture(), now),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await hunter.snapshot(now)).audit.length, 2);
  }));
test("corruption, disk failure and stranded lock block assessment without falling back to memory", async () =>
  lab(async (hunter, directory) => {
    await hunter.recordDiscovery(batch());
    const file = (await readdir(directory)).find((f) => f.endsWith(".json"))!;
    await rm(path.join(directory, file));
    await writeFile(path.join(directory, file), "{}");
    await assert.rejects(() => hunter.snapshot(), /ARCHIVE_CORRUPTED/);
    await mkdir(path.join(directory, ".lock"));
    await assert.rejects(() => hunter.snapshot(), /ARCHIVE_BUSY/);
    await assert.rejects(() =>
      new PrefundedHunter(
        new EvidenceJournal("/dev/null/not-writable"),
      ).snapshot(),
    );
  }));
test("kill switch survives restart and blocks discovery, proposals and approval", async () =>
  lab(async (hunter, directory) => {
    await hunter.recordDiscovery(batch());
    const r = await hunter.propose(fixture(), now);
    await hunter.stop();
    const restarted = new PrefundedHunter(
      new EvidenceJournal(directory),
      authority,
    );
    assert.equal((await restarted.snapshot(now)).killSwitchEngaged, true);
    await assert.rejects(() => restarted.recordDiscovery(batch()), /STOPPED/);
    await assert.rejects(() => restarted.propose(fixture()), /STOPPED/);
    await assert.rejects(
      () => restarted.review(r.digest, "APPROVE_REVIEW", now),
      /BLOCKED/,
    );
  }));
const transport =
  (data: unknown, operations: string[]): ReadTransport =>
  async (req) => {
    operations.push(req.operation);
    return {
      data,
      sourceUrl: "https://source.example/api",
      retrievedAt: new Date().toISOString(),
    };
  };
test("Vast adapter preserves actual observed prices without inferring firm quotes or eligibility", async () => {
  const operations: string[] = [];
  const b = await new VastWholesaleAdapter(
    transport(
      {
        offers: [
          {
            id: 1,
            gpu_name: "H100",
            num_gpus: 1,
            dph_total: 2.75,
            rentable: true,
            rented: false,
          },
        ],
      },
      operations,
    ),
  ).discover("synthetic-key");
  assert.equal(b.offers[0].hourlyUsd, 2.75);
  assert.deepEqual(operations, ["vastOffers"]);
  assert.equal(b.offers[0].availability, "OBSERVED");
  assert.equal(b.financialExecutionAllowed, false);
});
test("Runpod remains catalog-only even with stock; missing prices are never invented", async () => {
  const b = await new RunpodWholesaleAdapter(
    transport(
      {
        data: {
          gpuTypes: [
            {
              id: "NVIDIA H100",
              displayName: "H100",
              lowestPrice: { uninterruptablePrice: 2.9, stockStatus: "High" },
            },
            { id: "empty" },
          ],
        },
      },
      [],
    ),
  ).discover();
  assert.equal(b.offers.length, 1);
  assert.equal(b.offers[0].availability, "CATALOG_ONLY");
  assert.equal(b.offers[0].hourlyUsd, 2.9);
});
test("enterprise RFQs and Akash open orders never become funded from discovery", async () => {
  const b = await new EnterpriseRfqAdapter(
    transport(
      {
        opportunitiesData: [
          {
            noticeId: "notice-1",
            active: "Yes",
            title: "GPU compute RFQ",
            responseDeadLine: new Date(now + 600000).toISOString(),
          },
        ],
      },
      [],
    ),
  ).discover("synthetic", "11/01/2026", "11/12/2026");
  assert.equal(b.candidates[0].funding, "UNVERIFIED");
  const ops: string[] = [];
  const t: ReadTransport = async (req) => {
    ops.push(req.operation);
    return {
      data:
        req.operation === "akashOrders"
          ? {
              orders: [
                {
                  id: {
                    owner: "akash1example",
                    dseq: "1",
                    gseq: 1,
                    oseq: 1,
                  },
                  state: "open",
                  spec: {
                    resources: [
                      {
                        resource: { gpu: { units: { val: "1" } } },
                        count: 1,
                        price: { amount: "1.0", denom: "uakt" },
                      },
                    ],
                  },
                },
              ],
            }
          : { deployments: [] },
      sourceUrl: "https://source.example/api",
      retrievedAt: new Date().toISOString(),
    };
  };
  const a = await new AkashDiscoveryAdapter(t).discover();
  assert.equal(a.candidates[0].funding, "UNVERIFIED");
  assert.deepEqual(ops, ["akashOrders", "akashDeployments"]);
});
test("schema errors, stale response, unavailable sources and unsupported network operations fail closed", async () => {
  await assert.rejects(() =>
    new VastWholesaleAdapter(transport({}, [])).discover("synthetic"),
  );
  await assert.rejects(() =>
    new RunpodWholesaleAdapter(
      transport({ errors: [{ message: "secret upstream detail" }] }, []),
    ).discover(),
  );
  await assert.rejects(() =>
    new AkashDiscoveryAdapter(async () => {
      throw Error("source down");
    }).discover(),
  );
  assert.throws(() =>
    validateBatch(
      {
        ...batch(),
        candidates: [
          {
            ...batch().candidates[0],
            expiresAt: new Date(now - 1).toISOString(),
          },
        ],
      },
      now,
    ),
  );
  await assert.rejects(() => readOfficial({ operation: "purchase" as any }));
});
test("unknown receipt fields are rejected before any archival write", async () =>
  lab(async (hunter) => {
    const f = fixture();
    f.evidence.costs.payload.facts.secret = "synthetic-sensitive-value";
    await assert.rejects(() => hunter.propose(f), /INVALID_RECEIPT/);
    assert.equal((await hunter.snapshot()).audit.length, 0);
  }));
test("HTTP owner isolation, CSRF, malformed JSON, secret-safe failures and no execution route", async () =>
  lab(async (hunter) => {
    process.env.NODE_ENV = "test";
    process.env.DISABLE_JSON_PERSISTENCE = "true";
    process.env.OWNER_API_KEY = "prefunded-synthetic-owner-key";
    delete process.env.DATABASE_URL;
    const { requireOwnerAuth, createBrowserSession } =
      await import("../server/auth.js");
    const app = express();
    let collectorCalls = 0;
    registerPrefundedHunter(app, requireOwnerAuth, hunter, async () => {
      collectorCalls++;
      throw Error("PRIVATE-UPSTREAM-KEY");
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((r) =>
      server.listening ? r() : server.once("listening", r),
    );
    const address = server.address();
    assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/owner/prefunded-hunter`;
    const owner = {
      "X-Owner-Api-Key": process.env.OWNER_API_KEY,
      "Content-Type": "application/json",
    };
    try {
      for (const headers of [
        {},
        { "X-Owner-Api-Key": "invalid" },
        {
          "X-Session-Id": createBrowserSession("CUSTOMER", "customer")
            .sessionId,
        },
      ]) {
        assert.equal((await fetch(base, { headers })).status, 403);
        for (const route of ["/discover", "/proposals", "/review", "/stop"])
          assert.equal(
            (
              await fetch(base + route, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: "{}",
              })
            ).status,
            403,
          );
      }
      assert.equal(collectorCalls, 0);
      const snapshot = await fetch(base, { headers: owner });
      assert.equal(snapshot.status, 200);
      assert.equal(snapshot.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await snapshot.json()) as any).financialExecutionAllowed,
        false,
      );
      assert.equal(
        (
          await fetch(base + "/discover", {
            method: "POST",
            headers: { ...owner, Origin: "https://attacker.example" },
            body: '{"adapter":"akash"}',
          })
        ).status,
        403,
      );
      const failure = await fetch(base + "/discover", {
        method: "POST",
        headers: owner,
        body: '{"adapter":"akash"}',
      });
      assert.equal(failure.status, 409);
      assert(!(await failure.text()).includes("PRIVATE-UPSTREAM-KEY"));
      const malformed = await fetch(base + "/proposals", {
        method: "POST",
        headers: owner,
        body: '{"secret":"hidden"',
      });
      assert.equal(malformed.status, 400);
      assert(!(await malformed.text()).includes("hidden"));
      assert.equal(
        (
          await fetch(base + "/execute", {
            method: "POST",
            headers: owner,
            body: "{}",
          })
        ).status,
        404,
      );
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }));

test("wholesale comparison includes every ancillary cost, rejects stale/hardware mismatch and refuses invented FX", async () => {
  const { compareWholesale } = await import("../server/prefunded/matching.js");
  const offer = batch().offers[0];
  const r = compareWholesale(plan, [offer], undefined, now)[0];
  assert.equal(r.rentalMinor, 3000);
  assert.equal(r.otherCostsMinor, 1500);
  assert.equal(r.estimatedNetMinor, 5500);
  assert.equal(r.screeningPassed, true);
  assert.equal(r.financialExecutionAllowed, false);
  assert(r.reasons.includes("FIRM_QUOTE_AND_FULFILLMENT_EVIDENCE_REQUIRED"));
  assert.equal(
    compareWholesale({ ...plan, currency: "ZAR" }, [offer], undefined, now)[0]
      .estimatedNetMinor,
    null,
  );
  assert(
    compareWholesale(
      plan,
      [{ ...offer, gpuCount: 8 }],
      undefined,
      now,
    )[0].reasons.includes("HARDWARE_MISMATCH"),
  );
  assert(
    compareWholesale(plan, [offer], undefined, now + 60000)[0].reasons.includes(
      "STALE_QUOTE",
    ),
  );
});
test("independent OS processes cannot create duplicate opportunities", async () =>
  lab(async (hunter, directory) => {
    const { spawn } = await import("node:child_process");
    await hunter.recordDiscovery(batch());
    const input = path.join(directory, "synthetic-input");
    await writeFile(input, JSON.stringify(fixture()));
    const script = `import {readFileSync} from 'node:fs';import {PrefundedHunter} from './server/prefunded/service.ts';import {EvidenceJournal} from './server/prefunded/journal.ts';const h=new PrefundedHunter(new EvidenceJournal(process.env.HUNTER_TEST_DIR));h.propose(JSON.parse(readFileSync(process.env.HUNTER_TEST_INPUT,'utf8'))).then(()=>{process.exitCode=0;}).catch(()=>{process.exitCode=2;});`;
    const child = () =>
      new Promise<number>((resolve, reject) => {
        const p = spawn(
          process.execPath,
          ["--import", "tsx", "--input-type=module", "-e", script],
          {
            env: {
              ...process.env,
              HUNTER_TEST_DIR: directory,
              HUNTER_TEST_INPUT: input,
            },
            stdio: "ignore",
          },
        );
        p.on("error", reject);
        p.on("exit", (code) => resolve(code ?? -1));
      });
    const results = await Promise.all([child(), child()]);
    assert.equal(results.filter((code) => code === 0).length, 1);
    assert.equal(results.filter((code) => code === 2).length, 1);
    assert.equal(
      (await hunter.snapshot()).audit.filter((e) => e.kind === "PROPOSAL")
        .length,
      1,
    );
  }));

test("screening thresholds are configurable with positive bounded values and no activation switch", async () => {
  const { configuredHunterPolicy } =
    await import("../server/prefunded/configuration.js");
  assert.equal(
    configuredHunterPolicy({ PREFUNDED_MIN_NET_MINOR: "250" }).minNetMinor,
    250,
  );
  for (const raw of ["0", "-1", "NaN", "1.5", "Infinity", "1000000000001"])
    assert.throws(() =>
      configuredHunterPolicy({ PREFUNDED_MIN_NET_MINOR: raw }),
    );
  assert.throws(() =>
    configuredHunterPolicy({ PREFUNDED_MAX_EVIDENCE_AGE_MS: "300001" }),
  );
});

test("unchanged upstream data may be freshly reobserved without reviving an expired observation", async () =>
  lab(async (hunter) => {
    const first = batch();
    await hunter.recordDiscovery(first);
    const second = structuredClone(first);
    second.evidence.retrievedAt = new Date(
      Date.parse(first.evidence.retrievedAt) - 1,
    ).toISOString();
    assert.equal(
      (await hunter.recordDiscovery(second)).code,
      "EVIDENCE_ARCHIVED",
    );
    assert.equal((await hunter.snapshot(now)).audit.length, 2);
  }));

test("independently signed negative facts still reject eligibility, firm price, fulfillment and complete costs", () => {
  for (const [name, key, value, reason] of [
    [
      "eligibility",
      "subcontractingPermitted",
      false,
      "PROVIDER_OR_CONTRACT_INELIGIBLE",
    ],
    ["supplier", "priceFirm", false, "FIRM_AVAILABLE_QUOTE_REQUIRED"],
    ["supplier", "coveredHours", 1, "FIRM_AVAILABLE_QUOTE_REQUIRED"],
    ["requirements", "fulfillmentVerified", false, "FULFILLMENT_NOT_VERIFIED"],
    ["costs", "taxReviewed", false, "COMPLETE_COST_AND_FX_REVIEW_REQUIRED"],
    ["costs", "fxVerified", false, "COMPLETE_COST_AND_FX_REVIEW_REQUIRED"],
    ["contract", "contractuallyCommitted", false, "COMMITTED_REVENUE_REQUIRED"],
  ] as const) {
    const f = fixture();
    const receipt = f.evidence[name];
    receipt.payload.facts[key] = value;
    receipt.signature = sign(
      null,
      Buffer.from(receiptBytes(receipt)),
      keys.privateKey,
    ).toString("base64");
    assert(
      qualify(f.plan, f.evidence, authority, undefined, now).reasons.includes(
        reason,
      ),
    );
  }
});

test("public diagnostic maps actual transport rows and cannot promote fixture data or failed reads to funding", async () => {
  const { probePrefundedPublic } =
    await import("../scripts/probePrefundedPublic.js");
  const operations: string[] = [];
  const report = await probePrefundedPublic(async (request) => {
    operations.push(request.operation);
    if (request.operation !== "runpodCatalog") throw Error("SOURCE_HTTP_501");
    return {
      sourceUrl: "https://api.runpod.io/graphql",
      retrievedAt: new Date().toISOString(),
      data: {
        data: {
          gpuTypes: [
            {
              id: "synthetic-gpu",
              displayName: "Fixture GPU",
              memoryInGb: 24,
              lowestPrice: { uninterruptablePrice: 1.23 },
            },
          ],
        },
      },
    };
  });
  assert.equal(report.origin, "OFFLINE_INJECTED");
  assert.equal(report.financialExecutionAllowed, false);
  assert.equal(report.fundedCustomerOpportunitiesVerified, 0);
  assert.equal(
    report.escrowFundingVerification,
    "NOT_IMPLEMENTED_NO_TRUSTED_COLLECTOR",
  );
  assert.equal(report.results[0].normalizedOffers, 1);
  assert.equal(report.results[0].samples[0].hourlyUsd, 1.23);
  assert.equal(report.results[1].status, "BLOCKED");
  assert.deepEqual(operations, [
    "runpodCatalog",
    "akashOrders",
    "akashDeployments",
  ]);
});
test("dashboard renders and backend/dashboard/navigation/test entrypoints are wired", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { PrefundedHunterDashboard } =
    await import("../src/components/PrefundedHunterDashboard.js");
  const { readFile } = await import("node:fs/promises");
  const html = renderToStaticMarkup(
    React.createElement(PrefundedHunterDashboard),
  );
  assert(html.includes("Pre-Funded GPU Job Hunter"));
  assert(html.includes("Financial execution stays disabled"));
  const backend = await readFile("server.ts", "utf8");
  assert(backend.includes("registerPrefundedHunter(app, requireOwnerAuth)"));
  assert(
    (await readFile("src/App.tsx", "utf8")).includes(
      "activeTab === 'prefunded_hunter'",
    ),
  );
  assert(
    (await readFile("src/components/Header.tsx", "utf8")).includes(
      "id: 'prefunded_hunter'",
    ),
  );
  assert(
    JSON.parse(await readFile("package.json", "utf8")).scripts.test.includes(
      "npm run test:prefunded",
    ),
  );
});

test("public Akash diagnostics distinguish readable open GPU orders from verified escrow funding", async () => {
  const { probePrefundedPublic } =
    await import("../scripts/probePrefundedPublic.js");
  const report = await probePrefundedPublic(async (request) => {
    if (request.operation === "runpodCatalog") throw Error("SOURCE_HTTP_503");
    return {
      sourceUrl: "https://api.akashnet.net/akash",
      retrievedAt: new Date().toISOString(),
      data:
        request.operation === "akashOrders"
          ? {
              orders: [
                {
                  id: {
                    owner: "akash1synthetic",
                    dseq: "123",
                    gseq: 1,
                    oseq: 1,
                  },
                  state: "open",
                  spec: {
                    resources: [{ resource: { gpu: { units: { val: "1" } } } }],
                  },
                },
              ],
            }
          : { deployments: [] },
    };
  });
  assert.equal(report.results[1].observedRecords, 1);
  assert.equal(report.results[1].openGpuOrdersUnverified, 1);
  assert.equal(report.results[1].orderSamples[0].funding, "UNVERIFIED");
  assert.equal(report.fundedCustomerOpportunitiesVerified, 0);
  assert.equal(
    report.escrowFundingVerification,
    "NOT_IMPLEMENTED_NO_TRUSTED_COLLECTOR",
  );
});
