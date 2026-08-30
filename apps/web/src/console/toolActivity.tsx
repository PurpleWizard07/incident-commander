import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onToolActivity, type ToolCallRecord } from "../webmcp/registerTools.js";

/**
 * How long a settled call keeps drawing attention (plan §9: "feedback begins
 * when the call starts and settles when it returns" — this is the "settles"
 * part's visible hold, not an invented precision number, just long enough to
 * read). Individual callers may ask for a longer hold (the evidence
 * spotlight does, since a runbook takes longer to read than a topology
 * pulse) — `MAX_HOLD_MS` is the ceiling the shared clock keeps ticking for,
 * so no caller's window can outlive the clock that drives it.
 */
const DEFAULT_GLOW_MS = 2500;
const MAX_HOLD_MS = 8000;

const RecordsContext = createContext<ToolCallRecord[]>([]);
const NowContext = createContext<number>(0);

/**
 * The "UI event bus fed by the tool dispatch layer" from Phase 5's build
 * list. Ticks a shared clock only while something is pending or still
 * glowing, so idle periods (most of a real session) cost nothing.
 */
export function ToolActivityProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<ToolCallRecord[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => onToolActivity(setRecords), []);

  useEffect(() => {
    const active = records.some((r) => r.settledAt === null || Date.now() - r.settledAt < MAX_HOLD_MS);
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [records]);

  return (
    <RecordsContext.Provider value={records}>
      <NowContext.Provider value={now}>{children}</NowContext.Provider>
    </RecordsContext.Provider>
  );
}

/** Full call history, newest first — what the agent activity rail renders. */
export function useToolRecords(): ToolCallRecord[] {
  return useContext(RecordsContext);
}

export interface GlowingCall {
  record: ToolCallRecord;
  pending: boolean;
}

/**
 * The most recent call among `toolNames`, if it is still pending or settled
 * within the glow window — otherwise null. Every reactive effect (topology
 * pulse, chart emphasis, evidence-tab highlight, panel border) reads this;
 * it never gates whether evidence is VISIBLE (Phase 4 already shows evidence
 * ambiently, independent of the agent), only whether it is drawing attention
 * right now.
 */
export function useGlowingCall(toolNames: string[], holdMs: number = DEFAULT_GLOW_MS): GlowingCall | null {
  const records = useContext(RecordsContext);
  const now = useContext(NowContext);
  const key = toolNames.join(",");
  return useMemo(() => {
    const names = key.split(",");
    const match = records.find((r) => names.includes(r.tool));
    if (!match) return null;
    const pending = match.settledAt === null;
    if (!pending && now - (match.settledAt as number) > holdMs) return null;
    return { record: match, pending };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, now, key, holdMs]);
}
