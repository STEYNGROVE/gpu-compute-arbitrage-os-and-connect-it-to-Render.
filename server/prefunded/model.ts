import {
  EvidenceAuthority,
  canonicalFacts,
  sha256,
  integer,
  reference,
  safePublicReference,
  type EvidenceReceipt,
} from "../phase20/evidence.js";

export type Funding = "UNVERIFIED" | "FUNDED" | "AWARDED" | "SETTLED" | "PAID";
export interface Candidate {
  id: string;
  source: "akash" | "enterprise";
  sourceUrl: string;
  retrievedAt: string;
  expiresAt: string;
  evidenceDigest: string;
  title: string;
  funding: Funding;
  leadContext?: {
    organization: string | null;
    workloadRequirements: string | null;
    gpuRequirements: string | null;
    budgetMinor: number | null;
    currency: string | null;
    deadline: string | null;
    geographicRestrictions: string | null;
    eligibilityRequirements: string | null;
    contactRoute: string;
    qualificationStatus: "UNVERIFIED";
  };
  discoveredRequirements?: {
    gpuUnits: number;
    replicas: number;
    pricePerBlock: string | null;
    currencyDenom: string | null;
  }[];
}
export interface Offer {
  id: string;
  provider: "vast" | "runpod";
  sourceUrl: string;
  retrievedAt: string;
  expiresAt: string;
  evidenceDigest: string;
  model: string;
  gpuCount: number;
  hourlyUsd: number;
  availability: "OBSERVED" | "CATALOG_ONLY";
  vramGb?: number | null;
  bandwidthMbps?: number | null;
  region?: string | null;
  uptimeBps?: number | null;
}
export interface JobPlan {
  opportunityId: string;
  accountId: string;
  offerId: string;
  provider: "vast" | "runpod";
  currency: string;
  maximumPriceMinor: number;
  committedPriceMinor: number;
  fundedMinor: number;
  funding: Funding;
  durationHours: number;
  gpuModel: string;
  gpuCount: number;
  vramGb: number;
  bandwidthMbps: number;
  region: string;
  uptimeBps: number;
  workloadReference: string;
  // Every cost is mandatory. Zero requires an independent cost-policy attestation too.
  rentalMinor: number;
  setupMinor: number;
  commissionMinor: number;
  transactionMinor: number;
  conversionMinor: number;
  slippageMinor: number;
  networkMinor: number;
  storageMinor: number;
  transferMinor: number;
  contingencyMinor: number;
  taxMinor: number;
}
export interface QualificationPolicy {
  minNetMinor: number;
  minMarginBps: number;
  maxEvidenceAgeMs: number;
}
export const defaultPolicy: QualificationPolicy = {
  minNetMinor: 100,
  minMarginBps: 1000,
  maxEvidenceAgeMs: 300000,
};
export const planDigest = (plan: JobPlan) =>
  sha256(canonicalFacts({ ...plan }));
export interface PlanEvidence {
  contract: EvidenceReceipt;
  funding: EvidenceReceipt;
  requirements: EvidenceReceipt;
  eligibility: EvidenceReceipt;
  supplier: EvidenceReceipt;
  costs: EvidenceReceipt;
}
const costs = [
  "rentalMinor",
  "setupMinor",
  "commissionMinor",
  "transactionMinor",
  "conversionMinor",
  "slippageMinor",
  "networkMinor",
  "storageMinor",
  "transferMinor",
  "contingencyMinor",
  "taxMinor",
] as const;
const keys = new Set([
  "opportunityId",
  "accountId",
  "offerId",
  "provider",
  "currency",
  "maximumPriceMinor",
  "committedPriceMinor",
  "fundedMinor",
  "funding",
  "durationHours",
  "gpuModel",
  "gpuCount",
  "vramGb",
  "bandwidthMbps",
  "region",
  "uptimeBps",
  "workloadReference",
  ...costs,
]);
export function validatePlan(p: JobPlan) {
  if (
    !p ||
    Object.keys(p).length !== keys.size ||
    Object.keys(p).some((k) => !keys.has(k)) ||
    !reference(p.opportunityId) ||
    !reference(p.accountId) ||
    !reference(p.offerId) ||
    !["vast", "runpod"].includes(p.provider) ||
    !["USD", "EUR", "GBP", "ZAR"].includes(p.currency) ||
    !["UNVERIFIED", "FUNDED", "AWARDED", "SETTLED", "PAID"].includes(
      p.funding,
    ) ||
    !integer(p.maximumPriceMinor, 1e12) ||
    !integer(p.committedPriceMinor, 1e12) ||
    !integer(p.fundedMinor, 1e12) ||
    p.committedPriceMinor < 1 ||
    p.maximumPriceMinor < p.committedPriceMinor ||
    !Number.isFinite(p.durationHours) ||
    p.durationHours <= 0 ||
    p.durationHours > 8760 ||
    !integer(p.gpuCount, 1024) ||
    p.gpuCount < 1 ||
    !integer(p.vramGb, 4096) ||
    p.vramGb < 1 ||
    !integer(p.bandwidthMbps, 1e7) ||
    !integer(p.uptimeBps, 10000) ||
    !safePublicReference(p.workloadReference) ||
    !/^[A-Za-z0-9 _.-]{1,100}$/.test(p.gpuModel) ||
    !/^[A-Za-z0-9_-]{2,40}$/.test(p.region) ||
    costs.some((k) => !integer(p[k], 1e12))
  )
    throw Error("INVALID_PLAN");
  return p;
}
/** Attestations bind the complete plan, customer account, source, quote and all commercial assumptions.
 * There is deliberately no financial execution capability, including after owner review.
 */
export function qualify(
  plan: JobPlan,
  evidence: PlanEvidence,
  authority: EvidenceAuthority,
  policy = defaultPolicy,
  now = Date.now(),
) {
  validatePlan(plan);
  if (
    !integer(policy.minNetMinor, 1e12) ||
    policy.minNetMinor < 1 ||
    !integer(policy.minMarginBps, 10000) ||
    !integer(policy.maxEvidenceAgeMs, 300000) ||
    policy.maxEvidenceAgeMs < 1
  )
    throw Error("INVALID_POLICY");
  const digest = planDigest(plan),
    reasons: string[] = [];
  const checks = [
    ["contract", "CONTRACT"],
    ["funding", "PAYMENT"],
    ["requirements", "REQUIREMENT"],
    ["eligibility", "APPROVAL"],
    ["supplier", "SUPPLIER"],
    ["costs", "QUOTE"],
  ] as const;
  const assessments = checks.map(([name, kind]) => {
    const receipt = evidence?.[name];
    const review = authority.assess(
      receipt,
      kind,
      plan.opportunityId,
      plan.accountId,
      now,
      policy.maxEvidenceAgeMs,
    );
    if (
      review.status !== "VERIFIED" ||
      receipt?.payload?.facts?.planDigest !== digest
    )
      reasons.push(name.toUpperCase() + "_EVIDENCE_REQUIRED");
    return {
      name,
      sourceUrl: receipt?.payload?.sourceUrl ?? null,
      observedAt: receipt?.payload?.observedAt ?? null,
      expiresAt: receipt?.payload?.expiresAt ?? null,
      ...review,
    };
  });
  const f = (name: keyof PlanEvidence) =>
    evidence?.[name]?.payload?.facts || {};
  if (
    !["FUNDED", "AWARDED"].includes(plan.funding) ||
    plan.fundedMinor < plan.committedPriceMinor ||
    f("funding").fundsReserved !== true ||
    f("funding").fundingState !== plan.funding ||
    f("funding").amountMinor !== plan.fundedMinor ||
    f("funding").currency !== plan.currency ||
    !reference(f("funding").externalEventId)
  )
    reasons.push("FUNDING_NOT_SECURED_FOR_JOB");
  if (
    f("contract").contractuallyCommitted !== true ||
    f("contract").customerApproved !== true ||
    f("contract").currency !== plan.currency ||
    f("contract").committedPriceMinor !== plan.committedPriceMinor
  )
    reasons.push("COMMITTED_REVENUE_REQUIRED");
  if (
    f("eligibility").eligible !== true ||
    f("eligibility").subcontractingPermitted !== true ||
    f("eligibility").provider !== plan.provider ||
    !safePublicReference(String(f("eligibility").termsReference || ""))
  )
    reasons.push("PROVIDER_OR_CONTRACT_INELIGIBLE");
  if (f("requirements").fulfillmentVerified !== true)
    reasons.push("FULFILLMENT_NOT_VERIFIED");
  if (
    f("supplier").available !== true ||
    f("supplier").priceFirm !== true ||
    f("supplier").offerId !== plan.offerId ||
    f("supplier").provider !== plan.provider ||
    f("supplier").rentalMinor !== plan.rentalMinor ||
    f("supplier").currency !== plan.currency ||
    f("supplier").coveredHours !== plan.durationHours
  )
    reasons.push("FIRM_AVAILABLE_QUOTE_REQUIRED");
  if (
    f("costs").allCostsIncluded !== true ||
    f("costs").taxReviewed !== true ||
    f("costs").fxVerified !== true ||
    f("costs").currency !== plan.currency
  )
    reasons.push("COMPLETE_COST_AND_FX_REVIEW_REQUIRED");
  const totalCostMinor = costs.reduce((total, key) => total + plan[key], 0);
  const estimatedNetMinor = plan.committedPriceMinor - totalCostMinor;
  const marginBps = Math.floor(
    (estimatedNetMinor * 10000) / plan.committedPriceMinor,
  );
  if (estimatedNetMinor < policy.minNetMinor || marginBps < policy.minMarginBps)
    reasons.push("NET_PROFIT_BELOW_THRESHOLD");
  return {
    digest,
    plan,
    totalCostMinor,
    estimatedNetMinor,
    marginBps,
    reasons,
    assessments,
    status: reasons.length
      ? ("REJECTED" as const)
      : ("QUALIFIED_FOR_OWNER_REVIEW" as const),
    fundingConfidence:
      assessments.find((a) => a.name === "funding")?.status || "UNVERIFIED",
    providerEligibility:
      reasons.includes("PROVIDER_OR_CONTRACT_INELIGIBLE") ||
      reasons.includes("ELIGIBILITY_EVIDENCE_REQUIRED")
        ? "UNVERIFIED"
        : "VERIFIED",
    riskScore: reasons.length ? Math.min(100, 50 + reasons.length * 5) : 25,
    expiresAt: Math.min(
      ...checks.map(([name]) =>
        Date.parse(evidence?.[name]?.payload?.expiresAt || ""),
      ),
    ),
    projectedRevenueMinor: plan.committedPriceMinor,
    realizedRevenueMinor: null,
    financialExecutionAllowed: false as const,
  };
}
