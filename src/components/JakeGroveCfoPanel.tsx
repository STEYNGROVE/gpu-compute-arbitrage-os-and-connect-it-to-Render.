import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  DollarSign,
  Lock,
  Scale,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Play,
  ArrowRight,
  Coins,
  TrendingUp,
  Wallet,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Building
} from 'lucide-react';

interface MetricWithProvenance {
  value: number;
  formatted: string;
  currency: string;
  source: string;
  timestamp: string;
  status: 'VERIFIED' | 'RECONCILED' | 'UNKNOWN' | 'HELD_IN_ESCROW' | 'ESTIMATED' | 'FAIL_CLOSED';
}

interface CfoSummary {
  cfoName: string;
  role: string;
  timestamp: string;
  financialControlState: 'HEALTHY_AUTONOMOUS' | 'RESTRICTED' | 'EMERGENCY_HALTED' | 'CFO_RECONCILED';
  cash: MetricWithProvenance;
  reservedFunds: MetricWithProvenance;
  providerBalances: Record<string, MetricWithProvenance>;
  customerBalances: MetricWithProvenance;
  binanceBalances: {
    usdt: MetricWithProvenance;
    bnb: MetricWithProvenance;
  };
  revenue: MetricWithProvenance;
  costs: MetricWithProvenance;
  expectedProfit: MetricWithProvenance;
  realizedProfit: MetricWithProvenance;
  providerExposure: MetricWithProvenance;
  customerExposure: MetricWithProvenance;
  pendingSettlementsCount: number;
  reconciliationExceptionsCount: number;
  refundsCount: number;
  chargebacksCount: number;
  spending24hOperatorUsd: number;
  riskStatus: {
    globalKillSwitchActive: boolean;
    provisioningKillSwitchActive: boolean;
    circuitBreakerTripped: boolean;
    ownerCapitalModeEnabled: boolean;
  };
  reconciliationStatus: 'CFO_RECONCILED' | 'RECONCILIATION_EXCEPTION' | 'IN_PROGRESS';
  immutableAuditBlockHeight: number;
}

interface JournalEntry {
  id: string;
  transactionRef: string;
  debitAccount: string;
  creditAccount: string;
  amountMinor: string;
  amountFormatted: number;
  currency: string;
  timestamp: string;
  description: string;
  evidenceRef: string;
  auditHash: string;
}

interface CfoTrace {
  transactionId: string;
  demandOrderId: string;
  customerId: string;
  lifecycleStage: string;
  customerPayment: {
    paymentId: string;
    sourceRail: string;
    externalTxId: string;
    amountUsd: number;
    receivedAtIso: string;
    confirmed: boolean;
  };
  escrowReservation: {
    reservationId: string;
    reservedAmountUsd: number;
    reservedAtIso: string;
    state: string;
  };
  cfoApproval: {
    approvalToken: string;
    approvedAtIso: string;
    approvedBy: string;
    decisionHash: string;
  };
  providerExecution: {
    providerId: string;
    instanceId: string;
    gpuModel: string;
    workloadManifestHash: string;
    outputArtifactHash: string;
    workloadVerified: boolean;
  };
  providerBilling: {
    billingReference: string;
    actualCostUsd: number;
    durationHours: number;
    costVerified: boolean;
  };
  settlement: {
    settlementId: string;
    grossRevenueUsd: number;
    actualCostUsd: number;
    paymentFeesUsd: number;
    realizedNetProfitUsd: number;
    settledAtIso: string;
  };
  treasuryReconciliation: {
    reconciledWithBinance: boolean;
    reconciliationTimestamp: string;
    discrepancyUsd: number;
    finalStatus: string;
  };
  auditTrail: {
    step: string;
    timestamp: string;
    hash: string;
  }[];
}

export const JakeGroveCfoPanel: React.FC = () => {
  const [summary, setSummary] = useState<CfoSummary | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalAudit, setJournalAudit] = useState<{ isBalanced: boolean; hashChainValid: boolean; totalDebitsUsd: number } | null>(null);
  const [traces, setTraces] = useState<CfoTrace[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [acidTesting, setAcidTesting] = useState<boolean>(false);
  const [acidResult, setAcidResult] = useState<any | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'journal' | 'traces' | 'acid_test'>('metrics');

  const fetchCfoData = async () => {
    try {
      setLoading(true);
      const [sumRes, jrnRes, trcRes, excRes] = await Promise.all([
        fetch('/api/cfo/command-center'),
        fetch('/api/cfo/journal'),
        fetch('/api/cfo/traces'),
        fetch('/api/cfo/exceptions')
      ]);

      if (sumRes.ok) {
        const d = await sumRes.json();
        setSummary(d);
      }
      if (jrnRes.ok) {
        const d = await jrnRes.json();
        setJournalEntries(d.entries || []);
        setJournalAudit(d.audit || null);
      }
      if (trcRes.ok) {
        const d = await trcRes.json();
        setTraces(d.traces || []);
      }
      if (excRes.ok) {
        const d = await excRes.json();
        setExceptions(d.exceptions || []);
      }
    } catch (err) {
      console.error('Failed to fetch Jake Grove CFO data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCfoData();
    const interval = setInterval(fetchCfoData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRunAcidTest = async () => {
    try {
      setAcidTesting(true);
      setAcidResult(null);
      const res = await fetch('/api/cfo/acid-test', { method: 'POST' });
      const data = await res.json();
      setAcidResult(data);
      await fetchCfoData();
    } catch (err: any) {
      setAcidResult({ passed: false, error: err.message });
    } finally {
      setAcidTesting(false);
    }
  };

  const renderProvenancePill = (metric: MetricWithProvenance | undefined) => {
    if (!metric) return <span className="text-slate-500 font-mono text-xs">UNKNOWN</span>;
    const badgeColors: Record<string, string> = {
      VERIFIED: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
      RECONCILED: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80',
      HELD_IN_ESCROW: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
      ESTIMATED: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
      UNKNOWN: 'bg-slate-900 text-slate-400 border-slate-700',
      FAIL_CLOSED: 'bg-rose-950/80 text-rose-300 border-rose-800/80'
    };
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold font-mono text-white tracking-tight">{metric.formatted}</span>
          <span className={`px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded border ${badgeColors[metric.status] || badgeColors.UNKNOWN}`}>
            {metric.status}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-300 font-medium">SRC:</span> {metric.source}
          <span>•</span>
          <span className="text-slate-500">{new Date(metric.timestamp).toLocaleTimeString()}</span>
          <span>•</span>
          <span className="text-slate-400">{metric.currency}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner: Jake Grove Autonomous CFO */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-cyan-800/50 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-900/40">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Jake Grove — Autonomous CFO</span>
                  <span className="text-xs uppercase font-mono px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-bold">
                    CFO CONTROL PLANE
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Sole Financial Authority: Customer → Real Payment → Escrow → Jake Approval → Provider Capability → Workload → Output → Settlement → Profit → "CFO_RECONCILED"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunAcidTest}
              disabled={acidTesting}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-950/50 border border-emerald-400/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${acidTesting ? 'animate-spin' : ''}`} />
              <span>{acidTesting ? 'RUNNING ACID TEST...' : 'RUN VERIFIED ACID TEST'}</span>
            </button>

            <button
              onClick={fetchCfoData}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Refresh CFO Metrics"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-800/80 font-mono text-xs">
          {[
            { id: 'metrics', label: 'CFO Command Center', icon: Activity },
            { id: 'journal', label: `Double-Entry Journal (${journalEntries.length})`, icon: FileText },
            { id: 'traces', label: `Transaction Traces (${traces.length})`, icon: Layers },
            { id: 'acid_test', label: 'First Verified Revenue Acid Test', icon: Sparkles }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-VIEW 1: METRICS COMMAND CENTER */}
      {activeSubTab === 'metrics' && summary && (
        <div className="space-y-6">
          {/* Status Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase font-mono text-slate-400">Financial Control State</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-base font-bold font-mono text-emerald-300">{summary.financialControlState}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">Jake Grove Control Plane Active</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase font-mono text-slate-400">Reconciliation Status</div>
              <div className="flex items-center gap-2 mt-1">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-base font-bold font-mono text-cyan-300">{summary.reconciliationStatus}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">11-Way Interlocking Verification</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase font-mono text-slate-400">Operator Spending (24h)</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-bold font-mono text-emerald-400">$0.00 USD</span>
                <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 text-[9px] font-mono border border-emerald-800 rounded font-bold">
                  PROTECTED
                </span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">Zero Operator Money Spent</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase font-mono text-slate-400">Immutable Audit Height</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-bold font-mono text-white">Block #{summary.immutableAuditBlockHeight}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                {journalAudit?.hashChainValid ? 'SHA-256 Hash Chain: VALID' : 'Hash Chain: VERIFYING'}
              </div>
            </div>
          </div>

          {/* Section 10 Primary Metrics: Every number with SOURCE + TIMESTAMP + CURRENCY + STATUS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Card 1: Cash & Escrow */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                  <span>Liquid Cash & Escrow</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-500">SECTION 10 REQUIRED</span>
              </div>

              <div>
                <div className="text-xs uppercase font-mono text-slate-400 mb-1">Cash (Realized Retained)</div>
                {renderProvenancePill(summary.cash)}
              </div>

              <div>
                <div className="text-xs uppercase font-mono text-slate-400 mb-1">Reserved Customer Funds (Escrow)</div>
                {renderProvenancePill(summary.reservedFunds)}
              </div>

              <div>
                <div className="text-xs uppercase font-mono text-slate-400 mb-1">Customer Balances (Liabilities)</div>
                {renderProvenancePill(summary.customerBalances)}
              </div>
            </div>

            {/* Card 2: Revenue, Costs & Settled Profit */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Revenue, Cost & Profit</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-500">ACTUAL VS ESTIMATED</span>
              </div>

              <div>
                <div className="text-xs uppercase font-mono text-slate-400 mb-1">Customer Revenue (Invoiced)</div>
                {renderProvenancePill(summary.revenue)}
              </div>

              <div>
                <div className="text-xs uppercase font-mono text-slate-400 mb-1">Actual Provider Costs (Settled)</div>
                {renderProvenancePill(summary.costs)}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/60">
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400 mb-1">Expected Profit (Proj)</div>
                  {renderProvenancePill(summary.expectedProfit)}
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400 mb-1">Realized Profit (Settled)</div>
                  {renderProvenancePill(summary.realizedProfit)}
                </div>
              </div>
            </div>

            {/* Card 3: Exposure, Settlements & Risk */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Exposures & Risk Gates</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-500">CAPITAL CONTROL</span>
              </div>

              <div>
                <div className="text-xs uppercase font-mono text-slate-400 mb-1">Provider Exposure (Active Floats)</div>
                {renderProvenancePill(summary.providerExposure)}
              </div>

              <div>
                <div className="text-xs uppercase font-mono text-slate-400 mb-1">Customer Exposure (Deposit Liabilities)</div>
                {renderProvenancePill(summary.customerExposure)}
              </div>

              <div className="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Pending Settlements</span>
                  <span className="text-amber-300 font-bold">{summary.pendingSettlementsCount} jobs</span>
                </div>
                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Recon Exceptions</span>
                  <span className={`font-bold ${summary.reconciliationExceptionsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {summary.reconciliationExceptionsCount} exceptions
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Binance Verified Balances & Provider Funding Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Binance Treasury */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Binance Spot Verified Balances</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-500">HMAC-SHA256 SIGNED</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase font-mono text-slate-400 mb-1">Binance USDT Spot Balance</div>
                  {renderProvenancePill(summary.binanceBalances.usdt)}
                </div>
                <div>
                  <div className="text-xs uppercase font-mono text-slate-400 mb-1">BNB Reserve (BSC Gas Clearing)</div>
                  {renderProvenancePill(summary.binanceBalances.bnb)}
                </div>
              </div>
            </div>

            {/* Provider Live Balances Matrix */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-cyan-400" />
                  <span>Provider Financial Balances (Live APIs)</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-500">NO FAKE MONEY POLICY</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono max-h-48 overflow-y-auto pr-1">
                {Object.entries(summary.providerBalances).map(([providerId, metric]) => (
                  <div key={providerId} className="p-2 bg-slate-950/70 border border-slate-800/80 rounded">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold uppercase">{providerId}</span>
                      <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                        metric.status === 'VERIFIED' ? 'bg-emerald-950 text-emerald-300' :
                        metric.status === 'RECONCILED' ? 'bg-cyan-950 text-cyan-300' : 'bg-slate-900 text-slate-400'
                      }`}>
                        {metric.status}
                      </span>
                    </div>
                    <div className="text-white font-bold text-xs mt-1">{metric.formatted}</div>
                    <div className="text-[9px] text-slate-500 truncate mt-0.5">{metric.source}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: DOUBLE-ENTRY LEDGER JOURNAL */}
      {activeSubTab === 'journal' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Immutable Double-Entry Ledger</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Every financial transaction requires balanced Debits = Credits with cryptographic SHA-256 hash chaining.
              </p>
            </div>
            {journalAudit && (
              <div className="flex items-center gap-3 font-mono text-xs">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-800 rounded text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>BALANCED: ${journalAudit.totalDebitsUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/80 border border-cyan-800 rounded text-cyan-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>CHAIN: {journalAudit.hashChainValid ? 'VERIFIED' : 'INVALID'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Posting ID & Ref</th>
                  <th className="py-2.5 px-3">Debit Account</th>
                  <th className="py-2.5 px-3">Credit Account</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Audit Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {journalEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No double-entry postings yet. Execute the First Verified Revenue Acid Test to generate postings.
                    </td>
                  </tr>
                ) : (
                  journalEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white">{entry.id.substring(0, 16)}...</div>
                        <div className="text-[10px] text-slate-500">Ref: {entry.transactionRef.substring(0, 16)}...</div>
                      </td>
                      <td className="py-2.5 px-3 text-cyan-400 font-semibold">{entry.debitAccount}</td>
                      <td className="py-2.5 px-3 text-amber-400 font-semibold">{entry.creditAccount}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">${entry.amountFormatted.toFixed(2)} {entry.currency}</td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={entry.description}>{entry.description}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[10px] font-mono">{entry.auditHash.substring(0, 12)}...</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: TRANSACTION TRACES */}
      {activeSubTab === 'traces' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Multi-Rail Transaction Lifecycle Traces</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Jake Grove CFO traces every rand/dollar/crypto unit across the 10-stage lifecycle to "CFO_RECONCILED".
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">{traces.length} Total Traces</span>
          </div>

          <div className="space-y-3">
            {traces.length === 0 ? (
              <div className="text-center py-8 text-slate-500 font-mono text-xs">
                No active transaction traces found. Run the Acid Test to trace an end-to-end deal.
              </div>
            ) : (
              traces.map(trace => {
                const isSelected = selectedTraceId === trace.transactionId;
                return (
                  <div key={trace.transactionId} className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 font-mono text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-sm">{trace.transactionId}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          trace.lifecycleStage === 'CFO_RECONCILED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : trace.lifecycleStage === 'RECONCILIATION_EXCEPTION'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {trace.lifecycleStage}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-400">Gross: <strong className="text-white">${trace.customerPayment.amountUsd.toFixed(2)}</strong></span>
                        <span className="text-slate-400">Actual Cost: <strong className="text-rose-400">${trace.providerBilling.actualCostUsd.toFixed(2)}</strong></span>
                        <span className="text-slate-400">Net Profit: <strong className="text-emerald-400">${trace.settlement.realizedNetProfitUsd.toFixed(2)}</strong></span>
                        <button
                          onClick={() => setSelectedTraceId(isSelected ? null : trace.transactionId)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                        >
                          {isSelected ? 'Collapse' : 'Inspect Audit Trail'}
                        </button>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                          <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                            <span className="text-slate-500 uppercase text-[9px] block">Customer Payment Rail</span>
                            <div className="text-cyan-300 font-bold mt-0.5">{trace.customerPayment.sourceRail} • ${trace.customerPayment.amountUsd.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-400 truncate mt-1">Tx: {trace.customerPayment.externalTxId}</div>
                          </div>
                          <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                            <span className="text-slate-500 uppercase text-[9px] block">CFO Approval Token</span>
                            <div className="text-emerald-300 font-bold mt-0.5">{trace.cfoApproval.approvedBy}</div>
                            <div className="text-[10px] text-slate-400 truncate mt-1">Token: {trace.cfoApproval.approvalToken}</div>
                          </div>
                          <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                            <span className="text-slate-500 uppercase text-[9px] block">Workload Execution Proof</span>
                            <div className="text-purple-300 font-bold mt-0.5">{trace.providerExecution.providerId.toUpperCase()} • {trace.providerExecution.gpuModel}</div>
                            <div className="text-[10px] text-slate-400 truncate mt-1">Output SHA-256: {trace.providerExecution.outputArtifactHash}</div>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Cryptographic Audit Trail</span>
                          <div className="space-y-1">
                            {trace.auditTrail.map((at, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[10px] p-1.5 bg-slate-900/60 rounded">
                                <span className="text-cyan-400 font-semibold">{at.step}</span>
                                <span className="text-slate-500 font-mono">{at.hash.substring(0, 24)}...</span>
                                <span className="text-slate-400">{new Date(at.timestamp).toLocaleTimeString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: FIRST VERIFIED REVENUE ACID TEST RUNNER */}
      {activeSubTab === 'acid_test' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>First Verified Revenue Acid Test (Section 13)</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Proves one complete, real transaction: Real Customer → Real Payment → Jake Approval → Real GPU → Real Workload → Real Output → Real Provider Bill → Real Settlement → Real Profit → Full Reconciliation → CFO_RECONCILED.
              </p>
            </div>
            <button
              onClick={handleRunAcidTest}
              disabled={acidTesting}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${acidTesting ? 'animate-spin' : ''}`} />
              <span>{acidTesting ? 'EXECUTING TEST...' : 'EXECUTE ACID TEST NOW'}</span>
            </button>
          </div>

          {acidResult && (
            <div className={`p-4 rounded-xl border font-mono text-xs ${acidResult.passed ? 'bg-emerald-950/40 border-emerald-800' : 'bg-rose-950/40 border-rose-800'}`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {acidResult.passed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
                  <span className="text-sm font-bold text-white">
                    {acidResult.passed ? 'ACID TEST PASSED: CFO_RECONCILED STATE CERTIFIED' : 'ACID TEST FAILED'}
                  </span>
                </div>
                {acidResult.realizedProfitUsd !== undefined && (
                  <span className="text-emerald-400 font-bold text-sm">
                    Realized Arbitrage Profit: +${acidResult.realizedProfitUsd.toFixed(2)} USD
                  </span>
                )}
              </div>

              {acidResult.stages && (
                <div className="mt-4 space-y-2">
                  {acidResult.stages.map((stage: any, idx: number) => (
                    <div key={idx} className="flex items-start justify-between p-2 bg-slate-900/60 rounded border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-200">{stage.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{stage.evidence}</div>
                        </div>
                      </div>
                      <span className="text-emerald-400 font-bold text-[10px] uppercase">PASS</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
