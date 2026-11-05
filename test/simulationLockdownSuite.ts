import assert from 'node:assert/strict';
import {
  liveOperationsAllowed,
  assertLiveOperationsAllowed
} from '../server/simulationSafety.js';

const keys = [
  'SYSTEM_OPERATING_MODE',
  'EXECUTION_MODE',
  'REALITY_LEVEL'
] as const;

const original = keys.map(k => process.env[k]);

function setModes(values: (string | undefined)[]) {
  keys.forEach((key, i) => {
    if (values[i] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[i];
    }
  });
}

function blocked(name: string, modes: (string | undefined)[]) {
  setModes(modes);

  assert.equal(liveOperationsAllowed(), false, name);

  assert.throws(
    () => assertLiveOperationsAllowed(),
    /SIMULATION_LOCKDOWN/,
    name
  );

  console.log(`PASS: ${name}`);
}

try {
  blocked('Missing configuration', [
    undefined, undefined, undefined
  ]);

  blocked('All simulation', [
    'SIMULATION', 'SIMULATION', 'SIMULATION'
  ]);

  blocked('Mixed live and simulation', [
    'LIVE', 'SIMULATION', 'LIVE'
  ]);

  blocked('Only one live setting', [
    'LIVE', undefined, undefined
  ]);

  blocked('Invalid mode values', [
    'PRODUCTION', 'LIVE', 'LIVE'
  ]);

  setModes(['LIVE', 'LIVE', 'LIVE']);

  assert.equal(
    liveOperationsAllowed(),
    false,
    'Explicit LIVE configuration must remain blocked'
  );

  assert.throws(
    () => assertLiveOperationsAllowed(),
    /SIMULATION_LOCKDOWN/
  );

  console.log('PASS: Explicit LIVE configuration blocked');
  console.log('ALL 6 POLICY TESTS PASSED');
} finally {
  keys.forEach((key, i) => {
    if (original[i] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[i];
    }
  });
}
