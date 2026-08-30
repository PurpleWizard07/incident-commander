import type { ServiceStatus } from "@incident-commander/shared";

export function statusColor(status: ServiceStatus | undefined): string {
  switch (status) {
    case "healthy":
      return "var(--color-ic-healthy)";
    case "degraded":
      return "var(--color-ic-degraded)";
    case "down":
      return "var(--color-ic-down)";
    default:
      return "var(--color-ic-text-dim)";
  }
}

export function statusLabel(status: ServiceStatus | undefined): string {
  return status ?? "unknown";
}
