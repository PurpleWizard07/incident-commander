import { getScenario } from "../simEngine.js";
import type { SessionState } from "../store/session.js";

export function inspectAlert(session: SessionState, alertId: string) {
  const scenario = getScenario(session.scenarioId);
  const alert = scenario.alerts.find((a) => a.id === alertId && a.firedAtMinute <= session.nowMinute);
  if (!alert) return { status: 404, body: { error: `No alert "${alertId}" found.` } };
  return { status: 200, body: { alert } };
}

/**
 * Console-only (never a tool — same "browsing a section" reason
 * `/api/metrics/series` was added in Phase 4): the Alerts nav page needs to
 * list everything that's fired, not look up one alert it already knows the
 * id for. `inspect_alert` (the tool) deliberately stays lookup-only — an
 * agent is expected to already have an alert id from the incident, not
 * browse a list.
 */
export function getAllAlerts(session: SessionState) {
  const scenario = getScenario(session.scenarioId);
  const alerts = scenario.alerts.filter((a) => a.firedAtMinute <= session.nowMinute);
  return { status: 200, body: { alerts } };
}
