/** Release decisions are distinct from activation. This release has no financial activation capability. */
export const publicLaunchGates = [
  "codeQuality",
  "tests",
  "security",
  "database",
  "github",
  "render",
  "authentication",
  "gpuDiscovery",
  "customerAcquisition",
  "quotation",
  "financialSafeguards",
  "monitoring",
  "operations",
] as const;
export type LaunchGate = (typeof publicLaunchGates)[number];
export interface GateEvidence {
  status: "VERIFIED" | "BLOCKED" | "UNVERIFIED";
  evidence: string;
  independent: boolean;
}
export function certifyLaunchModes(
  evidence: Partial<Record<LaunchGate, GateEvidence>>,
) {
  const missing = publicLaunchGates.filter(
    (gate) =>
      evidence[gate]?.status !== "VERIFIED" ||
      evidence[gate]?.independent !== true ||
      !evidence[gate]?.evidence,
  );
  return {
    publicCommercialLaunch: {
      mode: "A",
      decision: missing.length ? "NO-GO" : "GO",
      blockingGates: missing,
      automaticFinancialExecution: false,
      registration: "OWNER_CONTROLLED",
      historicalRevenueRequired: false,
    },
    verifiedOrderOperations: {
      mode: "B",
      decision: "NO-GO",
      activationAllowed: false,
      reason:
        "INDEPENDENT_ORDER_PAYMENT_SUPPLIER_FULFILLMENT_EVIDENCE_AND_EXPLICIT_OWNER_AUTHORIZATION_REQUIRED",
    },
    automatedFinancialExecution: {
      mode: "C",
      decision: "NO-GO",
      activationAllowed: false,
      reason:
        "SEPARATE_AUDITED_FINANCIAL_RELEASE_AND_EXPLICIT_OWNER_AUTHORIZATION_REQUIRED",
    },
  } as const;
}
export function releaseOperatingMode(requested: string | undefined) {
  return {
    requested: requested ?? "DISCOVERY_ONLY",
    active: "DISCOVERY_ONLY",
    publicCommercialCapabilities: [
      "MARKETING",
      "ENQUIRIES",
      "READ_ONLY_LEADS",
      "SUPPLIER_CATALOGS",
      "INDICATIVE_QUOTES",
      "OWNER_SALES_REVIEW",
    ],
    financialExecutionAllowed: false,
    verifiedOrderActivationAllowed: false,
    automatedFinancialActivationAllowed: false,
    configurationAccepted:
      requested === undefined || requested === "DISCOVERY_ONLY",
  } as const;
}
