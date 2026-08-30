import { SERVICE_IDS } from "../sharedTypes.js";
import type { ServiceId, ChangeType } from "../sharedTypes.js";
import { getScenario } from "../simEngine.js";
import type { SessionState } from "../store/session.js";

export function getRecentChanges(
  session: SessionState,
  service: string | null,
  withinMinutes: string | null,
  type: string | null
) {
  const scenario = getScenario(session.scenarioId);
  const window = withinMinutes ? Math.min(4320, Number(withinMinutes)) : 120;
  const cutoff = session.nowMinute - window;

  let changes = scenario.changes.filter((c) => c.atMinute <= session.nowMinute && c.atMinute >= cutoff);
  if (service) {
    if (!(SERVICE_IDS as string[]).includes(service)) {
      return { status: 400, body: { error: `Unknown service "${service}".` } };
    }
    changes = changes.filter((c) => c.service === (service as ServiceId));
  }
  if (type) changes = changes.filter((c) => c.type === (type as ChangeType));

  return { status: 200, body: { changes } };
}
