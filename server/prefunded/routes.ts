import { configuredHunterPolicy } from "./configuration.js";
import { EvidenceAuthority } from "../phase20/evidence.js";
import express, { type Express, type RequestHandler } from "express";
import path from "node:path";
import { rateLimit } from "../rateLimit.js";
import { PrefundedHunter } from "./service.js";
import { EvidenceJournal } from "./journal.js";
import {
  AkashDiscoveryAdapter,
  EnterpriseRfqAdapter,
  VastWholesaleAdapter,
  RunpodWholesaleAdapter,
  type DiscoveryBatch,
} from "./adapters.js";
export function registerPrefundedHunter(
  app: Express,
  owner: RequestHandler,
  hunter = new PrefundedHunter(
    new EvidenceJournal(path.join(process.cwd(), "data", "prefunded-evidence")),
    new EvidenceAuthority(),
    configuredHunterPolicy(process.env),
  ),
  collect?: (adapter: string) => Promise<DiscoveryBatch>,
) {
  const prefix = "/api/owner/prefunded-hunter";
  const router = express.Router();
  router.use(owner, rateLimit(30, 60000), (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  // Cookie requests are same-origin; bearer/header clients need no Origin header.
  router.use((req, res, next) => {
    const origin = req.get("Origin");
    if (req.method !== "GET" && origin) {
      try {
        if (new URL(origin).host !== req.get("host")) throw Error();
      } catch {
        res.status(403).json({ error: "ORIGIN_REJECTED" });
        return;
      }
    }
    next();
  });
  router.use(express.json({ limit: "64kb" }));
  const safe =
    (work: (req: express.Request) => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      try {
        res.json(await work(req));
      } catch {
        res.status(409).json({
          error: "HUNTER_REQUEST_REJECTED",
          financialExecutionAllowed: false,
          reloadRequired: true,
        });
      }
    };
  router.get(
    "/",
    safe(() => hunter.snapshot()),
  );
  router.post(
    "/discover",
    safe(async (req) => {
      if (
        !req.body ||
        Object.keys(req.body).join(",") !== "adapter" ||
        !["akash", "enterprise", "vast", "runpod"].includes(req.body.adapter)
      )
        throw Error("INVALID_ADAPTER");
      const state = await hunter.snapshot();
      if (state.killSwitchEngaged) throw Error("DISCOVERY_STOPPED");
      const adapter = req.body.adapter;
      let batch: DiscoveryBatch;
      if (collect) batch = await collect(adapter);
      else if (adapter === "akash")
        batch = await new AkashDiscoveryAdapter().discover();
      else if (adapter === "vast")
        batch = await new VastWholesaleAdapter().discover(
          process.env.VAST_API_KEY || "",
        );
      else if (adapter === "runpod")
        batch = await new RunpodWholesaleAdapter().discover(
          process.env.RUNPOD_API_KEY,
        );
      else {
        const format = (date: Date) =>
          `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
        batch = await new EnterpriseRfqAdapter().discover(
          process.env.SAM_GOV_API_KEY || "",
          format(new Date(Date.now() - 7 * 86400000)),
          format(new Date()),
        );
      }
      return hunter.recordDiscovery(batch);
    }),
  );
  router.post(
    "/proposals",
    safe((req) => hunter.propose(req.body)),
  );
  router.post(
    "/review",
    safe((req) => {
      if (
        !req.body ||
        Object.keys(req.body).sort().join(",") !== "decision,digest"
      )
        throw Error("INVALID_REVIEW");
      return hunter.review(req.body.digest, req.body.decision);
    }),
  );
  router.post(
    "/stop",
    safe((req) => {
      if (req.body && Object.keys(req.body).length) throw Error("INVALID_STOP");
      return hunter.stop();
    }),
  );
  router.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(400).json({
        error: "INVALID_HUNTER_REQUEST",
        financialExecutionAllowed: false,
      });
    },
  );
  app.use(prefix, router);
}
