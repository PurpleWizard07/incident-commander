export type ServiceId =
  | "frontend"
  | "checkout"
  | "payments"
  | "auth"
  | "database"
  | "queue"
  | "notifications";

export const SERVICE_IDS: ServiceId[] = [
  "frontend",
  "checkout",
  "payments",
  "auth",
  "database",
  "queue",
  "notifications",
];

export type ServiceStatus = "healthy" | "degraded" | "down";

export interface ServiceHealth {
  service: ServiceId;
  status: ServiceStatus;
  errorRate: number;
  latencyP95Ms: number;
  baseline: {
    errorRate: number;
    latencyP95Ms: number;
  };
}
