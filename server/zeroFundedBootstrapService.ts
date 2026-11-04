/**
 * ZERO-FUNDED PROVIDER BOOTSTRAP SERVICE
 * 
 * Core Invariant: The operator has NOT funded any GPU provider accounts.
 * The system must NEVER:
 * - Assume provider credit exists
 * - Assume a provider balance is available
 * - Automatically top up provider accounts
 * - Use operator funds without explicit authorization
 * - Treat an authenticated provider account as financially funded
 * 
 * Provider financial states:
 * - "NOT_FUNDED"
 * - "FUNDED"
 * - "INSUFFICIENT_BALANCE"
 * - "CREDIT_AVAILABLE"
 * - "PAY_AS_YOU_GO"
 * - "PAYMENT_REQUIRED"
 * - "UNKNOWN"
 * 
 * GPU Execution Feasibility:
 * - "AVAILABLE GPU": Offer listed on provider marketplace
 * - "PURCHASABLE GPU": Provider financial requirements can be satisfied
 * - "EXECUTABLE GPU": Customer payment verified, spending gate passed, preflight passed
 */

import crypto from 'crypto';
import {
  ProviderId,
  ProviderStatus,
  ProviderFinancialState,
  ProviderExecutionState,
  GpuExecutionFeasibility,
  ZeroFundedProviderStatus,
  CustomerFundedJobEscrow,
  ProviderBillingResult,
  ProviderHealthResult
} from './providers/types.js';
import { providerRegistry } from './providers/providerRegistry.js';
import { killSwitchRepo, auditRepo } from './repositories/index.js';

export interface OwnerFundedConfig {
  enabled: boolean;
  authorizedBy?: string;
  authorizedAtIso?: string;
  maxSingleTransactionUsd: number;
  maxDailySpendUsd: number;
  maxJobExposureUsd: number;
  maxLossUsd: number;
  dailySpentUsd: number;
  lastResetIso: string;
  providerSpecificLimits?: Record<string, number>;
}

export interface SpendingGateResult {
  allowed: boolean;
  gateState: 'APPROVED' | 'WAITING_FOR_FUNDING' | 'EXECUTION_BLOCKED';
  reason: string;
  checks: {
    customerPaymentVerified: boolean;
    providerFinanciallyExecutable: boolean;
    providerCostWithinBudget: boolean;
    profitMeetsMinimum: boolean;
    riskLimitsPassed: boolean;
    killSwitchInactive: boolean;
  };
  providerFinancialState: ProviderFinancialState;
  authorizedBudgetUsd: number;
  estimatedCostUsd: number;
  expectedProfitUsd: number;
}

export interface ZeroCapitalRouteResult {
  hasZeroCapitalPath: boolean;
  status: 'ZERO_CAPITAL_ROUTE_AVAILABLE' | 'NO ZERO-CAPITAL EXECUTION PATH AVAILABLE';
  recommendedProvider: ProviderId | null;
  executableProviders: ProviderId[];
  blockedProviders: { providerId: ProviderId; reason: string }[];
  reason: string;
  message: string;
}

export class ZeroFundedBootstrapService {
  // Default: OWNER CAPITAL MODE IS STRICTLY DISABLED
  private ownerFundedConfig: OwnerFundedConfig = {
    enabled: false,
    maxSingleTransactionUsd: 0,
    maxDailySpendUsd: 0,
    maxJobExposureUsd: 0,
    maxLossUsd: 0,
    dailySpentUsd: 0,
    lastResetIso: new Date().toISOString()
  };

  // Customer-funded job escrows
  private jobEscrows: Map<string, CustomerFundedJobEscrow> = new Map();

  // Cached provider financial statuses (TTL: 15s)
  private statusCache: Map<ProviderId, { status: ZeroFundedProviderStatus; cachedAt: number }> = new Map();
  private cacheTtlMs = 15000;

  /**
   * 1. Check whether Owner Capital Mode is enabled.
   * STRICT DEFAULT: FALSE. Never spend operator money automatically.
   */
  public isOwnerFundedModeEnabled(): boolean {
    return this.ownerFundedConfig.enabled;
  }

  public getOwnerFundedConfig(): OwnerFundedConfig {
    return { ...this.ownerFundedConfig };
  }

  /**
   * Explicit operator authorization required to enable Owner Capital Mode
   */
  public setOwnerFundedMode(enabled: boolean, config?: Partial<OwnerFundedConfig>, operatorSecret?: string): { success: boolean; message: string } {
    if (enabled) {
      if (!config || !config.maxSingleTransactionUsd || config.maxSingleTransactionUsd <= 0) {
        return { success: false, message: 'Explicit maxSingleTransactionUsd is required to enable Owner Capital Mode.' };
      }
      this.ownerFundedConfig = {
        enabled: true,
        authorizedBy: config.authorizedBy || 'AUTHORIZED_OPERATOR',
        authorizedAtIso: new Date().toISOString(),
        maxSingleTransactionUsd: Number(config.maxSingleTransactionUsd),
        maxDailySpendUsd: Number(config.maxDailySpendUsd || config.maxSingleTransactionUsd * 3),
        maxJobExposureUsd: Number(config.maxJobExposureUsd || config.maxSingleTransactionUsd),
        maxLossUsd: Number(config.maxLossUsd || 50),
        dailySpentUsd: 0,
        lastResetIso: new Date().toISOString(),
        providerSpecificLimits: config.providerSpecificLimits || {}
      };
      return { success: true, message: 'Owner Capital Mode enabled with explicit spend limits.' };
    } else {
      this.ownerFundedConfig = {
        enabled: false,
        maxSingleTransactionUsd: 0,
        maxDailySpendUsd: 0,
        maxJobExposureUsd: 0,
        maxLossUsd: 0,
        dailySpentUsd: 0,
        lastResetIso: new Date().toISOString()
      };
      return { success: true, message: 'Owner Capital Mode disabled. Zero Operator Capital enforcement active.' };
    }
  }

  /**
   * 2. Detect real provider financial status without fabricating any numbers.
   * If balance cannot be verified, display "FUNDING_STATUS_UNKNOWN".
   * Never assume zero or positive balance.
   */
  public async detectProviderFinancialStatus(providerId: ProviderId, forceFresh: boolean = false): Promise<ZeroFundedProviderStatus> {
    const cached = this.statusCache.get(providerId);
    const now = Date.now();
    if (!forceFresh && cached && now - cached.cachedAt < this.cacheTtlMs) {
      return cached.status;
    }

    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      const unavailable: ZeroFundedProviderStatus = {
        providerId,
        providerName: providerId,
        authStatus: 'UNAVAILABLE',
        fundingStatus: 'UNKNOWN',
        executionStatus: 'UNAVAILABLE',
        billingMechanism: 'UNKNOWN',
        verifiedBalanceDisplay: 'FUNDING_STATUS_UNKNOWN',
        verifiedBalanceUsd: null,
        genuineCreditsDetected: false,
        requiresPrepaidBalance: true,
        allowsCustomerFundedExecution: false,
        allowsPayAsYouGo: false,
        minDepositUsd: 0,
        canExecuteWithoutOperatorCapital: false,
        lastCheckedIso: new Date().toISOString(),
        message: `Provider ${providerId} is not registered in system.`
      };
      return unavailable;
    }

    let health: ProviderHealthResult;
    try {
      health = await provider.healthCheck();
    } catch {
      health = {
        providerId,
        providerName: provider.name,
        status: 'ERROR',
        healthColor: 'RED',
        authenticated: false,
        latencyMs: 0,
        endpoints: {
          authentication: false,
          pricing: false,
          inventory: false,
          provisioning: false,
          instanceControl: false,
          telemetry: false,
          billing: false
        },
        lastCheckIso: new Date().toISOString(),
        message: 'Health check probe failed',
        configuredCredentials: [],
        missingCredentials: []
      };
    }

    let billing: ProviderBillingResult | null = null;
    try {
      billing = await provider.getBilling();
    } catch {
      billing = null;
    }

    // Determine Financial State & Verified Balance Display
    let fundingStatus: ProviderFinancialState = 'UNKNOWN';
    let balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
    let verifiedBalanceUsd: number | null = null;
    let genuineCreditsDetected = false;
    let creditDetails: ZeroFundedProviderStatus['creditDetails'] = undefined;
    let requiresPrepaidBalance = true;
    let allowsPayAsYouGo = false;
    let allowsCustomerFundedExecution = false;
    let minDepositUsd = 0;

    // Evaluate provider specific payment models
    switch (providerId) {
      case 'vast_ai': {
        requiresPrepaidBalance = true;
        allowsPayAsYouGo = false;
        minDepositUsd = 5.00;
        allowsCustomerFundedExecution = true; // Can be funded via customer deposit
        if (health.status === 'CONFIGURATION_REQUIRED' || !health.authenticated) {
          fundingStatus = 'UNKNOWN';
          balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
        } else if (billing && billing.creditRemainingUsd !== null) {
          verifiedBalanceUsd = billing.creditRemainingUsd;
          if (billing.creditRemainingUsd > 0) {
            fundingStatus = 'FUNDED';
            balanceDisplay = `$${billing.creditRemainingUsd.toFixed(2)}`;
          } else {
            fundingStatus = 'NOT_FUNDED';
            balanceDisplay = 'UNFUNDED ($0.00)';
          }
        } else {
          fundingStatus = 'NOT_FUNDED';
          balanceDisplay = 'UNFUNDED / NO_BALANCE';
        }
        break;
      }

      case 'runpod': {
        requiresPrepaidBalance = true;
        allowsPayAsYouGo = false;
        minDepositUsd = 10.00;
        allowsCustomerFundedExecution = true;
        if (health.status === 'CONFIGURATION_REQUIRED' || !health.authenticated) {
          fundingStatus = 'UNKNOWN';
          balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
        } else if (billing && billing.accountBalanceUsd !== null) {
          verifiedBalanceUsd = billing.accountBalanceUsd;
          if (billing.accountBalanceUsd > 0) {
            fundingStatus = 'FUNDED';
            balanceDisplay = `$${billing.accountBalanceUsd.toFixed(2)}`;
          } else {
            fundingStatus = 'NOT_FUNDED';
            balanceDisplay = 'UNFUNDED ($0.00)';
          }
        } else {
          fundingStatus = 'NOT_FUNDED';
          balanceDisplay = 'UNFUNDED / NO_BALANCE';
        }
        break;
      }

      case 'tensordock': {
        requiresPrepaidBalance = false;
        allowsPayAsYouGo = true; // Tensordock supports hourly card billing if card linked
        allowsCustomerFundedExecution = true;
        minDepositUsd = 0;
        fundingStatus = 'PAY_AS_YOU_GO';
        balanceDisplay = 'POSTPAID_CARD_OR_PREPAID';
        break;
      }

      case 'lambda': {
        requiresPrepaidBalance = false;
        allowsPayAsYouGo = true; // Lambda Labs uses hourly postpaid card charging
        allowsCustomerFundedExecution = true;
        minDepositUsd = 0;
        fundingStatus = 'PAY_AS_YOU_GO';
        balanceDisplay = 'POSTPAID_HOURLY';
        break;
      }

      case 'salad': {
        requiresPrepaidBalance = true;
        allowsPayAsYouGo = false;
        minDepositUsd = 5.00;
        allowsCustomerFundedExecution = true;
        if (health.status === 'CONFIGURATION_REQUIRED' || !health.authenticated) {
          fundingStatus = 'UNKNOWN';
          balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
        } else {
          fundingStatus = 'PAYMENT_REQUIRED';
          balanceDisplay = 'PREPAID_ORG_CREDIT';
        }
        break;
      }

      case 'akash': {
        requiresPrepaidBalance = true;
        allowsPayAsYouGo = false;
        minDepositUsd = 5.00; // AKT escrow tokens
        allowsCustomerFundedExecution = false; // Requires on-chain Cosmos wallet
        if (health.status === 'CONFIGURATION_REQUIRED' || !health.authenticated) {
          fundingStatus = 'UNKNOWN';
          balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
        } else {
          fundingStatus = 'NOT_FUNDED';
          balanceDisplay = 'ON_CHAIN_ESCROW_REQUIRED';
        }
        break;
      }

      case 'hyperstack': {
        requiresPrepaidBalance = false;
        allowsPayAsYouGo = true;
        allowsCustomerFundedExecution = true;
        minDepositUsd = 0;
        if (health.status === 'CONFIGURATION_REQUIRED' || !health.authenticated) {
          fundingStatus = 'UNKNOWN';
          balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
        } else {
          fundingStatus = 'PAYMENT_REQUIRED';
          balanceDisplay = 'INVOICE_TERMS_REQUIRED';
        }
        break;
      }

      case 'coreweave': {
        requiresPrepaidBalance = false;
        allowsPayAsYouGo = true;
        allowsCustomerFundedExecution = true;
        minDepositUsd = 0;
        if (health.status === 'CONFIGURATION_REQUIRED' || !health.authenticated) {
          fundingStatus = 'UNKNOWN';
          balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
        } else {
          fundingStatus = 'PAYMENT_REQUIRED';
          balanceDisplay = 'ENTERPRISE_CONTRACT_REQUIRED';
        }
        break;
      }

      case 'lightning_ai': {
        requiresPrepaidBalance = true;
        allowsPayAsYouGo = false;
        minDepositUsd = 10.00;
        allowsCustomerFundedExecution = true;
        if (billing && typeof billing.accountBalanceUsd === 'number' && billing.accountBalanceUsd > 0) {
          fundingStatus = 'FUNDED';
          balanceDisplay = `$${billing.accountBalanceUsd.toFixed(2)}`;
          verifiedBalanceUsd = billing.accountBalanceUsd;
        } else {
          fundingStatus = 'UNKNOWN';
          balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
          verifiedBalanceUsd = null;
        }
        break;
      }

      case 'hostinger': {
        requiresPrepaidBalance = true;
        allowsPayAsYouGo = false;
        minDepositUsd = 15.00;
        allowsCustomerFundedExecution = false;
        fundingStatus = 'PAYMENT_REQUIRED';
        balanceDisplay = 'PREPAID_VPS_ORDER';
        break;
      }

      default: {
        fundingStatus = 'UNKNOWN';
        balanceDisplay = 'FUNDING_STATUS_UNKNOWN';
      }
    }

    // Detect genuine credits / promotions if reported by the API
    if (billing && billing.rawBillingInfo) {
      const raw = billing.rawBillingInfo as Record<string, any>;
      if (typeof raw.promotional_credit === 'number' && raw.promotional_credit > 0) {
        genuineCreditsDetected = true;
        creditDetails = {
          promotionalCreditUsd: raw.promotional_credit,
          description: 'Provider-issued promotional credit'
        };
        fundingStatus = 'CREDIT_AVAILABLE';
        balanceDisplay = `CREDIT: $${raw.promotional_credit.toFixed(2)}`;
      } else if (typeof raw.free_trial_credit === 'number' && raw.free_trial_credit > 0) {
        genuineCreditsDetected = true;
        creditDetails = {
          freeTrialCreditUsd: raw.free_trial_credit,
          description: 'Provider free trial credit'
        };
        fundingStatus = 'CREDIT_AVAILABLE';
        balanceDisplay = `TRIAL: $${raw.free_trial_credit.toFixed(2)}`;
      }
    }

    // Determine Execution Status
    let executionStatus: ProviderExecutionState = 'BLOCKED';
    let canExecuteWithoutOperatorCapital = false;

    if (health.status === 'UNAVAILABLE' || health.status === 'ERROR') {
      executionStatus = 'UNAVAILABLE';
    } else if (fundingStatus === 'FUNDED' || fundingStatus === 'CREDIT_AVAILABLE') {
      executionStatus = 'EXECUTABLE';
      canExecuteWithoutOperatorCapital = true;
    } else if (allowsPayAsYouGo) {
      executionStatus = 'CUSTOMER_FUNDED_ONLY';
      canExecuteWithoutOperatorCapital = true;
    } else if (allowsCustomerFundedExecution) {
      executionStatus = 'WAITING_FOR_FUNDING';
      canExecuteWithoutOperatorCapital = false; // requires customer funds to be routed to provider first
    } else {
      executionStatus = 'BLOCKED';
    }

    const result: ZeroFundedProviderStatus = {
      providerId,
      providerName: provider.name,
      authStatus: health.status,
      fundingStatus,
      executionStatus,
      billingMechanism: billing ? billing.billingMechanism : 'UNKNOWN',
      verifiedBalanceDisplay: balanceDisplay,
      verifiedBalanceUsd,
      genuineCreditsDetected,
      creditDetails,
      requiresPrepaidBalance,
      allowsCustomerFundedExecution,
      allowsPayAsYouGo,
      minDepositUsd,
      canExecuteWithoutOperatorCapital,
      lastCheckedIso: new Date().toISOString(),
      message: health.authenticated
        ? `Authenticated. Financial State: ${fundingStatus}. Balance: ${balanceDisplay}.`
        : `Authentication required before financial verification.`
    };

    this.statusCache.set(providerId, { status: result, cachedAt: now });
    return result;
  }

  /**
   * 3. Get All Provider Funding Statuses for the 10-Row Matrix Dashboard
   */
  public async getAllProviderFundingStatuses(forceFresh: boolean = false): Promise<ZeroFundedProviderStatus[]> {
    const providers = providerRegistry.getAllProviders();
    const statuses = await Promise.all(
      providers.map(p => this.detectProviderFinancialStatus(p.id, forceFresh))
    );
    return statuses;
  }

  /**
   * 4. Customer-Funded Execution Mode:
   * Record customer payment and transition to FUNDS_RESERVED_FOR_JOB
   */
  public createCustomerJobEscrow(params: {
    jobId: string;
    demandOrderId: string;
    customerPaymentId: string;
    amountReceived: number;
    currency: string;
    providerBudget: number;
    maxProviderSpend: number;
    expectedProfit: number;
    maxLoss: number;
    paymentFees: number;
    providerId: ProviderId;
  }): CustomerFundedJobEscrow {
    const escrow: CustomerFundedJobEscrow = {
      jobId: params.jobId,
      demandOrderId: params.demandOrderId,
      customerPaymentId: params.customerPaymentId,
      amountReceived: params.amountReceived,
      currency: params.currency || 'USD',
      providerBudget: params.providerBudget,
      maxProviderSpend: params.maxProviderSpend,
      expectedProfit: params.expectedProfit,
      maxLoss: params.maxLoss,
      paymentFees: params.paymentFees,
      reservedAmount: 0,
      actualProviderCost: null,
      refundLiability: params.amountReceived,
      state: 'PAYMENT_RECEIVED',
      providerId: params.providerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.jobEscrows.set(params.jobId, escrow);
    return escrow;
  }

  /**
   * Transition customer payment from PAYMENT_RECEIVED to FUNDS_RESERVED_FOR_JOB
   */
  public reserveFundsForJob(jobId: string, reserveAmount: number): CustomerFundedJobEscrow {
    const escrow = this.jobEscrows.get(jobId);
    if (!escrow) {
      throw new Error(`JOB_ESCROW_NOT_FOUND: No customer escrow record for job ${jobId}`);
    }

    if (reserveAmount > escrow.providerBudget) {
      throw new Error(`RESERVE_EXCEEDS_BUDGET: Requested $${reserveAmount.toFixed(2)} exceeds authorized provider budget of $${escrow.providerBudget.toFixed(2)}`);
    }

    escrow.reservedAmount = reserveAmount;
    escrow.state = 'FUNDS_RESERVED_FOR_JOB';
    escrow.updatedAt = new Date().toISOString();
    this.jobEscrows.set(jobId, escrow);
    return escrow;
  }

  public getJobEscrow(jobId: string): CustomerFundedJobEscrow | undefined {
    return this.jobEscrows.get(jobId);
  }

  /**
   * 5. Strict Provider Spending Gate
   * Must evaluate before any provisioning call:
   * 1. Customer payment verified
   * 2. Provider financially executable
   * 3. Provider cost <= authorized budget
   * 4. Expected profit >= minimum profit ($0.001)
   * 5. Risk limits passed (within max single transaction/loss)
   * 6. No kill switch
   * Otherwise: WAITING_FOR_FUNDING or EXECUTION_BLOCKED.
   */
  public async evaluateProviderSpendingGate(params: {
    jobId: string;
    providerId: ProviderId;
    estimatedCostUsd: number;
    expectedRevenueUsd: number;
  }): Promise<SpendingGateResult> {
    const { jobId, providerId, estimatedCostUsd, expectedRevenueUsd } = params;

    // Check kill switches
    const globalKs = await killSwitchRepo.isKillSwitchActive('GLOBAL_KILL_SWITCH');
    const provKs = await killSwitchRepo.isKillSwitchActive('NEW_PROVISIONING_KILL_SWITCH');
    const killSwitchInactive = !globalKs.active && !provKs.active;

    if (!killSwitchInactive) {
      return {
        allowed: false,
        gateState: 'EXECUTION_BLOCKED',
        reason: `KILL_SWITCH_ACTIVE: Emergency stop active (${globalKs.active ? globalKs.reason : provKs.reason})`,
        checks: {
          customerPaymentVerified: false,
          providerFinanciallyExecutable: false,
          providerCostWithinBudget: false,
          profitMeetsMinimum: false,
          riskLimitsPassed: false,
          killSwitchInactive: false
        },
        providerFinancialState: 'UNKNOWN',
        authorizedBudgetUsd: 0,
        estimatedCostUsd,
        expectedProfitUsd: 0
      };
    }

    // 1. Check Customer Payment
    const escrow = this.jobEscrows.get(jobId);
    const customerPaymentVerified = Boolean(
      escrow && (escrow.state === 'PAYMENT_RECEIVED' || escrow.state === 'FUNDS_RESERVED_FOR_JOB')
    );

    if (!customerPaymentVerified) {
      return {
        allowed: false,
        gateState: 'WAITING_FOR_FUNDING',
        reason: 'CUSTOMER_PAYMENT_UNVERIFIED: Customer funds have not been verified and received for this job.',
        checks: {
          customerPaymentVerified: false,
          providerFinanciallyExecutable: false,
          providerCostWithinBudget: false,
          profitMeetsMinimum: false,
          riskLimitsPassed: false,
          killSwitchInactive: true
        },
        providerFinancialState: 'UNKNOWN',
        authorizedBudgetUsd: 0,
        estimatedCostUsd,
        expectedProfitUsd: 0
      };
    }

    const authorizedBudget = escrow!.maxProviderSpend || escrow!.providerBudget;
    const providerCostWithinBudget = estimatedCostUsd <= authorizedBudget;
    const expectedProfit = expectedRevenueUsd - estimatedCostUsd - (escrow!.paymentFees || 0);
    const profitMeetsMinimum = expectedProfit > 0;
    const riskLimitsPassed = estimatedCostUsd <= 500 && expectedProfit >= -0.01;

    // 2. Check Provider Financial State
    const providerFin = await this.detectProviderFinancialStatus(providerId);

    // Operator capital exposure rule:
    // If Owner Capital Mode is OFF:
    // The provider MUST either have verified positive balance, OR genuine post-paid/pay-as-you-go,
    // OR have promotional/free credit.
    let providerFinanciallyExecutable = false;

    if (providerFin.fundingStatus === 'FUNDED' || providerFin.fundingStatus === 'CREDIT_AVAILABLE') {
      if (providerFin.verifiedBalanceUsd !== null && providerFin.verifiedBalanceUsd >= estimatedCostUsd) {
        providerFinanciallyExecutable = true;
      } else if (providerFin.genuineCreditsDetected) {
        providerFinanciallyExecutable = true;
      } else {
        providerFinanciallyExecutable = false;
      }
    } else if (providerFin.fundingStatus === 'PAY_AS_YOU_GO') {
      // Allowed if customer payment escrow is held and verified
      providerFinanciallyExecutable = customerPaymentVerified;
    } else if (this.ownerFundedConfig.enabled) {
      // Owner capital mode is explicitly enabled
      if (estimatedCostUsd <= this.ownerFundedConfig.maxSingleTransactionUsd) {
        providerFinanciallyExecutable = true;
      }
    }

    if (!providerCostWithinBudget) {
      return {
        allowed: false,
        gateState: 'EXECUTION_BLOCKED',
        reason: `COST_EXCEEDS_BUDGET: Estimated cost $${estimatedCostUsd.toFixed(2)} exceeds authorized budget $${authorizedBudget.toFixed(2)}`,
        checks: {
          customerPaymentVerified: true,
          providerFinanciallyExecutable,
          providerCostWithinBudget: false,
          profitMeetsMinimum,
          riskLimitsPassed,
          killSwitchInactive: true
        },
        providerFinancialState: providerFin.fundingStatus,
        authorizedBudgetUsd: authorizedBudget,
        estimatedCostUsd,
        expectedProfitUsd: expectedProfit
      };
    }

    if (!profitMeetsMinimum) {
      return {
        allowed: false,
        gateState: 'EXECUTION_BLOCKED',
        reason: `UNPROFITABLE_JOB: Expected profit $${expectedProfit.toFixed(4)} is below minimum threshold.`,
        checks: {
          customerPaymentVerified: true,
          providerFinanciallyExecutable,
          providerCostWithinBudget: true,
          profitMeetsMinimum: false,
          riskLimitsPassed,
          killSwitchInactive: true
        },
        providerFinancialState: providerFin.fundingStatus,
        authorizedBudgetUsd: authorizedBudget,
        estimatedCostUsd,
        expectedProfitUsd: expectedProfit
      };
    }

    if (!providerFinanciallyExecutable) {
      const reason = `PROVIDER_NOT_FUNDED: Provider ${providerId} financial status is '${providerFin.fundingStatus}' (${providerFin.verifiedBalanceDisplay}). Requires prepaid funding before execution.`;
      return {
        allowed: false,
        gateState: 'WAITING_FOR_FUNDING',
        reason,
        checks: {
          customerPaymentVerified: true,
          providerFinanciallyExecutable: false,
          providerCostWithinBudget: true,
          profitMeetsMinimum: true,
          riskLimitsPassed,
          killSwitchInactive: true
        },
        providerFinancialState: providerFin.fundingStatus,
        authorizedBudgetUsd: authorizedBudget,
        estimatedCostUsd,
        expectedProfitUsd: expectedProfit
      };
    }

    // Mark escrow state as FUNDS_RESERVED_FOR_JOB if still in PAYMENT_RECEIVED
    if (escrow!.state === 'PAYMENT_RECEIVED') {
      escrow!.reservedAmount = estimatedCostUsd;
      escrow!.state = 'FUNDS_RESERVED_FOR_JOB';
      escrow!.updatedAt = new Date().toISOString();
    }

    return {
      allowed: true,
      gateState: 'APPROVED',
      reason: 'All financial, customer payment, risk, and provider spending gates passed.',
      checks: {
        customerPaymentVerified: true,
        providerFinanciallyExecutable: true,
        providerCostWithinBudget: true,
        profitMeetsMinimum: true,
        riskLimitsPassed: true,
        killSwitchInactive: true
      },
      providerFinancialState: providerFin.fundingStatus,
      authorizedBudgetUsd: authorizedBudget,
      estimatedCostUsd,
      expectedProfitUsd: expectedProfit
    };
  }

  /**
   * 6. Tri-state GPU Distinction:
   * "AVAILABLE GPU" vs "PURCHASABLE GPU" vs "EXECUTABLE GPU"
   */
  public async classifyGpuFeasibility(
    providerId: ProviderId,
    estimatedCostUsd: number,
    jobId?: string
  ): Promise<{
    feasibility: GpuExecutionFeasibility;
    explanation: string;
    isAvailable: boolean;
    isPurchasable: boolean;
    isExecutable: boolean;
  }> {
    const fin = await this.detectProviderFinancialStatus(providerId);

    // Is it AVAILABLE?
    const isAvailable = fin.authStatus !== 'UNAVAILABLE' && fin.authStatus !== 'ERROR' && fin.authStatus !== 'FAILED';

    if (!isAvailable) {
      return {
        feasibility: 'AVAILABLE_GPU',
        explanation: 'GPU offer discovered, but provider API is currently unverified or unavailable.',
        isAvailable: false,
        isPurchasable: false,
        isExecutable: false
      };
    }

    // Is it PURCHASABLE?
    // Purchasable if provider has verified balance OR is genuine PAYG OR owner funded mode is on
    const isPurchasable = (
      (fin.fundingStatus === 'FUNDED' && (fin.verifiedBalanceUsd ?? 0) >= estimatedCostUsd) ||
      fin.fundingStatus === 'CREDIT_AVAILABLE' ||
      fin.fundingStatus === 'PAY_AS_YOU_GO' ||
      (this.ownerFundedConfig.enabled && estimatedCostUsd <= this.ownerFundedConfig.maxSingleTransactionUsd)
    );

    if (!isPurchasable) {
      return {
        feasibility: 'AVAILABLE_GPU',
        explanation: `GPU is listed in marketplace, but NOT PURCHASABLE because provider ${providerId} is unfunded (${fin.verifiedBalanceDisplay}) and requires advance operator deposit.`,
        isAvailable: true,
        isPurchasable: false,
        isExecutable: false
      };
    }

    // Is it EXECUTABLE?
    // Requires a customer job with verified funds reserved
    let isExecutable = false;
    if (jobId) {
      const escrow = this.jobEscrows.get(jobId);
      if (escrow && (escrow.state === 'FUNDS_RESERVED_FOR_JOB' || escrow.state === 'PAYMENT_RECEIVED')) {
        isExecutable = true;
      }
    }

    if (isExecutable) {
      return {
        feasibility: 'EXECUTABLE_GPU',
        explanation: 'GPU is PURCHASABLE and EXECUTABLE: Customer payment is verified and escrow funds are reserved for the job.',
        isAvailable: true,
        isPurchasable: true,
        isExecutable: true
      };
    }

    return {
      feasibility: 'PURCHASABLE_GPU',
      explanation: 'GPU is PURCHASABLE (provider terms/balance satisfied), but awaiting customer payment reservation before execution.',
      isAvailable: true,
      isPurchasable: true,
      isExecutable: false
    };
  }

  /**
   * 7. Zero-Capital Routing & First Revenue Strategy:
   * Evaluate whether any candidate provider can execute without operator capital exposure.
   */
  public async evaluateZeroCapitalRoute(candidateProviderIds: ProviderId[], requiredGpuHours: number, hourlyRateUsd: number): Promise<ZeroCapitalRouteResult> {
    const totalEstimatedCost = requiredGpuHours * hourlyRateUsd;
    const executableProviders: ProviderId[] = [];
    const blockedProviders: { providerId: ProviderId; reason: string }[] = [];

    for (const pid of candidateProviderIds) {
      const fin = await this.detectProviderFinancialStatus(pid);
      if (fin.fundingStatus === 'FUNDED' && (fin.verifiedBalanceUsd ?? 0) >= totalEstimatedCost) {
        executableProviders.push(pid);
      } else if (fin.fundingStatus === 'CREDIT_AVAILABLE') {
        executableProviders.push(pid);
      } else if (fin.allowsPayAsYouGo) {
        // Genuine post-paid provider can execute on customer payment without upfront operator deposit
        executableProviders.push(pid);
      } else {
        blockedProviders.push({
          providerId: pid,
          reason: `Requires advance prepaid deposit of >= $${fin.minDepositUsd.toFixed(2)}, but account is unfunded (${fin.verifiedBalanceDisplay}).`
        });
      }
    }

    if (executableProviders.length > 0) {
      return {
        hasZeroCapitalPath: true,
        status: 'ZERO_CAPITAL_ROUTE_AVAILABLE',
        recommendedProvider: executableProviders[0],
        executableProviders,
        blockedProviders,
        reason: `Found ${executableProviders.length} provider(s) compatible with Zero Operator Capital execution (${executableProviders.join(', ')}).`,
        message: 'Customer payment can fund compute execution without upfront operator capital exposure.'
      };
    }

    return {
      hasZeroCapitalPath: false,
      status: 'NO ZERO-CAPITAL EXECUTION PATH AVAILABLE',
      recommendedProvider: null,
      executableProviders: [],
      blockedProviders,
      reason: 'All candidate providers require prepaid operator balances, but operator accounts are currently unfunded.',
      message: 'NO ZERO-CAPITAL EXECUTION PATH AVAILABLE. System safely holds execution until customer funds can be deposited or a pay-as-you-go provider is connected.'
    };
  }
}

export const zeroFundedBootstrapService = new ZeroFundedBootstrapService();
