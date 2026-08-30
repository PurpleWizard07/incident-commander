const STORAGE_KEY = "incident-commander-session-id";

/** One stable session id per browser tab's localStorage — shared by the manual
 * UI and every WebMCP tool call, so the agent and the human are always looking
 * at the same server-side session (plan §0's shared-context argument depends
 * on this: same session, same evidence, same console). */
export function getOrCreateSessionId(): string {
  if (typeof localStorage === "undefined") return "server";
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return "no-storage";
  }
}
