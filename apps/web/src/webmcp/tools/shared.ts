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

export const REASON_PROPERTY = {
  type: "string",
  description: "One sentence: what you are trying to establish with this call. Shown to the human responder.",
} as const;

export function toolResult(text: string): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text }] };
}
