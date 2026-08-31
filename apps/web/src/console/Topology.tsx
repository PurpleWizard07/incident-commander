import { SERVICES, SERVICE_IDS } from "@incident-commander/shared";
import type { ServiceId } from "@incident-commander/shared";
import type { ServiceHealthSummary } from "./api.js";
import { statusColor } from "./statusColors.js";
import { useGlowingCall } from "./toolActivity.js";

/**
 * Laid out by tier, top to bottom, so the graph's vertical axis means something:
 * edge-facing tier-1 services on top, shared tier-2 in the middle, stateful
 * tier-3 at the bottom. Dependencies therefore always point downward, and
 * "the failure is downstream of me" is a direction you can see rather than a
 * relationship you have to trace.
 */
const POS: Record<ServiceId, { x: number; y: number }> = {
  frontend: { x: 100, y: 52 },
  checkout: { x: 320, y: 52 },
  payments: { x: 540, y: 52 },
  auth: { x: 210, y: 152 },
  notifications: { x: 430, y: 152 },
  database: { x: 210, y: 250 },
  queue: { x: 430, y: 250 },
};

/** Radius encodes tier — a deliberate break from uniform shape language. */
const TIER_R: Record<1 | 2 | 3, number> = { 1: 30, 2: 26, 3: 23 };

/**
 * Gauge sweep is `sqrt(errorRate)`, not a linear fraction of some ceiling.
 *
 * A linear scale cannot serve this data: a 10% ceiling makes every service in a
 * bad incident (22%, 61%, 82% — INC-4821's real numbers) an identical full ring,
 * and a 100% ceiling makes a genuinely alarming 4% blip a sliver you cannot see.
 * A square root gives 4% → 20% of the ring, 22% → 47%, 61% → 78%, 82% → 91%:
 * small rates stay visible and large ones still rank against each other.
 */
function gaugeSweep(errorRate: number): number {
  return Math.sqrt(Math.max(0, Math.min(1, errorRate)));
}

function radius(id: ServiceId): number {
  return TIER_R[SERVICES[id].tier];
}

/** Endpoints pulled back to each node's edge, so an edge never runs under a dial. */
function trimmed(a: { x: number; y: number }, b: { x: number; y: number }, ra: number, rb: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: a.x + ux * (ra + 3),
    y1: a.y + uy * (ra + 3),
    x2: b.x - ux * (rb + 3),
    y2: b.y - uy * (rb + 3),
  };
}

/** A gentle perpendicular bow. Straight lines between circles read as a wiring diagram. */
function bowedPath(x1: number, y1: number, x2: number, y2: number, bend = 0.1): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return `M ${x1} ${y1} Q ${mx - dy * bend} ${my + dx * bend} ${x2} ${y2}`;
}

/** Clockwise arc from 12 o'clock covering `frac` of the circle. */
function gaugeArc(cx: number, cy: number, r: number, frac: number): string {
  if (frac <= 0) return "";
  const f = Math.min(frac, 0.9995);
  const a0 = -Math.PI / 2;
  const a1 = a0 + f * 2 * Math.PI;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * ═══ The topology ═══
 *
 * Previously seven identical circles, each stroked in a status colour, with the
 * error-rate percentage printed inside. The colour told you a service was
 * unhappy; nothing told you *how* unhappy without reading each number in turn.
 *
 * Each node is now an instrument dial: a hairline base ring with a status-coloured
 * arc sweeping clockwise with the service's error rate (see `gaugeSweep`). Seven
 * dials at seven different sweeps are comparable at a glance in a way seven
 * printed numbers are not — which is the entire job of putting a graph on screen
 * instead of the table that already exists on the Services page.
 *
 * The reactive behaviour is unchanged (plan §9): `get_service_health` pulses the
 * queried node, `get_service_dependencies` lights and animates the matching
 * edges, and an affected service shows a rotating dashed ring while the incident
 * is RECOVERING.
 */
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
    /* The cap matters: an SVG stretched to fill scales its own labels with it,
       and this component appears in two containers of very different widths. */
    <div className="mx-auto flex h-full w-full max-w-[700px] items-center justify-center">
      <svg viewBox="0 0 640 300" width="100%" height="100%" role="img" aria-label="Service dependency topology">
      <defs>
        <radialGradient id="dial-face" cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#241f1a" />
          <stop offset="100%" stopColor="#141210" />
        </radialGradient>
      </defs>

      {edges.map(({ from, to }) => {
        const t = trimmed(POS[from], POS[to], radius(from), radius(to));
        const highlighted =
          depsService !== undefined &&
          ((depsDirection !== "upstream" && from === depsService) ||
            (depsDirection !== "downstream" && to === depsService));
        return (
          <path
            key={`${from}-${to}`}
            d={bowedPath(t.x1, t.y1, t.x2, t.y2)}
            fill="none"
            stroke={highlighted ? "var(--color-ic-accent)" : "var(--color-ic-border-strong)"}
            strokeWidth={highlighted ? 2 : 1.25}
            strokeDasharray={highlighted ? "5 5" : undefined}
            strokeLinecap="round"
            className={highlighted ? "animate-dash-flow" : ""}
            style={{ transition: "stroke 250ms ease-out, stroke-width 250ms ease-out" }}
          />
        );
      })}

      {SERVICE_IDS.map((id) => {
        const p = POS[id];
        const h = health[id];
        const r = radius(id);
        const pulsing = id === healthService;
        const transitioning = transitioningServices.includes(id);
        const color = statusColor(h?.status);
        const sweep = h ? gaugeSweep(h.errorRate) : 0;
        const svc = SERVICES[id];

        return (
          <g key={id}>
            <title>
              {svc.displayName} — tier {svc.tier}, {h ? `${(h.errorRate * 100).toFixed(2)}% errors, ${h.status}` : "no data"}
            </title>

            {pulsing && (
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 4}
                fill="none"
                stroke="var(--color-ic-accent)"
                strokeWidth={1.75}
                className={healthGlow?.pending ? "animate-radar" : ""}
                opacity={healthGlow?.pending ? 1 : 0.85}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            )}
            {transitioning && (
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 8}
                fill="none"
                stroke="var(--color-ic-degraded)"
                strokeWidth={1.5}
                strokeDasharray="4 5"
                className="animate-spin"
                style={{ transformOrigin: `${p.x}px ${p.y}px`, animationDuration: "6s" }}
              />
            )}

            {/* The dial face, then the gauge track in the status colour at low
                opacity — so even a service reading 0.1% shows a complete ring
                whose colour already tells you it is healthy, with a small bright
                arc on it rather than an unexplained stub on grey. */}
            <circle cx={p.x} cy={p.y} r={r} fill="url(#dial-face)" stroke="var(--color-ic-border)" strokeWidth={1} />
            <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={color} strokeWidth={2.5} opacity={0.22} />

            {/* The gauge: arc length is the error rate. */}
            {sweep > 0 && (
              <path
                d={gaugeArc(p.x, p.y, r, sweep)}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                style={{
                  filter: pulsing ? "drop-shadow(0 0 6px rgb(134 169 223 / 0.6))" : undefined,
                  transition: "stroke 300ms ease-out",
                }}
              />
            )}
            {pulsing && (
              <circle cx={p.x} cy={p.y} r={r} fill="none" stroke="var(--color-ic-accent)" strokeWidth={1.5} opacity={0.9} />
            )}

            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={r >= 30 ? 12.5 : 11}
              fontWeight={500}
              letterSpacing="-0.03em"
              fill={h ? color : "var(--color-ic-text-faint)"}
            >
              {h ? `${(h.errorRate * 100).toFixed(1)}%` : "—"}
            </text>

            <text
              x={p.x}
              y={p.y + r + 16}
              textAnchor="middle"
              fontFamily="var(--font-sans)"
              fontSize={11.5}
              fontWeight={500}
              letterSpacing="-0.01em"
              fill="var(--color-ic-text)"
            >
              {svc.displayName}
            </text>
          </g>
        );
      })}
      </svg>
    </div>
  );
}
