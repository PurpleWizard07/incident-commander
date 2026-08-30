import { createHash } from "node:crypto";

/**
 * Canonical hash of {tool, args} — what an Approval actually authorizes. The
 * decide/execute path recomputes this at execution time and compares it to
 * the hash captured when the approval was requested, so approving a rollback
 * of checkout-v3 does not authorize a rollback of anything else (plan §10.1).
 * A flat key sort is sufficient: every action tool's args are flat primitives
 * (service, deploymentId, instances, poolSize, flagName), never nested.
 */
export function actionHash(tool: string, args: Record<string, unknown>): string {
  const canonical = JSON.stringify(args, Object.keys(args).sort());
  return createHash("sha256").update(`${tool}:${canonical}`).digest("hex");
}
