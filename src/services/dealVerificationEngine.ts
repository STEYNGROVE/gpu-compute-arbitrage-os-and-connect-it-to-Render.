import { 
  DemandOrder, 
  ProviderOffer, 
  Opportunity, 
  CostBreakdown, 
  HardRuleCheck, 
  MonetizationLevel, 
  OwnerConfig, 
  OpportunityGrade,
  getGpuWorkloadSpec
} from '../types';

export interface DealVerificationInput {
  demand: DemandOrder;
  offer: ProviderOffer;
  monetizationLevel: MonetizationLevel;
  ownerConfig: OwnerConfig;
  currentlyDeployedCapital: number;
  spentToday: number;
  humanApprovedBigJobs?: Set<string>;
}

export class DealVerificationEngine {
  /**
   * Calculates realistic 7-pillar cost breakdown
   */
  static calculateCostBreakdown(
    demand: DemandOrder,
    offer: ProviderOffer,
    monetizationLevel: MonetizationLevel,
    isWorstCase: boolean = false
  ): CostBreakdown {
    const durationHours = demand.durationHours * (isWorstCase ? 1.15 : 1.0); // 15% slippage in worst case
    const gpuCount = demand.gpuCount;

    // 1. Raw compute cost
    const computeCost = offer.hourlyPrice * durationHours * gpuCount;

    // 2. Storage cost (monthly rate amortized to hours)
    const storageGb = Math.max(offer.storageGb, 100);
    const storageCost = (storageGb * offer.storagePricePerGbMo / 730) * durationHours * (isWorstCase ? 1.3 : 1.0);

    // 3. Bandwidth egress cost (estimated 15GB to 80GB depending on level)
    const estimatedGbPerGpuHr = monetizationLevel === 1 ? 4 : monetizationLevel === 2 ? 8 : 15;
    const totalGb = estimatedGbPerGpuHr * durationHours * gpuCount * (isWorstCase ? 1.6 : 1.0);
    const bandwidthCost = totalGb * offer.bandwidthPricePerGb;

    // 4. Provider platform & booking fees (approx 1.5% to 2.5%)
    const providerFeeRate = offer.provider === 'vast_ai' ? 0.02 : 0.015;
    const providerFees = computeCost * providerFeeRate;

    // 5. Payment processing & settlement fee (Binance Treasury / Escrow Settlement)
    const grossRevenue = this.calculateGrossRevenue(demand, monetizationLevel);
    const paymentProcessingFee = (grossRevenue * 0.029) + 0.30;

    // 6. Tax / duties contingency (estimated 0% for B2B digital export, or 1% contingency)
    const taxDutyCost = isWorstCase ? grossRevenue * 0.01 : 0;

    // 7. Interruption / failover / reboot risk cost
    const failureProb = (1 - offer.reliabilityScore) * (offer.interruptionRisk === 'spot_interruptible' ? 2.5 : 1.0);
    const expectedFailureCost = isWorstCase 
      ? computeCost * Math.max(0.08, failureProb * 2.0)
      : computeCost * failureProb;

    // 8. Refund / dispute contingency
    const refundContingency = isWorstCase ? grossRevenue * 0.04 : grossRevenue * 0.015;

    const totalLandedCost = computeCost + storageCost + bandwidthCost + providerFees + paymentProcessingFee + taxDutyCost + expectedFailureCost + refundContingency;

    return {
      computeCost: Math.round(computeCost * 100) / 100,
      storageCost: Math.round(storageCost * 100) / 100,
      bandwidthCost: Math.round(bandwidthCost * 100) / 100,
      providerFees: Math.round(providerFees * 100) / 100,
      paymentProcessingFee: Math.round(paymentProcessingFee * 100) / 100,
      taxDutyCost: Math.round(taxDutyCost * 100) / 100,
      expectedFailureCost: Math.round(expectedFailureCost * 100) / 100,
      refundContingency: Math.round(refundContingency * 100) / 100,
      totalLandedCost: Math.round(totalLandedCost * 100) / 100
    };
  }

  /**
   * Calculates actual binding gross revenue from customer demand contract.
   * Real economic rule: Revenue is strictly determined by the customer's binding contract price,
   * never by artificial mathematical multipliers.
   */
  static calculateGrossRevenue(demand: DemandOrder, _level: MonetizationLevel): number {
    const baseRevenue = demand.customerGrossOfferPrice > 0 
      ? demand.customerGrossOfferPrice 
      : demand.customerHourlyRate * demand.durationHours * demand.gpuCount;

    return Math.round(baseRevenue * 100) / 100;
  }

  /**
   * Performs independent deal verification and checks all hard financial policies
   */
  static verifyOpportunity(input: DealVerificationInput): Opportunity {
    const { demand, offer, monetizationLevel, ownerConfig, currentlyDeployedCapital, spentToday, humanApprovedBigJobs } = input;

    const grossRevenue = this.calculateGrossRevenue(demand, monetizationLevel);
    const expectedCosts = this.calculateCostBreakdown(demand, offer, monetizationLevel, false);
    const worstCaseCosts = this.calculateCostBreakdown(demand, offer, monetizationLevel, true);

    const expectedNetContribution = Math.round((grossRevenue - expectedCosts.totalLandedCost) * 100) / 100;
    const worstCaseNetContribution = Math.round((grossRevenue - worstCaseCosts.totalLandedCost) * 100) / 100;

    const expectedMarginPct = Math.round((expectedNetContribution / grossRevenue) * 1000) / 10;
    const worstCaseMarginPct = Math.round((worstCaseNetContribution / grossRevenue) * 1000) / 10;
    const roiPct = Math.round((expectedNetContribution / expectedCosts.totalLandedCost) * 1000) / 10;

    const capitalRequired = Math.round((offer.hourlyPrice * demand.durationHours * demand.gpuCount) * 100) / 100;

    // Hard Rule Checks
    const checks: HardRuleCheck[] = [];

    // Rule 1: Confirmed Demand Check
    const rule1Passed = demand.isConfirmed && demand.demandClass === 'CONFIRMED' && demand.paymentStatus !== 'MODEL_PREDICTED' && demand.paymentStatus !== 'QUOTE_PENDING';
    checks.push({
      id: 'RULE_1_CONFIRMED_DEMAND',
      name: 'Rule 1: Confirmed Executable Demand',
      ruleDescription: 'No verified demand = No automatic purchase. Requires escrow, contract, or prepaid credits.',
      passed: rule1Passed,
      actualValue: `${demand.demandClass} (${demand.paymentStatus})`,
      threshold: 'CONFIRMED with Verified Escrow/Credit',
      critical: true
    });

    // Rule 2: Positive Worst-Case Economics
    const rule2Passed = worstCaseNetContribution > 0;
    checks.push({
      id: 'RULE_2_WORST_CASE_PROFIT',
      name: 'Rule 2: Positive Worst-Case Net Contribution',
      ruleDescription: 'Worst-case scenario (with 15% slippage, burst egress, reboot cost, and dispute reserve) must remain profitable.',
      passed: rule2Passed,
      actualValue: `$${(worstCaseNetContribution ?? 0).toFixed(2)} (${worstCaseMarginPct ?? 0}%)`,
      threshold: '> $0.00 Net Contribution',
      critical: true
    });

    // Rule 3: Minimum Profit Threshold ($)
    const rule3Passed = expectedNetContribution >= ownerConfig.minProfitDollars;
    checks.push({
      id: 'RULE_3_MIN_PROFIT',
      name: 'Rule 3: Owner Minimum Profit Threshold',
      ruleDescription: `Net contribution must meet or exceed owner threshold of $${(ownerConfig.minProfitDollars ?? 0).toFixed(2)}.`,
      passed: rule3Passed,
      actualValue: `$${(expectedNetContribution ?? 0).toFixed(2)}`,
      threshold: `>= $${(ownerConfig.minProfitDollars ?? 0).toFixed(2)}`,
      critical: false
    });

    // Rule 4: Minimum Margin Threshold (%)
    const rule4Passed = expectedMarginPct >= ownerConfig.minMarginPct;
    checks.push({
      id: 'RULE_4_MIN_MARGIN',
      name: 'Rule 4: Owner Minimum Margin Threshold',
      ruleDescription: `Gross profit margin must meet or exceed owner threshold of ${ownerConfig.minMarginPct}%.`,
      passed: rule4Passed,
      actualValue: `${expectedMarginPct}%`,
      threshold: `>= ${ownerConfig.minMarginPct}%`,
      critical: false
    });

    // Rule 5: Capital Exposure Limits
    const remainingExposureBudget = ownerConfig.maxCapitalExposure - currentlyDeployedCapital;
    const remainingDailyBudget = ownerConfig.maxDailySpending - spentToday;
    const rule5Passed = capitalRequired <= remainingExposureBudget && capitalRequired <= remainingDailyBudget;
    checks.push({
      id: 'RULE_5_CAPITAL_LIMITS',
      name: 'Rule 5: Hard Capital Exposure Limits',
      ruleDescription: 'Transaction capital must not exceed available capital exposure cap or daily spend limit.',
      passed: rule5Passed,
      actualValue: `Req: $${(capitalRequired ?? 0).toFixed(2)} (Avail: $${Math.max(0, remainingExposureBudget || 0).toFixed(2)}, Day: $${Math.max(0, remainingDailyBudget || 0).toFixed(2)})`,
      threshold: `Cap <= $${ownerConfig.maxCapitalExposure} & Day <= $${ownerConfig.maxDailySpending}`,
      critical: true
    });

    // Rule 6: Approved Provider Whitelist
    const rule6Passed = ownerConfig.approvedProviders.includes(offer.provider);
    checks.push({
      id: 'RULE_6_APPROVED_PROVIDER',
      name: 'Rule 6: Approved Provider Whitelist',
      ruleDescription: 'Compute provider must be explicitly authorized by the owner.',
      passed: rule6Passed,
      actualValue: offer.provider,
      threshold: ownerConfig.approvedProviders.join(', '),
      critical: true
    });

    // Rule 7: Approved GPU Model Whitelist
    const rule7Passed = ownerConfig.approvedGpuModels.includes(offer.gpuModel);
    checks.push({
      id: 'RULE_7_APPROVED_GPU',
      name: 'Rule 7: Approved GPU Architecture',
      ruleDescription: 'GPU model must be explicitly authorized by the owner.',
      passed: rule7Passed,
      actualValue: offer.gpuModel,
      threshold: ownerConfig.approvedGpuModels.join(', '),
      critical: true
    });

    // Rule 8: Approved Workload Compliance
    const rule8Passed = ownerConfig.approvedWorkloads.includes(demand.workloadType);
    checks.push({
      id: 'RULE_8_APPROVED_WORKLOAD',
      name: 'Rule 8: Approved Workload Compliance',
      ruleDescription: 'Workload category must be compliant and authorized.',
      passed: rule8Passed,
      actualValue: demand.workloadType,
      threshold: ownerConfig.approvedWorkloads.join(', '),
      critical: true
    });

    // Rule 9: Interruption & SLA Risk Alignment
    const rule9Passed = !(offer.interruptionRisk === 'spot_interruptible' && demand.slaMinReliability >= 0.995);
    checks.push({
      id: 'RULE_9_SLA_ALIGNMENT',
      name: 'Rule 9: SLA & Interruption Risk Alignment',
      ruleDescription: 'Spot/interruptible compute is prohibited for mission-critical 99.5%+ SLA customer contracts.',
      passed: rule9Passed,
      actualValue: `${offer.interruptionRisk} vs SLA ${(demand.slaMinReliability * 100).toFixed(1)}%`,
      threshold: 'On-Demand for high SLA',
      critical: true
    });

    // Rule 10: Data Provenance & Live API Verification
    const isProvenanceSafe = !ownerConfig.requireLiveApiForAuto || (offer.isLiveApiVerified && offer.dataProvenance === 'LIVE_API_VERIFIED');
    checks.push({
      id: 'RULE_10_LIVE_API_PROVENANCE',
      name: 'Rule 10: Live Provider API Provenance Gate',
      ruleDescription: 'Auto-execution strictly prohibited on fallback/simulated market data feeds.',
      passed: isProvenanceSafe,
      actualValue: offer.dataProvenance || (offer.isLiveApiVerified ? 'LIVE_API_VERIFIED' : 'FALLBACK_MARKET_FEED'),
      threshold: 'LIVE_API_VERIFIED (Real Provider API Credential)',
      critical: true
    });

    // Rule 11: Human Approval Required for Big Jobs
    const oppId = `opp-${demand.id}-${offer.id}-L${monetizationLevel}`;
    const bigJobThreshold = Number(ownerConfig.humanApprovalThresholdUsd ?? 250);
    const requireBigJobApproval = ownerConfig.requireHumanApprovalForBigJobs !== false;
    const isBigJob = capitalRequired >= bigJobThreshold;
    const humanApproved = Boolean(humanApprovedBigJobs?.has(oppId) || demand.paymentStatus === 'SIGNED_CONTRACT' && humanApprovedBigJobs?.has(demand.id));
    const requiresHumanApproval = requireBigJobApproval && isBigJob && !humanApproved;
    const rule11Passed = !requiresHumanApproval;
    checks.push({
      id: 'RULE_11_BIG_JOB_HUMAN_APPROVAL',
      name: `Rule 11: Big Job Human Approval Gate ($${bigJobThreshold.toFixed(0)}+)`,
      ruleDescription: `Jobs requiring >= $${bigJobThreshold.toFixed(2)} capital require explicit human approval before execution.`,
      passed: rule11Passed,
      actualValue: isBigJob
        ? `Big Job ($${capitalRequired.toFixed(2)}) — ${humanApproved ? 'HUMAN_APPROVED' : 'AWAITING_HUMAN_APPROVAL'}`
        : `Standard Job ($${capitalRequired.toFixed(2)} < $${bigJobThreshold.toFixed(2)})`,
      threshold: `Capital < $${bigJobThreshold.toFixed(2)} or Human Approved`,
      critical: true
    });

    const allHardRulesPassed = checks.every(c => c.passed);

    // Classification Grade
    let grade: OpportunityGrade = 'REJECT';
    let gradeReason = '';

    if (!rule1Passed) {
      if (expectedNetContribution > 0 && expectedMarginPct >= ownerConfig.minMarginPct) {
        grade = 'WATCH';
        gradeReason = 'Strong economic spread detected, but held in WATCH because demand is not yet confirmed (Rule 1).';
      } else {
        grade = 'REJECT';
        gradeReason = 'Unconfirmed demand with suboptimal unit economics.';
      }
    } else if (requiresHumanApproval && worstCaseNetContribution > 0) {
      grade = 'REVIEW';
      gradeReason = `Big Job ($${capitalRequired.toFixed(2)} >= $${bigJobThreshold.toFixed(2)} threshold): Economically verified with ${roiPct.toFixed(1)}% ROI, held for mandatory Human Operator Approval before execution.`;
    } else if (allHardRulesPassed && worstCaseNetContribution > 0) {
      grade = 'AUTO';
      gradeReason = 'All hard safety rules passed. Confirmed demand with verified positive worst-case contribution and live API provenance.';
    } else if (rule1Passed && rule2Passed && !isProvenanceSafe) {
      grade = 'REVIEW';
      gradeReason = 'Economically verified with confirmed demand, but held for Review because compute offer originates from fallback market stream rather than live API.';
    } else if (rule1Passed && rule2Passed && (!rule3Passed || !rule4Passed || !rule5Passed || !rule6Passed || !rule7Passed || !rule8Passed || !rule9Passed)) {
      grade = 'REVIEW';
      gradeReason = 'Confirmed demand with positive worst-case economics, but flagged for Owner Review due to custom parameters or limit thresholds.';
    } else {
      grade = 'REJECT';
      gradeReason = 'Failed critical safety rules or negative worst-case contribution.';
    }

    const canAutoExecute = grade === 'AUTO' && isProvenanceSafe && allHardRulesPassed && !requiresHumanApproval;
    const autoExecutionBlockedReason = requiresHumanApproval
      ? `Big Job ($${capitalRequired.toFixed(2)} capital >= $${bigJobThreshold.toFixed(2)} threshold) requires explicit human approval before execution.`
      : !isProvenanceSafe 
        ? 'Market data originates from fallback feed. Real live API key verification required to execute automatically.'
        : undefined;

    const levelDescriptions: Record<MonetizationLevel, string> = {
      1: 'Level 1: Direct Compute Capacity Arbitrage (Buy GPU → Resell Compute)',
      2: 'Level 2: AI Workload & API Serving (Buy GPU → Serve Model/API → Bill Consumption)',
      3: 'Level 3: Finished Business Outcome (Buy GPU → Execute Full Pipeline → Sell Verified Artifact)'
    };

    // Calculate risk score (0-100, lower is safer)
    let riskScore = 15;
    if (offer.interruptionRisk === 'spot_interruptible') riskScore += 25;
    if (!demand.isConfirmed) riskScore += 35;
    if (worstCaseMarginPct < 15) riskScore += 20;
    if (demand.durationHours > 24) riskScore += 10;
    if (!offer.isLiveApiVerified) riskScore += 15;
    riskScore = Math.min(99, Math.max(5, riskScore));

    const confidenceScore = Math.round(
      (demand.customerReliabilityScore * 40) + 
      (offer.reliabilityScore * 35) + 
      (rule2Passed ? 25 : 0)
    );

    // PIPELINE A (Discovery) vs PIPELINE B (Capital / Execution Gate)
    const discoveryStatus = (expectedNetContribution > 0 && expectedMarginPct >= Math.min(8, ownerConfig.minMarginPct))
      ? 'PROFITABLE'
      : 'REJECTED';

    const isRunpodFunded = (offer.provider === 'runpod') && capitalRequired <= 15.00;
    const verifiedAvailableCapitalUsd = Math.max(0, Number(ownerConfig.liveCurrentBalance ?? 0), isRunpodFunded ? 15.00 : 0);
    const requiredCapitalUsd = Math.round(capitalRequired * 100) / 100;
    const capitalShortfallUsd = isRunpodFunded ? 0 : Math.max(0, Math.round((requiredCapitalUsd - verifiedAvailableCapitalUsd) * 100) / 100);

    const blockReasons: string[] = [];
    if (discoveryStatus === 'REJECTED') {
      blockReasons.push('MARGIN_BELOW_THRESHOLD');
    } else {
      if (capitalShortfallUsd > 0) {
        blockReasons.push('INSUFFICIENT_OPERATING_CAPITAL');
      }
      if (!rule1Passed) {
        blockReasons.push('CUSTOMER_VERIFICATION_REQUIRED');
        blockReasons.push('PAYMENT_VERIFICATION_REQUIRED');
      }
      if (!isProvenanceSafe && !isRunpodFunded) {
        blockReasons.push('PROVIDER_ACCOUNT_UNFUNDED');
      }
      if (!rule5Passed) {
        blockReasons.push('TREASURY_LIMIT_EXCEEDED');
      }
      if (ownerConfig.emergencyKillSwitchActive) {
        blockReasons.push('EMERGENCY_KILL_SWITCH_ACTIVE');
      }
      if (requiresHumanApproval) {
        blockReasons.push('HUMAN_APPROVAL_REQUIRED_FOR_BIG_JOB');
      }
    }

    let canonicalStatus: Opportunity['canonicalStatus'] = 'DISCOVERED';
    if (discoveryStatus === 'REJECTED') {
      canonicalStatus = 'REJECTED';
    } else if (blockReasons.length === 0) {
      canonicalStatus = 'EXECUTABLE';
    } else if (blockReasons.includes('INSUFFICIENT_OPERATING_CAPITAL') || blockReasons.includes('TREASURY_LIMIT_EXCEEDED')) {
      canonicalStatus = 'CAPITAL_BLOCKED';
    } else if (blockReasons.includes('PROVIDER_ACCOUNT_UNFUNDED')) {
      canonicalStatus = 'PROVIDER_BLOCKED';
    } else if (blockReasons.includes('CUSTOMER_VERIFICATION_REQUIRED') || blockReasons.includes('PAYMENT_VERIFICATION_REQUIRED')) {
      canonicalStatus = 'CUSTOMER_REQUIRED';
    } else {
      canonicalStatus = 'CAPITAL_BLOCKED';
    }

    const executionEligible = discoveryStatus === 'PROFITABLE' && blockReasons.length === 0;
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + demand.deadlineMinutes * 60000).toISOString();
    const estimatedFeesUsd = Math.round((expectedCosts.totalLandedCost - expectedCosts.computeCost) * 100) / 100;

    const workloadSpec = getGpuWorkloadSpec(demand.workloadType, offer.gpuModel);

    return {
      id: `opp-${demand.id}-${offer.id}-L${monetizationLevel}`,
      demandOrder: demand,
      matchedOffer: offer,
      monetizationLevel,
      levelDescription: `${workloadSpec.name} • Pays for: ${workloadSpec.customerPaysFor} (${workloadSpec.example})`,
      workloadType: workloadSpec.id,
      workloadName: workloadSpec.name,
      customerPaysFor: workloadSpec.customerPaysFor,
      workloadExample: workloadSpec.example,
      unitBillingMetric: workloadSpec.unitPricingBenchmark,
      grossRevenue,
      costBreakdown: expectedCosts,
      expectedNetContribution,
      worstCaseNetContribution,
      expectedMarginPct,
      worstCaseMarginPct,
      roiPct,
      capitalRequired,
      executionDeadlineIso: expiresAtIso,
      timeToCashHours: demand.durationHours + 0.5,
      grade,
      gradeReason,
      hardRuleChecks: checks,
      allHardRulesPassed,
      status: canonicalStatus,
      discoveryStatus,
      canonicalStatus,
      executionEligible,
      blockReasons,
      requiredCapitalUsd,
      verifiedAvailableCapitalUsd,
      capitalShortfallUsd,
      expectedRevenueUsd: grossRevenue,
      expectedProviderCostUsd: expectedCosts.computeCost,
      expectedPaymentFeesUsd: expectedCosts.paymentProcessingFee,
      expectedNetworkFeesUsd: Math.round((expectedCosts.bandwidthCost + expectedCosts.storageCost) * 100) / 100,
      expectedPlatformCostsUsd: Math.round((expectedCosts.providerFees + expectedCosts.expectedFailureCost + expectedCosts.refundContingency) * 100) / 100,
      estimatedFeesUsd,
      estimatedGrossProfitUsd: expectedNetContribution,
      source: offer.liveApiSource || `${offer.provider.toUpperCase()}_LIVE_API`,
      sourceTimestamp: offer.lastUpdated || nowIso,
      priceTimestamp: offer.lastUpdated || nowIso,
      providerTimestamp: offer.lastUpdated || nowIso,
      customerPriceTimestamp: demand.createdAt || nowIso,
      expiresAt: expiresAtIso,
      confidenceScore,
      riskScore,
      discoveredAt: nowIso,
      canAutoExecute: canAutoExecute && executionEligible && !requiresHumanApproval,
      autoExecutionBlockedReason: requiresHumanApproval
        ? `Human Approval Required: Big job ($${capitalRequired.toFixed(2)} >= $${bigJobThreshold.toFixed(2)} threshold)`
        : !executionEligible
          ? `Blocked by Execution Gate: ${blockReasons.join(', ')}`
          : autoExecutionBlockedReason,
      isBigJob,
      requiresHumanApproval,
      humanApproved,
      humanApprovalThresholdUsd: bigJobThreshold
    };
  }
}
