import assert from 'node:assert/strict';
import {
  liveOperationsAllowed,
  assertLiveOperationsAllowed
} from '../server/simulationSafety.js';

const keys = [
  'SYSTEM_OPERATING_MODE',
  'EXECUTION_MODE',
  'REALITY_LEVEL'
];

const original = Object.fromEntries(
  keys.map(key => [key, process.env[key]])
);

try {
  const scenarios = [
    ['Missing configuration', {}],
    ['Explicit simulation', {
      SYSTEM_OPERATING_MODE: 'SIMULATION',
      EXECUTION_MODE: 'SIMULATION',
      REALITY_LEVEL: 'SIMULATION'
    }],
    ['All LIVE', {
      SYSTEM_OPERATING_MODE: 'LIVE',
      EXECUTION_MODE: 'LIVE',
      REALITY_LEVEL: 'LIVE'
    }],
    ['Mixed configuration', {
      SYSTEM_OPERATING_MODE: 'LIVE',
      EXECUTION_MODE: 'SIMULATION',
      REALITY_LEVEL: 'LIVE'
    }]
  ] as const;

  for (const [name, settings] of scenarios) {
    for (const key of keys) {
      delete process.env[key];
    }

    Object.assign(process.env, settings);

    assert.equal(
      liveOperationsAllowed(),
      false,
      `${name}: live operations must remain disabled`
    );

    assert.throws(
      () => assertLiveOperationsAllowed(),
      /SIMULATION_LOCKDOWN/
    );

    console.log(`PASS: ${name}`);
  }

  console.log('ALL 4 RUNTIME POLICY TESTS PASSED');
} finally {
  for (const key of keys) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
}
