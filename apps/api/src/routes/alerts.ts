import { getScenario } from "../simEngine.js";
import type { SessionState } from "../store/session.js";

export function inspectAlert(session: SessionState, alertId: string) {
  const scenario = getScenario(session.scenarioId);
  const alert = scenario.alerts.find((a) => a.id === alertId && a.firedAtMinute <= session.nowMinute);
  if (!alert) return { status: 404, body: { error: `No alert "${alertId}" found.` } };
  return { status: 200, body: { alert } };
}
