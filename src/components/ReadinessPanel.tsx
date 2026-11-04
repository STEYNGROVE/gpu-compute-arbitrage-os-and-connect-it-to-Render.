import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Play, 
  RotateCw, 
  Lock, 
  Terminal, 
  Activity,
  Flame
} from 'lucide-react';

interface ReadinessGate {
  gateId: string;
  name: string;
  category: string;
  isPassed: boolean;
  isMandatoryForLive: boolean;
  status: string;
  diagnostic: string;
  evidence?: Record<string, unknown>;
}

interface ReadinessReport {
  timestamp: string;
  isLiveAllowed: boolean;
  passedGatesCount: number;
  totalGatesCount: number;
  blockingReasons: string[];
  gates: ReadinessGate[];
}

interface AttackResult {
  attackName: string;
  category: string;
  passed: boolean;
  attemptDescription: string;
  expectedDefensiveOutcome: string;
  actualObservedOutcome: string;
  executionDurationMs: number;
}

interface AttackReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: AttackResult[];
}

function normalizeReadinessReport(data: any): ReadinessReport {
  if (!data) {
    return {
      timestamp: new Date().toISOString(),
      isLiveAllowed: false,
      passedGatesCount: 0,
      totalGatesCount: 0,
      blockingReasons: [],
      gates: []
    };
  }

  const rawGates = data.gates;
  let gatesList: ReadinessGate[] = [];

  if (Array.isArray(rawGates)) {
    gatesList = rawGates.map((g: any, idx: number) => ({
      gateId: String(g.gateId || g.id || `gate_${idx}`),
      name: String(g.name || 'Unnamed Gate'),
      category: String(g.category || 'SYSTEM'),
      isPassed: typeof g.isPassed === 'boolean' ? g.isPassed : g.status === 'GREEN',
      isMandatoryForLive: typeof g.isMandatoryForLive === 'boolean' ? g.isMandatoryForLive : Boolean(g.mandatory),
      status: String(g.status || (g.isPassed ? 'GREEN' : 'RED')),
      diagnostic: String(g.diagnostic || g.message || 'No diagnostic message'),
      evidence: g.evidence || g.details
    }));
  } else if (rawGates && typeof rawGates === 'object') {
    gatesList = Object.entries(rawGates).map(([key, g]: [string, any]) => ({
      gateId: key,
      name: String(g?.name || key),
      category: String(g?.category || g?.details?.category || 'SYSTEM'),
      isPassed: typeof g?.isPassed === 'boolean' ? g.isPassed : g?.status === 'GREEN',
      isMandatoryForLive: typeof g?.isMandatoryForLive === 'boolean' ? g.isMandatoryForLive : Boolean(g?.mandatory),
      status: String(g?.status || (g?.status === 'GREEN' ? 'GREEN' : 'RED')),
      diagnostic: String(g?.diagnostic || g?.message || 'Diagnostic unavailable'),
      evidence: g?.evidence || g?.details
    }));
  }

  const passedCount = typeof data.passedGatesCount === 'number'
    ? data.passedGatesCount
    : gatesList.filter(g => g.isPassed).length;

  const totalCount = typeof data.totalGatesCount === 'number'
    ? data.totalGatesCount
    : gatesList.length;

  const isLiveAllowed = typeof data.isLiveAllowed === 'boolean'
    ? data.isLiveAllowed
    : Boolean(data.liveReady);

  const blockingReasons = Array.isArray(data.blockingReasons)
    ? data.blockingReasons
    : Array.isArray(data.failedMandatoryGates)
    ? data.failedMandatoryGates
    : [];

  return {
    timestamp: data.timestamp || new Date().toISOString(),
    isLiveAllowed,
    passedGatesCount: passedCount,
    totalGatesCount: totalCount,
    blockingReasons,
    gates: gatesList
  };
}

export const ReadinessPanel: React.FC = () => {
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [attackReport, setAttackReport] = useState<AttackReport | null>(null);
  const [isRunningAttacks, setIsRunningAttacks] = useState(false);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    setIsLoadingReadiness(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/system/readiness', {
        headers: { 'x-auth-role': 'owner' }
      });
      if (res.ok) {
        const data = await res.json();
        setReadiness(normalizeReadinessReport(data));
      } else {
        setErrorMessage(`Server returned status ${res.status}`);
      }

      const attackRes = await fetch('/api/system/attack-test/results', {
        headers: { 'x-auth-role': 'owner' }
      });
      if (attackRes.ok) {
        const attackData = await attackRes.json();
        if (attackData.report && attackData.report.results) {
          setAttackReport(attackData.report);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to readiness system');
    } finally {
      setIsLoadingReadiness(false);
    }
  }, []);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  const handleRunAttackSuite = async () => {
    setIsRunningAttacks(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/system/attack-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-role': 'owner' }
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setAttackReport(data.report);
      } else {
        setErrorMessage(data.message || 'Attack suite execution failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsRunningAttacks(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Production Readiness & Attack Verification</h2>
            <p className="text-xs text-slate-400">
              Mandatory Fail-Closed Gates • Penetration & Concurrency Attack Suite
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReadiness}
            disabled={isLoadingReadiness}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Refresh Gates"
          >
            <RotateCw className={`w-4 h-4 ${isLoadingReadiness ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleRunAttackSuite}
            disabled={isRunningAttacks}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white text-xs font-mono font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
          >
            <Flame className={`w-4 h-4 ${isRunningAttacks ? 'animate-bounce' : ''}`} />
            <span>{isRunningAttacks ? 'Executing Attack Vectors...' : 'Execute Security Attack Suite'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-mono rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Readiness Status Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-xs text-slate-400 uppercase font-mono">Mandatory Gates Passed</div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {readiness ? `${readiness.passedGatesCount} / ${readiness.totalGatesCount}` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {readiness?.passedGatesCount === readiness?.totalGatesCount
              ? `All ${readiness?.totalGatesCount || 16} Gates Satisfied`
              : `Blocking: ${readiness?.blockingReasons?.join(', ') || 'Pending Live Capital'}`}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-xs text-slate-400 uppercase font-mono">Live Money Gate</div>
          <div className="flex items-center gap-2 pt-1">
            {readiness?.isLiveAllowed ? (
              <span className="px-2.5 py-1 bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono text-xs font-bold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                PRODUCTION READY
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-amber-950 border border-amber-700 text-amber-300 font-mono text-xs font-bold rounded-md flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                PROTECTED (FAIL-CLOSED)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {readiness?.isLiveAllowed ? 'Ready for live trading' : 'Fail-closed state: execution blocked until gates satisfied'}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-xs text-slate-400 uppercase font-mono">Attack Suite Defense</div>
          <div className="flex items-center gap-2 pt-1">
            {attackReport ? (
              attackReport.allPassed ? (
                <span className="px-2.5 py-1 bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono text-xs font-bold rounded-md flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {attackReport.passedTests} / {attackReport.totalTests} VECTORS DEFENDED
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-rose-950 border border-rose-700 text-rose-300 font-mono text-xs font-bold rounded-md flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  {attackReport.failedTests} VECTORS FAILED
                </span>
              )
            ) : (
              <span className="px-2.5 py-1 bg-slate-800 text-slate-400 font-mono text-xs rounded-md">
                UNTESTED (CLICK EXECUTE)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Double-Spend, HMAC, Replay, Escalation
          </div>
        </div>
      </div>

      {/* Mandatory Production Gates Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>{readiness?.totalGatesCount || 16} Core Production Readiness Gates</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">Strict Fail-Closed Architecture</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(readiness?.gates || []).map((gate) => (
            <div
              key={gate.gateId}
              className={`p-3.5 rounded-lg border text-xs font-mono space-y-2 ${
                gate.isPassed
                  ? 'bg-slate-950/70 border-emerald-900/60'
                  : 'bg-slate-950/70 border-amber-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white truncate max-w-[200px]" title={gate.name}>
                  {gate.name}
                </span>
                {gate.isPassed ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                    PASSED
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded">
                    FAIL-CLOSED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{gate.diagnostic}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Attack Suite Results Viewer */}
      {attackReport && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>Penetration & Financial Attack Defense Report</span>
            </h3>
            <span className="text-xs font-mono text-emerald-400">
              {attackReport.passedTests} of {attackReport.totalTests} Attacks Neutralized
            </span>
          </div>

          <div className="space-y-3">
            {(attackReport.results || []).map((result, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950 border border-slate-850 rounded-lg space-y-1.5 text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">#{idx + 1}</span>
                    <span className="text-white font-semibold">{result.attackName}</span>
                    <span className="px-1.5 py-0.5 bg-slate-850 text-slate-400 text-[10px] rounded">
                      {result.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">{result.executionDurationMs}ms</span>
                    {result.passed ? (
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] rounded font-bold">
                        NEUTRALIZED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 text-[10px] rounded font-bold">
                        BREACH DETECTED
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  <span className="text-slate-500">Attempt: </span>{result.attemptDescription}
                </div>
                <div className="text-[11px] text-emerald-400/90">
                  <span className="text-slate-500">Defense: </span>{result.actualObservedOutcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
