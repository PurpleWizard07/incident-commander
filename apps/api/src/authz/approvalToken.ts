import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "approval-tokens";
const TTL_MS = 120_000;

interface PendingToken {
  approvalId: string;
  sessionId: string;
  issuedAtMs: number;
}

function store() {
  return getStore(STORE_NAME);
}

/**
 * Called ONLY by the console's own fetch when it renders an approval card —
 * this is never a registered WebMCP tool, which is the entire security
 * property (plan §12.3): an agent cannot obtain a token because it cannot
 * call this.
 *
 * Stored in Blobs, not an in-memory Map. An in-memory cache would reintroduce
 * exactly the bug the SQLite rework fixed (plan §2.1) — Netlify Functions are
 * ephemeral and horizontally scaled, so a token minted on one instance could
 * be invisible to the request that tries to consume it on another.
 */
export async function issueApprovalToken(approvalId: string, sessionId: string): Promise<string> {
  const token = randomBytes(16).toString("hex");
  const entry: PendingToken = { approvalId, sessionId, issuedAtMs: Date.now() };
  await store().setJSON(token, entry);
  return token;
}

/**
 * Single-use: the token is deleted whether or not it turns out to be valid,
 * so a captured/replayed token can never succeed twice.
 */
export async function consumeApprovalToken(
  token: string | undefined,
  approvalId: string,
  sessionId: string
): Promise<boolean> {
  if (!token) return false;

  const entry = (await store().get(token, { type: "json", consistency: "strong" })) as PendingToken | null;
  await store().delete(token);

  if (!entry) return false;
  if (entry.approvalId !== approvalId || entry.sessionId !== sessionId) return false;
  if (Date.now() - entry.issuedAtMs > TTL_MS) return false;
  return true;
}
