import { SERVICE_IDS } from "@incident-commander/shared";

/**
 * The `enum` every tool's `service` parameter is constrained to.
 *
 * Sourced from `SERVICE_IDS` rather than restated, because it was previously
 * written out longhand in five separate tool modules plus the create-incident
 * form — six places to keep in step with `packages/shared`'s `ServiceId` union,
 * with nothing to catch a drift except noticing it.
 */
export const SERVICE_ENUM: string[] = SERVICE_IDS;

/**
 * `reason` is **required on every read-only tool**, not optional.
 *
 * It is the sentence the agent lane renders under each call, and it is what
 * turns that lane from a list of tool names into the investigation's narrative
 * — the thing this project claims WebMCP makes possible. A field the whole
 * shared-context argument rests on cannot be one the model may silently skip.
 *
 * It was optional until 2026-09-02, and the risk was not hypothetical: the eval
 * harness's hand-written schema mirror (`evals/prompt.mjs`) omitted `reason`
 * from every tool but `request_approval`, so across 290 logged tool calls in ten
 * real sessions the field was never once populated. That is not evidence models
 * skip it — they were never told it existed — it is evidence the path was
 * completely untested. Requiring it removes the question instead of answering it.
 *
 * Deliberately NOT required on the action tools: `create_incident` and
 * `add_incident_note` reach the agent as `<form toolname>` elements that a
 * *human* also fills in by hand, and requiring a rationale field there would
 * make the human's form worse to serve the agent's narrative.
 *
 * Nothing throws if it is absent anyway — `instrument()` reads it defensively —
 * so a model that ignores the schema degrades to the old behaviour rather than
 * failing the call.
 */
export const REASON_PROPERTY = {
  type: "string",
  description:
    "Required. One sentence: what you are trying to establish with this call. " +
    "Shown live to the human responder watching this console, so write it for them.",
} as const;

export function toolResult(text: string): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text }] };
}
