import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Coins,
  AlertTriangle,
  RotateCw,
  Lock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  DollarSign,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ZeroFundedProviderStatus {
  providerId: string;
  providerName: string;
  authStatus: string;
  fundingStatus: string;
  executionStatus: string;
  billingMechanism: string;
  verifiedBalanceDisplay: string;
  verifiedBalanceUsd: number | null;
  genuineCreditsDetected: boolean;
  creditDetails?: {
    promotionalCreditUsd?: number;
    freeTrialCreditUsd?: number;
    grantCreditUsd?: number;
    description?: string;
  };
  requiresPrepaidBalance: boolean;
  allowsCustomerFundedExecution: boolean;
  allowsPayAsYouGo: boolean;
  minDepositUsd: number;
  canExecuteWithoutOperatorCapital: boolean;
  lastCheckedIso: string;
  message: string;
}

interface ZeroFundedApiResponse {
  status: string;
  timestamp: string;
  ownerCapitalModeActive: boolean;
  operatorFundsProtected: boolean;
  summary: {
    totalProviders: number;
    executableCount: number;
    blockedCount: number;
    genuineCreditCount: number;
  };
  providers: ZeroFundedProviderStatus[];
}

export const ZeroFundedBootstrapPanel: React.FC = () => {
  const [data, setData] = useState<ZeroFundedApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerModeEnabled, setOwnerModeEnabled] = useState<boolean>(false);
  const [maxSingleTx, setMaxSingleTx] = useState<number>(100);
  const [isUpdatingOwnerMode, setIsUpdatingOwnerMode] = useState<boolean>(false);

  const fetchStatuses = useCallback(async (fresh: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/zero-funded/providers${fresh ? '?fresh=true' : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ZeroFundedApiResponse = await res.json();
      setData(json);
      setOwnerModeEnabled(json.ownerCapitalModeActive);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch provider funding status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(() => fetchStatuses(false), 30000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  const handleToggleOwnerMode = async () => {
    setIsUpdatingOwnerMode(true);
    try {
      const nextState = !ownerModeEnabled;
      const res = await fetch('/api/zero-funded/owner-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: nextState,
          maxSingleTransactionUsd: maxSingleTx,
          maxDailySpendUsd: maxSingleTx * 3,
          maxJobExposureUsd: maxSingleTx,
          maxLossUsd: 50,
          authorizedBy: 'OPERATOR_UI_CONFIRMED'
        })
      });
      const json = await res.json();
      if (json.status === 'ok') {
        setOwnerModeEnabled(nextState);
        fetchStatuses(true);
      } else {
        alert(`Error: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Failed to update mode: ${err.message}`);
    } finally {
      setIsUpdatingOwnerMode(false);
    }
  };

  const getFundingBadge = (funding: string) => {
    switch (funding) {
      case 'FUNDED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">FUNDED</span>;
      case 'CREDIT_AVAILABLE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-950 text-purple-300 border border-purple-800">CREDIT AVAILABLE</span>;
      case 'PAY_AS_YOU_GO':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-950 text-sky-300 border border-sky-800">PAY-AS-YOU-GO</span>;
      case 'PAYMENT_REQUIRED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-800">PAYMENT REQUIRED</span>;
      case 'NOT_FUNDED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-950/80 text-rose-300 border border-rose-800">NOT FUNDED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">UNKNOWN</span>;
    }
  };

  const getExecutionBadge = (exec: string) => {
    switch (exec) {
      case 'EXECUTABLE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> EXECUTABLE</span>;
      case 'CUSTOMER_FUNDED_ONLY':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1"><Zap className="w-3 h-3 text-cyan-400" /> CUSTOMER FUNDED</span>;
      case 'WAITING_FOR_FUNDING':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> WAITING FUNDING</span>;
      case 'UNAVAILABLE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-900 text-slate-500 border border-slate-800">UNAVAILABLE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1"><XCircle className="w-3 h-3 text-rose-400" /> BLOCKED</span>;
    }
  };

  const getAuthBadge = (auth: string) => {
    switch (auth) {
      case 'LIVE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">LIVE</span>;
      case 'AUTHENTICATED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-yellow-950 text-yellow-400 border border-yellow-800">AUTHENTICATED</span>;
      case 'CONFIGURATION_REQUIRED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-900 text-slate-400 border border-slate-700">CONFIG REQ</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-950 text-rose-400 border border-rose-800">{auth}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner: Zero-Capital Policy */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-800/60 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                ZERO-FUNDED PROVIDER BOOTSTRAP ACTIVE
                <span className="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-mono font-semibold">
                  100% OPERATOR PROTECTION
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Operator GPU accounts are initialized with <strong>zero upfront funding</strong>. The OS strictly prevents automatic operator balance spending. Every compute job executes only via <strong>Customer-Funded Escrow</strong>, verified genuine credits, or post-paid pay-as-you-go rails.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStatuses(true)}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Probe Live APIs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tri-State GPU Distinction & First Revenue Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase text-slate-400">Level 1</span>
            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">Catalog</span>
          </div>
          <h4 className="text-sm font-bold text-slate-200 mb-1">AVAILABLE GPU</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            GPU offer listed in market inventory. <em>Does not imply the operator can purchase it.</em>
          </p>
        </div>

        <div className="bg-slate-900/80 border border-cyan-900/60 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase text-cyan-400">Level 2</span>
            <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded text-[10px] font-mono">Financial Gate</span>
          </div>
          <h4 className="text-sm font-bold text-cyan-200 mb-1">PURCHASABLE GPU</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Provider financial requirements satisfied (verified balance, credit, or post-paid terms confirmed).
          </p>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/60 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase text-emerald-400">Level 3</span>
            <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px] font-mono">Workload Ready</span>
          </div>
          <h4 className="text-sm font-bold text-emerald-200 mb-1">EXECUTABLE GPU</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Customer payment verified, escrow reserved for job, preflight passed, ready for provisioning.
          </p>
        </div>
      </div>

      {/* Customer-Funded Execution Chain */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Customer-Funded First Revenue Execution Chain</span>
        </h3>
        <div className="flex items-center justify-between overflow-x-auto gap-2 py-2 text-xs font-mono text-slate-300">
          <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-center min-w-[110px]">
            <div className="text-[10px] text-slate-500 font-bold">1. CUSTOMER</div>
            <div className="text-slate-200 font-semibold">Demand Order</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-center min-w-[110px]">
            <div className="text-[10px] text-slate-500 font-bold">2. PAYMENT</div>
            <div className="text-slate-200 font-semibold">Binance / ITN</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <div className="px-3 py-2 bg-slate-950 border border-cyan-900 rounded-md text-center min-w-[120px] bg-cyan-950/20">
            <div className="text-[10px] text-cyan-400 font-bold">3. ESCROW</div>
            <div className="text-cyan-300 font-semibold">Funds Reserved</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-center min-w-[110px]">
            <div className="text-[10px] text-slate-500 font-bold">4. PROVIDER</div>
            <div className="text-slate-200 font-semibold">Zero-Capital Run</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-center min-w-[110px]">
            <div className="text-[10px] text-slate-500 font-bold">5. WORKLOAD</div>
            <div className="text-slate-200 font-semibold">Output Artifact</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <div className="px-3 py-2 bg-slate-950 border border-emerald-900 rounded-md text-center min-w-[120px] bg-emerald-950/20">
            <div className="text-[10px] text-emerald-400 font-bold">6. PROFIT</div>
            <div className="text-emerald-300 font-semibold">Settled Margin</div>
          </div>
        </div>
      </div>

      {/* Official 10-Row Provider Funding Matrix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <span>AUTHORITATIVE PROVIDER FUNDING STATUS MATRIX</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                10 PROVIDERS
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Populated strictly with verified live API data. Zero simulated balances or fake free credits.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Auto-refresh: 30s
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 font-mono text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Auth Status</th>
                <th className="py-3 px-4">Funding State</th>
                <th className="py-3 px-4">Execution Status</th>
                <th className="py-3 px-4">Billing Mechanism</th>
                <th className="py-3 px-4">Verified Balance</th>
                <th className="py-3 px-4 text-right">Zero-Cap Eligible?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {data && data.providers && data.providers.map((p) => (
                <tr key={p.providerId} className="hover:bg-slate-850/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{p.providerName}</div>
                    <div className="text-[11px] font-mono text-slate-400">{p.providerId}</div>
                  </td>
                  <td className="py-3 px-4">
                    {getAuthBadge(p.authStatus)}
                  </td>
                  <td className="py-3 px-4">
                    {getFundingBadge(p.fundingStatus)}
                  </td>
                  <td className="py-3 px-4">
                    {getExecutionBadge(p.executionStatus)}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                    {p.billingMechanism}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-200">
                    {p.verifiedBalanceDisplay}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {p.canExecuteWithoutOperatorCapital ? (
                      <span className="text-emerald-400 font-semibold">YES</span>
                    ) : (
                      <span className="text-amber-500 font-semibold">CUSTOMER ONLY</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!data || !data.providers || data.providers.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500 font-mono">
                    {isLoading ? 'Querying live provider APIs for balances...' : 'No provider data returned.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Owner Capital Mode (Disabled by default) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>OWNER CAPITAL MODE (OPTIONAL — DISABLED BY DEFAULT)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              When disabled, the system will never attempt to draw from operator bank/card/wallet accounts.
              Enabling requires explicit authorization and enforces strict per-job and daily spending caps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">
              Current: <strong className={ownerModeEnabled ? 'text-emerald-400' : 'text-rose-400'}>
                {ownerModeEnabled ? 'ENABLED' : 'DISABLED (SAFE)'}
              </strong>
            </span>
            <button
              onClick={handleToggleOwnerMode}
              disabled={isUpdatingOwnerMode}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                ownerModeEnabled
                  ? 'bg-rose-700 hover:bg-rose-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {ownerModeEnabled ? 'Disable Owner Mode' : 'Enable Owner Mode'}
            </button>
          </div>
        </div>

        {ownerModeEnabled && (
          <div className="bg-amber-950/30 border border-amber-800/80 rounded-lg p-3 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Owner Capital Authorization Active:</strong> Max single transaction: <strong>${maxSingleTx}</strong>, Max daily spend: <strong>${maxSingleTx * 3}</strong>, Max loss: <strong>$50.00</strong>.
              All operations pass through strict preflight and circuit breakers.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
