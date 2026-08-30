import { SERVICES, SERVICE_IDS } from "@incident-commander/shared";
import type { ServiceId } from "@incident-commander/shared";
import type { ServiceHealthSummary } from "./api.js";
import { statusColor } from "./statusColors.js";
import { useGlowingCall } from "./toolActivity.js";

const POS: Record<ServiceId, { x: number; y: number }> = {
  frontend: { x: 110, y: 34 },
  checkout: { x: 330, y: 34 },
  payments: { x: 550, y: 34 },
  auth: { x: 220, y: 150 },
  notifications: { x: 440, y: 150 },
  database: { x: 220, y: 260 },
  queue: { x: 440, y: 260 },
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
    <svg viewBox="0 0 640 300" width="100%" height="100%" role="img" aria-label="Service dependency topology">
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
            stroke={highlighted ? "var(--color-ic-accent)" : "var(--color-ic-border)"}
            strokeWidth={highlighted ? 3 : 2}
          />
        );
      })}
      {SERVICE_IDS.map((id) => {
        const p = POS[id];
        const h = health[id];
        const pulsing = id === healthService;
        const transitioning = transitioningServices.includes(id);
        return (
          <g key={id}>
            {pulsing && (
              <circle cx={p.x} cy={p.y} r={NODE_R + 6} fill="none" stroke="var(--color-ic-accent)" strokeWidth={2} className={healthGlow?.pending ? "animate-ping" : ""} opacity={healthGlow?.pending ? 0.6 : 0.9} />
            )}
            {transitioning && (
              <circle cx={p.x} cy={p.y} r={NODE_R + 6} fill="none" stroke="var(--color-ic-degraded)" strokeWidth={2} strokeDasharray="4 3" className="animate-spin" style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
            )}
            <circle cx={p.x} cy={p.y} r={NODE_R} fill="var(--color-ic-panel-2)" stroke={pulsing ? "var(--color-ic-accent)" : statusColor(h?.status)} strokeWidth={pulsing ? 4 : 3} />
            <circle cx={p.x} cy={p.y} r={4} fill={statusColor(h?.status)} />
            <text
              x={p.x}
              y={p.y + NODE_R + 16}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={12}
              fill="var(--color-ic-text)"
            >
              {SERVICES[id].displayName}
            </text>
            {h && (
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={10}
                fill="var(--color-ic-text-dim)"
              >
                {(h.errorRate * 100).toFixed(1)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
