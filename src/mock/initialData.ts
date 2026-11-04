import { 
  DemandOrder, 
  OwnerConfig, 
  RealizedTransaction, 
  ProviderReliabilityMetric, 
  AuditLogEntry, 
  CustomerApiKey, 
  ActiveJob 
} from '../types';

export const initialOwnerConfig: OwnerConfig = {
  maxCapitalExposure: 5000.00,
  maxDailySpending: 1800.00,
  minProfitDollars: 15.00,
  minMarginPct: 22.0,
  maxAcceptableLoss: 0.00,
  approvedProviders: ['vast_ai', 'runpod'],
  approvedGpuModels: [
    'H100 SXM5 80GB',
    'H100 PCIe 80GB',
    'A100 80GB SXM',
    'A100 40GB PCIe',
    'L40S 48GB',
    'RTX 4090 24GB',
    'RTX 6000 Ada 48GB',
    'A6000 48GB',
    'H200 141GB'
  ],
  approvedWorkloads: [
    'DIRECT_COMPUTE',
    'LLM_INFERENCE',
    'FINE_TUNING',
    'AI_PRODUCTION_VIDEO',
    'AI_PRODUCTION_IMAGE',
    'MODEL_SERVING',
    'BATCH_AI_PROCESSING',
    '3D_RENDERING'
  ],
  geographicRestrictions: ['US-East', 'US-West', 'EU-Central', 'EU-West'],
  autoReinvestmentPct: 35.0,
  maxConcurrentJobs: 6,
  maxComputeReservationHours: 48,
  autoExecutionEnabled: true,
  emergencyKillSwitchActive: false,
  requireLiveApiForAuto: true,
  enforceProvenanceGate: true,
  
  liveInitialBalance: 0.00,
  liveCurrentBalance: 0.00,
  
  reinvestmentVaultBalance: 0.00,

  treasuryStatus: 'SIMULATED_UNFUNDED',
  realBankCashBalance: 0.00,
  simulatedReserve: 0.00,
  escrowVaultBalance: 0.00,
  sessionId: '',
  authStatus: 'INITIALIZING'
};

/**
 * STRICT REAL/LIVE ONLY POLICY (Requirement 1):
 * Synthetic customers, jobs, GPU instances, balances, and profits must NEVER enter production.
 * All collections initialize empty and are populated exclusively from verified backend PostgreSQL & live APIs.
 */
export const initialDemandOrders: DemandOrder[] = [];

export const initialActiveJobs: ActiveJob[] = [];

export const initialRealizedTransactions: RealizedTransaction[] = [];

export const initialProviderReliabilityMetrics: ProviderReliabilityMetric[] = [];

export const initialAuditLogs: AuditLogEntry[] = [];

export const initialApiKeys: CustomerApiKey[] = [];
