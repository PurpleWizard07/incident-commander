import { useState } from "react";
import type { Approval } from "@incident-commander/shared";
import { issueApprovalNonce, decideApproval } from "./api.js";
import { useEvidenceJump } from "./evidenceJump.js";
import { actionButton, badge, type BadgeTone } from "./ui.js";

function riskTone(risk: string): BadgeTone {
  if (risk === "high") return "critical";
  if (risk === "medium") return "warning";
  return "healthy";
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
    <div className="flex flex-col gap-2.5 p-3.5 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-ic-text">PROPOSED ACTION</span>
        <span className={badge(riskTone(approval.risk))}>risk: {approval.risk}</span>
      </div>

      <div className="rounded-lg border border-ic-border bg-ic-panel-2 px-2.5 py-1.5 font-mono text-ic-accent-2">
        {approval.action.tool}
        <span className="text-ic-text-dim">({Object.entries(approval.action.args).map(([k, v]) => `${k}=${String(v)}`).join(", ")})</span>
      </div>

      <div>
        <div className="text-ic-text-faint">Reason</div>
        <div className="text-ic-text">{approval.reason}</div>
      </div>

      {approval.evidenceRefs.length > 0 && (
        <div>
          <div className="text-ic-text-faint">Evidence</div>
          <div className="mt-0.5 flex flex-col gap-0.5">
            {approval.evidenceRefs.map((ref, i) => (
              <button
                key={i}
                data-testid={`evidence-link-${ref.kind}`}
                onClick={() => requestJump(ref)}
                className="block w-fit text-left text-ic-accent decoration-ic-accent/40 decoration-dotted transition-colors duration-150 hover:text-ic-accent-2 hover:underline"
              >
                → {ref.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-ic-text-faint">Expected effect</div>
        <div className="text-ic-text">{approval.expectedEffect}</div>
      </div>

      <div>
        <div className="text-ic-text-faint">Not covered</div>
        <div className="text-ic-text">{approval.notCovered}</div>
      </div>

      {error && <div className="rounded-lg bg-ic-down/10 px-2 py-1 text-ic-down">{error}</div>}

      <div className="mt-1 flex gap-2">
        <button data-testid="approval-reject" onClick={() => decide("rejected")} disabled={busy !== null} className={actionButton("secondary", "flex-1")}>
          {busy === "reject" ? "…" : "Reject"}
        </button>
        <button data-testid="approval-approve" onClick={() => decide("approved")} disabled={busy !== null} className={actionButton("primary", "flex-1")}>
          {busy === "approve" ? "…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
