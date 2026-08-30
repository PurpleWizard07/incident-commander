import type { Deployment, ServiceId } from "../sharedTypes.js";

/** The most recent deployment for a service that had already happened by `minute`. */
export function activeDeploymentAt(
  deployments: Deployment[],
  service: ServiceId,
  minute: number
): Deployment | null {
  let best: Deployment | null = null;
  for (const d of deployments) {
    if (d.service !== service) continue;
    if (d.deployedAtMinute > minute) continue;
    if (!best || d.deployedAtMinute > best.deployedAtMinute) best = d;
  }
  return best;
}
