import { compareWholesale, selectRecentOffers } from "./matching.js";
import {
  EvidenceAuthority,
  canonicalFacts,
  type EvidenceReceipt,
} from "../phase20/evidence.js";
import {
  qualify,
  validatePlan,
  defaultPolicy,
  type JobPlan,
  type PlanEvidence,
  type QualificationPolicy,
} from "./model.js";
import { EvidenceJournal, type JournalEntry } from "./journal.js";
import {
  validateBatch,
  restrictedNetworks,
  type DiscoveryBatch,
} from "./adapters.js";
export interface Proposal {
  plan: JobPlan;
  evidence: PlanEvidence;
}
const factKeys = new Set([
  "planDigest",
  "fundsReserved",
  "fundingState",
  "amountMinor",
  "externalEventId",
  "contractuallyCommitted",
  "customerApproved",
  "currency",
  "committedPriceMinor",
  "eligible",
  "subcontractingPermitted",
  "provider",
  "termsReference",
  "fulfillmentVerified",
  "available",
  "priceFirm",
  "offerId",
  "rentalMinor",
  "coveredHours",
  "allCostsIncluded",
  "taxReviewed",
  "fxVerified",
  "discoveryDigest",
]);
function validateReceipt(receipt: EvidenceReceipt) {
  if (
    !receipt ||
    Object.keys(receipt).some(
      (k) => !["issuer", "signature", "payload"].includes(k),
    ) ||
    typeof receipt.signature !== "string" ||
    receipt.signature.length > 128 ||
    typeof receipt.issuer !== "string" ||
    receipt.issuer.length > 128
  )
    throw Error("INVALID_RECEIPT");
  const payload = receipt.payload;
  if (
    !payload ||
    Object.keys(payload).some(
      (k) =>
        ![
          "kind",
          "subjectId",
          "accountId",
          "origin",
          "sourceUrl",
          "observedAt",
          "expiresAt",
          "facts",
        ].includes(k),
    ) ||
    !payload.facts ||
    Object.keys(payload.facts).some((k) => !factKeys.has(k))
  )
    throw Error("INVALID_RECEIPT");
  const { facts, ...metadata } = payload;
  canonicalFacts(metadata);
  canonicalFacts(facts);
}
const proposals = (entries: readonly JournalEntry[]) =>
  entries.filter((e) => e.kind === "PROPOSAL").map((e) => e.data as Proposal);
const stopped = (entries: readonly JournalEntry[]) =>
  entries.some((e) => e.kind === "STOP");
export class PrefundedHunter {
  constructor(
    private readonly journal: EvidenceJournal,
    private readonly authority = new EvidenceAuthority(),
    private readonly policy: QualificationPolicy = defaultPolicy,
  ) {}
  async recordDiscovery(batch: DiscoveryBatch) {
    validateBatch(batch);
    return this.journal.transaction(async (entries, append) => {
      if (stopped(entries)) throw Error("DISCOVERY_STOPPED");
      if (
        entries.some(
          (e) =>
            e.kind === "DISCOVERY" &&
            (e.data as DiscoveryBatch).evidence.responseDigest ===
              batch.evidence.responseDigest &&
            (e.data as DiscoveryBatch).adapter === batch.adapter &&
            (e.data as DiscoveryBatch).evidence.retrievedAt ===
              batch.evidence.retrievedAt,
        )
      )
        return { code: "DUPLICATE_EVIDENCE" };
      await append("DISCOVERY", batch);
      return { code: "EVIDENCE_ARCHIVED" };
    });
  }
  async propose(input: Proposal, now = Date.now()) {
    if (!input || Object.keys(input).sort().join(",") !== "evidence,plan")
      throw Error("INVALID_PROPOSAL");
    validatePlan(input.plan);
    if (
      !input.evidence ||
      Object.keys(input.evidence).sort().join(",") !==
        "contract,costs,eligibility,funding,requirements,supplier"
    )
      throw Error("INVALID_EVIDENCE");
    for (const receipt of Object.values(input.evidence)) {
      validateReceipt(receipt);
      canonicalFacts(receipt.payload.facts);
    }
    return this.journal.transaction(async (entries, append) => {
      if (stopped(entries)) throw Error("DISCOVERY_STOPPED");
      if (proposals(entries).length >= 100)
        throw Error("PROPOSAL_CAPACITY_REACHED");
      if (
        proposals(entries).some(
          (p) => p.plan.opportunityId === input.plan.opportunityId,
        )
      )
        throw Error("DUPLICATE_ORDER");
      const event = input.evidence.funding.payload.facts.externalEventId;
      if (
        event &&
        proposals(entries).some(
          (p) => p.evidence.funding.payload.facts.externalEventId === event,
        )
      )
        throw Error("DUPLICATE_FUNDING_EVENT");
      const result = this.assess(input, entries, now);
      await append("PROPOSAL", input);
      return result;
    });
  }
  private assess(
    input: Proposal,
    entries: readonly JournalEntry[],
    now: number,
  ) {
    const result = qualify(
      input.plan,
      input.evidence,
      this.authority,
      this.policy,
      now,
    );
    const batches = entries
      .filter((e) => e.kind === "DISCOVERY")
      .map((e) => e.data as DiscoveryBatch);
    const candidate = batches
      .flatMap((b) => b.candidates)
      .filter((c) => c.id === input.plan.opportunityId)
      .at(-1);
    const offer = batches
      .flatMap((b) => b.offers)
      .filter(
        (o) =>
          o.id === input.plan.offerId && o.provider === input.plan.provider,
      )
      .at(-1);
    if (
      !candidate ||
      Date.parse(candidate.expiresAt) <= now ||
      input.evidence.contract.payload.facts.discoveryDigest !==
        candidate.evidenceDigest
    )
      result.reasons.push("FRESH_DISCOVERED_ORDER_REQUIRED");
    if (
      !offer ||
      Date.parse(offer.expiresAt) <= now ||
      input.evidence.supplier.payload.facts.discoveryDigest !==
        offer.evidenceDigest
    )
      result.reasons.push("FRESH_DISCOVERED_OFFER_REQUIRED");
    if (
      offer &&
      (offer.model !== input.plan.gpuModel ||
        offer.gpuCount !== input.plan.gpuCount)
    )
      result.reasons.push("HARDWARE_MISMATCH");
    if (offer?.vramGb != null && offer.vramGb < input.plan.vramGb)
      result.reasons.push("VRAM_MISMATCH");
    if (stopped(entries)) result.reasons.push("KILL_SWITCH_ENGAGED");
    return {
      ...result,
      status: result.reasons.length
        ? ("REJECTED" as const)
        : ("QUALIFIED_FOR_OWNER_REVIEW" as const),
      riskScore: result.reasons.length
        ? Math.min(100, 50 + 5 * result.reasons.length)
        : 25,
    };
  }
  async review(
    digest: string,
    decision: "APPROVE_REVIEW" | "REJECT",
    now = Date.now(),
  ) {
    if (
      !/^[a-f0-9]{64}$/.test(digest) ||
      !["APPROVE_REVIEW", "REJECT"].includes(decision)
    )
      throw Error("INVALID_REVIEW");
    return this.journal.transaction(async (entries, append) => {
      if (
        entries.some(
          (e) =>
            e.kind === "REVIEW" &&
            (e.data as { digest: string }).digest === digest,
        )
      )
        throw Error("ALREADY_REVIEWED");
      const proposal = proposals(entries).find(
        (p) =>
          qualify(p.plan, p.evidence, this.authority, this.policy, now)
            .digest === digest,
      );
      if (!proposal) throw Error("PROPOSAL_NOT_FOUND");
      const assessment = this.assess(proposal, entries, now);
      if (
        decision === "APPROVE_REVIEW" &&
        assessment.status !== "QUALIFIED_FOR_OWNER_REVIEW"
      )
        throw Error("REVIEW_BLOCKED");
      await append("REVIEW", {
        digest,
        decision,
        financialExecutionAllowed: false,
      });
      return {
        code: "OWNER_REVIEW_RECORDED",
        financialExecutionAllowed: false,
      };
    });
  }
  async stop() {
    return this.journal.transaction(async (entries, append) => {
      if (!stopped(entries)) await append("STOP", { reason: "OWNER_STOP" });
      return { engaged: true, financialExecutionAllowed: false };
    });
  }
  async snapshot(now = Date.now()) {
    return this.journal.transaction(async (entries) => {
      const batches = entries
        .filter((e) => e.kind === "DISCOVERY")
        .map((e) => e.data as DiscoveryBatch);
      const assessments = proposals(entries).map((p) =>
        this.assess(p, entries, now),
      );
      const reviews = entries
        .filter((e) => e.kind === "REVIEW")
        .map((e) => e.data as { digest: string; decision: string });
      const latest = <T extends { id: string }>(items: T[]) => [
        ...new Map(items.map((item) => [item.id, item])).values(),
      ];
      return {
        mode: "READ_ONLY",
        financialExecutionAllowed: false,
        killSwitchEngaged: stopped(entries),
        archive: "LOCAL_HASH_CHAIN",
        durableExternalArchiveVerified: false,
        verifiedOpportunities: assessments.filter(
          (a) => a.status === "QUALIFIED_FOR_OWNER_REVIEW",
        ),
        rejectedOpportunities: assessments.filter(
          (a) => a.status === "REJECTED",
        ),
        approvalQueue: assessments.filter(
          (a) =>
            a.status === "QUALIFIED_FOR_OWNER_REVIEW" &&
            !reviews.some((r) => r.digest === a.digest),
        ),
        reviews,
        candidates: latest(batches.flatMap((b) => b.candidates))
          .slice(-500)
          .map((c) => ({
            ...c,
            stale: Date.parse(c.expiresAt) <= now,
            rejectionReasons: [
              Date.parse(c.expiresAt) <= now
                ? "STALE_SOURCE_EVIDENCE"
                : "FUNDING_CONTRACT_AND_REQUIREMENTS_UNVERIFIED",
            ],
            requirements: {
              durationHours: null,
              currency: null,
              maximumContractPriceMinor: null,
              providerEligibility: "UNVERIFIED",
              hardware: null,
              vramGb: null,
              bandwidthMbps: null,
              region: null,
              uptimeBps: null,
            },
          })),
        indicativeComparisons: proposals(entries).flatMap((p) =>
          compareWholesale(
            p.plan,
            latest(batches.flatMap((b) => b.offers)),
            this.policy,
            now,
          ).slice(0, 10),
        ),
        wholesaleMatches: selectRecentOffers(
          latest(batches.flatMap((b) => b.offers)),
          now,
        ).map((o) => ({
          ...o,
          stale: Date.parse(o.expiresAt) <= now,
        })),
        realizedRevenue: { status: "NOT_CONNECTED", amountMinor: null },
        projectedRevenue: "PER_QUALIFIED_PLAN_ONLY",
        restrictedNetworks,
        policy: this.policy,
        independentCollectorsConfigured: false,
        audit: entries.slice(-100).map((e) => ({
          sequence: e.sequence,
          kind: e.kind,
          at: e.at,
          digest: e.digest,
          previousDigest: e.previousDigest,
        })),
      };
    });
  }
}
