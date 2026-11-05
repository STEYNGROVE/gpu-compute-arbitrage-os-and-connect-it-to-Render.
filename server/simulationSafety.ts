/**
 * Simulation-only release safety policy.
 * Missing or conflicting mode settings deny live operations.
 */
export function liveOperationsAllowed(): boolean {

  // Simulation-only release: never authorize live operations.
  return false;
}

export function assertLiveOperationsAllowed(): void {
  if (!liveOperationsAllowed()) {
    throw new Error(
      'SIMULATION_LOCKDOWN: Real financial and GPU operations are disabled.'
    );
  }
}
