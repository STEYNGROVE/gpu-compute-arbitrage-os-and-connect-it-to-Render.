export type ProviderId = 'vast_ai' | 'runpod' | 'lambda' | 'coreweave' | 'fluidstack';

export type GpuModel = 
  | 'H100 SXM5 80GB'
  | 'H100 PCIe 80GB'
  | 'A100 80GB SXM'
  | 'A100 40GB PCIe'
  | 'L40S 48GB'
  | 'RTX 4090 24GB'
  | 'RTX 3090 24GB'
  | 'RTX 6000 Ada 48GB'
  | 'A6000 48GB'
  | 'H200 141GB';

export type DemandClass = 'CONFIRMED' | 'PROBABLE' | 'PREDICTED';

export type WorkloadType = 
  | 'LLM_INFERENCE'
  | 'LLM_HOSTING'
  | 'AI_PRODUCTION_IMAGE'
  | 'AI_PRODUCTION_VIDEO'
  | '3D_RENDERING'
  | 'AI_MODEL_TRAINING'
  | 'FINE_TUNING'
  | 'WHISPER_TRANSCRIPTION'
  | 'VIDEO_TRANSCODING'
  | 'COMPUTER_VISION'
  | 'OCR_PROCESSING'
  | 'SCIENTIFIC_COMPUTE'
  | 'BATCH_AI_PROCESSING'
  | 'PROTEIN_BIOLOGY'
  | 'RENDERING_FARM'
  | 'GAME_SERVER_WORKLOADS'
  | 'DIRECT_COMPUTE'
  | 'MODEL_SERVING';

export interface GpuWorkloadSpec {
  id: WorkloadType;
  name: string;
  customerPaysFor: string;
  example: string;
  unitPricingBenchmark: string;
  preferredGpuModels: GpuModel[];
  defaultDurationHours: number;
  monetizationLevel: 1 | 2 | 3;
  dockerImage: string;
}

export const GPU_WORKLOAD_CATALOG: readonly GpuWorkloadSpec[] = [
  {
    id: 'LLM_INFERENCE',
    name: 'AI inference',
    customerPaysFor: 'GPU time per request/token',
    example: 'LLM API, image analysis, embeddings',
    unitPricingBenchmark: '$0.0018 / 1K tokens (~45k tok/hr)',
    preferredGpuModels: ['H100 SXM5 80GB', 'H100 PCIe 80GB', 'A100 80GB SXM', 'L40S 48GB', 'RTX 4090 24GB'],
    defaultDurationHours: 8,
    monetizationLevel: 3,
    dockerImage: 'vllm/vllm-openai:latest'
  },
  {
    id: 'LLM_HOSTING',
    name: 'LLM hosting',
    customerPaysFor: 'Dedicated GPU endpoint',
    example: 'Host an open-source model/API',
    unitPricingBenchmark: 'Dedicated SLA Endpoint ($/GPU-hr)',
    preferredGpuModels: ['H200 141GB', 'H100 SXM5 80GB', 'A100 80GB SXM', 'L40S 48GB'],
    defaultDurationHours: 24,
    monetizationLevel: 2,
    dockerImage: 'ghcr.io/huggingface/text-generation-inference:latest'
  },
  {
    id: 'AI_PRODUCTION_IMAGE',
    name: 'Image generation',
    customerPaysFor: 'Images generated',
    example: 'Stable Diffusion/Flux-style generation',
    unitPricingBenchmark: '$0.014 / image (~320 imgs/GPU-hr)',
    preferredGpuModels: ['RTX 4090 24GB', 'L40S 48GB', 'RTX 6000 Ada 48GB', 'A6000 48GB'],
    defaultDurationHours: 6,
    monetizationLevel: 3,
    dockerImage: 'yanwk/comfyui-boot:cu124-slim'
  },
  {
    id: 'AI_PRODUCTION_VIDEO',
    name: 'Video generation',
    customerPaysFor: 'Video frames/seconds',
    example: 'AI video generation',
    unitPricingBenchmark: '$0.085 / video sec (~60 sec/GPU-hr)',
    preferredGpuModels: ['H100 SXM5 80GB', 'A100 80GB SXM', 'L40S 48GB', 'RTX 6000 Ada 48GB'],
    defaultDurationHours: 8,
    monetizationLevel: 3,
    dockerImage: 'pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime'
  },
  {
    id: '3D_RENDERING',
    name: '3D rendering',
    customerPaysFor: 'Render time',
    example: 'Blender/Cycles rendering',
    unitPricingBenchmark: 'OptiX Ray-Traced Render Time ($/GPU-hr)',
    preferredGpuModels: ['RTX 4090 24GB', 'RTX 6000 Ada 48GB', 'A6000 48GB', 'RTX 3090 24GB'],
    defaultDurationHours: 4,
    monetizationLevel: 2,
    dockerImage: 'linuxserver/blender:latest'
  },
  {
    id: 'AI_MODEL_TRAINING',
    name: 'AI model training',
    customerPaysFor: 'GPU-hours',
    example: 'Fine-tuning models',
    unitPricingBenchmark: 'Cluster Training Compute ($/GPU-hr)',
    preferredGpuModels: ['H200 141GB', 'H100 SXM5 80GB', 'H100 PCIe 80GB', 'A100 80GB SXM'],
    defaultDurationHours: 24,
    monetizationLevel: 2,
    dockerImage: 'nvcr.io/nvidia/pytorch:24.07-py3'
  },
  {
    id: 'FINE_TUNING',
    name: 'LoRA fine-tuning',
    customerPaysFor: 'Training jobs',
    example: 'Customer-specific models',
    unitPricingBenchmark: 'Per-Job Adapter Training ($/job)',
    preferredGpuModels: ['A100 80GB SXM', 'A100 40GB PCIe', 'L40S 48GB', 'RTX 4090 24GB'],
    defaultDurationHours: 6,
    monetizationLevel: 3,
    dockerImage: 'pytorch/pytorch:2.4.0-cuda12.4-cudnn9-devel'
  },
  {
    id: 'WHISPER_TRANSCRIPTION',
    name: 'Whisper transcription',
    customerPaysFor: 'Audio processed',
    example: 'Bulk transcription',
    unitPricingBenchmark: '$0.0035 / audio min (~1,200 min/GPU-hr)',
    preferredGpuModels: ['RTX 4090 24GB', 'L40S 48GB', 'A100 40GB PCIe', 'RTX 3090 24GB'],
    defaultDurationHours: 4,
    monetizationLevel: 3,
    dockerImage: 'onerahmet/openai-whisper-asr-webservice:latest-gpu'
  },
  {
    id: 'VIDEO_TRANSCODING',
    name: 'Video transcoding',
    customerPaysFor: 'Video processing',
    example: 'Batch conversion/encoding',
    unitPricingBenchmark: '$0.018 / GB NVENC 4K/8K stream',
    preferredGpuModels: ['RTX 4090 24GB', 'L40S 48GB', 'A6000 48GB', 'RTX 3090 24GB'],
    defaultDurationHours: 4,
    monetizationLevel: 2,
    dockerImage: 'jrottenberg/ffmpeg:6.1-nvidia'
  },
  {
    id: 'COMPUTER_VISION',
    name: 'Computer vision',
    customerPaysFor: 'Image/video analysis',
    example: 'Object detection/classification',
    unitPricingBenchmark: '$0.0008 / frame analyzed (~5,000 fps)',
    preferredGpuModels: ['RTX 4090 24GB', 'L40S 48GB', 'A100 40GB PCIe', 'RTX 6000 Ada 48GB'],
    defaultDurationHours: 8,
    monetizationLevel: 3,
    dockerImage: 'ultralytics/ultralytics:latest'
  },
  {
    id: 'OCR_PROCESSING',
    name: 'OCR',
    customerPaysFor: 'Documents/images processed',
    example: 'Large document processing',
    unitPricingBenchmark: '$0.0025 / page (~1,800 pages/GPU-hr)',
    preferredGpuModels: ['RTX 4090 24GB', 'L40S 48GB', 'RTX 3090 24GB', 'A6000 48GB'],
    defaultDurationHours: 4,
    monetizationLevel: 3,
    dockerImage: 'pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime'
  },
  {
    id: 'SCIENTIFIC_COMPUTE',
    name: 'Scientific compute',
    customerPaysFor: 'GPU computation',
    example: 'Simulation/optimization',
    unitPricingBenchmark: 'FP64/FP32 CUDA Compute ($/GPU-hr)',
    preferredGpuModels: ['H100 SXM5 80GB', 'H100 PCIe 80GB', 'A100 80GB SXM', 'A100 40GB PCIe'],
    defaultDurationHours: 12,
    monetizationLevel: 2,
    dockerImage: 'nvcr.io/nvidia/hpc-benchmarks:24.03'
  },
  {
    id: 'BATCH_AI_PROCESSING',
    name: 'Batch data processing',
    customerPaysFor: 'GPU workloads',
    example: 'Large-scale analytics',
    unitPricingBenchmark: 'RAPIDS cuDF/cuML Batch ($/workload)',
    preferredGpuModels: ['A100 80GB SXM', 'H100 PCIe 80GB', 'L40S 48GB', 'RTX 6000 Ada 48GB'],
    defaultDurationHours: 8,
    monetizationLevel: 2,
    dockerImage: 'rapidsai/base:24.08-cuda12.5-py3.11'
  },
  {
    id: 'PROTEIN_BIOLOGY',
    name: 'Protein/biology workloads',
    customerPaysFor: 'Scientific GPU time',
    example: 'Molecular/biological computation',
    unitPricingBenchmark: 'AlphaFold / GROMACS Folding ($/GPU-hr)',
    preferredGpuModels: ['H100 SXM5 80GB', 'A100 80GB SXM', 'RTX 6000 Ada 48GB', 'L40S 48GB'],
    defaultDurationHours: 12,
    monetizationLevel: 3,
    dockerImage: 'nvcr.io/hpc/gromacs:2023.2'
  },
  {
    id: 'RENDERING_FARM',
    name: 'Rendering farm',
    customerPaysFor: 'Frames/jobs',
    example: 'Animation/VFX',
    unitPricingBenchmark: '$0.38 / VFX frame (~12 frames/GPU-hr)',
    preferredGpuModels: ['RTX 4090 24GB', 'RTX 6000 Ada 48GB', 'L40S 48GB', 'A6000 48GB'],
    defaultDurationHours: 8,
    monetizationLevel: 3,
    dockerImage: 'linuxserver/blender:latest'
  },
  {
    id: 'GAME_SERVER_WORKLOADS',
    name: 'Game/server workloads',
    customerPaysFor: 'GPU compute',
    example: 'Specialized workloads',
    unitPricingBenchmark: 'Pixel Streaming / Physics Sim ($/GPU-hr)',
    preferredGpuModels: ['RTX 4090 24GB', 'L40S 48GB', 'RTX 6000 Ada 48GB', 'RTX 3090 24GB'],
    defaultDurationHours: 12,
    monetizationLevel: 1,
    dockerImage: 'nvidia/cuda:12.4.1-runtime-ubuntu22.04'
  }
] as const;

export function getGpuWorkloadSpec(workloadType?: string, gpuModel?: string): GpuWorkloadSpec {
  if (workloadType) {
    const found = GPU_WORKLOAD_CATALOG.find(w => w.id === workloadType || w.name.toLowerCase() === workloadType.toLowerCase());
    if (found) return found;
    if (workloadType === 'MODEL_SERVING') return GPU_WORKLOAD_CATALOG[1]; // LLM hosting
  }
  if (gpuModel) {
    const g = gpuModel.toUpperCase();
    if (g.includes('H200')) return GPU_WORKLOAD_CATALOG[1]; // LLM hosting
    if (g.includes('H100')) return GPU_WORKLOAD_CATALOG[0]; // AI inference
    if (g.includes('A100')) return GPU_WORKLOAD_CATALOG[5]; // AI model training
    if (g.includes('L40')) return GPU_WORKLOAD_CATALOG[3]; // Video generation
    if (g.includes('6000')) return GPU_WORKLOAD_CATALOG[14]; // Rendering farm
    if (g.includes('4090') || g.includes('3090')) return GPU_WORKLOAD_CATALOG[2]; // Image generation
  }
  return GPU_WORKLOAD_CATALOG[0];
}

export type MonetizationLevel = 1 | 2 | 3;

export type OpportunityGrade = 'AUTO' | 'REVIEW' | 'WATCH' | 'REJECT'; // Grade A (🟢), Grade B (🟡), Grade C (⚪), Grade D (🔴)

export type SystemMode = 'SAFE_AUTO' | 'SMART_AUTO' | 'MANUAL' | 'EMERGENCY_PAUSE';

export type ExecutionEnvironment = 'LIVE';

export interface ProviderOffer {
  id: string;
  provider: ProviderId;
  gpuModel: GpuModel;
  vramGb: number;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  location: string;
  region: 'US-East' | 'US-West' | 'EU-Central' | 'EU-West' | 'AP-East' | 'Global';
  hourlyPrice: number;
  startupTimeSec: number;
  availableInstances: number;
  reliabilityScore: number; // 0 to 1, e.g. 0.992
  interruptionRisk: 'on_demand' | 'spot_interruptible';
  bandwidthPricePerGb: number;
  storagePricePerGbMo: number;
  apiHealth: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  lastUpdated: string;
  historicalAvgPrice24h: number;
  termsCompliant: boolean;
  providerTermsNotes?: string;
  supplyIndexScore: number; // normalized 0-100 composite
  // Real-time Data Provenance & Truthfulness
  dataProvenance: 'LIVE_API_VERIFIED' | 'FALLBACK_MARKET_FEED';
  isLiveApiVerified: boolean;
  liveApiSource?: string;
}

export interface DemandOrder {
  id: string;
  customerName: string;
  customerId: string;
  demandClass: DemandClass;
  workloadType: WorkloadType;
  gpuModel: GpuModel;
  minVramGb: number;
  gpuCount: number;
  durationHours: number;
  deadlineMinutes: number;
  customerGrossOfferPrice: number; // Total budget offered or per-hour price
  customerHourlyRate: number; // $/hr
  paymentStatus: 'ESCROW_AUTHORIZED' | 'SIGNED_CONTRACT' | 'PREPAID_CREDIT' | 'QUOTE_PENDING' | 'MODEL_PREDICTED';
  demandSource?: 'VERIFIED_CLIENT_API' | 'ESCROW_WEBHOOK' | 'DEMO_SEED_ORDER' | 'LIVE_CROSS_PROVIDER_SPREAD';
  escrowReferenceId?: string;
  escrowAmountAuthorized?: number;
  escrowCurrency?: string;
  webhookReceivedAt?: string;
  webhookEventId?: string;
  webhookSignatureVerified?: boolean;
  customerApiKeyId?: string;
  authSignature?: string;
  customerReliabilityScore: number; // 0 to 1
  geographicRestrictions?: string[];
  createdAt: string;
  slaMinReliability: number;
  slaMaxLatencySec: number;
  workloadDescription: string;
  isConfirmed: boolean;
}

export type CanonicalOpportunityState =
  | 'DISCOVERED'
  | 'PRICED'
  | 'PROFITABLE'
  | 'CAPITAL_BLOCKED'
  | 'PROVIDER_BLOCKED'
  | 'CUSTOMER_REQUIRED'
  | 'EXECUTABLE'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'REJECTED';

export type ExecutionBlockReason =
  | 'INSUFFICIENT_OPERATING_CAPITAL'
  | 'PROVIDER_ACCOUNT_UNFUNDED'
  | 'PROVIDER_CAPACITY_UNAVAILABLE'
  | 'CUSTOMER_VERIFICATION_REQUIRED'
  | 'PAYMENT_VERIFICATION_REQUIRED'
  | 'QUOTE_EXPIRED_OR_INVALID'
  | 'OPPORTUNITY_EXPIRED'
  | 'MARGIN_BELOW_THRESHOLD'
  | 'RISK_LIMIT_EXCEEDED'
  | 'TREASURY_LIMIT_EXCEEDED'
  | 'AUTONOMOUS_EXECUTION_DISABLED'
  | 'EMERGENCY_KILL_SWITCH_ACTIVE'
  | 'HUMAN_APPROVAL_REQUIRED_FOR_BIG_JOB';

export interface DiscoveredMarketOpportunity {
  opportunityId: string;
  source: string;
  sourceTimestamp: string;
  priceTimestamp: string;
  providerTimestamp: string;
  customerPriceTimestamp: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  confidence: number;

  customerDemandSource: string;
  customerId?: string;
  customerName?: string;
  demandOrderId?: string;
  customerPrice: number;
  customerHourlyRate: number;
  customerPriceCurrency: string;
  customerVerified: boolean;
  paymentVerified: boolean;

  gpuType: string;
  gpuQuantity: number;
  runtimeHours: number;
  workloadType?: WorkloadType;
  workloadName?: string;
  customerPaysFor?: string;
  workloadExample?: string;
  unitBillingMetric?: string;

  provider: string;
  providerOfferId: string;
  providerHourlyCost: number;
  providerTotalCost: number;
  providerAvailableCount: number;
  providerAccountFunded: boolean;
  providerRegion: string;

  expectedRevenueUsd: number;
  expectedProviderCostUsd: number;
  expectedPaymentFeesUsd: number;
  expectedNetworkFeesUsd: number;
  expectedPlatformCostsUsd: number;
  estimatedFeesUsd: number;
  estimatedGrossProfitUsd: number;
  expectedMarginPct: number;
  expectedRoiPct?: number;
  roiPct?: number;

  requiredCapitalUsd: number;
  verifiedAvailableCapitalUsd: number;
  capitalShortfallUsd: number;

  isBigJob?: boolean;
  requiresHumanApproval?: boolean;
  humanApproved?: boolean;
  humanApprovalThresholdUsd?: number;

  discoveryStatus: CanonicalOpportunityState;
  status: CanonicalOpportunityState;
  executionEligible: boolean;
  blockReasons: string[];
}

export interface OpportunityDashboardSummary {
  realOpportunities: number;
  profitable: number;
  executableNow: number;
  capitalBlocked: number;
  providerBlocked: number;
  customerRequired: number;
  expired: number;
  rejected: number;
  zeroCapitalModeActive: boolean;
  verifiedAvailableCapitalUsd: number;
  totalRequiredCapitalForProfitableUsd: number;
  totalCapitalShortfallForProfitableUsd: number;
  requiredCapitalForBestOpportunityUsd: number;
  totalExpectedRevenueForProfitableUsd: number;
  totalExpectedFeesForProfitableUsd: number;
  totalExpectedNetProfitForProfitableUsd: number;
  weightedExpectedMarginPct: number;
  weightedExpectedRoiPct: number;
  lastMarketUpdate: string;
  lastMarketUpdateFormatted: string;
  dataStatus: 'LIVE_DATA_ACTIVE' | 'PARTIAL_DATA_AVAILABLE' | 'DATA_UNAVAILABLE';
  dataUnavailableProviders: string[];
}

export interface CostBreakdown {
  computeCost: number;
  storageCost: number;
  bandwidthCost: number;
  providerFees: number;
  paymentProcessingFee: number;
  taxDutyCost: number;
  expectedFailureCost: number;
  refundContingency: number;
  totalLandedCost: number;
}

export interface HardRuleCheck {
  id: string;
  name: string;
  ruleDescription: string;
  passed: boolean;
  actualValue: string | number;
  threshold: string | number;
  critical: boolean;
}

export interface Opportunity {
  id: string;
  demandOrder: DemandOrder;
  matchedOffer: ProviderOffer;
  monetizationLevel: MonetizationLevel;
  levelDescription: string;
  workloadType?: WorkloadType;
  workloadName?: string;
  customerPaysFor?: string;
  workloadExample?: string;
  unitBillingMetric?: string;
  
  // Economics (Expected / Forecast Only — Never Realized Money)
  grossRevenue: number;
  costBreakdown: CostBreakdown;
  
  expectedNetContribution: number;
  worstCaseNetContribution: number;
  expectedMarginPct: number;
  worstCaseMarginPct: number;
  roiPct: number;
  
  capitalRequired: number;
  executionDeadlineIso: string;
  timeToCashHours: number;
  
  // Classification
  grade: OpportunityGrade;
  gradeReason: string;
  hardRuleChecks: HardRuleCheck[];
  allHardRulesPassed: boolean;
  
  // Status & Pipeline A / Pipeline B Separation
  status: 'DISCOVERED' | 'QUEUED' | 'ACQUIRING_COMPUTE' | 'PROVISIONING' | 'EXECUTING' | 'VERIFYING_OUTPUT' | 'DELIVERED' | 'RECONCILED' | 'REJECTED' | 'CANCELLED' | CanonicalOpportunityState;
  discoveryStatus?: CanonicalOpportunityState;
  canonicalStatus?: CanonicalOpportunityState;
  executionEligible?: boolean;
  blockReasons?: string[];
  requiredCapitalUsd?: number;
  verifiedAvailableCapitalUsd?: number;
  capitalShortfallUsd?: number;
  expectedRevenueUsd?: number;
  expectedProviderCostUsd?: number;
  expectedPaymentFeesUsd?: number;
  expectedNetworkFeesUsd?: number;
  expectedPlatformCostsUsd?: number;
  estimatedFeesUsd?: number;
  estimatedGrossProfitUsd?: number;
  source?: string;
  sourceTimestamp?: string;
  priceTimestamp?: string;
  providerTimestamp?: string;
  customerPriceTimestamp?: string;
  expiresAt?: string;

  confidenceScore: number; // 0-100
  riskScore: number; // 0-100 (lower is better)
  discoveredAt: string;
  approvedBy?: 'AUTO_ENGINE' | 'OWNER_MANUAL';
  
  // Real-Time Provenance & Auto Execution Safety Gates
  canAutoExecute: boolean;
  autoExecutionBlockedReason?: string;

  // Big-Job Human Approval Gate
  isBigJob?: boolean;
  requiresHumanApproval?: boolean;
  humanApproved?: boolean;
  humanApprovedBy?: string;
  humanApprovedAt?: string;
  humanApprovalThresholdUsd?: number;
}

export interface ActiveJob {
  id: string;
  opportunityId: string;
  demandOrderId: string;
  provider: ProviderId;
  instanceId: string;
  gpuModel: GpuModel;
  gpuCount: number;
  workloadType: WorkloadType;
  monetizationLevel: MonetizationLevel;
  customerName: string;
  
  startedAt: string;
  plannedDurationHours: number;
  elapsedSeconds: number;
  progressPct: number;
  
  currentAccruedCost: number;
  totalEstimatedCost: number;
  contractedRevenue: number;
  currentEstimatedProfit: number;
  
  status: 'PROVISIONING' | 'RUNNING' | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'ABORTED' | 'UNSETTLED_NEEDS_RECONCILIATION';
  executionEnvironment?: 'LIVE';
  quoteToken?: string;
  quoteExpiresAt?: string;
  idempotencyKey?: string;
  unsettledReconciliationReason?: string;
  
  telemetry: {
    gpuUtilPct: number;
    vramUsedGb: number;
    tempC: number;
    powerWatts: number;
    networkInMb: number;
    networkOutMb: number;
    throughputMetric: string;
    throughputValue: number;
    logStream: string[];
    provenance?: 'LIVE_PROVIDER_API' | 'LIVE_UNMEASURED' | string;
  };
  
  spotInterruptionWarning?: boolean;
}

export interface RealizedTransaction {
  id: string;
  jobId: string;
  opportunityId: string;
  completedAt: string;
  durationHours: number;
  
  grossRevenue: number;
  grossComputeCost: number;
  otherCosts: number;
  totalCost: number;
  
  netRealizedProfit: number;
  realizedMarginPct: number;
  realizedRoiPct: number;
  
  provider: ProviderId;
  gpuModel: GpuModel;
  customerName: string;
  workloadType: WorkloadType;
  monetizationLevel: MonetizationLevel;
  
  status: 'SETTLED_PROFITABLE' | 'SETTLED_LOSS' | 'REFUNDED';
  auditHash: string;
}

export interface OwnerConfig {
  maxCapitalExposure: number; // $ e.g. 5000
  maxDailySpending: number; // $ e.g. 1500
  minProfitDollars: number; // $ e.g. 12.00
  minMarginPct: number; // % e.g. 20%
  maxAcceptableLoss: number; // $ e.g. 0
  humanApprovalThresholdUsd?: number; // $ e.g. 250 — jobs with capitalRequired >= threshold require explicit human approval
  requireHumanApprovalForBigJobs?: boolean; // default true
  approvedProviders: ProviderId[];
  approvedGpuModels: GpuModel[];
  approvedWorkloads: WorkloadType[];
  geographicRestrictions: string[];
  autoReinvestmentPct: number; // % e.g. 35%
  maxConcurrentJobs: number; // e.g. 6
  maxComputeReservationHours: number; // e.g. 48
  autoExecutionEnabled: boolean;
  emergencyKillSwitchActive: boolean;
  requireLiveApiForAuto: boolean; // Enforce Live API connection (blocks fallback data from auto-execution)
  enforceProvenanceGate: boolean;
  
  liveInitialBalance: number;
  liveCurrentBalance: number;
  
  // Treasury Authenticity & Separation
  treasuryStatus: 'SIMULATED_UNFUNDED' | 'TEST_TRANCHE_FUNDED' | 'BINANCE_TREASURY_CONNECTED' | 'BANK_CONNECTED' | 'ESCROW_FUNDED';
  realTreasuryCashBalance?: number;
  realBankCashBalance?: number;
  simulatedReserve: number;
  escrowVaultBalance: number;
  
  // Safe Browser Session Authorization (No secrets exposed)
  ownerApiKey?: string;
  customerApiKey?: string;
  sessionId?: string;
  authStatus?: string;
  isLiveReady?: boolean;
  
  reinvestmentVaultBalance: number;
}

export interface HeatmapDataPoint {
  gpu: GpuModel;
  provider: ProviderId;
  region: string;
  supplyPricePerHour: number;
  demandPricePerHour: number;
  spreadPerHour: number;
  spreadMarginPct: number;
  availableCapacityUnits: number;
  demandRequiredUnits: number;
  ratio: number;
  status: 'VERIFIED_OPPORTUNITY' | 'SHORTAGE' | 'OVERSUPPLY' | 'BALANCED';
}

export interface ProviderReliabilityMetric {
  provider: ProviderId;
  totalJobsAssigned: number;
  successfulJobs: number;
  interruptedJobs: number;
  failedProvisions: number;
  avgStartupLatencySec: number;
  actualVsAdvertisedPerfFactor: number; // e.g. 0.98
  billingAccuracyRate: number; // 0-1
  compositeReliabilityScore: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: 'DECISION_EVAL' | 'CAPITAL_ALLOCATION' | 'JOB_EXECUTION' | 'EMERGENCY_STOP' | 'CONFIG_CHANGE' | 'RECONCILIATION' | 'SECURITY_CHECK' | 'ESCROW_VERIFIED' | string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS' | 'SECURITY';
  message: string;
  details: Record<string, unknown>;
  prevHash?: string;
  verifiedSignature: string;
}

export interface CustomerApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  monthlyQuotaDollars: number;
  spentThisMonthDollars: number;
  allowedWorkloads: WorkloadType[];
  status: 'ACTIVE' | 'REVOKED';
}
