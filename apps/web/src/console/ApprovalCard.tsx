import { useState } from "react";
import type { Approval } from "@incident-commander/shared";
import { issueApprovalNonce, decideApproval } from "./api.js";
import { useEvidenceJump } from "./evidenceJump.js";

function riskColor(risk: string): string {
  if (risk === "high") return "var(--color-ic-down)";
  if (risk === "medium") return "var(--color-ic-degraded)";
  return "var(--color-ic-healthy)";
}

/**
 * Plan §10.2. The Approve/Reject buttons never go through
 * `document.modelContext` — they call the console-only nonce endpoint and
 * the decide endpoint directly, as plain fetches from a trusted human
 * click. That is the entire security property behind `record_approval`
 * always denying an agent (plan §12.3): the nonce endpoint is never
 * registered as a tool, so this is the only path that can ever produce a
 * token.
 */
export function ApprovalCard({ approval }: { approval: Approval }) {
  const { requestJump } = useEvidenceJump();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision === "approved" ? "approve" : "reject");
    setError(null);
    try {
      const { approvalToken } = await issueApprovalNonce(approval.id);
      await decideApproval(approval.id, decision, approvalToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold tracking-wide text-ic-text">PROPOSED ACTION</span>
        <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ic-bg" style={{ background: riskColor(approval.risk) }}>
          risk: {approval.risk.toUpperCase()}
        </span>
      </div>

      <div className="font-mono text-ic-text">
        {approval.action.tool}({Object.entries(approval.action.args).map(([k, v]) => `${k}=${String(v)}`).join(", ")})
      </div>

      <div>
        <div className="text-ic-text-dim">Reason</div>
        <div className="text-ic-text">{approval.reason}</div>
      </div>

      {approval.evidenceRefs.length > 0 && (
        <div>
          <div className="text-ic-text-dim">Evidence</div>
          {approval.evidenceRefs.map((ref, i) => (
            <button
              key={i}
              data-testid={`evidence-link-${ref.kind}`}
              onClick={() => requestJump(ref)}
              className="block text-left text-ic-accent underline decoration-dotted"
            >
              → {ref.label}
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="text-ic-text-dim">Expected effect</div>
        <div className="text-ic-text">{approval.expectedEffect}</div>
      </div>

      <div>
        <div className="text-ic-text-dim">Not covered</div>
        <div className="text-ic-text">{approval.notCovered}</div>
      </div>

      {error && <div className="text-ic-down">{error}</div>}

      <div className="mt-1 flex gap-2">
        <button
          data-testid="approval-reject"
          onClick={() => decide("rejected")}
          disabled={busy !== null}
          className="flex-1 rounded bg-ic-panel-2 py-1 font-semibold text-ic-text disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
        <button
          data-testid="approval-approve"
          onClick={() => decide("approved")}
          disabled={busy !== null}
          className="flex-1 rounded bg-ic-accent py-1 font-semibold text-ic-bg disabled:opacity-50"
        >
          {busy === "approve" ? "…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
