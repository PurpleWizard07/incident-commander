import { createContext, useContext, useState, type ReactNode } from "react";
import type { EvidenceRef } from "@incident-commander/shared";

/**
 * Approval-card evidence links (plan §10.2: "every evidence item is a live
 * link... clicking scrolls to it") aren't tool calls, so they don't go
 * through `toolActivity`'s event bus — this is a small, separate mechanism
 * for the same "the console reacts" idea, triggered by a human click
 * instead of an agent call.
 */
export interface EvidenceJump {
  ref: EvidenceRef;
  nonce: number;
}

interface EvidenceJumpContextValue {
  jump: EvidenceJump | null;
  requestJump: (ref: EvidenceRef) => void;
}

const EvidenceJumpContext = createContext<EvidenceJumpContextValue>({
  jump: null,
  requestJump: () => {},
});

export function EvidenceJumpProvider({ children }: { children: ReactNode }) {
  const [jump, setJump] = useState<EvidenceJump | null>(null);
  const requestJump = (ref: EvidenceRef) => setJump({ ref, nonce: Date.now() });
  return <EvidenceJumpContext.Provider value={{ jump, requestJump }}>{children}</EvidenceJumpContext.Provider>;
}

export function useEvidenceJump(): EvidenceJumpContextValue {
  return useContext(EvidenceJumpContext);
}
