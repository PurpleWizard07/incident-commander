import { Fragment, useState } from "react";
import type { Approval } from "@incident-commander/shared";
import { issueApprovalNonce, decideApproval } from "./api.js";
import { useEvidenceJump } from "./evidenceJump.js";
import { FloatCard } from "./Surface.js";
import { ArrowRightIcon } from "./icons.js";
import { actionButton, badge, type BadgeTone } from "./ui.js";

function riskTone(risk: string): BadgeTone {
  if (risk === "high") return "critical";
  if (risk === "medium") return "warning";
  return "healthy";
}

/** Each of the four disclosures gets the same shape: tracked-out label, then the text. */
function Clause({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="ic-overline mb-1">{label}</div>
      <div className="text-[11.5px] leading-[1.5] text-ic-text-dim">{children}</div>
    </div>
  );
}

/**
 * Plan §10.2. The Approve/Reject buttons never go through
 * `document.modelContext` — they call the console-only nonce endpoint and the
 * decide endpoint directly, as plain fetches from a trusted human click. That
 * is the entire security property behind `record_approval` always denying an
 * agent (plan §12.3): the nonce endpoint is never registered as a tool, so this
 * is the only path that can ever produce a token.
 *
 * The design carries that same argument. The card is the only elevated,
 * blurred, bordered surface in the interface — it has landed on top of the
 * console, and it is blocking. Its Approve button is bone, not the agent's
 * blue: the primary action here is a human's, and rendering it in the machine's
 * colour would say precisely the wrong thing about who holds authority. The
 * proposed call itself is shown in the agent's blue in a recessed well, framed
 * as a quotation of what the agent asked for, not as something already true.
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

  const args = Object.entries(approval.action.args);

  return (
    <FloatCard className="animate-fade-up overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ic-border/70 px-4 py-2.5">
        <h4 className="ic-overline text-ic-text-dim">Proposed action</h4>
        <span aria-hidden="true" className="h-px flex-1 bg-ic-border/60" />
        <span className={badge(riskTone(approval.risk))}>{approval.risk} risk</span>
      </div>

      <div className="flex flex-col gap-3.5 px-4 py-3.5">
        <div className="rounded-md border border-ic-border bg-ic-bg/60 px-3 py-2.5 shadow-[inset_0_1px_3px_0_rgb(0_0_0/0.4)]">
          <div className="font-mono text-[12px] font-medium text-ic-accent">{approval.action.tool}</div>
          {args.length > 0 && (
            <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-1 font-mono text-[10.5px]">
              {args.map(([k, v]) => (
                <Fragment key={k}>
                  <dt className="text-ic-text-faint">{k}</dt>
                  <dd className="truncate text-ic-text-dim" title={String(v)}>
                    {String(v)}
                  </dd>
                </Fragment>
              ))}
            </dl>
          )}
        </div>

        <Clause label="Reason">{approval.reason}</Clause>

        {approval.evidenceRefs.length > 0 && (
          <div>
            <div className="ic-overline mb-1.5">Evidence</div>
            <div className="flex flex-col items-start gap-1">
              {approval.evidenceRefs.map((ref, i) => (
                <button
                  key={i}
                  data-testid={`evidence-link-${ref.kind}`}
                  onClick={() => requestJump(ref)}
                  className="group flex max-w-full items-center gap-1.5 rounded-[4px] text-left font-mono text-[10.5px] text-ic-accent transition-colors duration-150 hover:text-ic-accent-2"
                >
                  <ArrowRightIcon
                    size={12}
                    className="shrink-0 opacity-50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                  <span className="truncate underline decoration-ic-accent/25 decoration-dotted underline-offset-[3px] group-hover:decoration-ic-accent-2/60">
                    {ref.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5 border-t border-ic-border/60 pt-3">
          <Clause label="Expected effect">{approval.expectedEffect}</Clause>
          <Clause label="Not covered">{approval.notCovered}</Clause>
        </div>

        {error && (
          <div className="rounded-md bg-ic-down/10 px-2.5 py-1.5 font-mono text-[10.5px] text-ic-down ring-1 ring-inset ring-ic-down/25">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            data-testid="approval-reject"
            onClick={() => decide("rejected")}
            disabled={busy !== null}
            className={actionButton("ghost", "flex-1")}
          >
            {busy === "reject" ? "…" : "Reject"}
          </button>
          <button
            data-testid="approval-approve"
            onClick={() => decide("approved")}
            disabled={busy !== null}
            className={actionButton("primary", "flex-[1.4]")}
          >
            {busy === "approve" ? "…" : "Approve"}
          </button>
        </div>
      </div>
    </FloatCard>
  );
}
