import React from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import { 
  TrendingUp, 
  Coins, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  DollarSign, 
  Lock, 
  ArrowUpRight,
  PieChart,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

export const ProfitEngine: React.FC = () => {
  const {
    realizedTransactions,
    totalRealizedProfit,
    realizedProfitToday,
    totalRealizedRevenue,
    overallRealizedRoiPct,
    overallRealizedMarginPct,
    ownerConfig,
    capitalVelocityPerHour
  } = useArbitrage();

  // Safe formatting helpers
  const fmt = (val: number | undefined | null, decimals = 2): string => {
    const n = Number(val);
    return Number.isFinite(n) ? n.toFixed(decimals) : '0.00';
  };
  const fmtPct = (val: number | undefined | null): string => {
    const n = Number(val);
    return Number.isFinite(n) ? n.toString() : '0';
  };

  // Aggregate metrics
  const totalGpuHours = realizedTransactions.reduce((acc, t) => acc + (Number.isFinite(Number(t.durationHours)) ? Number(t.durationHours) : 1), 0);
  const revenuePerGpuHour = totalGpuHours > 0 ? Math.round(((Number(totalRealizedRevenue) || 0) / totalGpuHours) * 100) / 100 : 0;
  const profitPerGpuHour = totalGpuHours > 0 ? Math.round(((Number(totalRealizedProfit) || 0) / totalGpuHours) * 100) / 100 : 0;
  const totalCost = Math.max(0, (Number(totalRealizedRevenue) || 0) - (Number(totalRealizedProfit) || 0));
  const profitPerDollarCapital = totalCost > 0 ? Math.round(((Number(totalRealizedProfit) || 0) / totalCost) * 100) / 100 : 0;

  const exportCsv = () => {
    const headers = ['TxID', 'CompletedAt', 'Customer', 'Provider', 'GPU', 'Workload', 'DurationHours', 'GrossRevenue', 'TotalCost', 'NetProfit', 'MarginPct', 'AuditHash'];
    const rows = realizedTransactions.map(t => [
      t.id,
      t.completedAt,
      `"${t.customerName}"`,
      t.provider,
      `"${t.gpuModel}"`,
      t.workloadType,
      t.durationHours,
      fmt(t.grossRevenue),
      fmt(t.totalCost),
      fmt(t.netRealizedProfit),
      `${fmtPct(t.realizedMarginPct)}%`,
      t.auditHash
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gpu_arb_realized_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Realized P&L Ledger & Capital Compounding Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Strict Rule #4 Policy: Only completed, settled transactions count as realized profit. Zero speculative projections booked.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Export Settled CSV</span>
        </button>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-emerald-900/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase flex justify-between">
            <span>Net Realized Profit</span>
            <span className="text-emerald-400 font-bold">100% Settled</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">
            +${fmt(totalRealizedProfit)}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">
            +{fmtPct(overallRealizedMarginPct)}% realized margin
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase">Profit / GPU-Hour</div>
          <div className="text-3xl font-bold text-white mt-2">
            +${fmt(profitPerGpuHour)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Revenue: ${fmt(revenuePerGpuHour)}/GPU-hr
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase">Profit per $ Capital</div>
          <div className="text-3xl font-bold text-cyan-400 mt-2">
            ${fmt(profitPerDollarCapital)}x
          </div>
          <div className="text-xs text-cyan-600 font-medium mt-1">
            ROI: +{fmtPct(overallRealizedRoiPct)}%
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-900/50 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase flex justify-between">
            <span>Reinvestment Vault</span>
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-300 mt-2">
            ${fmt(ownerConfig?.reinvestmentVaultBalance)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {ownerConfig?.autoReinvestmentPct ?? 0}% auto-compounded
          </div>
        </div>
      </div>

      {/* Detailed Transaction Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span>Immutable Realized Transactions History ({realizedTransactions.length})</span>
          </h3>
          <span className="text-xs text-slate-400">
            Total Capital Deployed: ${fmt(totalCost)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="pb-2">Tx ID & Customer</th>
                <th className="pb-2">Provider & GPU</th>
                <th className="pb-2">Duration</th>
                <th className="pb-2 text-right">Gross Rev</th>
                <th className="pb-2 text-right">Total Cost</th>
                <th className="pb-2 text-right">Net Profit</th>
                <th className="pb-2 text-right">Margin / ROI</th>
                <th className="pb-2 text-right">Cryptographic Audit Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {realizedTransactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-950/60 transition-colors">
                  <td className="py-3">
                    <div className="font-bold text-white">{tx.customerName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{tx.id} • {new Date(tx.completedAt).toLocaleTimeString()}</div>
                  </td>
                  <td className="py-3">
                    <div className="text-slate-200">{tx.gpuModel}</div>
                    <div className="text-[10px] text-cyan-400 uppercase font-semibold">{tx.provider} (Level {tx.monetizationLevel})</div>
                  </td>
                  <td className="py-3 text-slate-300">
                    {tx.durationHours} hrs
                  </td>
                  <td className="py-3 text-right font-bold text-white">
                    ${fmt(tx.grossRevenue)}
                  </td>
                  <td className="py-3 text-right text-rose-300">
                    ${fmt(tx.totalCost)}
                  </td>
                  <td className="py-3 text-right font-bold text-emerald-400">
                    +${fmt(tx.netRealizedProfit)}
                  </td>
                  <td className="py-3 text-right">
                    <div className="text-emerald-400 font-bold">+{fmtPct(tx.realizedMarginPct)}%</div>
                    <div className="text-[10px] text-slate-500">{fmtPct(tx.realizedRoiPct)}% ROI</div>
                  </td>
                  <td className="py-3 text-right font-mono text-[10px] text-slate-500">
                    <code>{tx.auditHash?.slice(0, 14)}...</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
