import React, { useState } from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import { 
  Cpu, 
  Activity, 
  Terminal, 
  AlertTriangle, 
  CheckCircle2, 
  Square, 
  TrendingUp, 
  Zap, 
  ShieldAlert,
  Server,
  Radio,
  Clock
} from 'lucide-react';
import { ActiveJob } from '../types';

export const ActiveJobsFleet: React.FC = () => {
  const {
    activeJobs,
    abortActiveJob,
    completeActiveJobManually,
    deployedCapital,
    activeJobsProfitProjected,
    ownerConfig
  } = useArbitrage();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const selectedJob = activeJobs.find(j => j.id === selectedJobId) || activeJobs[0];

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Fleet Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Active GPU Worker Fleet & Real-Time Telemetry
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live container state, NVLink bus saturation, hardware thermals, and customer output verification.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400">Deployed Capital: </span>
            <strong className="text-white">${(deployedCapital ?? 0).toFixed(2)}</strong>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400">Projected Settlement: </span>
            <strong className="text-emerald-400">+${(activeJobsProfitProjected ?? 0).toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {activeJobs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Active Jobs Cards List (5 Cols) */}
          <div className="lg:col-span-5 space-y-3">
            {activeJobs.map(job => {
              const isSelected = selectedJob?.id === job.id;

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500/80 shadow-lg shadow-cyan-950/40'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          job.status === 'RUNNING' ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
                        }`} />
                        <h3 className="text-sm font-bold text-white">{job.customerName}</h3>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {job.gpuCount}x {job.gpuModel} • {job.workloadType}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-cyan-300 text-[10px] font-bold rounded uppercase">
                      {job.provider}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Progress: <strong>{job.progressPct}%</strong></span>
                      <span className="text-emerald-400 font-bold">
                        +${(job.currentEstimatedProfit ?? 0).toFixed(2)} est. profit
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${job.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics snapshot */}
                  <div className="mt-3 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-[10px] text-slate-400 text-center">
                    <div>
                      <span className="text-slate-500 block">UTIL</span>
                      <strong className="text-white">
                        {job.telemetry.gpuUtilPct !== null && job.telemetry.gpuUtilPct !== undefined ? `${job.telemetry.gpuUtilPct}%` : '--'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">TEMP</span>
                      <strong className="text-amber-400">
                        {job.telemetry.tempC !== null && job.telemetry.tempC !== undefined ? `${job.telemetry.tempC}°C` : '--'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">THROUGHPUT</span>
                      <strong className="text-cyan-300">
                        {job.telemetry.throughputValue !== null && job.telemetry.throughputValue !== undefined ? `${job.telemetry.throughputValue} ${job.telemetry.throughputMetric}` : '--'}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Job Deep Telemetry & Container Console (7 Cols) */}
          {selectedJob && (
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cyan-400 font-bold">JOB ID: {selectedJob.id}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-400">Instance: {selectedJob.instanceId}</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {selectedJob.customerName} ({selectedJob.gpuCount}x {selectedJob.gpuModel})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => completeActiveJobManually(selectedJob.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Settle & Realize P&L</span>
                  </button>

                  <button
                    onClick={() => abortActiveJob(selectedJob.id, 'Owner manual terminate')}
                    className="px-3 py-1.5 bg-rose-700/80 hover:bg-rose-600 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Abort GPU</span>
                  </button>
                </div>
              </div>

              {/* Real-Time Hardware Gauges */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-mono">Hardware Telemetry Stream</span>
                  <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                    selectedJob.telemetry.provenance === 'LIVE_PROVIDER_API'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {selectedJob.telemetry.provenance === 'LIVE_PROVIDER_API' ? '● VERIFIED HARDWARE API' : '○ LIVE UNMEASURED (NO SIMULATION)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase">GPU Compute Util</div>
                    <div className="text-xl font-bold text-cyan-400 mt-1">
                      {selectedJob.telemetry.gpuUtilPct !== null && selectedJob.telemetry.gpuUtilPct !== undefined ? `${selectedJob.telemetry.gpuUtilPct}%` : '--'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">CUDA core load</div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase">VRAM Allocated</div>
                    <div className="text-xl font-bold text-blue-400 mt-1">
                      {selectedJob.telemetry.vramUsedGb !== null && selectedJob.telemetry.vramUsedGb !== undefined ? `${selectedJob.telemetry.vramUsedGb} GB` : '--'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">HBM3 memory bus</div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase">Die Temperature</div>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {selectedJob.telemetry.tempC !== null && selectedJob.telemetry.tempC !== undefined ? `${selectedJob.telemetry.tempC}°C` : '--'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {selectedJob.telemetry.powerWatts !== null && selectedJob.telemetry.powerWatts !== undefined ? `${selectedJob.telemetry.powerWatts}W draw` : 'Power unmeasured'}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase">Throughput Rate</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">
                      {selectedJob.telemetry.throughputValue !== null && selectedJob.telemetry.throughputValue !== undefined ? selectedJob.telemetry.throughputValue : '--'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {selectedJob.telemetry.throughputMetric || 'Unmeasured'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Status of Job */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs space-y-2">
                <div className="font-bold text-slate-200 uppercase text-[10px]">Financial Execution Status:</div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Contracted Revenue:</span>
                    <strong className="text-white">${(selectedJob.contractedRevenue ?? 0).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Accrued Landed Cost:</span>
                    <strong className="text-rose-300">${(selectedJob.currentAccruedCost ?? 0).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Projected Profit:</span>
                    <strong className="text-emerald-400">+${(selectedJob.currentEstimatedProfit ?? 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Live Container Log Terminal */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Live Container Logs & Audit Output</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Auto-tailing stdio</span>
                </div>

                <div className="bg-black/90 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 h-44 overflow-y-auto space-y-1">
                  {selectedJob.telemetry.logStream.map((line, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-slate-600 select-none">&gt;</span>
                      <span className={line.includes('WARNING') ? 'text-amber-400' : line.includes('OPTIMAL') || line.includes('passed') ? 'text-emerald-400' : 'text-slate-300'}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-16 text-center text-slate-400 space-y-3">
          <Server className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No GPU Instances Currently Active</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The system adheres strictly to the Golden Rule: <em>No verified demand = No automatic purchase.</em> GPU capacity is acquired on-demand only when profitable contracts are verified.
          </p>
        </div>
      )}
    </div>
  );
};
