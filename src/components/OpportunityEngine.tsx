import React, { useState } from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Play, 
  Layers, 
  DollarSign, 
  Clock, 
  ShieldCheck, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  TrendingUp,
  Cpu,
  Server
} from 'lucide-react';
import { Opportunity, MonetizationLevel, OpportunityGrade, CanonicalOpportunityState, GPU_WORKLOAD_CATALOG, getGpuWorkloadSpec } from '../types';

export const OpportunityEngine: React.FC = () => {
  const {
    opportunities,
    opportunitySummary,
    executeOpportunity,
    approveBigJob,
    humanApprovedBigJobs,
    selectedMonetizationLevel,
    setSelectedMonetizationLevel,
    ownerConfig,
    scanNow,
    isScanning
  } = useArbitrage();

  const [filterGrade, setFilterGrade] = useState<OpportunityGrade | 'ALL'>('ALL');
  const [filterState, setFilterState] = useState<CanonicalOpportunityState | 'ALL'>('ALL');
  const [filterWorkload, setFilterWorkload] = useState<string>('ALL');
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [executionFeedback, setExecutionFeedback] = useState<{ id: string; message: string; success: boolean } | null>(null);

  const bigJobThresholdUsd = Number(ownerConfig.humanApprovalThresholdUsd ?? 250);

  // Filtered opportunities, strictly sorted by ROI descending
  const filteredOpportunities = opportunities
    .filter(opp => {
      if (filterGrade !== 'ALL' && opp.grade !== filterGrade) return false;
      if (filterWorkload !== 'ALL') {
        const spec = getGpuWorkloadSpec(opp.workloadType || opp.demandOrder?.workloadType, opp.matchedOffer?.gpuModel);
        if (spec.id !== filterWorkload) return false;
      }
      if (filterState !== 'ALL') {
        if (filterState === 'PROFITABLE') {
          if (opp.discoveryStatus !== 'PROFITABLE' && opp.expectedNetContribution <= 0) return false;
        } else if (filterState === 'CAPITAL_BLOCKED') {
          if (opp.canonicalStatus !== 'CAPITAL_BLOCKED' && !(opp.blockReasons || []).includes('INSUFFICIENT_OPERATING_CAPITAL')) return false;
        } else if (filterState === 'PROVIDER_BLOCKED') {
          if (opp.canonicalStatus !== 'PROVIDER_BLOCKED' && !(opp.blockReasons || []).includes('PROVIDER_ACCOUNT_UNFUNDED')) return false;
        } else if (filterState === 'CUSTOMER_REQUIRED') {
          if (opp.canonicalStatus !== 'CUSTOMER_REQUIRED' && !(opp.blockReasons || []).includes('CUSTOMER_VERIFICATION_REQUIRED')) return false;
        } else if (opp.canonicalStatus !== filterState && opp.status !== filterState) {
          return false;
        }
      }
      if (selectedMonetizationLevel !== 'ALL' && opp.monetizationLevel !== selectedMonetizationLevel) return false;
      return true;
    })
    .sort((a, b) => {
      // Prioritize EXECUTABLE opportunities first so user immediately sees jobs ready to deploy with available capital
      const aExec = (a.executionEligible || a.canonicalStatus === 'EXECUTABLE') ? 1 : 0;
      const bExec = (b.executionEligible || b.canonicalStatus === 'EXECUTABLE') ? 1 : 0;
      if (aExec !== bExec) return bExec - aExec;

      const aProf = a.discoveryStatus === 'PROFITABLE' || a.expectedNetContribution > 0 ? 1 : 0;
      const bProf = b.discoveryStatus === 'PROFITABLE' || b.expectedNetContribution > 0 ? 1 : 0;
      if (aProf !== bProf) return bProf - aProf;
      const roiDiff = (b.roiPct ?? 0) - (a.roiPct ?? 0);
      if (roiDiff !== 0) return roiDiff;
      return (b.expectedNetContribution ?? 0) - (a.expectedNetContribution ?? 0);
    });

  const handleApproveBigJob = async (opp: Opportunity) => {
    setApprovingId(opp.id);
    setExecutionFeedback(null);
    const res = await approveBigJob(opp.id);
    setApprovingId(null);
    setExecutionFeedback({ id: opp.id, message: res.message, success: res.success });
  };

  const handleExecute = async (opp: Opportunity) => {
    setExecutingId(opp.id);
    setExecutionFeedback(null);
    const res = await executeOpportunity(opp.id, opp.monetizationLevel);
    setExecutingId(null);
    setExecutionFeedback({ id: opp.id, message: res.message, success: res.success });
  };

  const getCanonicalStateBadge = (opp: Opportunity) => {
    const st = opp.canonicalStatus || opp.status;
    if (opp.executionEligible && st === 'EXECUTABLE') {
      return <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700 rounded font-mono text-xs font-bold">🟢 EXECUTABLE</span>;
    }
    if (st === 'CAPITAL_BLOCKED' || (opp.blockReasons || []).includes('INSUFFICIENT_OPERATING_CAPITAL')) {
      return <span className="px-2.5 py-1 bg-amber-950 text-amber-300 border border-amber-700 rounded font-mono text-xs font-bold">🟡 CAPITAL BLOCKED</span>;
    }
    if (st === 'PROVIDER_BLOCKED') {
      return <span className="px-2.5 py-1 bg-orange-950 text-orange-300 border border-orange-700 rounded font-mono text-xs font-bold">🟠 PROVIDER BLOCKED</span>;
    }
    if (st === 'CUSTOMER_REQUIRED') {
      return <span className="px-2.5 py-1 bg-blue-950 text-blue-300 border border-blue-700 rounded font-mono text-xs font-bold">🔵 CUSTOMER REQUIRED</span>;
    }
    if (st === 'EXPIRED') {
      return <span className="px-2.5 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded font-mono text-xs font-bold">⚪ EXPIRED</span>;
    }
    if (st === 'REJECTED') {
      return <span className="px-2.5 py-1 bg-rose-950 text-rose-300 border border-rose-800 rounded font-mono text-xs font-bold">🔴 REJECTED</span>;
    }
    return <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-mono text-xs font-bold">{st}</span>;
  };

  const getGradeBadge = (grade: OpportunityGrade) => {
    switch (grade) {
      case 'AUTO':
        return <span className="px-2.5 py-1 bg-emerald-950/90 text-emerald-300 border border-emerald-800 rounded font-mono text-xs font-bold flex items-center gap-1.5">🟢 AUTO (Grade A)</span>;
      case 'REVIEW':
        return <span className="px-2.5 py-1 bg-amber-950/90 text-amber-300 border border-amber-800 rounded font-mono text-xs font-bold flex items-center gap-1.5">🟡 REVIEW (Grade B)</span>;
      case 'WATCH':
        return <span className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded font-mono text-xs font-bold flex items-center gap-1.5">⚪ WATCH (Grade C)</span>;
      case 'REJECT':
        return <span className="px-2.5 py-1 bg-rose-950/90 text-rose-300 border border-rose-800 rounded font-mono text-xs font-bold flex items-center gap-1.5">🔴 REJECT (Grade D)</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar + 6 Authoritative Pipeline Summary Cards */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4 font-mono">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                Pipeline A (Opportunity Discovery) & Pipeline B (Capital Gate)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Last market update: <span className="text-cyan-300 font-bold">{opportunitySummary.lastMarketUpdateFormatted}</span>
              {' • '}Verified Available Capital: <span className="text-emerald-400 font-bold">${opportunitySummary.verifiedAvailableCapitalUsd.toFixed(2)}</span>
              {' • '}Data Status: <span className={opportunitySummary.dataStatus === 'DATA_UNAVAILABLE' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{opportunitySummary.dataStatus}</span>
              {' • '}Ranking: <span className="text-cyan-300 font-bold">Sorted by ROI (Highest Return %)</span>
              {' • '}Big Job Gate: <span className="text-amber-300 font-bold">&ge; ${bigJobThresholdUsd.toFixed(0)} Requires Human Approval</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => scanNow()}
              disabled={isScanning}
              className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isScanning ? 'Scanning Live Providers...' : 'Run Live Discovery'}
            </button>
          </div>
        </div>

        {/* 6 Required Dashboard Cards (Click to filter by state) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setFilterState('ALL')}
            className={`text-left bg-slate-950 border rounded-lg p-3 cursor-pointer transition-colors ${filterState === 'ALL' ? 'border-cyan-500' : 'border-cyan-900/60 hover:border-cyan-700'}`}
          >
            <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">REAL OPPORTUNITIES</div>
            <div className="text-2xl font-bold text-white mt-1">
              {opportunitySummary.dataStatus === 'DATA_UNAVAILABLE' && opportunitySummary.realOpportunities === 0
                ? 'DATA_UNAVAILABLE'
                : opportunitySummary.realOpportunities}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">All discovered spreads</div>
          </button>

          <button
            onClick={() => setFilterState('PROFITABLE')}
            className={`text-left bg-slate-950 border rounded-lg p-3 cursor-pointer transition-colors ${filterState === 'PROFITABLE' ? 'border-emerald-400' : 'border-emerald-900/60 hover:border-emerald-700'}`}
          >
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">PROFITABLE</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{opportunitySummary.profitable}</div>
            <div className="text-[10px] text-slate-400 mt-1">Positive after all fees</div>
          </button>

          <button
            onClick={() => setFilterState('EXECUTABLE')}
            className={`text-left bg-slate-950 border rounded-lg p-3 cursor-pointer transition-colors ${filterState === 'EXECUTABLE' ? 'border-emerald-300' : 'border-emerald-700/60 hover:border-emerald-500'}`}
          >
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">EXECUTABLE NOW</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">{opportunitySummary.executableNow}</div>
            <div className="text-[10px] text-slate-400 mt-1">Ready for deployment</div>
          </button>

          <button
            onClick={() => setFilterState('CAPITAL_BLOCKED')}
            className={`text-left bg-slate-950 border rounded-lg p-3 cursor-pointer transition-colors ${filterState === 'CAPITAL_BLOCKED' ? 'border-amber-400' : 'border-amber-900/60 hover:border-amber-700'}`}
          >
            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">CAPITAL BLOCKED</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{opportunitySummary.capitalBlocked}</div>
            <div className="text-[10px] text-slate-400 mt-1">Shortfall &gt; $0.00</div>
          </button>

          <button
            onClick={() => setFilterState('PROVIDER_BLOCKED')}
            className={`text-left bg-slate-950 border rounded-lg p-3 cursor-pointer transition-colors ${filterState === 'PROVIDER_BLOCKED' ? 'border-orange-400' : 'border-orange-900/60 hover:border-orange-700'}`}
          >
            <div className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">PROVIDER BLOCKED</div>
            <div className="text-2xl font-bold text-orange-400 mt-1">{opportunitySummary.providerBlocked}</div>
            <div className="text-[10px] text-slate-400 mt-1">Provider account/stock</div>
          </button>

          <button
            onClick={() => setFilterState('CUSTOMER_REQUIRED')}
            className={`text-left bg-slate-950 border rounded-lg p-3 cursor-pointer transition-colors ${filterState === 'CUSTOMER_REQUIRED' ? 'border-blue-400' : 'border-blue-900/60 hover:border-blue-700'}`}
          >
            <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">CUSTOMER REQUIRED</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{opportunitySummary.customerRequired}</div>
            <div className="text-[10px] text-slate-400 mt-1">Awaiting escrow order</div>
          </button>
        </div>

        {/* TOTAL MONEY REQUIRED FOR ALL PROFITABLE JOBS SUMMARY STRIP */}
        <div className="bg-slate-950 border border-amber-800/60 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <div className="text-[10px] uppercase text-amber-400 font-bold">Total Capital Required ({opportunitySummary.profitable} Jobs)</div>
            <div className="text-lg font-bold text-white mt-0.5">
              ${(opportunitySummary.totalRequiredCapitalForProfitableUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400 font-bold">Verified Available Capital</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              ${(opportunitySummary.verifiedAvailableCapitalUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-rose-400 font-bold">Total Capital Shortfall</div>
            <div className="text-lg font-bold text-rose-400 mt-0.5">
              ${(opportunitySummary.totalCapitalShortfallForProfitableUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-cyan-400 font-bold">Best Single Job Capital</div>
            <div className="text-lg font-bold text-cyan-300 mt-0.5">
              ${(opportunitySummary.requiredCapitalForBestOpportunityUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400 font-bold">Total Forecast Revenue</div>
            <div className="text-lg font-bold text-slate-200 mt-0.5">
              ${(opportunitySummary.totalExpectedRevenueForProfitableUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-emerald-400 font-bold">Total Expected Net Profit</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              +${(opportunitySummary.totalExpectedNetProfitForProfitableUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[10px] text-emerald-300/80 ml-1">({(opportunitySummary.weightedExpectedRoiPct ?? 0).toFixed(1)}% ROI)</span>
            </div>
          </div>
        </div>

        {/* Grade Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs overflow-x-auto">
            {(['ALL', 'AUTO', 'REVIEW', 'WATCH', 'REJECT'] as const).map(grade => (
              <button
                key={grade}
                onClick={() => setFilterGrade(grade)}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  filterGrade === grade
                    ? 'bg-slate-800 text-cyan-400 font-bold border border-cyan-800/80'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {grade === 'ALL' ? 'All Grades' : grade}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterWorkload}
              onChange={e => setFilterWorkload(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All 16 GPU Workloads</option>
              {GPU_WORKLOAD_CATALOG.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} — Pays for: {w.customerPaysFor}
                </option>
              ))}
            </select>
            {filterState !== 'ALL' && (
              <button
                onClick={() => setFilterState('ALL')}
                className="text-xs text-amber-300 hover:text-amber-200 underline cursor-pointer"
              >
                Clear State Filter ({filterState})
              </button>
            )}
          </div>
        </div>

        {/* 3-Level Monetization Engine Switcher */}
        <div className="pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-2 font-mono text-xs">
          <button
            onClick={() => setSelectedMonetizationLevel('ALL')}
            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedMonetizationLevel === 'ALL'
                ? 'bg-cyan-950/60 border-cyan-700 text-white'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-cyan-300">All Monetization Levels</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Evaluate all available revenue structures</div>
          </button>

          <button
            onClick={() => setSelectedMonetizationLevel(1)}
            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedMonetizationLevel === 1
                ? 'bg-blue-950/60 border-blue-700 text-white'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-blue-300">Level 1: Direct Compute</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Buy GPU → Resell raw compute hours</div>
          </button>

          <button
            onClick={() => setSelectedMonetizationLevel(2)}
            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedMonetizationLevel === 2
                ? 'bg-purple-950/60 border-purple-700 text-white'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-purple-300">Level 2: AI Serving / API</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Buy GPU → Run vLLM/API → Sell tokens</div>
          </button>

          <button
            onClick={() => setSelectedMonetizationLevel(3)}
            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedMonetizationLevel === 3
                ? 'bg-emerald-950/60 border-emerald-700 text-white'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-emerald-300">Level 3: Finished Outcome</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Buy GPU → Full pipeline → Sell artifact</div>
          </button>
        </div>
      </div>

      {/* Opportunity Cards List */}
      <div className="space-y-4">
        {filteredOpportunities.length > 0 ? (
          filteredOpportunities.map((opp, idx) => {
            const isExpanded = expandedOppId === opp.id;
            const isExecuting = executingId === opp.id;
            const isApproving = approvingId === opp.id;
            const feedback = executionFeedback?.id === opp.id ? executionFeedback : null;
            const reqCap = Number(opp.requiredCapitalUsd ?? opp.capitalRequired ?? 0);
            const isBigJob = Boolean(opp.isBigJob ?? (reqCap >= bigJobThresholdUsd));
            const isHumanApproved = Boolean(opp.humanApproved || humanApprovedBigJobs.has(opp.id));
            const needsHumanApproval = isBigJob && (ownerConfig.requireHumanApprovalForBigJobs !== false) && !isHumanApproved;

            return (
              <div 
                key={opp.id} 
                className={`bg-slate-900/80 border rounded-xl p-5 font-mono transition-all ${
                  opp.grade === 'AUTO' 
                    ? 'border-emerald-900/70 shadow-lg shadow-emerald-950/20' 
                    : opp.grade === 'REVIEW' 
                    ? 'border-amber-900/70 shadow-lg shadow-amber-950/20' 
                    : 'border-slate-800'
                }`}
              >
                {/* Main Card Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Metadata */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-700 rounded text-xs font-bold">
                        #{idx + 1} ROI: +{(opp.roiPct ?? 0).toFixed(1)}%
                      </span>
                      {getCanonicalStateBadge(opp)}
                      {isBigJob && (
                        needsHumanApproval ? (
                          <span className="px-2.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-600 rounded text-xs font-bold flex items-center gap-1">
                            🔒 BIG JOB (${reqCap.toFixed(0)}) — HUMAN APPROVAL REQUIRED
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-600 rounded text-xs font-bold flex items-center gap-1">
                            ✅ BIG JOB (${reqCap.toFixed(0)}) — HUMAN APPROVED
                          </span>
                        )
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        opp.discoveryStatus === 'PROFITABLE' || opp.expectedNetContribution > 0
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          : 'bg-rose-950/80 text-rose-300 border-rose-800'
                      }`}>
                        DISCOVERY: {opp.discoveryStatus || (opp.expectedNetContribution > 0 ? 'PROFITABLE' : 'REJECTED')}
                      </span>
                      {getGradeBadge(opp.grade)}
                      <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs rounded font-bold uppercase">
                        Provider: {opp.matchedOffer.provider === 'vast_ai' ? 'Vast.ai' : opp.matchedOffer.provider === 'runpod' ? 'RunPod' : opp.matchedOffer.provider === 'lambda' ? 'Lambda Cloud' : opp.matchedOffer.provider}
                      </span>
                      {opp.matchedOffer.isLiveApiVerified ? (
                        <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs rounded font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          LIVE API VERIFIED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-800 text-xs rounded font-medium flex items-center gap-1">
                          <span>⚠️</span>
                          FALLBACK MARKET STREAM
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        ID: {opp.id}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white flex items-center gap-2 pt-1 flex-wrap">
                      <span>{opp.demandOrder.customerName}</span>
                      <span className="text-xs text-slate-400 font-normal">
                        ({opp.demandOrder.demandClass} • {opp.demandOrder.paymentStatus})
                      </span>
                    </h3>

                    {(() => {
                      const wSpec = getGpuWorkloadSpec(opp.workloadType || opp.demandOrder?.workloadType, opp.matchedOffer?.gpuModel);
                      const wName = opp.workloadName || wSpec.name;
                      const wPaysFor = opp.customerPaysFor || wSpec.customerPaysFor;
                      const wExample = opp.workloadExample || wSpec.example;
                      return (
                        <div className="bg-slate-950/90 border border-cyan-900/50 rounded-lg px-3 py-1.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>
                            <strong className="text-cyan-400 uppercase text-[10px]">GPU Workload:</strong>{' '}
                            <span className="text-white font-bold">{wName}</span>
                          </span>
                          <span>
                            <strong className="text-amber-400 uppercase text-[10px]">What Customer Pays For:</strong>{' '}
                            <span className="text-amber-300 font-semibold">{wPaysFor}</span>
                          </span>
                          <span>
                            <strong className="text-slate-400 uppercase text-[10px]">Example:</strong>{' '}
                            <span className="text-slate-300">{wExample}</span>
                          </span>
                        </div>
                      );
                    })()}

                    <div className="text-xs text-slate-300 flex items-center gap-3 flex-wrap">
                      <span><strong>GPU:</strong> {opp.demandOrder.gpuCount}x {opp.matchedOffer.gpuModel}</span>
                      <span><strong>Duration:</strong> {opp.demandOrder.durationHours}h</span>
                      <span><strong>Provider Rate:</strong> ${opp.matchedOffer.hourlyPrice.toFixed(2)}/hr</span>
                      <span><strong>Customer/Market Rate:</strong> ${opp.demandOrder.customerHourlyRate.toFixed(2)}/hr</span>
                      <span><strong>Location:</strong> {opp.matchedOffer.location} ({opp.matchedOffer.region})</span>
                    </div>
                  </div>

                  {/* Right Financials Overview */}
                  <div className="flex items-center gap-4 lg:text-right shrink-0">
                    <div className="bg-slate-950/90 border border-cyan-800/80 rounded-lg p-3 space-y-1">
                      <div className="text-[10px] text-cyan-400 uppercase font-bold">Return on Capital (ROI)</div>
                      <div className="text-xl font-bold text-cyan-300">
                        +{(opp.roiPct ?? 0).toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-emerald-400 font-semibold">
                        +${(opp.estimatedGrossProfitUsd ?? opp.expectedNetContribution ?? 0).toFixed(2)} net ({opp.expectedMarginPct ?? 0}% margin)
                      </div>
                    </div>

                    <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase">Capital Shortfall</div>
                      <div className={`text-xl font-bold ${(opp.capitalShortfallUsd ?? 0) <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        ${(opp.capitalShortfallUsd ?? Math.max(0, (opp.capitalRequired ?? 0) - opportunitySummary.verifiedAvailableCapitalUsd)).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Req: ${(opp.requiredCapitalUsd ?? opp.capitalRequired ?? 0).toFixed(2)} | Avail: ${(opp.verifiedAvailableCapitalUsd ?? opportunitySummary.verifiedAvailableCapitalUsd).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 8: Expected Economics vs Capital Gate Requirement Block */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 border border-slate-800/90 rounded-lg p-3 space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-cyan-400 border-b border-slate-800 pb-1">
                      Expected Economics (Forecast Only — Never Realized Ledger Money)
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected Revenue:</span>
                      <strong className="text-white">${(opp.expectedRevenueUsd ?? opp.grossRevenue ?? 0).toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected GPU Cost:</span>
                      <strong className="text-rose-300">${(opp.expectedProviderCostUsd ?? opp.costBreakdown?.computeCost ?? 0).toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected Fees (Payment + Network + Platform):</span>
                      <strong className="text-amber-300">
                        ${(opp.estimatedFeesUsd ?? ((opp.costBreakdown?.totalLandedCost ?? 0) - (opp.costBreakdown?.computeCost ?? 0))).toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-800">
                      <span className="text-slate-300 font-bold">Expected Profit:</span>
                      <strong className="text-emerald-400">+${(opp.estimatedGrossProfitUsd ?? opp.expectedNetContribution ?? 0).toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/90 rounded-lg p-3 space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-amber-400 border-b border-slate-800 pb-1">
                      Pipeline B Capital Requirement & Execution Gate
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Required Capital:</span>
                      <strong className="text-white">${(opp.requiredCapitalUsd ?? opp.capitalRequired ?? 0).toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Available Capital (Verified):</span>
                      <strong className="text-emerald-400">${(opp.verifiedAvailableCapitalUsd ?? opportunitySummary.verifiedAvailableCapitalUsd ?? 0).toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Capital Shortfall:</span>
                      <strong className="text-amber-400">
                        ${(opp.capitalShortfallUsd ?? Math.max(0, (opp.capitalRequired ?? 0) - opportunitySummary.verifiedAvailableCapitalUsd)).toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-800">
                      <span className="text-slate-300 font-bold">STATUS:</span>
                      <strong className={opp.executionEligible ? 'text-emerald-400' : 'text-amber-300'}>
                        {opp.executionEligible ? '🟢 EXECUTABLE' : `🟡 ${(opp.canonicalStatus || 'CAPITAL_BLOCKED').replace(/_/g, ' ')}`}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Explicit Block Reasons & Data Freshness Row */}
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/80 border border-slate-800/80 rounded p-2.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Block Reasons:</span>
                    {(opp.blockReasons || []).length > 0 ? (
                      (opp.blockReasons || []).map((reason, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[10px] font-bold">
                          {reason}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px] font-bold">
                        NONE — ELIGIBLE FOR EXECUTION
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-3 shrink-0">
                    <span>Source: <strong className="text-slate-300">{opp.source || opp.matchedOffer.provider.toUpperCase()}</strong></span>
                    <span>Confidence: <strong className="text-emerald-400">{opp.confidenceScore}%</strong></span>
                    <span>Expires: <strong className="text-cyan-300">{opp.expiresAt ? new Date(opp.expiresAt).toLocaleTimeString() : '15m'}</strong></span>
                  </div>
                </div>

                {/* Grade Reason Banner */}
                <div className="mt-3 p-2.5 bg-slate-950 border border-slate-800 rounded text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-slate-300 text-[11px]">{opp.gradeReason}</span>
                  </div>
                  <button
                    onClick={() => setExpandedOppId(isExpanded ? null : opp.id)}
                    className="text-cyan-400 hover:text-cyan-300 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Verification Audit' : 'Inspect 7-Pillar Verification'}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* EXPANDABLE AUDIT & 7-PILLAR COST BREAKDOWN DRAWER */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 text-xs">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      
                      {/* Left: 7-Pillar Landed Cost Breakdown */}
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                        <div className="font-bold text-slate-200 uppercase text-xs border-b border-slate-800 pb-2 flex justify-between">
                          <span>Independent 7-Pillar Landed Cost Breakdown</span>
                          <span className="text-rose-400">${(opp.costBreakdown?.totalLandedCost ?? 0).toFixed(2)}</span>
                        </div>

                        <div className="space-y-1.5 pt-1 text-[11px]">
                          <div className="flex justify-between text-slate-300">
                            <span>1. Compute Capacity ({opp.matchedOffer.gpuModel} @ ${opp.matchedOffer.hourlyPrice}/hr):</span>
                            <span className="font-semibold">${(opp.costBreakdown?.computeCost ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>2. Dedicated NVMe Storage ({opp.matchedOffer.storageGb} GB amortized):</span>
                            <span>${(opp.costBreakdown?.storageCost ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>3. High-Speed Bandwidth & Egress:</span>
                            <span>${(opp.costBreakdown?.bandwidthCost ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>4. Provider Booking & Booking Fees ({opp.matchedOffer.provider}):</span>
                            <span>${(opp.costBreakdown?.providerFees ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>5. Payment Processing & Escrow Clearance (2.9% + $0.30):</span>
                            <span>${(opp.costBreakdown?.paymentProcessingFee ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>6. Expected Interruption / Reboot Contingency:</span>
                            <span>${(opp.costBreakdown?.expectedFailureCost ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>7. Dispute & Refund Safety Reserve (1.5%):</span>
                            <span>${(opp.costBreakdown?.refundContingency ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Hard Rule Checks Verification Matrix */}
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                        <div className="font-bold text-slate-200 uppercase text-xs border-b border-slate-800 pb-2 flex justify-between">
                          <span>Hard Risk Policy Checks</span>
                          <span className={opp.allHardRulesPassed ? 'text-emerald-400' : 'text-amber-400'}>
                            {opp.hardRuleChecks.filter(c => c.passed).length}/{opp.hardRuleChecks.length} Passed
                          </span>
                        </div>

                        <div className="space-y-2 pt-1 text-[11px]">
                          {opp.hardRuleChecks.map(check => (
                            <div key={check.id} className="flex items-start justify-between gap-2 border-b border-slate-900 pb-1">
                              <div className="flex items-start gap-1.5">
                                {check.passed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <div className="font-bold text-slate-200">{check.name}</div>
                                  <div className="text-[10px] text-slate-500">{check.ruleDescription}</div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`font-bold ${check.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {check.passed ? 'PASSED' : 'FLAGGED'}
                                </div>
                                <div className="text-[10px] text-slate-400">{check.actualValue}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Execution Feedback Notification */}
                {feedback && (
                  <div className={`mt-3 p-2.5 rounded text-xs font-mono flex items-center gap-2 ${
                    feedback.success ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800' : 'bg-rose-950/90 text-rose-300 border border-rose-800'
                  }`}>
                    {feedback.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{feedback.message}</span>
                  </div>
                )}

                {/* Bottom Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Independent Verification Hash: <code className="text-cyan-400">0x{opp.id.slice(0, 10)}...</code></span>
                  </div>

                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    {needsHumanApproval && (
                      <button
                        onClick={() => handleApproveBigJob(opp)}
                        disabled={isApproving}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded text-xs font-bold font-mono flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          {isApproving ? 'Recording Approval...' : `Approve Big Job ($${reqCap.toFixed(2)})`}
                        </span>
                      </button>
                    )}

                    {opp.executionEligible && !needsHumanApproval && !ownerConfig.emergencyKillSwitchActive ? (
                      <button
                        onClick={() => handleExecute(opp)}
                        disabled={isExecuting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950 rounded text-xs font-bold font-mono flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {isExecuting ? 'Procuring GPU...' : `Execute Deal (Commit $${(opp.capitalRequired ?? 0).toFixed(2)})`}
                        </span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-4 py-2 bg-slate-900 text-amber-300 border border-amber-800/70 rounded text-xs font-mono font-bold cursor-not-allowed"
                      >
                        {needsHumanApproval
                          ? `Awaiting Human Approval ($${reqCap.toFixed(2)} >= $${bigJobThresholdUsd.toFixed(0)})`
                          : `Execution Gated (${(opp.canonicalStatus || 'CAPITAL_BLOCKED').replace(/_/g, ' ')})`}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center text-slate-400 font-mono space-y-3">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
            <h3 className="text-base font-bold text-white">No Opportunities Match Selected Filter</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              The continuous intelligence loop verifies new supply/demand pairs every few seconds. Ensure your approved GPU whitelist and margin parameters in Owner Controls allow active combinations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
