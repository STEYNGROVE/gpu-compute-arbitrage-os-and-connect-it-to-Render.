import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Server,
  Terminal,
  Activity,
  Globe,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';

interface ProviderField {
  key: string;
  label: string;
  placeholder: string;
  isSecret: boolean;
  required: boolean;
  description: string;
}

interface ProviderSummaryItem {
  id: string;
  name: string;
  tier: string;
  website: string;
  docsUrl: string;
  description: string;
  sshSupport?: boolean;
  fields: ProviderField[];
  isConfigured: boolean;
  fieldValues: Record<string, { value: string; masked: string; isSet: boolean }>;
  billing?: {
    balanceUsd: number | null;
    formatted: string;
    mechanism: string;
    isFunded: boolean;
  };
  health: {
    providerId: string;
    providerName: string;
    status: 'LIVE' | 'AUTHENTICATED' | 'DISCOVERY_ONLY' | 'UNAVAILABLE' | 'CONFIGURATION_REQUIRED' | 'ERROR';
    healthColor: 'GREEN' | 'YELLOW' | 'RED' | 'GREY';
    authenticated: boolean;
    latencyMs: number;
    message: string;
    endpoints: {
      authentication: boolean;
      pricing: boolean;
      inventory: boolean;
      provisioning: boolean;
      instanceControl: boolean;
      telemetry: boolean;
      billing: boolean;
    };
    configuredCredentials: string[];
    missingCredentials: string[];
  };
}

interface CustomProviderItem {
  id: string;
  name: string;
  baseUrl: string;
  authHeaderName: string;
  authHeaderPrefix: string;
  apiKeyMasked: string;
  tier: string;
  website?: string;
  supportedGpuModels?: string[];
  notes?: string;
  createdAt: string;
}

export const ProviderKeyringPanel: React.FC = () => {
  const [providers, setProviders] = useState<ProviderSummaryItem[]>([]);
  const [customProviders, setCustomProviders] = useState<CustomProviderItem[]>([]);
  const [stats, setStats] = useState({ total: 10, configured: 0, live: 0, unconfigured: 10 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterTab, setFilterTab] = useState<'ALL' | 'FUNDED' | 'LIGHTNING' | 'PENDING' | 'LIVE' | 'CUSTOM'>('ALL');

  // Input states per provider: providerId -> { [fieldKey]: string }
  const [inputForms, setInputForms] = useState<Record<string, Record<string, string>>>({});
  // Password visibility toggle per field: `${providerId}_${fieldKey}` -> boolean
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Operational feedback states
  const [savingState, setSavingState] = useState<Record<string, boolean>>({});
  const [testingState, setTestingState] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [feedbackMessages, setFeedbackMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  // SSH Key Modal / Drawer
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const lightningSshKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGX2+NOwu++nYjP1f/6Cyck3JYW3hREdejuy/6lbXApv Gpu compute';

  // Custom provider modal / drawer form state
  const [showAddCustomModal, setShowAddCustomModal] = useState<boolean>(false);
  const [customForm, setCustomForm] = useState({
    id: '',
    name: '',
    baseUrl: '',
    authHeaderName: 'Authorization',
    authHeaderPrefix: 'Bearer ',
    apiKey: '',
    tier: 'NEOCLOUD',
    website: '',
    supportedGpuModels: 'RTX 4090, A100 SXM4 80GB, H100 PCIe 80GB',
    notes: ''
  });
  const [isSubmittingCustom, setIsSubmittingCustom] = useState<boolean>(false);

  const fetchProviderCredentials = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/providers/credentials');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setCustomProviders(data.customProviders || []);
        if (data.stats) {
          setStats(data.stats);
        }

        // Initialize local input form defaults if not already typed
        const initialInputs: Record<string, Record<string, string>> = {};
        (data.providers || []).forEach((p: ProviderSummaryItem) => {
          initialInputs[p.id] = {};
          p.fields.forEach(f => {
            // For non-secret fields like org_id or user_id, pre-populate existing value
            if (!f.isSecret && p.fieldValues?.[f.key]?.value) {
              initialInputs[p.id][f.key] = p.fieldValues[f.key].value;
            } else if (f.key === 'LIGHTNING_ORG_ID' && !p.fieldValues?.[f.key]?.value) {
              initialInputs[p.id][f.key] = 'steyngrovesar-org';
            } else {
              initialInputs[p.id][f.key] = '';
            }
          });
        });
        setInputForms(prev => ({ ...initialInputs, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load provider credentials:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderCredentials();
  }, []);

  const handleInputChange = (providerId: string, fieldKey: string, value: string) => {
    setInputForms(prev => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || {}),
        [fieldKey]: value
      }
    }));
  };

  const toggleShowSecret = (fieldId: string) => {
    setShowSecrets(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveCredentials = async (providerId: string) => {
    setSavingState(prev => ({ ...prev, [providerId]: true }));
    setFeedbackMessages(prev => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });

    try {
      const currentInputs = inputForms[providerId] || {};
      const res = await fetch('/api/providers/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          fields: currentInputs
        })
      });

      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setFeedbackMessages(prev => ({
          ...prev,
          [providerId]: {
            type: 'success',
            text: `Credentials saved successfully! Status: ${data.result?.health?.status || 'UPDATED'}`
          }
        }));
        // Refresh provider data
        await fetchProviderCredentials();
      } else {
        setFeedbackMessages(prev => ({
          ...prev,
          [providerId]: {
            type: 'error',
            text: data.message || 'Failed to save credentials'
          }
        }));
      }
    } catch (err: any) {
      setFeedbackMessages(prev => ({
        ...prev,
        [providerId]: {
          type: 'error',
          text: err.message || 'Network error saving credentials'
        }
      }));
    } finally {
      setSavingState(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingState(prev => ({ ...prev, [providerId]: true }));
    setTestResults(prev => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });

    try {
      const currentInputs = inputForms[providerId] || {};
      const res = await fetch('/api/providers/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          fields: currentInputs
        })
      });

      const data = await res.json();
      setTestResults(prev => ({
        ...prev,
        [providerId]: data
      }));
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          status: 'ERROR',
          message: err.message || 'Failed to ping provider API'
        }
      }));
    } finally {
      setTestingState(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleCreateCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customForm.id || !customForm.name || !customForm.baseUrl) {
      return;
    }

    setIsSubmittingCustom(true);
    try {
      const gpuList = customForm.supportedGpuModels
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/providers/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...customForm,
          supportedGpuModels: gpuList
        })
      });

      if (res.ok) {
        setShowAddCustomModal(false);
        setCustomForm({
          id: '',
          name: '',
          baseUrl: '',
          authHeaderName: 'Authorization',
          authHeaderPrefix: 'Bearer ',
          apiKey: '',
          tier: 'NEOCLOUD',
          website: '',
          supportedGpuModels: 'RTX 4090, A100 SXM4 80GB, H100 PCIe 80GB',
          notes: ''
        });
        await fetchProviderCredentials();
      }
    } catch (err) {
      console.error('Failed to create custom provider', err);
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const handleDeleteCustomProvider = async (id: string) => {
    if (!window.confirm(`Remove custom provider ${id}?`)) return;
    try {
      const res = await fetch(`/api/providers/custom/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProviderCredentials();
      }
    } catch (err) {
      console.error('Failed to remove custom provider', err);
    }
  };

  const lightningProvider = providers.find(p => p.id === 'lightning_ai');
  const fundedProvidersCount = providers.filter(p => p.billing?.isFunded).length;

  const filteredProviders = providers.filter(p => {
    if (filterTab === 'FUNDED') return p.billing?.isFunded;
    if (filterTab === 'LIGHTNING') return p.id === 'lightning_ai';
    if (filterTab === 'PENDING') return !p.isConfigured || p.health.status === 'CONFIGURATION_REQUIRED';
    if (filterTab === 'LIVE') return p.health.status === 'LIVE' || p.health.status === 'AUTHENTICATED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Provider Keyring & Integration Space</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                    ZERO-FUNDED COMPATIBLE
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure API credentials for Lightning AI Studios, Neoclouds, and any new GPU providers not yet integrated.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchProviderCredentials()}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Health</span>
            </button>
            <button
              onClick={() => setShowAddCustomModal(true)}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-medium rounded-lg flex items-center gap-1.5 shadow-md shadow-cyan-950 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Provider</span>
            </button>
          </div>
        </div>

        {/* Live Provider Health Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
            <div className="text-[11px] font-mono text-slate-400">TOTAL PROVIDERS</div>
            <div className="text-xl font-bold font-mono text-white mt-0.5">{stats.total}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">10 Canonical + {customProviders.length} Custom</div>
          </div>

          <div className="p-3 bg-slate-900/80 border border-emerald-900/40 rounded-lg">
            <div className="text-[11px] font-mono text-emerald-400 flex items-center justify-between">
              <span>LIVE / AUTHENTICATED</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-0.5">{stats.live} / {stats.total}</div>
            <div className="text-[10px] text-emerald-500/80 mt-0.5">Ready for live job execution</div>
          </div>

          <div className="p-3 bg-slate-900/80 border border-amber-900/40 rounded-lg">
            <div className="text-[11px] font-mono text-amber-400 flex items-center justify-between">
              <span>CONFIGURED</span>
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-0.5">{stats.configured} / {stats.total}</div>
            <div className="text-[10px] text-amber-500/80 mt-0.5">API keys saved in keyring</div>
          </div>

          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span>UNCONFIGURED</span>
              <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-300 mt-0.5">{stats.unconfigured}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Needs API keys below</div>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-800 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              filterTab === 'ALL'
                ? 'bg-slate-800 text-white font-bold border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Providers ({providers.length})
          </button>
          <button
            onClick={() => setFilterTab('FUNDED')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'FUNDED'
                ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-600'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Funded Accounts ({fundedProvidersCount})</span>
          </button>
          <button
            onClick={() => setFilterTab('LIGHTNING')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'LIGHTNING'
                ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/50'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Lightning AI (Spotlight)</span>
          </button>
          <button
            onClick={() => setFilterTab('PENDING')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              filterTab === 'PENDING'
                ? 'bg-slate-800 text-amber-300 font-bold border border-amber-900/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Needs Keys ({stats.unconfigured})
          </button>
          <button
            onClick={() => setFilterTab('LIVE')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              filterTab === 'LIVE'
                ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-800/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live & Authenticated ({stats.live})
          </button>
          <button
            onClick={() => setFilterTab('CUSTOM')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              filterTab === 'CUSTOM'
                ? 'bg-cyan-950/40 text-cyan-300 font-bold border border-cyan-800/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Custom Providers ({customProviders.length})
          </button>
        </div>
      </div>

      {/* FEATURED SPOTLIGHT: LIGHTNING AI STUDIOS (Requirements Focus) */}
      {(filterTab === 'ALL' || filterTab === 'LIGHTNING') && lightningProvider && (
        <div className="border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 px-4 py-1.5 bg-gradient-to-l from-amber-500 to-amber-600 text-slate-950 text-[10px] font-mono font-bold uppercase tracking-wider rounded-bl-xl shadow-md flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>PRIMARY NEOCLOUD SPOTLIGHT</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-amber-500/20">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Lightning AI Studios</span>
                    <span className="text-xs px-2 py-0.5 rounded font-mono font-normal bg-amber-950/60 text-amber-300 border border-amber-700/60">
                      Teamspace: steyngrovesar-org
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 max-w-2xl">
                    High-performance PyTorch Lightning Studios, distributed multi-node GPU clusters, and serverless compute.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://lightning.ai/steyngrovesar-org/dashboard/teamspaces"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-amber-300 hover:text-white text-xs font-mono rounded-lg flex items-center gap-1.5 border border-amber-500/30 transition cursor-pointer"
              >
                <span>Open Lightning Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  lightningProvider.health.status === 'LIVE' || lightningProvider.health.status === 'AUTHENTICATED'
                    ? 'bg-emerald-400'
                    : lightningProvider.health.status === 'ERROR'
                    ? 'bg-rose-400'
                    : 'bg-slate-500'
                }`} />
                <span className="text-slate-300 font-bold">{lightningProvider.health.status}</span>
              </div>
            </div>
          </div>

          {/* Form & SSH Key grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
            {/* Left 2 Cols: Credential Fields Input */}
            <div className="lg:col-span-2 space-y-4">
              <div className="text-xs font-mono font-semibold text-amber-300 flex items-center gap-1.5">
                <Key className="w-4 h-4" />
                <span>CONFIGURE LIGHTNING AI API CREDENTIALS</span>
              </div>

              {lightningProvider.fields.map(field => {
                const currentVal = inputForms['lightning_ai']?.[field.key] || '';
                const fieldId = `lightning_ai_${field.key}`;
                const isSecretShown = showSecrets[fieldId] || false;
                const isCurrentlySet = lightningProvider.fieldValues?.[field.key]?.isSet;

                return (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-mono text-slate-300 font-medium flex items-center gap-1.5">
                        <span>{field.label}</span>
                        {field.required && <span className="text-rose-400">*</span>}
                        {isCurrentlySet && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Saved ({lightningProvider.fieldValues[field.key].masked})
                          </span>
                        )}
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">{field.key}</span>
                    </div>

                    <div className="relative">
                      <input
                        type={field.isSecret && !isSecretShown ? 'password' : 'text'}
                        value={currentVal}
                        onChange={e => handleInputChange('lightning_ai', field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white rounded-lg px-3.5 py-2 text-xs font-mono placeholder:text-slate-600 transition"
                      />
                      {field.isSecret && (
                        <button
                          type="button"
                          onClick={() => toggleShowSecret(fieldId)}
                          className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          {isSecretShown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{field.description}</p>
                  </div>
                );
              })}

              {/* Action Buttons & Feedback */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveCredentials('lightning_ai')}
                  disabled={savingState['lightning_ai']}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-amber-950 transition cursor-pointer active:scale-95"
                >
                  {savingState['lightning_ai'] ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Lightning Credentials</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTestConnection('lightning_ai')}
                  disabled={testingState['lightning_ai']}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono rounded-lg flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  {testingState['lightning_ai'] ? (
                    <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <Activity className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Test Connection / Ping</span>
                </button>
              </div>

              {/* Save Feedback Banner */}
              {feedbackMessages['lightning_ai'] && (
                <div className={`p-3 rounded-lg text-xs font-mono flex items-center gap-2 ${
                  feedbackMessages['lightning_ai'].type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                }`}>
                  {feedbackMessages['lightning_ai'].type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{feedbackMessages['lightning_ai'].text}</span>
                </div>
              )}

              {/* Test Connection Live Output */}
              {testResults['lightning_ai'] && (
                <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ping Result:</span>
                    <span className={`font-bold ${testResults['lightning_ai'].success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {testResults['lightning_ai'].status} ({testResults['lightning_ai'].latencyMs}ms)
                    </span>
                  </div>
                  <p className="text-slate-300">{testResults['lightning_ai'].message}</p>
                </div>
              )}
            </div>

            {/* Right Col: Built-in SSH Public Key */}
            <div className="bg-slate-900/80 border border-amber-900/30 rounded-xl p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="text-xs font-mono font-semibold text-amber-300 flex items-center gap-1.5 mb-2">
                  <Terminal className="w-4 h-4" />
                  <span>LIGHTNING SSH KEY ("Gpu compute")</span>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  This public SSH key is pre-authorized for the Lightning AI Studio environment. Copy and add to your teamspace:
                </p>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 break-all select-all">
                  {lightningSshKey}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleCopy(lightningSshKey, 'ssh_lightning')}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white text-xs font-mono font-medium rounded-lg flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  {copiedKey === 'ssh_lightning' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied Public Key!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SSH Key to Clipboard</span>
                    </>
                  )}
                </button>
                <div className="text-[10px] text-slate-500 font-mono text-center">
                  Dashboard → Settings → SSH Keys → "Gpu compute"
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALL OTHER PROVIDERS SECTION */}
      {filterTab !== 'CUSTOM' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              <span>Canonical GPU Providers (Unified Architecture)</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Showing {filteredProviders.length} providers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredProviders
              .filter(p => filterTab === 'LIGHTNING' || p.id !== 'lightning_ai')
              .map(provider => {
                const isTesting = testingState[provider.id] || false;
                const isSaving = savingState[provider.id] || false;
                const testResult = testResults[provider.id];
                const feedback = feedbackMessages[provider.id];

                return (
                  <div
                    key={provider.id}
                    className="border border-slate-800 bg-slate-900/70 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition shadow-md"
                  >
                    <div>
                      {/* Provider Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full ${
                            provider.health.status === 'LIVE' || provider.health.status === 'AUTHENTICATED'
                              ? 'bg-emerald-400'
                              : provider.health.status === 'ERROR'
                              ? 'bg-rose-400'
                              : 'bg-slate-600'
                          }`} />
                          <div>
                            <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                              <span>{provider.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                {provider.tier}
                              </span>
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
                            provider.health.status === 'LIVE' || provider.health.status === 'AUTHENTICATED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {provider.health.status}
                          </span>
                          <a
                            href={provider.docsUrl || provider.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white"
                            title="Open Docs / API Key page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 mb-4">{provider.description}</p>

                      {/* Verified Account Balance Banner */}
                      {provider.billing?.isFunded && (
                        <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-950/80 border border-emerald-600/80 flex items-center justify-between text-xs font-mono shadow-sm">
                          <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>ACCOUNT FUNDED: {provider.billing.formatted}</span>
                          </div>
                          <span className="text-[10px] text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700/60 font-semibold uppercase">
                            {provider.billing.mechanism}
                          </span>
                        </div>
                      )}

                      {/* Inputs for each credential field */}
                      <div className="space-y-3">
                        {provider.fields.map(field => {
                          const currentVal = inputForms[provider.id]?.[field.key] || '';
                          const fieldId = `${provider.id}_${field.key}`;
                          const isSecretShown = showSecrets[fieldId] || false;
                          const isCurrentlySet = provider.fieldValues?.[field.key]?.isSet;

                          return (
                            <div key={field.key} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <label className="font-mono text-slate-300 text-[11px] font-medium flex items-center gap-1">
                                  <span>{field.label}</span>
                                  {field.required && <span className="text-rose-400">*</span>}
                                  {isCurrentlySet && (
                                    <span className="text-[9px] px-1 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                                      Saved: {provider.fieldValues[field.key].masked}
                                    </span>
                                  )}
                                </label>
                                <span className="text-[9px] text-slate-500 font-mono">{field.key}</span>
                              </div>

                              <div className="relative">
                                <input
                                  type={field.isSecret && !isSecretShown ? 'password' : 'text'}
                                  value={currentVal}
                                  onChange={e => handleInputChange(provider.id, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white rounded-lg px-3 py-1.5 text-xs font-mono placeholder:text-slate-600"
                                />
                                {field.isSecret && (
                                  <button
                                    type="button"
                                    onClick={() => toggleShowSecret(fieldId)}
                                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 cursor-pointer"
                                  >
                                    {isSecretShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Endpoint Capabilities */}
                      <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-1.5 text-[10px] font-mono text-slate-400">
                        <div className="flex items-center gap-1">
                          {provider.health.endpoints.authentication ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-slate-600" />}
                          <span>Auth</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {provider.health.endpoints.pricing ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-slate-600" />}
                          <span>Pricing</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {provider.health.endpoints.provisioning ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-slate-600" />}
                          <span>Provision</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Feedback */}
                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveCredentials(provider.id)}
                          disabled={isSaving}
                          className="flex-1 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-medium rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          {isSaving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Save Key</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTestConnection(provider.id)}
                          disabled={isTesting}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg flex items-center gap-1 border border-slate-700 transition cursor-pointer"
                        >
                          {isTesting ? <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Activity className="w-3.5 h-3.5 text-cyan-400" />}
                          <span>Test Ping</span>
                        </button>
                      </div>

                      {feedback && (
                        <div className={`p-2 rounded text-[11px] font-mono ${
                          feedback.type === 'success' ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-300'
                        }`}>
                          {feedback.text}
                        </div>
                      )}

                      {testResult && (
                        <div className="p-2 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400">{testResult.message}</span>
                          <span className={testResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {testResult.status} ({testResult.latencyMs}ms)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* CUSTOM / FUTURE PROVIDERS SECTION (For Any Other Providers Not Yet Integrated) */}
      {(filterTab === 'ALL' || filterTab === 'CUSTOM') && (
        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>Custom / Future GPU Providers (Not Yet Integrated)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Register any external GPU provider (e.g. Crusoe Cloud, Nebius, Together AI, Shadeform, FluidStack, JarvisLabs) into the arbitrage routing engine.
              </p>
            </div>
            <button
              onClick={() => setShowAddCustomModal(true)}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-medium rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Provider</span>
            </button>
          </div>

          {customProviders.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
              <Server className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-300">No Custom Providers Configured Yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                You can add any REST/GraphQL GPU cloud provider here. Enter their endpoint and API token to integrate them into the arbitrage matrix.
              </p>
              <button
                onClick={() => setShowAddCustomModal(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-mono rounded-lg border border-slate-700 cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Custom Provider</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customProviders.map(cp => (
                <div key={cp.id} className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                        <h4 className="font-bold text-sm text-white">{cp.name}</h4>
                      </div>
                      <button
                        onClick={() => handleDeleteCustomProvider(cp.id)}
                        className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-1"
                        title="Delete custom provider"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono text-slate-400">
                      <div><span className="text-slate-600">ID:</span> {cp.id}</div>
                      <div><span className="text-slate-600">Base URL:</span> {cp.baseUrl}</div>
                      <div><span className="text-slate-600">Key:</span> {cp.apiKeyMasked || 'Not set'}</div>
                      {cp.supportedGpuModels && cp.supportedGpuModels.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-1">
                          {cp.supportedGpuModels.map(m => (
                            <span key={m} className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                    <span>Added: {new Date(cp.createdAt).toLocaleDateString()}</span>
                    <span className="text-cyan-400">ACTIVE IN ROUTER</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD CUSTOM PROVIDER */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add New GPU Provider</h3>
                  <p className="text-xs text-slate-400">Connect any external NeoCloud or Decentralized GPU source</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddCustomModal(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomProvider} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Provider Name *</label>
                  <input
                    type="text"
                    required
                    value={customForm.name}
                    onChange={e => {
                      const name = e.target.value;
                      const id = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                      setCustomForm(prev => ({ ...prev, name, id: prev.id ? prev.id : id }));
                    }}
                    placeholder="e.g. Crusoe Cloud"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Provider ID (Slug) *</label>
                  <input
                    type="text"
                    required
                    value={customForm.id}
                    onChange={e => setCustomForm(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="e.g. crusoe_cloud"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">API Base URL *</label>
                <input
                  type="url"
                  required
                  value={customForm.baseUrl}
                  onChange={e => setCustomForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.crusoecloud.com/v1"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Auth Header Name</label>
                  <input
                    type="text"
                    value={customForm.authHeaderName}
                    onChange={e => setCustomForm(prev => ({ ...prev, authHeaderName: e.target.value }))}
                    placeholder="Authorization"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">Auth Prefix</label>
                  <input
                    type="text"
                    value={customForm.authHeaderPrefix}
                    onChange={e => setCustomForm(prev => ({ ...prev, authHeaderPrefix: e.target.value }))}
                    placeholder="Bearer "
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">API Key / Token</label>
                <input
                  type="password"
                  value={customForm.apiKey}
                  onChange={e => setCustomForm(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter API token or key..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Supported GPU Models (comma-separated)</label>
                <input
                  type="text"
                  value={customForm.supportedGpuModels}
                  onChange={e => setCustomForm(prev => ({ ...prev, supportedGpuModels: e.target.value }))}
                  placeholder="RTX 4090, A100 SXM4 80GB, H100 PCIe 80GB"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustom}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingCustom ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Provider</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZERO-FUNDED ARCHITECTURE & JAKE GROVE CFO INTEGRATION NOTE */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1 font-mono">
          <div className="text-slate-200 font-bold">Zero-Funded Financial Guarantee & Jake Grove CFO Audit:</div>
          <p>
            Storing API keys here enables live pricing matrix feeds and instant inventory discovery. In strict compliance with Build 53 rules, 
            <strong> zero operator capital is ever spent automatically</strong>. GPU instances will only provision once a real customer deposit 
            is cryptographically verified, funds reserved in escrow, and Jake Grove CFO issues an authorized gate approval.
          </p>
        </div>
      </div>
    </div>
  );
};
