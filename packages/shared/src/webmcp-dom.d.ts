export {};

// React's built-in HTML attribute types don't know about these declarative-
// WebMCP form attributes (plan §21.3) — augmenting them here means every
// consumer gets clean JSX typing with no per-usage casts.
declare module "react" {
  interface FormHTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
  }
  interface InputHTMLAttributes<T> {
    toolparamdescription?: string;
  }
  interface TextareaHTMLAttributes<T> {
    toolparamdescription?: string;
  }
  interface SelectHTMLAttributes<T> {
    toolparamdescription?: string;
  }
}

declare global {
  interface ModelContextTool {
    name: string;
    title?: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    annotations?: {
      readOnlyHint?: boolean;
      untrustedContentHint?: boolean;
    };
    execute: (
      input: Record<string, unknown>,
      context: { signal: AbortSignal }
    ) => Promise<unknown> | unknown;
  }

  interface ModelContextRegisterOptions {
    signal?: AbortSignal;
    exposedTo?: string[];
  }

  interface ModelContextGetToolsOptions {
    fromOrigins?: string[];
  }

  interface ModelContext extends EventTarget {
    registerTool(tool: ModelContextTool, options?: ModelContextRegisterOptions): Promise<void>;
    getTools(options?: ModelContextGetToolsOptions): Promise<ModelContextTool[]>;
    executeTool(
      tool: ModelContextTool,
      input: string,
      options?: { signal?: AbortSignal }
    ): Promise<unknown>;
  }

  interface Document {
    modelContext?: ModelContext;
  }

  /** Declarative WebMCP (plan §21.3) — form-based tools, a second surface distinct from registerTool. */
  interface SubmitEvent {
    /** True when this submit was triggered by an agent filling and "pressing" submit, not a plain human click. */
    agentInvoked?: boolean;
    /** Lets the form's submit handler return the tool's result back to the agent. */
    respondWith?(result: Promise<unknown>): void;
  }

  interface HTMLElementEventMap {
    /** Fires on a declarative-tool form when an agent begins filling it — plan §21.3. */
    toolactivated: Event;
    /** Fires when an agent-initiated fill is abandoned before a human submits. */
    toolcancel: Event;
  }
}
