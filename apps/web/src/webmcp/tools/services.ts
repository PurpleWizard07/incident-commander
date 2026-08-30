import { apiGet } from "../apiClient.js";
import { capText, pct } from "../shape.js";
import { REASON_PROPERTY, toolResult } from "./shared.js";

const SERVICE_ENUM = ["frontend", "checkout", "payments", "auth", "database", "queue", "notifications"];

interface ServiceHealth {
  service: string;
  status: string;
  errorRate: number;
  latencyP95Ms: number | null;
  baseline: { errorRate: number; latencyP95Ms: number | null };
  instances: number;
}

interface ServiceDependencies {
  service: string;
  downstream?: string[];
  upstream?: string[];
  externalDependencies: string[];
}

export const getServiceHealth = {
  name: "get_service_health",
  description:
    "Reports current status, error rate, and p95 latency for one service, each compared against " +
    "its pre-incident baseline. Use to establish whether a service is genuinely abnormal. A high " +
    "error rate on a downstream service does NOT prove that service is the cause — check " +
    "get_service_dependencies to see what it depends on.",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string", enum: SERVICE_ENUM, description: "Which service to check." },
      reason: REASON_PROPERTY,
    },
    required: ["service"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input: Record<string, unknown>) => {
    const h = await apiGet<ServiceHealth>(`/api/services/${encodeURIComponent(String(input.service))}/health`);
    const lines = [
      `${h.service}: ${h.status.toUpperCase()}`,
      `error_rate ${pct(h.errorRate)} (baseline ${pct(h.baseline.errorRate)})`,
      h.latencyP95Ms !== null ? `latency_p95 ${h.latencyP95Ms.toFixed(0)}ms (baseline ${h.baseline.latencyP95Ms?.toFixed(0)}ms)` : "latency_p95 not tracked for this service",
      `${h.instances} instances`,
    ];
    return toolResult(capText(lines.join(". ")));
  },
};

export const getServiceDependencies = {
  name: "get_service_dependencies",
  description:
    "Returns which services a given service calls (downstream) and which call it (upstream), " +
    "including external third-party dependencies. Use this to separate an upstream root cause " +
    "from downstream damage when several services are degraded at once.",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string", enum: SERVICE_ENUM },
      direction: { type: "string", enum: ["upstream", "downstream", "both"], description: "Which direction to return. Default both." },
      reason: REASON_PROPERTY,
    },
    required: ["service"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input: Record<string, unknown>) => {
    const d = await apiGet<ServiceDependencies>(`/api/services/${encodeURIComponent(String(input.service))}/dependencies`, {
      direction: input.direction as string | undefined,
    });
    const lines = [`${d.service}:`];
    if (d.downstream) lines.push(`  calls (downstream): ${d.downstream.length ? d.downstream.join(", ") : "none"}`);
    if (d.upstream) lines.push(`  called by (upstream): ${d.upstream.length ? d.upstream.join(", ") : "none"}`);
    lines.push(`  external dependencies: ${d.externalDependencies.length ? d.externalDependencies.join(", ") : "none"}`);
    return toolResult(capText(lines.join("\n")));
  },
};
