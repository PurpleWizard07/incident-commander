export {};

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
}
