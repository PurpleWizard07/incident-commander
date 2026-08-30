export const REASON_PROPERTY = {
  type: "string",
  description: "One sentence: what you are trying to establish with this call. Shown to the human responder.",
} as const;

export function toolResult(text: string): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text }] };
}
