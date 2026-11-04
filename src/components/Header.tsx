import React, { useState, useEffect } from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import { 
  ShieldAlert, 
  ShieldCheck,
  Play, 
  RotateCw, 
  Lock, 
  Coins, 
  TrendingUp, 
  Zap, 
  Activity, 
  AlertTriangle,
  Cpu,
  Layers,
  Sparkles,
  Scale,
  Key
} from 'lucide-react';
import { SystemMode, ExecutionEnvironment } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const {
    ownerConfig,
    systemMode,
    setSystemMode,
    triggerEmergencyShutdown,
    resetEmergencyShutdown,
    totalRealizedProfit,
    realizedProfitToday,
    deployedCapital,
    capitalExposureHeadroom,
    isScanning,
    scanNow,
    activeJobs,
    opportunitySummary
  } = useArbitrage();

  const handleModeChange = (mode: SystemMode) => {
    if (mode === 'EMERGENCY_PAUSE') {
      triggerEmergencyShutdown();
    } else {
      if (ownerConfig.emergencyKillSwitchActive) {
        resetEmergencyShutdown();
      }
      setSystemMode(mode);
    }
  };

  const [firstRevenueProven, setFirstRevenueProven] = useState<boolean>(false);
  const [milestoneStatus, setMilestoneStatus] = useState<string>('PRE-PRODUCTION — FIRST VERIFIED REVENUE NOT PROVEN');

  useEffect(() => {
    const checkMilestone = async () => {
      try {
        const res = await fetch('/api/cfo/command-center');
        if (res.ok) {
          const data = await res.json();
          setFirstRevenueProven(Boolean(data.firstVerifiedRevenueProven));
          if (data.milestoneStatus) {
            setMilestoneStatus(data.milestoneStatus);
          }
        }
      } catch {}
    };
    checkMilestone();
    const interval = setInterval(checkMilestone, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentBalance = ownerConfig.liveCurrentBalance ?? 0;

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
      {/* Top Warning Banner if Emergency Paused */}
      {ownerConfig.emergencyKillSwitchActive && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-4 py-2 text-rose-200 text-xs sm:text-sm font-medium flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span><strong>EMERGENCY SHUTDOWN ACTIVE:</strong> All automatic GPU purchases and jobs are paused. Zero capital risk.</span>
          </div>
          <button
            onClick={resetEmergencyShutdown}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Reset System
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 p-0.5 shadow-lg shadow-cyan-950/50 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                    <span>GPU COMPUTE ARBITRAGE</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 rounded font-semibold tracking-wider">
                      OS v2.4
                    </span>
                  </h1>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Rule #1 Enforced: No Verified Demand = No Purchase</span>
                </p>
              </div>
            </div>

            {/* Mobile Big Red Button */}
            <div className="lg:hidden">
              <button
                onClick={triggerEmergencyShutdown}
                className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white font-mono text-xs font-bold rounded flex items-center gap-1.5 shadow-lg shadow-rose-950"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>KILL</span>
              </button>
            </div>
          </div>

          {/* Center Capital & Financial Ticker */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1 text-xs font-mono">
            {/* Capital Balance */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0">
              <Coins className="w-3.5 h-3.5 text-cyan-400" />
              <div>
                <div className="text-[10px] uppercase text-slate-400">Available Cap</div>
                <div className="font-semibold text-slate-100">${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* RunPod Funded Pre-Paid Credit */}
            <button
              onClick={() => setActiveTab('zero_funded')}
              title="RunPod Account is live and funded with $15.00 pre-paid credit"
              className="bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/80 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0 text-left cursor-pointer transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <div className="text-[10px] uppercase text-emerald-400/90 font-bold flex items-center gap-1">
                  <span>RunPod</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </div>
                <div className="font-bold text-emerald-300">$15.00 <span className="text-[9px] text-emerald-400/90 font-normal">Funded</span></div>
              </div>
            </button>

            {/* Lightning AI Studios Funded Pre-Paid Credit */}
            <button
              onClick={() => setActiveTab('zero_funded')}
              title="Lightning AI Studios Account (steyngrovesar) is live and funded with $29.81 pre-paid credit"
              className="bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/80 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0 text-left cursor-pointer transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <div>
                <div className="text-[10px] uppercase text-cyan-400/90 font-bold flex items-center gap-1">
                  <span>Lightning AI</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                </div>
                <div className="font-bold text-cyan-300">$29.81 <span className="text-[9px] text-cyan-400/90 font-normal">Funded</span></div>
              </div>
            </button>

            {/* Total Capital Required for All Profitable Jobs */}
            <button
              onClick={() => setActiveTab('capital_summary')}
              title="Open Total Money Required for All Profitable Jobs Summary Screen"
              className="bg-slate-900/80 hover:bg-slate-800/90 border border-amber-800/60 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0 text-left cursor-pointer transition-colors"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase text-amber-400/90">Req. Cap ({opportunitySummary.profitable} Jobs)</div>
                <div className="font-bold text-amber-300">
                  ${(opportunitySummary.totalRequiredCapitalForProfitableUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </button>

            {/* Deployed Capital */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <div>
                <div className="text-[10px] uppercase text-slate-400">Deployed Cap</div>
                <div className="font-semibold text-blue-300">${(deployedCapital ?? 0).toFixed(2)} <span className="text-[10px] text-slate-500">/ ${ownerConfig.maxCapitalExposure}</span></div>
              </div>
            </div>

            {/* Realized Profit */}
            <div className="bg-slate-900/80 border border-emerald-900/50 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <div className="text-[10px] uppercase text-emerald-400/80">Realized Profit (Settled)</div>
                <div className="font-bold text-emerald-400">+${(Number.isFinite(totalRealizedProfit) ? totalRealizedProfit : 0).toFixed(2)} <span className="text-[10px] text-emerald-600 font-normal">(Today: +${(Number.isFinite(realizedProfitToday) ? realizedProfitToday : 0).toFixed(2)})</span></div>
              </div>
            </div>

            {/* Active Running Instances */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase text-slate-400">Active GPUs</div>
                <div className="font-semibold text-amber-300">{activeJobs.filter(j => j.status === 'RUNNING').length} <span className="text-[10px] text-slate-500">instances</span></div>
              </div>
            </div>
          </div>

          {/* Right Action Controls: Mode Selector + Environment + BIG RED STOP BUTTON */}
          <div className="flex items-center gap-2.5 shrink-0 justify-end">
            {/* Scan Refresh Button */}
            <button
              onClick={() => scanNow()}
              disabled={isScanning}
              title="Rescan GPU Supply & Demand Index"
              className={`p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors cursor-pointer ${isScanning ? 'animate-spin text-cyan-400' : ''}`}
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Authoritative Milestone Status Indicator */}
            <button
              onClick={() => setActiveTab('jake_grove_cfo')}
              title={firstRevenueProven ? 'Verified Revenue Proven under Jake Grove CFO' : 'Click to view Jake Grove CFO verification chain & execute acid test'}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-colors ${
                firstRevenueProven
                  ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
                  : 'border-amber-500/60 bg-amber-950/80 text-amber-300 hover:bg-amber-900/80'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${firstRevenueProven ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{milestoneStatus}</span>
            </button>

            {/* System Mode Dropdown / Pills */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center gap-1">
              <button
                onClick={() => handleModeChange('SAFE_AUTO')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                  systemMode === 'SAFE_AUTO'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="SAFE AUTO: Autonomous execution only on confirmed demand with positive worst-case margin"
              >
                SAFE AUTO
              </button>
              <button
                onClick={() => handleModeChange('SMART_AUTO')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                  systemMode === 'SMART_AUTO'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="SMART AUTO: Low-risk autonomous routing with dynamic monetization selection"
              >
                SMART AUTO
              </button>
              <button
                onClick={() => handleModeChange('MANUAL')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                  systemMode === 'MANUAL'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="MANUAL: System discovers opportunities but requires Owner 1-Click approval"
              >
                MANUAL
              </button>
            </div>

            {/* THE BIG RED STOP BUTTON */}
            <button
              onClick={triggerEmergencyShutdown}
              title="EMERGENCY SHUTDOWN: Immediately stops all buying and pauses all active jobs"
              className="hidden lg:flex px-3.5 py-1.5 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-mono text-xs font-bold rounded-lg items-center gap-1.5 shadow-lg shadow-rose-950/80 border border-rose-500 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>EMERGENCY STOP</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-850 overflow-x-auto text-xs font-medium">
          {[
            { id: 'command_center', label: 'Command Center (5 Answers)', icon: Activity },
            { id: 'cfo_command', label: 'Jake Grove — CFO', icon: Scale, textBadge: 'CONTROL PLANE' },
            { id: 'zero_funded', label: 'Zero-Funded Bootstrap', icon: ShieldCheck, textBadge: 'ZERO CAP' },
            { id: 'price_router', label: 'Live GPU Price Router', icon: Cpu, textBadge: 'CORE 4' },
            { id: 'provider_keyring', label: 'Provider APIs & Keyring', icon: Key, textBadge: 'LIGHTNING & APIS' },
            { id: 'capital_summary', label: 'Capital Required Summary', icon: Coins, badge: opportunitySummary.profitable },
            { id: 'opportunities', label: 'Verified Opportunities', icon: Sparkles, badge: opportunitySummary.realOpportunities },
            { id: 'treasury', label: 'Treasury & Multi-Wallet', icon: Coins },
            { id: 'readiness', label: 'Production Readiness & Attacks', icon: ShieldAlert },
            { id: 'supply_demand', label: 'Supply/Demand Radar & Heatmap', icon: Layers },
            { id: 'active_fleet', label: 'Active GPU Fleet', icon: Cpu, badge: activeJobs.length },
            { id: 'profit_engine', label: 'Realized P&L Ledger', icon: TrendingUp },
            { id: 'owner_control', label: 'Owner Controls & Risk Limits', icon: Lock },
            { id: 'customer_api', label: 'Private Customer API', icon: Zap },
            { id: 'learning_engine', label: 'Provider Intelligence & SLA', icon: Activity },
            { id: 'stress_test', label: 'Simulation & Stress Sandbox', icon: ShieldAlert },
            { id: 'audit_logs', label: 'Audit Logs', icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md font-mono flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 border border-cyan-800/60 font-semibold shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.textBadge && (
                  <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] rounded font-bold uppercase tracking-wider">
                    {tab.textBadge}
                  </span>
                )}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
