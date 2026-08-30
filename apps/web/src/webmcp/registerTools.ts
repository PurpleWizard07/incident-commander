import { SERVICE_IDS } from "@incident-commander/shared";

export type ToolCallLogEntry = {
  id: string;
  at: string;
  tool: string;
  args: unknown;
  result: unknown;
  error?: string;
};

type Listener = (entry: ToolCallLogEntry) => void;

const listeners = new Set<Listener>();

export function onToolCall(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(entry: ToolCallLogEntry) {
  for (const l of listeners) l(entry);
}

/**
 * Phase 0: a single hardcoded investigation tool, registered imperatively via
 * document.modelContext.registerTool(). Real tool set arrives in Phase 3.
 */
export function registerPhase0Tools(): () => void {
  if (typeof document === "undefined" || !document.modelContext) {
    console.warn(
      "[webmcp] document.modelContext is not available in this browser. " +
        "Enable chrome://flags/#enable-webmcp-testing, or open this page in ChatGPT's in-app browser."
    );
    return () => {};
  }

  const controller = new AbortController();

  document.modelContext.registerTool(
    {
      name: "get_service_health",
      description:
        "Inspect the current health of a production service. Reports status, error rate, " +
        "and p95 latency compared to its pre-incident baseline. Use this to establish " +
        "whether a service is genuinely abnormal.",
      inputSchema: {
        type: "object",
        properties: {
          service: {
            type: "string",
            enum: SERVICE_IDS as unknown as string[],
            description: "Which service to check.",
          },
        },
        required: ["service"],
      },
      annotations: {
        readOnlyHint: true,
      },
      execute: async (input: Record<string, unknown>) => {
        const service = String(input.service ?? "");
        const id = crypto.randomUUID();
        const at = new Date().toISOString();

        try {
          const res = await fetch(`/api/service-health?service=${encodeURIComponent(service)}`);
          const data = await res.json();
          emit({ id, at, tool: "get_service_health", args: input, result: data });
          return {
            content: [{ type: "text", text: JSON.stringify(data) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          emit({ id, at, tool: "get_service_health", args: input, result: null, error: message });
          throw err;
        }
      },
    },
    { signal: controller.signal }
  );

  return () => controller.abort();
}
