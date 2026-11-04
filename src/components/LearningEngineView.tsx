import React from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import { 
  Activity, 
  TrendingUp, 
  ShieldCheck, 
  Cpu, 
  Clock, 
  Zap, 
  Layers, 
  Server,
  Award
} from 'lucide-react';

export const LearningEngineView: React.FC = () => {
  const { reliabilityMetrics } = useArbitrage();

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Self-Improving Provider Intelligence & Reliability Index
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Section 12 & 28: Continuously scores actual vs advertised GPU throughput, spot pre-emptions, and billing discrepancy history.
          </p>
        </div>
      </div>

      {/* Provider SLA Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reliabilityMetrics.map(metric => (
          <div key={metric.provider} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase">{metric.provider.replace('_', '.')}</h3>
                <span className="text-[10px] text-slate-400">Total Runs: {metric.totalJobsAssigned} jobs</span>
              </div>
              <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-bold rounded">
                {((metric.compositeReliabilityScore ?? 0) * 100).toFixed(1)}% Score
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Success Rate:</span>
                <strong className="text-emerald-400">{(((metric.successfulJobs ?? 0) / (metric.totalJobsAssigned || 1)) * 100).toFixed(1)}%</strong>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>Actual vs Advertised Perf:</span>
                <strong className="text-blue-300">{((metric.actualVsAdvertisedPerfFactor ?? 1) * 100).toFixed(1)}%</strong>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>Avg Startup Latency:</span>
                <strong className="text-white">{metric.avgStartupLatencySec ?? 0}s</strong>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>Spot Interruption Events:</span>
                <strong className={metric.interruptedJobs === 0 ? 'text-emerald-400' : 'text-amber-400'}>{metric.interruptedJobs ?? 0}</strong>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>Billing Accuracy:</span>
                <strong className="text-emerald-400">{((metric.billingAccuracyRate ?? 1) * 100).toFixed(1)}%</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Historical Intelligence & Optimization Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Profitable Combinations */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Highest Historical Net Margin Combinations</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            {[
              { pair: 'H100 SXM5 on Vast.ai (US-East)', workload: 'LLM_INFERENCE (Level 2)', avgMargin: '72.4%', score: 'A+' },
              { pair: 'RTX 4090 on Lambda Labs (EU-West)', workload: 'AI_PRODUCTION_VIDEO (Level 3)', avgMargin: '78.1%', score: 'A+' },
              { pair: 'A100 80GB on RunPod (US-West)', workload: 'FINE_TUNING (Level 1)', avgMargin: '43.8%', score: 'A' },
              { pair: 'L40S 48GB on Vast.ai (AP-East)', workload: 'BATCH_AI_PROCESSING (Level 1)', avgMargin: '46.2%', score: 'A' }
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">{item.pair}</div>
                  <div className="text-[10px] text-slate-400">{item.workload}</div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-bold">{item.avgMargin}</div>
                  <span className="text-[10px] text-cyan-300 font-semibold">{item.score} Rating</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time-of-Day Pricing Dips */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Time-of-Day Spot Price Discrepancies</span>
          </h3>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <div className="text-cyan-300 font-bold">EU Off-Peak Window (02:00 - 07:00 UTC)</div>
              <p className="text-[11px] text-slate-400 mt-1">
                RTX 4090 and A100 spot instance prices drop by <strong>18.5%</strong> during European overnight hours. Safe for batch AI image and video upscaling workloads.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <div className="text-blue-300 font-bold">US Weekend Compute Surplus</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Corporate training clusters idle from Friday 22:00 UTC to Sunday 18:00 UTC, widening the H100 arbitrage spread by <strong>$0.65/GPU-hour</strong>.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
