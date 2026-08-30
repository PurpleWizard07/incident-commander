import type { Config } from "@netlify/functions";

type ServiceId =
  | "frontend"
  | "checkout"
  | "payments"
  | "auth"
  | "database"
  | "queue"
  | "notifications";

const SERVICE_IDS: ServiceId[] = [
  "frontend",
  "checkout",
  "payments",
  "auth",
  "database",
  "queue",
  "notifications",
];

// Phase 0 stub: hardcoded, matches the INC-4821 hero incident snapshot from
// implementation-plan.md §5.1. Replaced by the real simulation engine in Phase 1/2.
const HARDCODED_HEALTH: Record<ServiceId, { status: string; errorRate: number; latencyP95Ms: number; baseline: { errorRate: number; latencyP95Ms: number } }> = {
  frontend:      { status: "degraded", errorRate: 0.22, latencyP95Ms: 410, baseline: { errorRate: 0.004, latencyP95Ms: 220 } },
  checkout:      { status: "degraded", errorRate: 0.64, latencyP95Ms: 260, baseline: { errorRate: 0.005, latencyP95Ms: 240 } },
  payments:      { status: "degraded", errorRate: 0.83, latencyP95Ms: 300, baseline: { errorRate: 0.006, latencyP95Ms: 280 } },
  auth:          { status: "healthy",  errorRate: 0.002, latencyP95Ms: 90,  baseline: { errorRate: 0.002, latencyP95Ms: 90 } },
  database:      { status: "healthy",  errorRate: 0.001, latencyP95Ms: 12,  baseline: { errorRate: 0.001, latencyP95Ms: 12 } },
  queue:         { status: "healthy",  errorRate: 0.0,   latencyP95Ms: 8,   baseline: { errorRate: 0.0,   latencyP95Ms: 8 } },
  notifications: { status: "healthy",  errorRate: 0.0,   latencyP95Ms: 45,  baseline: { errorRate: 0.0,   latencyP95Ms: 45 } },
};

export default async (req: Request) => {
  const url = new URL(req.url);
  const service = url.searchParams.get("service");

  if (!service || !SERVICE_IDS.includes(service as ServiceId)) {
    return new Response(
      JSON.stringify({
        error: `Unknown service "${service}". Valid services: ${SERVICE_IDS.join(", ")}.`,
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const health = HARDCODED_HEALTH[service as ServiceId];
  return new Response(
    JSON.stringify({ service, ...health }),
    { headers: { "content-type": "application/json" } }
  );
};

export const config: Config = {
  path: "/api/service-health",
};
