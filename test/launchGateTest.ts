/**
 * End-to-End Production Launch Gate & Edge-Case Verification Test Suite
 * Directly tests the required launch verification scenarios:
 * 1. Customer -> quote -> Binance payment -> webhook -> verification -> database settlement -> audit log
 * 2. Duplicate payment notification (PostgreSQL webhook_events replay protection)
 * 3. Forged Binance webhook notification
 * 4. Payment with wrong amount
 * 5. Payment with wrong reference
 * 6. Duplicate customer request
 * 7. Provider failure
 * 8. GPU disappears mid-job
 * 9. Binance balance mismatch
 * 10. PostgreSQL outage
 * 11. Worker crash/restart
 * 12. Concurrent requests attempting the same capital
 * 13. Emergency kill switch
 */

import '../server/bootstrap.js';
import { launchGateService } from '../server/launchGateVerification.js';

async function runLaunchGateTestSuite() {
  process.env.NODE_ENV = 'production';
  console.log('================================================================');
  console.log('  RUNNING PRODUCTION LAUNCH GATE & END-TO-END SCENARIO BATTERY');
  console.log('  (Canonical Binance Payment Rail & PostgreSQL Replay Protection)');
  console.log('================================================================\n');

  const report = await launchGateService.generateReport();

  console.log(`[EVALUATION TIMESTAMP]: ${report.timestamp}`);
  console.log(`[LAUNCH STATUS]: ${report.launchStatus}`);
  console.log(`[ALL GATES PASSED]: ${report.allGatesPassed ? 'YES (READY)' : 'NO (FAIL-CLOSED)'}`);
  console.log(`[BLOCKING ITEMS COUNT]: ${report.blockingCount}\n`);

  console.log('--- 1. EVALUATION OF 11 STRICT PRODUCTION LAUNCH GATES ---');
  for (const gate of report.gates) {
    const icon = gate.passed ? '🟢 PASS' : (gate.criticalForLiveMoney ? '🔴 BLOCKED' : '🟡 WARN');
    console.log(`  ${icon} [${gate.category}] ${gate.name}`);
    console.log(`       Requirement: ${gate.requirement}`);
    console.log(`       Observed:    ${gate.observed}`);
  }

  console.log(`\n--- 2. VERIFICATION OF ${report.scenarios.length} END-TO-END CRITICAL LAUNCH SCENARIOS ---`);
  let scenariosPassed = 0;
  for (const s of report.scenarios) {
    const icon = s.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${icon} [${s.scenarioId}] ${s.name} (${s.durationMs}ms)`);
    console.log(`       Attempt:  ${s.attemptDescription}`);
    console.log(`       Observed: ${s.observedOutcome}`);
    if (s.passed) scenariosPassed++;
  }

  console.log(`\nScenario Battery Summary: ${scenariosPassed}/${report.scenarios.length} scenarios verified successfully.`);

  if (scenariosPassed !== report.scenarios.length) {
    console.error('\n❌ CRITICAL: One or more launch verification scenarios failed!');
    process.exit(1);
  }

  console.log(`\n=== ALL ${report.scenarios.length} PRODUCTION LAUNCH SCENARIOS VERIFIED END-TO-END ===`);
  process.exit(0);
}

runLaunchGateTestSuite().catch(err => {
  console.error('[LAUNCH GATE TEST FATAL ERROR]:', err);
  process.exit(1);
});
