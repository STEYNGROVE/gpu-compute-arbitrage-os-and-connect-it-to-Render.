import React, { useEffect, useState } from 'react';
import { ArbitrageProvider } from './context/ArbitrageContext';
import { Header } from './components/Header';
import { CommandCenter } from './components/CommandCenter';
import { OpportunityEngine } from './components/OpportunityEngine';
import { SupplyDemandRadar } from './components/SupplyDemandRadar';
import { ActiveJobsFleet } from './components/ActiveJobsFleet';
import { ProfitEngine } from './components/ProfitEngine';
import { OwnerControlPanel } from './components/OwnerControlPanel';
import { CustomerApiPortal } from './components/CustomerApiPortal';
import { LearningEngineView } from './components/LearningEngineView';
import { StressTestSandbox } from './components/StressTestSandbox';
import { AuditLogViewer } from './components/AuditLogViewer';
import { TreasuryPanel } from './components/TreasuryPanel';
import { ReadinessPanel } from './components/ReadinessPanel';
import { ProfitableCapitalSummaryScreen } from './components/ProfitableCapitalSummaryScreen';
import { LiveGpuPriceRouter } from './components/LiveGpuPriceRouter';
import { ZeroFundedBootstrapPanel } from './components/ZeroFundedBootstrapPanel';
import { JakeGroveCfoPanel } from './components/JakeGroveCfoPanel';
import { ProviderKeyringPanel } from './components/ProviderKeyringPanel';
import { GpuComparisonDashboard } from './components/GpuComparisonDashboard';

export function AppContent() {
  const [activeTab, setActiveTab] = useState<string>('command_center');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Fixed Header with Mode & Emergency Kill Switch */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'command_center' && (
          <CommandCenter onNavigate={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'cfo_command' && <JakeGroveCfoPanel />}
        {activeTab === 'provider_keyring' && <ProviderKeyringPanel />}
        {activeTab === 'capital_summary' && (
          <ProfitableCapitalSummaryScreen onNavigate={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'zero_funded' && <ZeroFundedBootstrapPanel />}
        {activeTab === 'price_router' && <LiveGpuPriceRouter />}
        {activeTab === 'gpu_comparison' && <GpuComparisonDashboard />}
        {activeTab === 'treasury' && <TreasuryPanel />}
        {activeTab === 'readiness' && <ReadinessPanel />}
        {activeTab === 'opportunities' && <OpportunityEngine />}
        {activeTab === 'supply_demand' && <SupplyDemandRadar />}
        {activeTab === 'active_fleet' && <ActiveJobsFleet />}
        {activeTab === 'profit_engine' && <ProfitEngine />}
        {activeTab === 'owner_control' && <OwnerControlPanel />}
        {activeTab === 'customer_api' && <CustomerApiPortal />}
        {activeTab === 'learning_engine' && <LearningEngineView />}
        {activeTab === 'stress_test' && <StressTestSandbox />}
        {activeTab === 'audit_logs' && <AuditLogViewer />}
      </main>

      {/* Persistent Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 sm:px-6 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>GPU Compute Arbitrage OS • Private Owner-Controlled Instance</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Policy: Zero-Speculation</span>
            <span>•</span>
            <span>Live Price Router (Vast.ai · Akash · Salad · RunPod · Neoclouds)</span>
            <span>•</span>
            <span>All Hard Limits Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

type AuthState = 'checking' | 'anonymous' | 'owner';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Session check failed');
        return response.json();
      })
      .then(data => { if (active) setAuthState(data.authenticated === true && data.role === 'OWNER' ? 'owner' : 'anonymous'); })
      .catch(() => { if (active) { setAuthState('anonymous'); setError('Could not verify your session. Sign in to continue.'); } });
    return () => { active = false; };
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!secret.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'OWNER', secretOrKey: secret })
      });
      const data = await response.json();
      if (!response.ok || data.authenticated !== true || data.role !== 'OWNER')
        throw new Error('Owner authentication failed. Verify your OWNER_API_KEY.');
      setSecret('');
      setAuthState('owner');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    setAuthState('checking');
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
    finally { setAuthState('anonymous'); setSecret(''); }
  }

  if (authState !== 'owner') return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-2">GPU Compute Arbitrage OS</h1>
        <p className="text-slate-400 mb-6">Private owner access</p>
        {authState === 'checking' ? <p role="status">Verifying session…</p> : (
          <form onSubmit={signIn} className="space-y-4">
            <label htmlFor="owner-key" className="block text-sm">Owner access key</label>
            <input id="owner-key" type="password" autoComplete="current-password" required
              value={secret} onChange={event => setSecret(event.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-950 p-3 text-white" />
            {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
            <button disabled={busy} type="submit" className="w-full rounded bg-cyan-600 p-3 font-semibold disabled:opacity-50">
              {busy ? 'Signing in…' : 'Sign in securely'}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <ArbitrageProvider>
      <div className="bg-slate-950 text-right px-6 py-2">
        <button type="button" onClick={signOut} className="text-sm text-cyan-300 underline">Sign out</button>
      </div>
      <AppContent />
    </ArbitrageProvider>
  );
}
