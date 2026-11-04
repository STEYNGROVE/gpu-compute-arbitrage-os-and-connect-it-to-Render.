import React, { useState } from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import { 
  Layers, 
  Search, 
  Cpu, 
  Lock, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  CheckCircle2, 
  ShieldCheck, 
  Zap,
  Globe,
  Radio
} from 'lucide-react';
import { DemandClass, ProviderId, GpuModel } from '../types';

export const SupplyDemandRadar: React.FC = () => {
  const {
    providerOffers,
    demandOrders,
    heatmapData,
    isScanning,
    lastScanTimestamp,
    scanNow
  } = useArbitrage();

  const [selectedDemandClass, setSelectedDemandClass] = useState<DemandClass | 'ALL'>('ALL');
  const [selectedGpuFilter, setSelectedGpuFilter] = useState<string>('ALL');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>('ALL');

  // Filter demand orders
  const filteredDemand = demandOrders.filter(d => {
    if (selectedDemandClass !== 'ALL' && d.demandClass !== selectedDemandClass) return false;
    if (selectedGpuFilter !== 'ALL' && d.gpuModel !== selectedGpuFilter) return false;
    return true;
  });

  // Filter supply offers
  const filteredSupply = providerOffers.filter(o => {
    if (selectedGpuFilter !== 'ALL' && o.gpuModel !== selectedGpuFilter) return false;
    if (selectedProviderFilter !== 'ALL' && o.provider !== selectedProviderFilter) return false;
    return true;
  });

  const getDemandClassBadge = (dClass: DemandClass) => {
    switch (dClass) {
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-mono text-[10px] font-bold flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>CONFIRMED DEMAND</span>
          </span>
        );
      case 'PROBABLE':
        return (
          <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded font-mono text-[10px] font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>PROBABLE DEMAND</span>
          </span>
        );
      case 'PREDICTED':
        return (
          <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-mono text-[10px] font-bold flex items-center gap-1">
            <Radio className="w-3 h-3 text-purple-400" />
            <span>PREDICTED FORECAST</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      
      {/* Top Banner: Real-time Scanning Radar status */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              GPU Supply & Demand Intelligence Radar
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-provider compute aggregation (Vast.ai, RunPod, and optional Lambda Cloud) with cryptographic provenance verification. Last synchronized: {new Date(lastScanTimestamp).toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* GPU Filter */}
          <select
            value={selectedGpuFilter}
            onChange={e => setSelectedGpuFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All GPU Models</option>
            <option value="H100 SXM5 80GB">H100 SXM5 80GB</option>
            <option value="A100 80GB SXM">A100 80GB SXM</option>
            <option value="L40S 48GB">L40S 48GB</option>
            <option value="RTX 4090 24GB">RTX 4090 24GB</option>
            <option value="RTX 6000 Ada 48GB">RTX 6000 Ada 48GB</option>
            <option value="H200 141GB">H200 141GB</option>
          </select>

          <button
            onClick={() => scanNow()}
            disabled={isScanning}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold transition-colors cursor-pointer"
          >
            {isScanning ? 'Scanning...' : 'Rescan Index'}
          </button>
        </div>
      </div>

      {/* SECTION: 4D SUPPLY / DEMAND HEATMAP (GPU x Provider x Region) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              4D Market Spread Heatmap (GPU × Provider × Region × Time)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80 border border-emerald-400" />
              <span>Verified Arbitrage Spread</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/80 border border-amber-400" />
              <span>Capacity Shortage</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/80 border border-blue-400" />
              <span>Oversupply</span>
            </span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
          {heatmapData.map((cell, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border flex flex-col justify-between transition-all ${
                cell.status === 'VERIFIED_OPPORTUNITY'
                  ? 'bg-emerald-950/40 border-emerald-700/80 shadow-md shadow-emerald-950/40'
                  : cell.status === 'SHORTAGE'
                  ? 'bg-amber-950/40 border-amber-700/80'
                  : cell.status === 'OVERSUPPLY'
                  ? 'bg-blue-950/30 border-blue-800/60'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white truncate max-w-[130px]">{cell.gpu}</span>
                  <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-[10px] uppercase font-semibold text-cyan-300 rounded">
                    {cell.provider}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                  <span>Region: <strong className="text-slate-200">{cell.region}</strong></span>
                  <span>Stock: <strong className="text-slate-200">{cell.availableCapacityUnits}</strong></span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-900/80 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-300">
                    <span>Supply Cost:</span>
                    <span className="text-rose-300 font-bold">${(cell.supplyPricePerHour ?? 0).toFixed(2)}/hr</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Demand Price:</span>
                    <span className="text-emerald-300 font-bold">${(cell.demandPricePerHour ?? 0).toFixed(2)}/hr</span>
                  </div>
                  <div className="flex justify-between text-slate-200 pt-1 border-t border-slate-900">
                    <span>Gross Spread:</span>
                    <span className={`font-bold ${(cell.spreadPerHour ?? 0) > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      +${(cell.spreadPerHour ?? 0).toFixed(2)}/hr ({cell.spreadMarginPct ?? 0}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-900 flex justify-between items-center text-[10px]">
                <span className="text-slate-400">Market Status:</span>
                <span className={`font-bold uppercase ${
                  cell.status === 'VERIFIED_OPPORTUNITY' ? 'text-emerald-400' : cell.status === 'SHORTAGE' ? 'text-amber-400' : 'text-blue-300'
                }`}>
                  {cell.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION: TWO PANELS: SUPPLY INDEX TABLE VS DEMAND QUEUE STREAM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Normalized GPU Supply Index (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span>Normalized GPU Supply Index ({filteredSupply.length})</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Executable spot and on-demand quotes with normalized composite rating.
              </p>
            </div>

            {/* Provider Filter */}
            <div className="flex items-center gap-1 text-xs">
              {(['ALL', 'vast_ai', 'runpod'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedProviderFilter(p)}
                  className={`px-2 py-1 rounded text-[11px] uppercase transition-colors cursor-pointer ${
                    selectedProviderFilter === p
                      ? 'bg-slate-800 text-cyan-300 font-bold border border-cyan-800'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p === 'ALL' ? 'All' : p.replace('_', '.')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="pb-2">GPU Model & Provider</th>
                  <th className="pb-2">VRAM / HW</th>
                  <th className="pb-2 text-right">Price / hr</th>
                  <th className="pb-2 text-center">Type</th>
                  <th className="pb-2 text-center">Reliability</th>
                  <th className="pb-2 text-right">Supply Index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filteredSupply.map(offer => (
                  <tr key={offer.id} className="hover:bg-slate-950/60 transition-colors">
                    <td className="py-2.5">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{offer.gpuModel}</span>
                        {offer.isLiveApiVerified ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" title="Live API Verified" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" title="Fallback Market Feed" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="uppercase font-semibold text-cyan-300">
                          {offer.provider === 'vast_ai' ? 'Vast.ai' : offer.provider === 'runpod' ? 'RunPod' : offer.provider === 'lambda' ? 'Lambda Cloud' : offer.provider}
                        </span>
                        <span>•</span>
                        <span>{offer.location}</span>
                        <span>•</span>
                        <span className={offer.isLiveApiVerified ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                          {offer.isLiveApiVerified ? 'LIVE API' : 'FEED'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-300">
                      <div>{offer.vramGb} GB VRAM</div>
                      <div className="text-[10px] text-slate-500">{offer.cpuCores} vCPU • {offer.ramGb}GB RAM</div>
                    </td>
                    <td className="py-2.5 text-right font-bold text-white">
                      ${(offer.hourlyPrice ?? 0).toFixed(2)}
                      <div className="text-[10px] text-slate-500 font-normal">24h avg: ${(offer.historicalAvgPrice24h ?? offer.hourlyPrice ?? 0).toFixed(2)}</div>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                        offer.interruptionRisk === 'on_demand'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {offer.interruptionRisk === 'on_demand' ? 'On-Demand' : 'Spot'}
                      </span>
                    </td>
                    <td className="py-2.5 text-center text-slate-300 font-semibold">
                      {((offer.reliabilityScore ?? 0.99) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="px-2 py-1 bg-cyan-950/80 text-cyan-300 border border-cyan-800 rounded font-bold">
                        {offer.supplyIndexScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Demand Queue Stream (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Demand Stream ({filteredDemand.length})</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Rule #1: Only CONFIRMED demand may trigger autonomous capital deployment.
              </p>
            </div>

            {/* Demand Class Filter */}
            <div className="flex items-center gap-1 text-xs">
              {(['ALL', 'CONFIRMED', 'PROBABLE', 'PREDICTED'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedDemandClass(c)}
                  className={`px-2 py-1 rounded text-[10px] uppercase transition-colors cursor-pointer ${
                    selectedDemandClass === c
                      ? 'bg-slate-800 text-cyan-300 font-bold border border-cyan-800'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c === 'ALL' ? 'All' : c.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredDemand.map(demand => (
              <div 
                key={demand.id}
                className={`bg-slate-950 border rounded-lg p-3.5 space-y-2 text-xs transition-colors ${
                  demand.demandClass === 'CONFIRMED'
                    ? 'border-emerald-900/60'
                    : demand.demandClass === 'PROBABLE'
                    ? 'border-amber-900/50'
                    : 'border-slate-800 opacity-75'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-white">{demand.customerName}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {demand.workloadDescription}
                    </div>
                  </div>
                  {getDemandClassBadge(demand.demandClass)}
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2 rounded text-center text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">GPU Spec</span>
                    <strong className="text-slate-200">{demand.gpuCount}x {demand.gpuModel.split(' ')[0]}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Budget / hr</span>
                    <strong className="text-emerald-400">${(demand.customerHourlyRate ?? 0).toFixed(2)}/h</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Duration</span>
                    <strong className="text-cyan-300">{demand.durationHours}h</strong>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                  <span>Escrow: <strong className="text-slate-300 truncate max-w-[140px] inline-block align-bottom">{demand.authSignature || 'Pending Quote'}</strong></span>
                  <span>SLA: <strong className="text-slate-300">{((demand.slaMinReliability ?? 0.99) * 100).toFixed(1)}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
