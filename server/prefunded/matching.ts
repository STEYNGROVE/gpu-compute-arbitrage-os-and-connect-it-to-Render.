import type { JobPlan, Offer, QualificationPolicy } from "./model.js";
import { validatePlan, defaultPolicy } from "./model.js";
/** Indicative screening only: catalog prices do not establish duration, reservation, all-in costs or eligibility.
 * Costs are in the plan currency's minor units. Catalog USD cannot be mixed with another currency without FX evidence.
 */
export function compareWholesale(
  plan: JobPlan,
  offers: readonly Offer[],
  policy: QualificationPolicy = defaultPolicy,
  now = Date.now(),
) {
  validatePlan(plan);
  const otherCosts =
    plan.setupMinor +
    plan.commissionMinor +
    plan.transactionMinor +
    plan.conversionMinor +
    plan.slippageMinor +
    plan.networkMinor +
    plan.storageMinor +
    plan.transferMinor +
    plan.contingencyMinor +
    plan.taxMinor;
  return offers
    .map((offer, index) => {
      const observed = Date.parse(offer.retrievedAt);
      return {
        offer,
        index,
        time:
          Number.isFinite(observed) && observed <= now ? observed : -Infinity,
      };
    })
    .sort((a, b) =>
      a.time === b.time ? a.index - b.index : a.time > b.time ? -1 : 1,
    )
    .slice(0, 500)
    .map(({ offer }) => {
      const reasons: string[] = [];
      const observed = Date.parse(offer.retrievedAt),
        expires = Date.parse(offer.expiresAt);
      if (
        !Number.isFinite(observed) ||
        !Number.isFinite(expires) ||
        observed > now ||
        expires <= now ||
        now - observed > 60000
      )
        reasons.push("STALE_QUOTE");
      if (offer.model !== plan.gpuModel || offer.gpuCount !== plan.gpuCount)
        reasons.push("HARDWARE_MISMATCH");
      if (offer.vramGb != null && offer.vramGb < plan.vramGb)
        reasons.push("VRAM_MISMATCH");
      if (plan.currency !== "USD") reasons.push("VERIFIED_FX_REQUIRED");
      if (
        !Number.isFinite(offer.hourlyUsd) ||
        offer.hourlyUsd <= 0 ||
        !Number.isSafeInteger(
          Math.ceil(offer.hourlyUsd * 100 * plan.durationHours),
        )
      )
        reasons.push("INVALID_PRICE");
      const rentalMinor =
        reasons.includes("VERIFIED_FX_REQUIRED") ||
        reasons.includes("INVALID_PRICE")
          ? null
          : Math.ceil(offer.hourlyUsd * 100 * plan.durationHours);
      const estimatedNetMinor =
        rentalMinor === null
          ? null
          : plan.committedPriceMinor - rentalMinor - otherCosts;
      const marginBps =
        estimatedNetMinor === null
          ? null
          : Math.floor((estimatedNetMinor * 10000) / plan.committedPriceMinor);
      if (
        estimatedNetMinor !== null &&
        (estimatedNetMinor < policy.minNetMinor ||
          marginBps! < policy.minMarginBps)
      )
        reasons.push("NET_PROFIT_BELOW_THRESHOLD");
      return {
        opportunityId: plan.opportunityId,
        currency: plan.currency,
        offerId: offer.id,
        provider: offer.provider,
        rentalMinor,
        otherCostsMinor: otherCosts,
        estimatedNetMinor,
        marginBps,
        screeningPassed: reasons.length === 0,
        reasons: [...reasons, "FIRM_QUOTE_AND_FULFILLMENT_EVIDENCE_REQUIRED"],
        financialExecutionAllowed: false as const,
      };
    })
    .sort(
      (a, b) =>
        Number(b.screeningPassed) - Number(a.screeningPassed) ||
        ((a.estimatedNetMinor ?? -Infinity) ===
        (b.estimatedNetMinor ?? -Infinity)
          ? 0
          : (a.estimatedNetMinor ?? -Infinity) >
              (b.estimatedNetMinor ?? -Infinity)
            ? -1
            : 1),
    );
}
