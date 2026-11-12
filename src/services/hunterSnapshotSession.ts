export interface HunterSessionOptions<T> {
  fetcher?: typeof fetch;
  onData: (data: T | null) => void;
  onBusy: (busy: boolean) => void;
  onError: (error: string) => void;
}
/** One active operation per mounted dashboard. Cancellation never retries a mutation or updates an unmounted view. */
export function createHunterSnapshotSession<T>(
  options: HunterSessionOptions<T>,
) {
  let active = true,
    pending: Promise<boolean> | null = null;
  const controller = new AbortController(),
    fetcher = options.fetcher ?? fetch;
  const read = async (path = "", body?: unknown) => {
    const response = await fetcher("/api/owner/prefunded-hunter" + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok)
      throw Error(
        response.status === 401 || response.status === 403
          ? "OWNER_SESSION_EXPIRED"
          : "HUNTER_REQUEST_BLOCKED",
      );
    return response.json();
  };
  const run = (path = "", body?: unknown): Promise<boolean> => {
    if (!active) return Promise.resolve(false);
    if (pending) return pending;
    options.onBusy(true);
    options.onError("");
    pending = (async () => {
      try {
        if (path) await read(path, body);
        const snapshot = await read();
        const arrays = [
          "verifiedOpportunities",
          "rejectedOpportunities",
          "approvalQueue",
          "candidates",
          "wholesaleMatches",
          "indicativeComparisons",
          "reviews",
          "restrictedNetworks",
          "audit",
        ];
        if (
          snapshot?.mode !== "READ_ONLY" ||
          snapshot.financialExecutionAllowed !== false ||
          arrays.some((key) => !Array.isArray(snapshot[key]))
        )
          throw Error("UNSAFE_HUNTER_RESPONSE");
        if (!active) return false;
        options.onData(snapshot);
        return true;
      } catch (error) {
        if (active) {
          options.onData(null);
          options.onError(
            error instanceof Error && error.message === "OWNER_SESSION_EXPIRED"
              ? "Owner session expired. Sign in again."
              : "Request unavailable or blocked. Fresh evidence and a writable archive are required.",
          );
        }
        return false;
      } finally {
        pending = null;
        if (active) options.onBusy(false);
      }
    })();
    return pending;
  };
  return {
    run,
    close() {
      active = false;
      controller.abort();
    },
  };
}
