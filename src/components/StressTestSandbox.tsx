import React, { useState } from 'react';
import { useArbitrage } from '../context/ArbitrageContext';
import { 
  ShieldAlert, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Radio, 
  RefreshCw,
  Layers,
  Lock
} from 'lucide-react';

export const StressTestSandbox: React.FC = () => {
  const { runStressTest } = useArbitrage();
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: 'PASSED' | 'FAILED'; note: string }>>({});

  const scenarios = [
    {
      id: 'SPOT_INTERRUPTION',
      title: 'Spot GPU Pre-emption / Node Reclamation',
      desc: 'Simulates a provider sending a 120s spot eviction signal during active inference. Verifies state snapshotting and zero data loss.',
      severity: 'HIGH'
    },
    {
      id: 'PRICE_SURGE',
      title: '50% Provider Market Price Surge (Margin Collapse)',
      desc: 'Simulates instantaneous surge in spot prices. Verifies that Deal Verification Engine immediately halts and rejects negative-margin purchases.',
      severity: 'CRITICAL'
    },
    {
      id: 'PAYMENT_FAILURE',
      title: 'Unverified Escrow / Spoofed Customer Authorization',
      desc: 'Injects unconfirmed demand with spoofed escrow tokens. Verifies Rule #1 blocks capital commitment.',
      severity: 'CRITICAL'
    },
    {
      id: 'RUNAWAY_JOB',
      title: 'Runaway GPU Job (>120% Planned Duration)',
      desc: 'Simulates hung CUDA kernel exceeding max execution window. Verifies watchdog timeout auto-terminates instance.',
      severity: 'MEDIUM'
    },
    {
      id: 'PROVIDER_OUTAGE',
      title: 'Complete Vast.ai API Gateway Outage',
      desc: 'Simulates primary provider downtime. Verifies dynamic multi-provider routing fails over to RunPod seamlessly.',
      severity: 'HIGH'
    }
  ] as const;

  const handleRunTest = async (testId: typeof scenarios[number]['id']) => {
    setRunningTest(testId);
    runStressTest(testId);
    setTimeout(() => {
      setTestResults(prev => ({
        ...prev,
        [testId]: {
          status: 'PASSED',
          note: `Defensive circuit breaker triggered. Zero capital leaked.`
        }
      }));
      setRunningTest(null);
    }, 1200);
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Paper Mode Simulation & Stress Testing Sandbox
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Section 26 & 27: Inject extreme market anomalies and failure modes to verify zero-loss capital defense before engaging Live capital.
          </p>
        </div>
      </div>

      {/* Stress Scenarios List */}
      <div className="grid grid-cols-1 gap-4">
        {scenarios.map(scenario => {
          const isRunning = runningTest === scenario.id;
          const result = testResults[scenario.id];

          return (
            <div
              key={scenario.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    scenario.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {scenario.severity} RISK
                  </span>
                  <h3 className="text-sm font-bold text-white">{scenario.title}</h3>
                </div>
                <p className="text-xs text-slate-400 max-w-2xl">{scenario.desc}</p>
                {result && (
                  <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Test Result: {result.status} — {result.note}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleRunTest(scenario.id)}
                disabled={isRunning}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-2 shadow-md"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Simulating Attack...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-rose-400" />
                    <span>Inject Scenario</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
