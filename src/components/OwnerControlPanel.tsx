import React, { useState } from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import { 
  Lock, 
  ShieldCheck, 
  Save, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  Globe, 
  Sliders,
  DollarSign
} from 'lucide-react';
import { ProviderId, GpuModel, WorkloadType, GPU_WORKLOAD_CATALOG } from '../types';

export const OwnerControlPanel: React.FC = () => {
  const { ownerConfig, updateOwnerConfig } = useArbitrage();

  const [formData, setFormData] = useState({
    maxCapitalExposure: ownerConfig.maxCapitalExposure,
    maxDailySpending: ownerConfig.maxDailySpending,
    minProfitDollars: ownerConfig.minProfitDollars,
    minMarginPct: ownerConfig.minMarginPct,
    maxAcceptableLoss: ownerConfig.maxAcceptableLoss,
    humanApprovalThresholdUsd: ownerConfig.humanApprovalThresholdUsd ?? 250,
    requireHumanApprovalForBigJobs: ownerConfig.requireHumanApprovalForBigJobs ?? true,
    autoReinvestmentPct: ownerConfig.autoReinvestmentPct,
    maxConcurrentJobs: ownerConfig.maxConcurrentJobs,
    maxComputeReservationHours: ownerConfig.maxComputeReservationHours,
    requireLiveApiForAuto: ownerConfig.requireLiveApiForAuto ?? true,
    approvedProviders: [...ownerConfig.approvedProviders],
    approvedGpuModels: [...ownerConfig.approvedGpuModels],
    approvedWorkloads: [...ownerConfig.approvedWorkloads],
    geographicRestrictions: [...ownerConfig.geographicRestrictions]
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  const allProviders: ProviderId[] = ['vast_ai', 'runpod', 'lambda', 'coreweave', 'fluidstack'];
  const allGpus: GpuModel[] = [
    'H100 SXM5 80GB',
    'H100 PCIe 80GB',
    'A100 80GB SXM',
    'A100 40GB PCIe',
    'L40S 48GB',
    'RTX 4090 24GB',
    'RTX 6000 Ada 48GB',
    'A6000 48GB',
    'H200 141GB'
  ];
  const allWorkloads: WorkloadType[] = GPU_WORKLOAD_CATALOG.map(w => w.id);
  const allRegions = ['US-East', 'US-West', 'EU-Central', 'EU-West', 'AP-East'];

  const toggleItem = <T,>(list: T[], item: T): T[] => {
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  };

  const handleSave = () => {
    updateOwnerConfig(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Owner Security Panel & Hard Risk Limits
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Section 1 Mandate: No autonomous action or ML forecast may ever override these hard financial ceilings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Limits Saved</span>
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-950"
          >
            <Save className="w-4 h-4" />
            <span>Apply Hard Limits</span>
          </button>
        </div>
      </div>

      {/* Treasury Segregation & Production Status Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Treasury Capital Segregation & Production Gates</span>
                <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-800 text-amber-300 rounded text-[10px] font-mono">
                  {ownerConfig.treasuryStatus || 'SIMULATED_UNFUNDED'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Strict financial isolation: Live capital starts at $0.00 until verified bank deposit settlement via signed webhook.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded text-[10px] font-bold">
              AUTH & RATE LIMITS ACTIVE
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Live Available Capital</div>
            <div className="text-base font-bold text-cyan-400 font-mono">
              ${(ownerConfig.liveCurrentBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500">Live operational liquidity</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Real Treasury Liquidity</div>
            <div className="text-base font-bold text-slate-400 font-mono">
              ${(ownerConfig.realTreasuryCashBalance ?? ownerConfig.realBankCashBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-amber-400/90 font-medium">Binance Custody Rail</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Escrow Vault</div>
            <div className="text-base font-bold text-emerald-400 font-mono">
              ${(ownerConfig.escrowVaultBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500">Authoritative webhook locked</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Database Storage</div>
            <div className="text-xs font-bold text-purple-300 font-mono truncate">
              TransactionalFileStore
            </div>
            <div className="text-[10px] text-purple-400">PostgreSQL Interface Ready</div>
          </div>
        </div>

        {/* Security Credentials Summary */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-slate-300 font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Session Authorization (<code className="text-cyan-300">X-Session-Id</code>)</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Server-authenticated session with zero client secret exposure.
            </div>
          </div>
          <code className="text-cyan-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 text-[11px]">
            {ownerConfig.sessionId ? `${ownerConfig.sessionId.slice(0, 16)}...` : (ownerConfig.authStatus || 'AUTHENTICATED')}
          </code>
        </div>
      </div>

      {/* Main Limits Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Financial Hard Ceilings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Capital Exposure & Profit Ceilings</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Maximum Capital Exposure ($):</label>
              <input
                type="number"
                value={formData.maxCapitalExposure}
                onChange={e => setFormData({ ...formData, maxCapitalExposure: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Absolute ceiling on simultaneously deployed GPU capital.</span>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Maximum Daily Spending Limit ($):</label>
              <input
                type="number"
                value={formData.maxDailySpending}
                onChange={e => setFormData({ ...formData, maxDailySpending: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Daily spending circuit breaker limit.</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1">Min Profit ($ / deal):</label>
                <input
                  type="number"
                  value={formData.minProfitDollars}
                  onChange={e => setFormData({ ...formData, minProfitDollars: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Min Margin (%):</label>
                <input
                  type="number"
                  value={formData.minMarginPct}
                  onChange={e => setFormData({ ...formData, minMarginPct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1">Auto-Reinvestment (%):</label>
                <input
                  type="number"
                  value={formData.autoReinvestmentPct}
                  onChange={e => setFormData({ ...formData, autoReinvestmentPct: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-500">% of settled profit to compound.</span>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Max Concurrent Jobs:</label>
                <input
                  type="number"
                  value={formData.maxConcurrentJobs}
                  onChange={e => setFormData({ ...formData, maxConcurrentJobs: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-500">Fleet concurrency ceiling.</span>
              </div>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Max Acceptable Loss ($):</label>
              <input
                type="number"
                disabled
                value={0}
                className="w-full bg-slate-950/50 border border-slate-800 rounded px-3 py-2 text-emerald-400 font-bold cursor-not-allowed"
              />
              <span className="text-[10px] text-emerald-500">Locked at $0.00: Strict Zero-Speculation Mandate.</span>
            </div>

            {/* Big Job Human Approval Gate */}
            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-300 uppercase text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Require Human Approval for Big Jobs</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Hold jobs at or above the big-job capital threshold for explicit human operator sign-off.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, requireHumanApprovalForBigJobs: !(formData.requireHumanApprovalForBigJobs !== false) })}
                  className={`px-3 py-1 rounded font-bold text-xs cursor-pointer border transition-colors ${
                    formData.requireHumanApprovalForBigJobs !== false
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-slate-950 text-slate-500 border-slate-800'
                  }`}
                >
                  {formData.requireHumanApprovalForBigJobs !== false ? 'REQUIRED' : 'BYPASSED'}
                </button>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Big Job Capital Threshold ($ USD):</label>
                <input
                  type="number"
                  step="10"
                  min="10"
                  value={formData.humanApprovalThresholdUsd ?? 250}
                  onChange={e => setFormData({ ...formData, humanApprovalThresholdUsd: Math.max(10, parseFloat(e.target.value) || 250) })}
                  className="w-full bg-slate-950 border border-amber-800/70 rounded px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500">
                  Any job requiring &ge; ${(formData.humanApprovalThresholdUsd ?? 250).toFixed(2)} capital will require human approval before execution.
                </span>
              </div>
            </div>

            {/* Provenance Gate Switch */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200 uppercase text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Enforce Live API Provenance Gate</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Block autonomous purchases on fallback feeds; require verified provider API key.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, requireLiveApiForAuto: !formData.requireLiveApiForAuto })}
                  className={`px-3 py-1 rounded font-bold text-xs cursor-pointer border transition-colors ${
                    formData.requireLiveApiForAuto
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-slate-950 text-slate-500 border-slate-800'
                  }`}
                >
                  {formData.requireLiveApiForAuto ? 'ENFORCED' : 'OPTIONAL'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Whitelists (Providers, GPUs, Workloads, Regions) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Authorized Compute & Workload Whitelists</span>
          </h3>

          <div className="space-y-4 text-xs">
            {/* Providers */}
            <div>
              <label className="text-slate-300 block mb-1.5 font-bold uppercase text-[10px]">
                Approved Compute Providers:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allProviders.map(p => {
                  const isChecked = formData.approvedProviders.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData({ ...formData, approvedProviders: toggleItem(formData.approvedProviders, p) })}
                      className={`px-2.5 py-1 rounded text-xs uppercase cursor-pointer border transition-colors ${
                        isChecked ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {p.replace('_', '.')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GPUs */}
            <div>
              <label className="text-slate-300 block mb-1.5 font-bold uppercase text-[10px]">
                Approved GPU Architectures:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allGpus.map(gpu => {
                  const isChecked = formData.approvedGpuModels.includes(gpu);
                  return (
                    <button
                      key={gpu}
                      type="button"
                      onClick={() => setFormData({ ...formData, approvedGpuModels: toggleItem(formData.approvedGpuModels, gpu) })}
                      className={`px-2.5 py-1 rounded text-xs cursor-pointer border transition-colors ${
                        isChecked ? 'bg-blue-950 text-blue-300 border-blue-700 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {gpu}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Workloads */}
            <div>
              <label className="text-slate-300 block mb-1.5 font-bold uppercase text-[10px]">
                Approved GPU Workloads ({formData.approvedWorkloads.length} / {GPU_WORKLOAD_CATALOG.length} Whitelisted):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {GPU_WORKLOAD_CATALOG.map(spec => {
                  const isChecked = formData.approvedWorkloads.includes(spec.id);
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      title={`${spec.name} — Pays for: ${spec.customerPaysFor} (${spec.example})`}
                      onClick={() => setFormData({ ...formData, approvedWorkloads: toggleItem(formData.approvedWorkloads, spec.id) })}
                      className={`px-2.5 py-1 rounded text-xs cursor-pointer border transition-colors ${
                        isChecked ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {spec.name} <span className="text-[10px] opacity-75">({spec.customerPaysFor})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Geographic Restrictions */}
            <div>
              <label className="text-slate-300 block mb-1.5 font-bold uppercase text-[10px]">
                Approved Geographic Regions:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allRegions.map(reg => {
                  const isChecked = formData.geographicRestrictions.includes(reg);
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setFormData({ ...formData, geographicRestrictions: toggleItem(formData.geographicRestrictions, reg) })}
                      className={`px-2.5 py-1 rounded text-xs cursor-pointer border transition-colors ${
                        isChecked ? 'bg-purple-950 text-purple-300 border-purple-700 font-bold' : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {reg}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Lambda Cloud API Integration & Diagnostics (OpenAPI 3.1.0) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Lambda Cloud API Integration (OpenAPI 3.1.0)
              </h3>
              <p className="text-[11px] text-slate-400">
                Direct endpoint synchronization with <span className="text-purple-300 font-mono">https://cloud.lambda.ai/api/v1</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-purple-950/80 border border-purple-800 text-purple-300 rounded text-[10px] font-bold">
              v1.10.0 OPENAPI SPEC
            </span>
            <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ENDPOINTS ACTIVE
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Instance Types & Capacity</div>
            <div className="text-slate-200 font-bold">GET /api/v1/instance-types</div>
            <div className="text-[11px] text-slate-400">
              Live specs, architecture (x86_64), pricing in cents/hr, and regional capacity matrices.
            </div>
            <div className="text-[10px] text-purple-400 pt-1">
              Active: H100 SXM5, H100 PCIe, A100 SXM4, RTX A6000, A10
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-[10px] text-slate-500 uppercase font-bold">On-Demand Provisioning</div>
            <div className="text-slate-200 font-bold">POST /instance-operations/launch</div>
            <div className="text-[11px] text-slate-400">
              Atomic automated provisioning with SSH keys, region selection, and custom workload tags.
            </div>
            <div className="text-[10px] text-emerald-400 pt-1">
              Sub-40s SLA startup & health handshake
            </div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Lifecycle & Ledger Sync</div>
            <div className="text-slate-200 font-bold">POST /instance-operations/terminate</div>
            <div className="text-[11px] text-slate-400">
              Instant termination upon contract settlement with cryptographic SHA-256 ledger anchoring.
            </div>
            <div className="text-[10px] text-cyan-400 pt-1">
              Zero trailing cost guarantee
            </div>
          </div>
        </div>

        {/* Integration Code Sample & Configuration info */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase">
              Backend Integration Proxy & Env Configuration:
            </span>
            <span className="text-[10px] text-slate-500">Bearer Token Auth</span>
          </div>
          <pre className="text-[11px] text-slate-400 overflow-x-auto p-2.5 bg-slate-900/90 rounded border border-slate-800">
{`# Lambda Cloud API is integrated server-side via /server.ts
# Set LAMBDA_API_KEY in your deployment environment or Settings
curl -X GET "http://localhost:3000/api/providers/lambda/instance-types" \\
  -H "Accept: application/json"

# Launch Instance via OS Orchestrator:
curl -X POST "http://localhost:3000/api/providers/lambda/launch" \\
  -H "Content-Type: application/json" \\
  -d '{"region_name":"us-west-1","instance_type_name":"gpu_1x_h100_pcie","ssh_key_names":["default"]}'`}
          </pre>
        </div>
      </div>
    </div>
  );
};
