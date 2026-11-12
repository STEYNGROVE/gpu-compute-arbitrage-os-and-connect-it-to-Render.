import https from "node:https";
import { lookup } from "node:dns/promises";
import { isPublicIPv4 } from "../secureFeedFetch.js";

export type ReadOperation =
  | "akashOrders"
  | "akashDeployments"
  | "akashDeploymentsV1Beta4"
  | "vastOffers"
  | "runpodCatalog"
  | "enterpriseRfqs";
const urls: Record<ReadOperation, string> = {
  akashOrders:
    "https://api.akashnet.net/akash/market/v1beta5/orders/list?filters.state=open&pagination.limit=50",
  akashDeployments:
    "https://api.akashnet.net/akash/deployment/v1beta5/deployments/list?filters.state=active&pagination.limit=50",
  akashDeploymentsV1Beta4:
    "https://api.akashnet.net/akash/deployment/v1beta4/deployments/list?filters.state=active&pagination.limit=50",
  vastOffers: "https://cloud.vast.ai/api/v0/bundles/",
  runpodCatalog: "https://api.runpod.io/graphql",
  enterpriseRfqs: "https://api.sam.gov/opportunities/v2/search",
};
export interface ReadRequest {
  operation: ReadOperation;
  credential?: string;
  postedFrom?: string;
  postedTo?: string;
}
export interface ReadResponse {
  data: unknown;
  sourceUrl: string;
  retrievedAt: string;
}
export type ReadTransport = (request: ReadRequest) => Promise<ReadResponse>;
const query =
  "query { gpuTypes { id displayName memoryInGb lowestPrice(input: { gpuCount: 1, secureCloud: true }) { stockStatus uninterruptablePrice availableGpuCounts } } }";
/** Only these fixed read operations exist. Redirects, arbitrary hosts, mutations and retries are absent. */
export const readOfficial: ReadTransport = async (input) => {
  if (!Object.hasOwn(urls, input.operation)) throw Error("UNSUPPORTED_READ");
  const url = new URL(urls[input.operation]);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "identity",
    "User-Agent": "GPU-OS-Prefunded-ReadOnly/1.0",
  };
  if (
    input.credential &&
    (input.credential.length > 4096 || /[\r\n]/.test(input.credential))
  )
    throw Error("INVALID_CREDENTIAL");
  if (input.operation === "vastOffers") {
    if (!input.credential) throw Error("READ_CREDENTIAL_REQUIRED");
    headers.Authorization = "Bearer " + input.credential;
    url.searchParams.set(
      "q",
      JSON.stringify({
        rentable: { eq: true },
        rented: { eq: false },
        verified: { eq: true },
        limit: 50,
      }),
    );
  }
  if (input.operation === "runpodCatalog" && input.credential)
    headers.Authorization = "Bearer " + input.credential;
  if (input.operation === "enterpriseRfqs") {
    if (!input.credential) throw Error("READ_CREDENTIAL_REQUIRED");
    if (
      !/^\d{2}\/\d{2}\/\d{4}$/.test(input.postedFrom || "") ||
      !/^\d{2}\/\d{2}\/\d{4}$/.test(input.postedTo || "")
    )
      throw Error("DATE_RANGE_REQUIRED");
    url.searchParams.set("api_key", input.credential);
    url.searchParams.set("postedFrom", input.postedFrom!);
    url.searchParams.set("postedTo", input.postedTo!);
    url.searchParams.set("title", "GPU");
    url.searchParams.set("limit", "50");
  }
  const deadline = AbortSignal.timeout(9000);
  // Resolve once, reject mixed/private DNS, pin public address while validating TLS against the original host.
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true, family: 4 }),
    new Promise<never>((_, reject) =>
      deadline.addEventListener("abort", () => reject(Error("READ_TIMEOUT")), {
        once: true,
      }),
    ),
  ]);
  if (!addresses.length || addresses.some((a) => !isPublicIPv4(a.address)))
    throw Error("UNSAFE_SOURCE_DNS");
  const body =
    input.operation === "runpodCatalog" ? JSON.stringify({ query }) : undefined;
  if (body) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(body));
  }
  const data = await new Promise<unknown>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: body ? "POST" : "GET",
        headers,
        agent: false,
        signal: deadline,
        rejectUnauthorized: true,
        servername: url.hostname,
        lookup: (_host, options, callback) => {
          if (typeof options === "object" && options.all)
            callback(null, [{ address: addresses[0].address, family: 4 }]);
          else callback(null, addresses[0].address, 4);
        },
      },
      (response) => {
        if (
          !response.statusCode ||
          response.statusCode < 200 ||
          response.statusCode >= 300 ||
          (response.headers["content-encoding"] &&
            response.headers["content-encoding"] !== "identity")
        ) {
          response.destroy();
          reject(Error("SOURCE_HTTP_" + (response.statusCode || "UNKNOWN")));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1024 * 1024) {
            response.destroy();
            reject(Error("SOURCE_TOO_LARGE"));
          } else chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(Error("SOURCE_SCHEMA_INVALID"));
          }
        });
        response.on("error", () => reject(Error("SOURCE_READ_FAILED")));
      },
    );
    request.on("error", () => reject(Error("SOURCE_READ_FAILED")));
    request.end(body);
  });
  return {
    data,
    sourceUrl: urls[input.operation].split("?")[0],
    retrievedAt: new Date().toISOString(),
  };
};
