import { SERVICE_IDS, SERVICES } from "../sharedTypes.js";
import type { ServiceId } from "../sharedTypes.js";
import { materializeWorld, getScenario } from "../simEngine.js";
import type { SessionState } from "../store/session.js";

function isServiceId(value: string): value is ServiceId {
  return (SERVICE_IDS as string[]).includes(value);
}

export function getServiceHealth(session: SessionState, serviceId: string) {
  if (!isServiceId(serviceId)) {
    return { status: 400, body: { error: `Unknown service "${serviceId}". Valid: ${SERVICE_IDS.join(", ")}.` } };
  }
  const world = materializeWorld(getScenario(session.scenarioId), session.seed, session.nowMinute);
  const errSeries = world.metrics.find((m) => m.service === serviceId && m.metric === "error_rate");
  const latSeries = world.metrics.find((m) => m.service === serviceId && m.metric === "latency_p95");
  const live = world.services[serviceId];

  return {
    status: 200,
    body: {
      service: serviceId,
      status: live.status,
      errorRate: live.errorRate,
      latencyP95Ms: latSeries?.points[latSeries.points.length - 1]?.value ?? null,
      baseline: {
        errorRate: errSeries?.baseline ?? 0,
        latencyP95Ms: latSeries?.baseline ?? null,
      },
      instances: SERVICES[serviceId].instances,
    },
  };
}

export function getServiceDependencies(_session: SessionState, serviceId: string, direction: string | null) {
  if (!isServiceId(serviceId)) {
    return { status: 400, body: { error: `Unknown service "${serviceId}". Valid: ${SERVICE_IDS.join(", ")}.` } };
  }
  const dir = direction ?? "both";
  const downstream = SERVICES[serviceId].dependsOn;
  const upstream = SERVICE_IDS.filter((id) => SERVICES[id].dependsOn.includes(serviceId));

  return {
    status: 200,
    body: {
      service: serviceId,
      downstream: dir === "upstream" ? undefined : downstream,
      upstream: dir === "downstream" ? undefined : upstream,
      externalDependencies: SERVICES[serviceId].externalDependencies,
    },
  };
}
