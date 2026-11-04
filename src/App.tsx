import React, { useState } from 'react';
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

export default function App() {
  return (
    <ArbitrageProvider>
      <AppContent />
    </ArbitrageProvider>
  );
}
