import React, { useMemo, useState } from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import {
  Coins,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Cpu,
  ArrowRight,
  RotateCw,
  Download,
  ShieldCheck,
  Calculator,
  DollarSign,
  Server,
  Lock
} from 'lucide-react';
import { Opportunity, GPU_WORKLOAD_CATALOG, getGpuWorkloadSpec, WorkloadType } from '../types';

interface ProfitableCapitalSummaryScreenProps {
  onNavigate?: (tab: string) => void;
}

export const ProfitableCapitalSummaryScreen: React.FC<ProfitableCapitalSummaryScreenProps> = ({ onNavigate }) => {
  const {
    opportunities,
    opportunitySummary,
    executeOpportunity,
    approveBigJob,
    humanApprovedBigJobs,
    ownerConfig,
    scanNow,
    isScanning
  } = useArbitrage();

  const [tableScope, setTableScope] = useState<'PROFITABLE_ONLY' | 'ALL_DISCOVERED'>('PROFITABLE_ONLY');
  const [selectedWorkloadFilter, setSelectedWorkloadFilter] = useState<string>('ALL');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const bigJobThresholdUsd = Number(ownerConfig.humanApprovalThresholdUsd ?? 250);

  // Filter strictly to profitable jobs sorted by ROI descending (expected profit as tie-breaker)
  const profitableJobs = useMemo<Opportunity[]>(() => {
    return opportunities
      .filter(o => o.discoveryStatus === 'PROFITABLE' || (o.expectedNetContribution ?? 0) > 0 || (o.estimatedGrossProfitUsd ?? 0) > 0)
      .sort((a, b) => {
        const roiDiff = (b.roiPct ?? 0) - (a.roiPct ?? 0);
        if (roiDiff !== 0) return roiDiff;
        return (b.estimatedGrossProfitUsd ?? b.expectedNetContribution ?? 0) - (a.estimatedGrossProfitUsd ?? a.expectedNetContribution ?? 0);
      });
  }, [opportunities]);

  const displayedSourceJobs = useMemo<Opportunity[]>(() => {
    const base = tableScope === 'ALL_DISCOVERED' ? opportunities : profitableJobs;
    if (selectedWorkloadFilter === 'ALL') return base;
    return base.filter(j => {
      const spec = getGpuWorkloadSpec(j.workloadType || j.demandOrder?.workloadType, j.demandOrder?.gpuModel);
      return spec.id === selectedWorkloadFilter;
    });
  }, [tableScope, opportunities, profitableJobs, selectedWorkloadFilter]);

  // Authoritative aggregate metrics across all profitable jobs
  const totals = useMemo(() => {
    const count = profitableJobs.length;
    const verifiedAvailable = opportunitySummary.verifiedAvailableCapitalUsd ?? 0;

    const totalRequiredCapital = Math.round(
      profitableJobs.reduce((sum, j) => sum + (Number(j.requiredCapitalUsd ?? j.capitalRequired ?? 0) || 0), 0) * 100
    ) / 100;

    const totalShortfall = Math.max(0, Math.round((totalRequiredCapital - verifiedAvailable) * 100) / 100);

    const totalExpectedRevenue = Math.round(
      profitableJobs.reduce((sum, j) => sum + (Number(j.expectedRevenueUsd ?? j.grossRevenue ?? 0) || 0), 0) * 100
    ) / 100;

    const totalExpectedProviderCost = Math.round(
      profitableJobs.reduce((sum, j) => sum + (Number(j.expectedProviderCostUsd ?? j.costBreakdown?.computeCost ?? 0) || 0), 0) * 100
    ) / 100;

    const totalExpectedFees = Math.round(
      profitableJobs.reduce((sum, j) => sum + (Number(j.estimatedFeesUsd ?? 0) || 0), 0) * 100
    ) / 100;

    const totalExpectedNetProfit = Math.round(
      profitableJobs.reduce((sum, j) => sum + (Number(j.estimatedGrossProfitUsd ?? j.expectedNetContribution ?? 0) || 0), 0) * 100
    ) / 100;

    const totalGpuHours = profitableJobs.reduce(
      (sum, j) => sum + ((j.demandOrder?.gpuCount || 1) * (j.demandOrder?.durationHours || 1)),
      0
    );

    const totalGpuUnits = profitableJobs.reduce(
      (sum, j) => sum + (j.demandOrder?.gpuCount || 1),
      0
    );

    const singleBestRequired = count > 0
      ? Math.round((Number(profitableJobs[0].requiredCapitalUsd ?? profitableJobs[0].capitalRequired ?? 0) || 0) * 100) / 100
      : 0;

    const singleBestProfit = count > 0
      ? Math.round((Number(profitableJobs[0].estimatedGrossProfitUsd ?? profitableJobs[0].expectedNetContribution ?? 0) || 0) * 100) / 100
      : 0;

    const weightedMarginPct = totalExpectedRevenue > 0
      ? Math.round((totalExpectedNetProfit / totalExpectedRevenue) * 10000) / 100
      : 0;

    const weightedRoiPct = totalRequiredCapital > 0
      ? Math.round((totalExpectedNetProfit / totalRequiredCapital) * 10000) / 100
      : 0;

    const capitalCoveragePct = totalRequiredCapital > 0
      ? Math.min(100, Math.round((verifiedAvailable / totalRequiredCapital) * 1000) / 10)
      : 100;

    return {
      count,
      verifiedAvailable,
      totalRequiredCapital,
      totalShortfall,
      totalExpectedRevenue,
      totalExpectedProviderCost,
      totalExpectedFees,
      totalExpectedNetProfit,
      totalGpuHours,
      totalGpuUnits,
      singleBestRequired,
      singleBestProfit,
      weightedMarginPct,
      weightedRoiPct,
      capitalCoveragePct
    };
  }, [profitableJobs, opportunitySummary.verifiedAvailableCapitalUsd]);

  // Interactive What-If Capital Simulator State
  const [simulatedCapitalInput, setSimulatedCapitalInput] = useState<string>('');
  const effectiveSimulatedCapital = useMemo(() => {
    if (simulatedCapitalInput.trim() === '') {
      return totals.totalRequiredCapital;
    }
    const parsed = Number(simulatedCapitalInput);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : totals.totalRequiredCapital;
  }, [simulatedCapitalInput, totals.totalRequiredCapital]);

  // Compute cumulative running capital & what-if allocation per displayed job
  const enrichedProfitableJobs = useMemo(() => {
    let runningCapital = 0;
    let runningProfit = 0;
    let remainingSimCap = effectiveSimulatedCapital;

    return displayedSourceJobs.map((job, idx) => {
      const reqCap = Math.round((Number(job.requiredCapitalUsd ?? job.capitalRequired ?? 0) || 0) * 100) / 100;
      const rev = Math.round((Number(job.expectedRevenueUsd ?? job.grossRevenue ?? 0) || 0) * 100) / 100;
      const fees = Math.round((Number(job.estimatedFeesUsd ?? 0) || 0) * 100) / 100;
      const netProfit = Math.round((Number(job.estimatedGrossProfitUsd ?? job.expectedNetContribution ?? 0) || 0) * 100) / 100;
      const shortfall = Math.max(0, Math.round((reqCap - totals.verifiedAvailable) * 100) / 100);
      const isProf = job.discoveryStatus === 'PROFITABLE' || netProfit > 0;

      if (isProf) {
        runningCapital = Math.round((runningCapital + reqCap) * 100) / 100;
        runningProfit = Math.round((runningProfit + netProfit) * 100) / 100;
      }

      const fundedInSim = isProf && remainingSimCap >= reqCap;
      if (fundedInSim) {
        remainingSimCap = Math.round((remainingSimCap - reqCap) * 100) / 100;
      }

      return {
        rank: idx + 1,
        job,
        reqCap,
        rev,
        fees,
        netProfit,
        shortfall,
        cumulativeCapital: runningCapital,
        cumulativeProfit: runningProfit,
        fundedInSim
      };
    });
  }, [displayedSourceJobs, totals.verifiedAvailable, effectiveSimulatedCapital]);

  const simulationSummary = useMemo(() => {
    const fundedList = enrichedProfitableJobs.filter(item => item.fundedInSim);
    const capitalDeployed = Math.round(fundedList.reduce((acc, i) => acc + i.reqCap, 0) * 100) / 100;
    const expectedProfitUnlocked = Math.round(fundedList.reduce((acc, i) => acc + i.netProfit, 0) * 100) / 100;
    const expectedRevenueUnlocked = Math.round(fundedList.reduce((acc, i) => acc + i.rev, 0) * 100) / 100;
    const unallocatedCapital = Math.max(0, Math.round((effectiveSimulatedCapital - capitalDeployed) * 100) / 100);
    return {
      jobsUnlocked: fundedList.length,
      capitalDeployed,
      expectedProfitUnlocked,
      expectedRevenueUnlocked,
      unallocatedCapital
    };
  }, [enrichedProfitableJobs, effectiveSimulatedCapital]);

  // Breakdown by Provider Float
  const providerBreakdown = useMemo(() => {
    const map = new Map<string, {
      provider: string;
      jobCount: number;
      requiredCapital: number;
      expectedRevenue: number;
      expectedFees: number;
      expectedNetProfit: number;
      gpuHours: number;
    }>();

    for (const item of enrichedProfitableJobs) {
      const prov = item.job.matchedOffer?.provider || 'vast_ai';
      const existing = map.get(prov) || {
        provider: prov,
        jobCount: 0,
        requiredCapital: 0,
        expectedRevenue: 0,
        expectedFees: 0,
        expectedNetProfit: 0,
        gpuHours: 0
      };
      existing.jobCount += 1;
      existing.requiredCapital = Math.round((existing.requiredCapital + item.reqCap) * 100) / 100;
      existing.expectedRevenue = Math.round((existing.expectedRevenue + item.rev) * 100) / 100;
      existing.expectedFees = Math.round((existing.expectedFees + item.fees) * 100) / 100;
      existing.expectedNetProfit = Math.round((existing.expectedNetProfit + item.netProfit) * 100) / 100;
      existing.gpuHours += (item.job.demandOrder?.gpuCount || 1) * (item.job.demandOrder?.durationHours || 1);
      map.set(prov, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.requiredCapital - a.requiredCapital);
  }, [enrichedProfitableJobs]);

  // Breakdown by GPU Architecture
  const gpuBreakdown = useMemo(() => {
    const map = new Map<string, {
      gpuModel: string;
      jobCount: number;
      totalGpus: number;
      gpuHours: number;
      requiredCapital: number;
      expectedRevenue: number;
      expectedNetProfit: number;
    }>();

    for (const item of enrichedProfitableJobs) {
      const gpuModel = item.job.demandOrder?.gpuModel || item.job.matchedOffer?.gpuModel || 'GPU';
      const existing = map.get(gpuModel) || {
        gpuModel,
        jobCount: 0,
        totalGpus: 0,
        gpuHours: 0,
        requiredCapital: 0,
        expectedRevenue: 0,
        expectedNetProfit: 0
      };
      existing.jobCount += 1;
      existing.totalGpus += item.job.demandOrder?.gpuCount || 1;
      existing.gpuHours += (item.job.demandOrder?.gpuCount || 1) * (item.job.demandOrder?.durationHours || 1);
      existing.requiredCapital = Math.round((existing.requiredCapital + item.reqCap) * 100) / 100;
      existing.expectedRevenue = Math.round((existing.expectedRevenue + item.rev) * 100) / 100;
      existing.expectedNetProfit = Math.round((existing.expectedNetProfit + item.netProfit) * 100) / 100;
      map.set(gpuModel, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.expectedNetProfit - a.expectedNetProfit);
  }, [enrichedProfitableJobs]);

  // All 16 GPU Workloads Breakdown (with customer billing unit, examples, capital required, and expected profit)
  const workloadMatrix = useMemo(() => {
    return GPU_WORKLOAD_CATALOG.map(spec => {
      const matchingJobs = profitableJobs.filter(j => {
        const jSpec = getGpuWorkloadSpec(j.workloadType || j.demandOrder?.workloadType, j.demandOrder?.gpuModel);
        return jSpec.id === spec.id;
      });
      const reqCap = Math.round(
        matchingJobs.reduce((s, j) => s + (Number(j.requiredCapitalUsd ?? j.capitalRequired ?? 0) || 0), 0) * 100
      ) / 100;
      const rev = Math.round(
        matchingJobs.reduce((s, j) => s + (Number(j.expectedRevenueUsd ?? j.grossRevenue ?? 0) || 0), 0) * 100
      ) / 100;
      const netProfit = Math.round(
        matchingJobs.reduce((s, j) => s + (Number(j.estimatedGrossProfitUsd ?? j.expectedNetContribution ?? 0) || 0), 0) * 100
      ) / 100;
      const gpuHours = matchingJobs.reduce(
        (s, j) => s + ((j.demandOrder?.gpuCount || 1) * (j.demandOrder?.durationHours || 1)),
        0
      );
      return {
        spec,
        jobCount: matchingJobs.length,
        gpuHours,
        requiredCapital: reqCap,
        expectedRevenue: rev,
        expectedNetProfit: netProfit
      };
    });
  }, [profitableJobs]);

  // Funding Tranche Ladder (Top 1, Top 3, Half Queue, All Profitable Jobs)
  const fundingTranches = useMemo(() => {
    if (enrichedProfitableJobs.length === 0) return [];
    const totalCount = enrichedProfitableJobs.length;
    const indices = Array.from(new Set([
      1,
      Math.min(3, totalCount),
      Math.max(1, Math.ceil(totalCount / 2)),
      totalCount
    ])).sort((a, b) => a - b);

    return indices.map(count => {
      const slice = enrichedProfitableJobs.slice(0, count);
      const reqCap = Math.round(slice.reduce((s, x) => s + x.reqCap, 0) * 100) / 100;
      const shortfall = Math.max(0, Math.round((reqCap - totals.verifiedAvailable) * 100) / 100);
      const rev = Math.round(slice.reduce((s, x) => s + x.rev, 0) * 100) / 100;
      const profit = Math.round(slice.reduce((s, x) => s + x.netProfit, 0) * 100) / 100;
      const roi = reqCap > 0 ? Math.round((profit / reqCap) * 1000) / 10 : 0;

      const label = count === 1
        ? 'Tranche 1: Single Best Profitable Job'
        : count === totalCount
        ? `Full Queue: All ${totalCount} Profitable Jobs`
        : `Top ${count} Profitable Jobs`;

      return {
        count,
        label,
        reqCap,
        shortfall,
        rev,
        profit,
        roi
      };
    });
  }, [enrichedProfitableJobs, totals.verifiedAvailable]);

  const exportCsv = () => {
    const headers = [
      'Rank',
      'Opportunity_ID',
      'GPU_Model',
      'GPU_Qty',
      'Duration_Hours',
      'Provider',
      'Provider_Offer_ID',
      'Required_Capital_USD',
      'Verified_Available_Capital_USD',
      'Capital_Shortfall_USD',
      'Cumulative_Capital_Required_USD',
      'Expected_Revenue_USD',
      'Expected_Fees_USD',
      'Expected_Net_Profit_USD',
      'Expected_Margin_Pct',
      'Expected_ROI_Pct',
      'Status'
    ];
    const rows = enrichedProfitableJobs.map(item => [
      item.rank,
      item.job.id,
      `"${item.job.demandOrder?.gpuModel || ''}"`,
      item.job.demandOrder?.gpuCount || 1,
      item.job.demandOrder?.durationHours || 1,
      item.job.matchedOffer?.provider || '',
      (item.job.matchedOffer as any)?.providerOfferId || item.job.matchedOffer?.id || '',
      item.reqCap.toFixed(2),
      totals.verifiedAvailable.toFixed(2),
      item.shortfall.toFixed(2),
      item.cumulativeCapital.toFixed(2),
      item.rev.toFixed(2),
      item.fees.toFixed(2),
      item.netProfit.toFixed(2),
      item.job.expectedMarginPct.toFixed(2),
      item.job.roiPct.toFixed(2),
      item.job.canonicalStatus || item.job.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profitable-jobs-capital-summary-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* TOP EXECUTIVE SUMMARY SCREEN HEADER */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center">
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-white">
                    Total Capital Required — All Profitable Jobs Summary
                  </h2>
                  <span className="text-xs text-amber-300">
                    · {totals.count} Profitable {totals.count === 1 ? 'Job' : 'Jobs'} Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authoritative capital requirement calculation across all live profitable arbitrage spreads
                  {' · '}Last market update: <span className="text-cyan-300 font-semibold">{opportunitySummary.lastMarketUpdateFormatted}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => scanNow()}
              disabled={isScanning}
              className="px-3.5 py-2 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Live Market...' : 'Recalculate Live Totals'}</span>
            </button>

            <button
              onClick={exportCsv}
              disabled={profitableJobs.length === 0}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('treasury')}
                className="px-3.5 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Treasury & Wallets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* PRIMARY CAPITAL REQUIREMENT HERO CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: TOTAL MONEY REQUIRED FOR ALL PROFITABLE JOBS */}
          <div className="bg-slate-950 border-2 border-amber-500/60 rounded-xl p-4 flex flex-col justify-between shadow-lg shadow-amber-950/20">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-amber-400 font-bold flex items-center justify-between">
                <span>TOTAL MONEY REQUIRED (ALL PROFITABLE)</span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-white mt-2 tracking-tight">
                ${totals.totalRequiredCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-amber-300/90 mt-1">
                To fund all {totals.count} profitable {totals.count === 1 ? 'job' : 'jobs'} ({totals.totalGpuUnits} GPUs · {totals.totalGpuHours} GPU-hrs)
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Single Best Job Needs:</span>
              <span className="text-white font-bold">${totals.singleBestRequired.toFixed(2)} USD</span>
            </div>
          </div>

          {/* Card 2: VERIFIED AVAILABLE CAPITAL vs SHORTFALL */}
          <div className="bg-slate-950 border border-rose-800/70 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-rose-400 font-bold flex items-center justify-between">
                <span>TOTAL CAPITAL SHORTFALL</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-rose-400 mt-2 tracking-tight">
                ${totals.totalShortfall.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Verified Available Capital: <span className="text-emerald-400 font-bold">${totals.verifiedAvailable.toFixed(2)}</span>
                {' '}({totals.capitalCoveragePct.toFixed(1)}% covered)
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Capital Gate Status:</span>
              <span className={totals.totalShortfall > 0 ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold'}>
                {totals.totalShortfall > 0 ? '🟡 CAPITAL BLOCKED' : '🟢 FULLY FUNDED'}
              </span>
            </div>
          </div>

          {/* Card 3: TOTAL EXPECTED NET PROFIT FROM PROFITABLE JOBS */}
          <div className="bg-slate-950 border border-emerald-800/70 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold flex items-center justify-between">
                <span>TOTAL EXPECTED NET PROFIT</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-emerald-400 mt-2 tracking-tight">
                +${totals.totalExpectedNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Net after provider cost (${totals.totalExpectedProviderCost.toFixed(2)}) & fees (${totals.totalExpectedFees.toFixed(2)})
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Return on Required Capital:</span>
              <span className="text-emerald-300 font-bold">+{totals.weightedRoiPct.toFixed(1)}% ROI ({totals.weightedMarginPct.toFixed(1)}% margin)</span>
            </div>
          </div>

          {/* Card 4: TOTAL EXPECTED CUSTOMER REVENUE */}
          <div className="bg-slate-950 border border-cyan-900/70 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold flex items-center justify-between">
                <span>TOTAL EXPECTED GROSS REVENUE</span>
                <Layers className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-cyan-300 mt-2 tracking-tight">
                ${totals.totalExpectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Forecast customer billings across {totals.count} profitable {totals.count === 1 ? 'workload' : 'workloads'}
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>All-In Network & Escrow Fees:</span>
              <span className="text-slate-200 font-bold">${totals.totalExpectedFees.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* EQUATION BAR: HOW TOTAL CAPITAL & PROFIT ARE CALCULATED */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-300">
            <span className="text-slate-400 uppercase font-bold">Profitable Queue Equation:</span>
            <span>Expected Revenue <strong className="text-cyan-300">${totals.totalExpectedRevenue.toFixed(2)}</strong></span>
            <span className="text-slate-500">−</span>
            <span>Required Provider Capital <strong className="text-amber-300">${totals.totalRequiredCapital.toFixed(2)}</strong></span>
            <span className="text-slate-500">−</span>
            <span>Estimated Fees <strong className="text-slate-300">${totals.totalExpectedFees.toFixed(2)}</strong></span>
            <span className="text-slate-500">=</span>
            <span>Forecast Net Profit <strong className="text-emerald-400">+${totals.totalExpectedNetProfit.toFixed(2)}</strong></span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Forecast values never enter realized P&amp;L or withdrawable balance until execution &amp; settlement complete.</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: CAPITAL FUNDING MILESTONES (TRANCHE LADDER) & INTERACTIVE SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Funding Tranche Milestones */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Capital Funding Ladder (Cumulative Profitable Job Tranches)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                How much operating capital is required to fund the highest-profit subset vs. 100% of profitable jobs
              </p>
            </div>
          </div>

          {fundingTranches.length > 0 ? (
            <div className="space-y-3">
              {fundingTranches.map((tranche, i) => (
                <div
                  key={tranche.count}
                  onClick={() => setSimulatedCapitalInput(tranche.reqCap.toFixed(2))}
                  className="bg-slate-950 border border-slate-800 hover:border-cyan-700/70 rounded-lg p-3.5 transition-colors cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="text-cyan-400">#{i + 1}</span>
                        <span>{tranche.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Unlocks <strong className="text-slate-200">{tranche.count}</strong> profitable {tranche.count === 1 ? 'job' : 'jobs'} · Expected Revenue: <strong className="text-cyan-300">${tranche.rev.toFixed(2)}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Money Required</div>
                        <div className="text-base font-bold text-amber-300">${tranche.reqCap.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Shortfall</div>
                        <div className="text-base font-bold text-rose-400">${tranche.shortfall.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Expected Profit</div>
                        <div className="text-base font-bold text-emerald-400">+${tranche.profit.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center text-xs text-slate-400">
              No profitable opportunities currently active in queue. Click &quot;Recalculate Live Totals&quot; to scan providers.
            </div>
          )}
        </div>

        {/* Right 5 Cols: Interactive What-If Capital Allocation Planner */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>Capital Allocation Planner (What-If)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulate any treasury deposit amount to see which profitable jobs unlock
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-slate-300 font-bold uppercase">
                Hypothetical Operating Capital ($ USD)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={simulatedCapitalInput}
                  onChange={e => setSimulatedCapitalInput(e.target.value)}
                  placeholder={totals.totalRequiredCapital.toFixed(2)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm text-white font-bold outline-none"
                />
                <button
                  onClick={() => setSimulatedCapitalInput(totals.totalRequiredCapital.toFixed(2))}
                  className="px-3 py-2 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/70 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  100% Queue (${totals.totalRequiredCapital.toFixed(2)})
                </button>
              </div>

              {/* Quick preset buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[
                  { label: '$0 (Current)', val: totals.verifiedAvailable },
                  { label: `Best Job ($${totals.singleBestRequired.toFixed(2)})`, val: totals.singleBestRequired },
                  { label: '$100', val: 100 },
                  { label: '$250', val: 250 },
                  { label: '$500', val: 500 },
                  { label: `All Jobs ($${totals.totalRequiredCapital.toFixed(2)})`, val: totals.totalRequiredCapital }
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSimulatedCapitalInput(preset.val.toFixed(2))}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded text-[11px] cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulation Output Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Simulated Capital Budget:</span>
                <span className="text-white font-bold">${effectiveSimulatedCapital.toFixed(2)} USD</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Profitable Jobs Funded:</span>
                <span className="text-cyan-300 font-bold">
                  {simulationSummary.jobsUnlocked} of {totals.count} jobs
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Capital Deployed to Providers:</span>
                <span className="text-amber-300 font-bold">${simulationSummary.capitalDeployed.toFixed(2)} USD</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Unallocated Reserve Remaining:</span>
                <span className="text-slate-300 font-bold">${simulationSummary.unallocatedCapital.toFixed(2)} USD</span>
              </div>
              <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-sm">
                <span className="text-emerald-400 font-bold">Expected Net Profit Unlocked:</span>
                <span className="text-emerald-400 font-bold text-base">
                  +${simulationSummary.expectedProfitUnlocked.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            Jobs marked <span className="text-emerald-400 font-bold">FUNDED IN PLAN</span> in the table below indicate which specific profitable workloads are covered by this capital budget.
          </div>
        </div>
      </div>

      {/* SECTION 3: CAPITAL REQUIRED BY PROVIDER FLOAT & BY GPU ARCHITECTURE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Float Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <span>Capital Required by Provider Float</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Exact provider account funding needed per GPU marketplace to execute all profitable jobs
            </p>
          </div>

          <div className="space-y-2.5">
            {providerBreakdown.map(p => (
              <div key={p.provider} className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white uppercase flex items-center gap-2">
                    <span className="text-blue-400">{p.provider.replace('_', '.').toUpperCase()}</span>
                    <span className="text-slate-400 font-normal">· {p.jobCount} profitable {p.jobCount === 1 ? 'job' : 'jobs'} ({p.gpuHours} GPU-hrs)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Expected Revenue: ${p.expectedRevenue.toFixed(2)} · Estimated Fees: ${p.expectedFees.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Provider Float Needed</div>
                    <div className="text-sm font-bold text-amber-300">${p.requiredCapital.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Expected Net Profit</div>
                    <div className="text-sm font-bold text-emerald-400">+${p.expectedNetProfit.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GPU Hardware Architecture Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Capital Required by GPU Architecture</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Capital lock and expected net profit grouped by hardware model
            </p>
          </div>

          <div className="space-y-2.5">
            {gpuBreakdown.map(g => (
              <div key={g.gpuModel} className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="text-purple-300">{g.gpuModel}</span>
                    <span className="text-slate-400 font-normal">· {g.jobCount} {g.jobCount === 1 ? 'job' : 'jobs'} ({g.totalGpus} GPUs · {g.gpuHours} hrs)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Expected Customer Revenue: ${g.expectedRevenue.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Capital Required</div>
                    <div className="text-sm font-bold text-amber-300">${g.requiredCapital.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Expected Net Profit</div>
                    <div className="text-sm font-bold text-emerald-400">+${g.expectedNetProfit.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3.5: ALL 16 GPU WORKLOADS — CUSTOMER BILLING MODEL, EXAMPLES & CAPITAL MATRIX */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>All 16 Specialized GPU Workloads — Customer Billing &amp; Capital Matrix</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Integrated billing taxonomy: GPU workload, what the customer pays for, production example, required capital, and expected profit. Click any row to filter the schedule below.
            </p>
          </div>
          {selectedWorkloadFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedWorkloadFilter('ALL')}
              className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700 rounded-lg text-xs font-bold cursor-pointer"
            >
              Clear Workload Filter ({selectedWorkloadFilter})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/70">
                <th className="py-2.5 px-3">GPU Workload</th>
                <th className="py-2.5 px-3">What the Customer Pays For</th>
                <th className="py-2.5 px-3">Production Example</th>
                <th className="py-2.5 px-3">Target GPUs</th>
                <th className="py-2.5 px-3 text-right">Profitable Jobs</th>
                <th className="py-2.5 px-3 text-right">Money Required</th>
                <th className="py-2.5 px-3 text-right">Expected Revenue</th>
                <th className="py-2.5 px-3 text-right">Expected Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {workloadMatrix.map(row => {
                const isSelected = selectedWorkloadFilter === row.spec.id;
                return (
                  <tr
                    key={row.spec.id}
                    onClick={() => setSelectedWorkloadFilter(isSelected ? 'ALL' : row.spec.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-950/50 border-l-2 border-cyan-400' : 'hover:bg-slate-950/60'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                      <span className="text-cyan-300">{row.spec.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-amber-300 font-semibold">
                      {row.spec.customerPaysFor}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {row.spec.example}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-400">
                      {row.spec.preferredGpuModels.slice(0, 2).map(g => g.split(' ')[0]).join(', ')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {row.jobCount} <span className="text-[10px] text-slate-500 font-normal">({row.gpuHours}h)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-300">
                      ${row.requiredCapital.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-300">
                      ${row.expectedRevenue.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      +${row.expectedNetProfit.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: ITEMIZED PROFITABLE JOBS CAPITAL LEDGER TABLE */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Itemized Opportunities &amp; Capital Schedule — Ranked by ROI ({enrichedProfitableJobs.length} Shown)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked by Return on Capital (ROI %) descending · Jobs &ge; ${bigJobThresholdUsd.toFixed(0)} require explicit Human Approval
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedWorkloadFilter}
              onChange={e => setSelectedWorkloadFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All 16 GPU Workloads</option>
              {GPU_WORKLOAD_CATALOG.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.customerPaysFor})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
              <button
                onClick={() => setTableScope('PROFITABLE_ONLY')}
                className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                  tableScope === 'PROFITABLE_ONLY'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Profitable Jobs ({profitableJobs.length})
              </button>
              <button
                onClick={() => setTableScope('ALL_DISCOVERED')}
                className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                  tableScope === 'ALL_DISCOVERED'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Discovered Opportunities ({opportunities.length})
              </button>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('opportunities')}
                className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg text-xs font-bold cursor-pointer"
              >
                View Full Cards ({opportunities.length})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/60">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">GPU Workload &amp; What Customer Pays For</th>
                <th className="py-2.5 px-3">Hardware &amp; Provider</th>
                <th className="py-2.5 px-3 text-right">Required Capital</th>
                <th className="py-2.5 px-3 text-right">Capital Shortfall</th>
                <th className="py-2.5 px-3 text-right">Cumulative Capital</th>
                <th className="py-2.5 px-3 text-right">Expected Revenue</th>
                <th className="py-2.5 px-3 text-right">Est. Fees</th>
                <th className="py-2.5 px-3 text-right">Expected Profit</th>
                <th className="py-2.5 px-3 text-right">ROI / Margin</th>
                <th className="py-2.5 px-3">Gate &amp; Big-Job Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {enrichedProfitableJobs.map(item => {
                const { job } = item;
                const gpuCount = job.demandOrder?.gpuCount || 1;
                const hours = job.demandOrder?.durationHours || 1;
                const providerOfferId = (job.matchedOffer as any)?.providerOfferId || job.matchedOffer?.id || 'N/A';
                const wSpec = getGpuWorkloadSpec(job.workloadType || job.demandOrder?.workloadType, job.demandOrder?.gpuModel);
                const wName = job.workloadName || wSpec.name;
                const wPaysFor = job.customerPaysFor || wSpec.customerPaysFor;
                const wExample = job.workloadExample || wSpec.example;
                const isBigJob = Boolean(job.isBigJob ?? (item.reqCap >= bigJobThresholdUsd));
                const isHumanApproved = Boolean(job.humanApproved || humanApprovedBigJobs.has(job.id));
                const needsHumanApproval = isBigJob && (ownerConfig.requireHumanApprovalForBigJobs !== false) && !isHumanApproved;
                return (
                  <tr key={job.id} className="hover:bg-slate-950/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-300">
                      #{item.rank}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-cyan-300">
                        {wName} <span className="text-slate-400 font-normal">· Pays for:</span> <span className="text-amber-300">{wPaysFor}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Example: <span className="text-slate-300">{wExample}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">
                        {gpuCount}x {job.demandOrder?.gpuModel} ({hours}h)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <span className="text-cyan-300 uppercase font-semibold">{job.matchedOffer?.provider?.replace('_', '.')}</span> · Offer {providerOfferId} (${job.matchedOffer?.hourlyPrice?.toFixed(2)}/h)
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-300 text-sm">
                      ${item.reqCap.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-rose-400">
                      ${item.shortfall.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-200">
                      ${item.cumulativeCapital.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-cyan-300">
                      ${item.rev.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      ${item.fees.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400 text-sm">
                      +${item.netProfit.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="text-cyan-300 font-bold">+{(job.roiPct ?? 0).toFixed(1)}% ROI</div>
                      <div className="text-[10px] text-emerald-400">{job.expectedMarginPct.toFixed(1)}% Margin</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-[11px] font-bold text-amber-300">
                          {job.canonicalStatus || job.status}
                        </span>
                        {isBigJob && (
                          needsHumanApproval ? (
                            <button
                              onClick={() => approveBigJob(job.id)}
                              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded text-[10px] font-bold cursor-pointer"
                            >
                              🔒 Approve Big Job
                            </button>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 rounded text-[10px] font-bold">
                              ✅ Human Approved
                            </span>
                          )
                        )}
                        <span className={`text-[10px] ${item.fundedInSim ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {item.fundedInSim ? '✓ Funded in Plan' : 'Unfunded in Plan'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {enrichedProfitableJobs.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-slate-950 font-bold text-xs">
                  <td colSpan={3} className="py-3.5 px-3 text-white uppercase">
                    TOTAL ACROSS ALL {totals.count} PROFITABLE JOBS
                  </td>
                  <td className="py-3.5 px-3 text-right text-amber-300 text-sm">
                    ${totals.totalRequiredCapital.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-rose-400 text-sm">
                    ${totals.totalShortfall.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-300">
                    ${totals.totalRequiredCapital.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-cyan-300">
                    ${totals.totalExpectedRevenue.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-300">
                    ${totals.totalExpectedFees.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-emerald-400 text-sm">
                    +${totals.totalExpectedNetProfit.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-emerald-300">
                    {totals.weightedMarginPct.toFixed(1)}% / {totals.weightedRoiPct.toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-3 text-amber-300">
                    {totals.totalShortfall > 0 ? 'SHORTFALL ACTIVE' : 'READY'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
