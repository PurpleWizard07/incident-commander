import { SERVICES, SERVICE_IDS } from "@incident-commander/shared";
import type { ServiceId } from "@incident-commander/shared";
import type { ServiceHealthSummary } from "./api.js";
import { statusColor } from "./statusColors.js";

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

export function Topology({ health }: { health: Partial<Record<ServiceId, ServiceHealthSummary>> }) {
  const edges = SERVICE_IDS.flatMap((id) => SERVICES[id].dependsOn.map((dep) => ({ from: id, to: dep })));

  return (
    <svg viewBox="0 0 640 300" width="100%" height="100%" role="img" aria-label="Service dependency topology">
      {edges.map(({ from, to }) => {
        const a = POS[from];
        const b = POS[to];
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--color-ic-border)"
            strokeWidth={2}
          />
        );
      })}
      {SERVICE_IDS.map((id) => {
        const p = POS[id];
        const h = health[id];
        return (
          <g key={id}>
            <circle cx={p.x} cy={p.y} r={NODE_R} fill="var(--color-ic-panel-2)" stroke={statusColor(h?.status)} strokeWidth={3} />
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
