import { SERVICE_IDS } from "../sharedTypes.js";
import type { ServiceId } from "../sharedTypes.js";
import { getScenario } from "../simEngine.js";
import type { SessionState } from "../store/session.js";

export function getRecentDeployments(session: SessionState, service: string | null, withinMinutes: string | null) {
  const scenario = getScenario(session.scenarioId);
  const window = withinMinutes ? Math.min(4320, Number(withinMinutes)) : 120;
  const cutoff = session.nowMinute - window;

  let deployments = scenario.deployments.filter((d) => d.deployedAtMinute <= session.nowMinute && d.deployedAtMinute >= cutoff);
  if (service) {
    if (!(SERVICE_IDS as string[]).includes(service)) {
      return { status: 400, body: { error: `Unknown service "${service}".` } };
    }
    deployments = deployments.filter((d) => d.service === (service as ServiceId));
  }

  if (deployments.length === 0) {
    return {
      status: 200,
      body: {
        deployments: [],
        note: `No deployments in this window. Non-deploy changes exist — call get_recent_changes.`,
      },
    };
  }
  return { status: 200, body: { deployments } };
}
