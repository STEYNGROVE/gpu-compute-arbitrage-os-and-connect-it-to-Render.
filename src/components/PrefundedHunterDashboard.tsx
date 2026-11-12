import { createHunterSnapshotSession } from "../services/hunterSnapshotSession";
import React, { useState, useEffect, useRef } from "react";
import type { Candidate, Offer } from "../../server/prefunded/model";
import type { compareWholesale } from "../../server/prefunded/matching";
import type { qualify } from "../../server/prefunded/model";
type Assessment = ReturnType<typeof qualify>;
interface Snapshot {
  mode: string;
  financialExecutionAllowed: boolean;
  killSwitchEngaged: boolean;
  verifiedOpportunities: Assessment[];
  rejectedOpportunities: Assessment[];
  approvalQueue: Assessment[];
  indicativeComparisons: ReturnType<typeof compareWholesale>;
  candidates: (Candidate & { stale: boolean; rejectionReasons: string[] })[];
  wholesaleMatches: (Offer & { stale: boolean })[];
  reviews: { digest: string; decision: string }[];
  restrictedNetworks: { network: string; reason: string; sourceUrl: string }[];
  realizedRevenue: { amountMinor: null; status: string };
  audit: { sequence: number; kind: string; at: string; digest: string }[];
}
export function PrefundedHunterDashboard() {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [proposal, setProposal] = useState("");
  const [proposalError, setProposalError] = useState("");
  const proposalRevision = useRef(0);
  const session = useRef<ReturnType<
    typeof createHunterSnapshotSession<Snapshot>
  > | null>(null);
  useEffect(() => {
    const current = createHunterSnapshotSession<Snapshot>({
      onData: setData,
      onBusy: setBusy,
      onError: setError,
    });
    session.current = current;
    void current.run();
    return () => {
      current.close();
      if (session.current === current) session.current = null;
    };
  }, []);
  const run = (path = "", body?: unknown) =>
    session.current?.run(path, body) ?? Promise.resolve(false);
  const submitProposal = async () => {
    setProposalError("");
    let payload: unknown;
    try {
      payload = JSON.parse(proposal);
    } catch {
      setProposalError("Invalid JSON.");
      return;
    }
    const current = session.current;
    const submittedRevision = proposalRevision.current;
    const success = await current?.run("/proposals", payload);
    if (
      session.current === current &&
      proposalRevision.current === submittedRevision &&
      !success
    )
      setProposalError(
        "Plan rejected or unavailable. Review the evidence and sign-in status.",
      );
  };
  const money = (amount: number, currency: string) =>
    `${currency} ${(amount / 100).toFixed(2)}`;
  const assessment = (item: Assessment) => (
    <article
      key={item.digest}
      className="border border-slate-700 rounded p-3 my-3"
    >
      <p>
        {item.plan.opportunityId} · {item.status}
      </p>
      <p>
        Funding: {item.plan.funding} / {item.fundingConfidence} · Provider
        eligibility: {item.providerEligibility} · Risk score: {item.riskScore}
        /100
      </p>
      <p>
        Wholesale: {item.plan.provider} / {item.plan.offerId} · Estimated net:{" "}
        {money(item.estimatedNetMinor, item.plan.currency)} (
        {(item.marginBps / 100).toFixed(2)}%)
      </p>
      <p>
        Projected contract revenue:{" "}
        {money(item.projectedRevenueMinor, item.plan.currency)} · Costs:{" "}
        {money(item.totalCostMinor, item.plan.currency)}
      </p>
      <p>
        {item.plan.gpuCount} × {item.plan.gpuModel} / {item.plan.vramGb} GB /{" "}
        {item.plan.durationHours} hours / {item.plan.region} /{" "}
        {item.plan.bandwidthMbps} Mbps /{" "}
        {(item.plan.uptimeBps / 100).toFixed(2)}% uptime
      </p>
      <p>
        Reasons:{" "}
        {item.reasons.join(", ") ||
          "Evidence meets review policy. Estimate remains subject to delivery risk."}
      </p>
      <details>
        <summary>Evidence and cost calculation</summary>
        <pre className="whitespace-pre-wrap break-all">
          {JSON.stringify(
            { costs: item.plan, evidence: item.assessments },
            null,
            2,
          )}
        </pre>
      </details>
    </article>
  );
  return (
    <section className="space-y-4 pb-8">
      <h1 className="text-2xl">Pre-Funded GPU Job Hunter</h1>
      <p>
        Discover demand, verify evidence, then review estimated profit.
        Financial execution stays disabled after owner review.
      </p>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => run()}>
          Refresh evidence
        </button>
        {["akash", "enterprise", "vast", "runpod"].map((adapter) => (
          <button
            key={adapter}
            disabled={busy || data?.killSwitchEngaged}
            onClick={() => run("/discover", { adapter })}
          >
            Discover {adapter}
          </button>
        ))}
        <button disabled={busy} onClick={() => run("/stop", {})}>
          Stop discovery
        </button>
      </div>
      <p role="status">{busy ? "Working…" : error}</p>
      {data && (
        <>
          <p>
            Discovery stop: {data.killSwitchEngaged ? "ENGAGED" : "AVAILABLE"} ·
            Spending: DISABLED
          </p>
          <p>
            Realized revenue: unavailable — payment and settlement ledger is not
            connected. Projected revenue appears only with individual plans.
          </p>
          <p>
            Evidence archive: local hash chain. External immutable archive and
            independent collectors require separate configuration and review.
          </p>
          <h2 className="text-xl">
            Verified opportunities ({data.verifiedOpportunities.length})
          </h2>
          {data.verifiedOpportunities.map(assessment)}
          <h2 className="text-xl">Discovered demand — funding unverified</h2>
          {data.candidates.map((item) => (
            <p key={item.id}>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                {item.title}
              </a>{" "}
              · {item.id} · {item.funding} · {item.stale ? "STALE" : "fresh"} ·
              retrieved {item.retrievedAt} · expires {item.expiresAt} · evidence{" "}
              {item.evidenceDigest} · {item.rejectionReasons.join(", ")}
            </p>
          ))}
          <h2 className="text-xl">Wholesale availability</h2>
          {data.wholesaleMatches.map((item) => (
            <p key={item.id}>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                {item.provider}
              </a>{" "}
              · {item.id} · {item.gpuCount} × {item.model} · USD{" "}
              {item.hourlyUsd}/hour · {item.availability} ·{" "}
              {item.stale ? "STALE" : "fresh"} · expires {item.expiresAt}
            </p>
          ))}
          <h2 className="text-xl">Indicative wholesale comparisons</h2>
          {data.indicativeComparisons.map((item) => (
            <p key={item.opportunityId + item.offerId}>
              {item.opportunityId} → {item.provider} / {item.offerId} ·
              Estimated net:{" "}
              {item.estimatedNetMinor === null
                ? "Verified price / FX evidence required"
                : money(item.estimatedNetMinor, item.currency)}{" "}
              · {item.reasons.join(", ")}
            </p>
          ))}
          <h2 className="text-xl">Owner approval queue</h2>
          {data.approvalQueue.map((item) => (
            <div key={item.digest}>
              {assessment(item)}
              <button
                disabled={busy}
                onClick={() =>
                  run("/review", {
                    digest: item.digest,
                    decision: "APPROVE_REVIEW",
                  })
                }
              >
                Record owner review approval
              </button>{" "}
              <button
                disabled={busy}
                onClick={() =>
                  run("/review", { digest: item.digest, decision: "REJECT" })
                }
              >
                Reject plan
              </button>
            </div>
          ))}
          <p>
            Approval records a review decision only. Every future financial
            action requires separate explicit owner authorization.
          </p>
          <h2 className="text-xl">Rejected opportunities</h2>
          {data.rejectedOpportunities.map(assessment)}
          <details>
            <summary>Submit an evidence-backed plan for assessment</summary>
            <p>
              Use the documented plan and signed receipt schema. Manual
              statements cannot verify funding.
            </p>
            <label>
              Plan and evidence JSON
              <textarea
                className="block w-full bg-slate-900 border p-2"
                rows={6}
                value={proposal}
                onChange={(event) => {
                  proposalRevision.current++;
                  setProposal(event.target.value);
                  setProposalError("");
                }}
              />
            </label>
            {proposalError && <p role="alert">{proposalError}</p>}
            <button disabled={busy} onClick={() => void submitProposal()}>
              Assess plan
            </button>
          </details>
          <h2 className="text-xl">Networks awaiting eligibility review</h2>
          {data.restrictedNetworks.map((item) => (
            <p key={item.network}>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                {item.network}
              </a>
              : {item.reason}
            </p>
          ))}
          <details>
            <summary>Owner reviews and audit trail</summary>
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(
                { reviews: data.reviews, audit: data.audit },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      )}
    </section>
  );
}
