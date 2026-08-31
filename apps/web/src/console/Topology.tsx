import { SERVICES, SERVICE_IDS } from "@incident-commander/shared";
import type { ServiceId } from "@incident-commander/shared";
import type { ServiceHealthSummary } from "./api.js";
import { statusColor } from "./statusColors.js";
import { useGlowingCall } from "./toolActivity.js";

const POS: Record<ServiceId, { x: number; y: number }> = {
  frontend: { x: 110, y: 50 },
  checkout: { x: 330, y: 50 },
  payments: { x: 550, y: 50 },
  auth: { x: 220, y: 162 },
  notifications: { x: 440, y: 162 },
  database: { x: 220, y: 274 },
  queue: { x: 440, y: 274 },
};

const NODE_R = 30;

export function Topology({
  health,
  transitioningServices = [],
}: {
  health: Partial<Record<ServiceId, ServiceHealthSummary>>;
  /** Plan §9: "Any action tool → ... affected topology node enters a transition state." Populated with the incident's affected services while it's RECOVERING. */
  transitioningServices?: ServiceId[];
}) {
  const edges = SERVICE_IDS.flatMap((id) => SERVICES[id].dependsOn.map((dep) => ({ from: id, to: dep })));

  const healthGlow = useGlowingCall(["get_service_health"]);
  const healthService = healthGlow?.record.args.service as ServiceId | undefined;

  const depsGlow = useGlowingCall(["get_service_dependencies"]);
  const depsService = depsGlow?.record.args.service as ServiceId | undefined;
  const depsDirection = (depsGlow?.record.args.direction as string | undefined) ?? "both";

  return (
    <svg viewBox="0 0 640 340" width="100%" height="100%" role="img" aria-label="Service dependency topology">
      <defs>
        <radialGradient id="node-fill" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#232a3c" />
          <stop offset="100%" stopColor="#171b26" />
        </radialGradient>
      </defs>
      {edges.map(({ from, to }) => {
        const a = POS[from];
        const b = POS[to];
        const highlighted =
          depsService !== undefined &&
          ((depsDirection !== "upstream" && from === depsService) || (depsDirection !== "downstream" && to === depsService));
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={highlighted ? "var(--color-ic-accent)" : "var(--color-ic-border-strong)"}
            strokeWidth={highlighted ? 2.5 : 1.5}
            strokeDasharray={highlighted ? "5 5" : undefined}
            className={highlighted ? "animate-dash-flow" : ""}
            style={{ transition: "stroke 250ms ease-out" }}
          />
        );
      })}
      {SERVICE_IDS.map((id) => {
        const p = POS[id];
        const h = health[id];
        const pulsing = id === healthService;
        const transitioning = transitioningServices.includes(id);
        const color = statusColor(h?.status);
        return (
          <g key={id}>
            {pulsing && (
              <circle
                cx={p.x}
                cy={p.y}
                r={NODE_R}
                fill="none"
                stroke="var(--color-ic-accent)"
                strokeWidth={2}
                className={healthGlow?.pending ? "animate-radar" : ""}
                opacity={healthGlow?.pending ? 1 : 0.9}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            )}
            {transitioning && (
              <circle cx={p.x} cy={p.y} r={NODE_R + 6} fill="none" stroke="var(--color-ic-degraded)" strokeWidth={2} strokeDasharray="4 3" className="animate-spin" style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={NODE_R}
              fill="url(#node-fill)"
              stroke={pulsing ? "var(--color-ic-accent)" : color}
              strokeWidth={pulsing ? 3.5 : 2.5}
              style={{ filter: pulsing ? "drop-shadow(0 0 8px rgb(34 211 238 / 0.55))" : undefined, transition: "stroke 250ms ease-out" }}
            />
            <text
              x={p.x}
              y={p.y - 5}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={12}
              fontWeight={600}
              fill={h ? color : "var(--color-ic-text-faint)"}
            >
              {h ? `${(h.errorRate * 100).toFixed(1)}%` : "—"}
            </text>
            <text x={p.x} y={p.y + 10} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-ic-text-faint)">
              {statusLabelShort(h?.status)}
            </text>
            <text
              x={p.x}
              y={p.y + NODE_R + 18}
              textAnchor="middle"
              fontFamily="var(--font-sans)"
              fontSize={12}
              fontWeight={500}
              fill="var(--color-ic-text)"
            >
              {SERVICES[id].displayName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function statusLabelShort(status: ServiceHealthSummary["status"] | undefined): string {
  if (!status) return "no data";
  return status;
}
