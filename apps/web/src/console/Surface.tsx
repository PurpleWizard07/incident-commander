import type { ReactNode } from "react";
import { agentEdge, agentGlowRing } from "./ui.js";

export type AgentGlow = "pending" | "settled" | null | undefined;

/**
 * ═══ The single most important structural decision in this design ═══
 *
 * A `Region` is an AREA OF THE APPLICATION SHEET, not a card. It has no border,
 * no background of its own and no gap around it — it is delimited by a floating
 * mono overline whose hairline runs out to the right edge, and by the hairline
 * of whichever region it sits against.
 *
 * The previous design gave every content area an identical rounded-xl bordered
 * gradient card, then stacked eight of them. The result was that the topology
 * graph, a chart, a 200-row log table and two forms all carried exactly the
 * same visual weight and the same framing, so nothing on screen was primary —
 * and the framing itself (eight borders, eight header rows, eight shadows) was
 * the loudest thing in the interface. Regions fix that at the root: hierarchy
 * now comes from position, size and type, which is where it belongs, and
 * elevation is freed up to mean something specific (see `FloatCard`).
 *
 * `glow` is the region-level half of the reactivity contract (plan §9) —
 * which part of the console the agent's most recent call concerns. It lights
 * the region's top hairline in the agent's blue and washes the top few pixels,
 * rather than ringing a card, because there is no card to ring.
 */
export function Region({
  label,
  accessory,
  glow,
  className = "",
  bodyClassName = "",
  children,
}: {
  label: string;
  accessory?: ReactNode;
  glow?: AgentGlow;
  className?: string;
  /** Escape hatch for regions whose body needs its own padding or scroll. */
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={`relative flex min-h-0 min-w-0 flex-col ${className}`}>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 z-[3] h-[2px] transition-colors duration-300 ${agentEdge(glow)}`}
      />
      {glow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-ic-accent/[0.1] to-transparent"
        />
      )}
      <header className="relative z-[2] flex shrink-0 items-center gap-3 px-4 pb-2.5 pt-3">
        <h2 className={`ic-overline shrink-0 transition-colors duration-300 ${glow ? "text-ic-accent" : ""}`}>{label}</h2>
        <span
          aria-hidden="true"
          className={`h-px min-w-4 flex-1 transition-colors duration-300 ${glow ? "bg-ic-accent/35" : "bg-ic-border/80"}`}
        />
        {accessory}
      </header>
      <div className={`relative z-[2] min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/**
 * The counterpart rule: elevation, blur and a border are reserved for things
 * that genuinely float above the sheet — an approval landing, the evidence
 * spotlight, a nav label capsule. Because nothing else in the interface is
 * lifted, anything that is reads as urgent without needing a colour or an
 * icon to say so.
 *
 * Everything using this class arrives after first paint, which is why the
 * `backdrop-filter` in `.ic-float` is affordable here and nowhere else.
 */
export function FloatCard({
  className = "",
  glow,
  children,
}: {
  className?: string;
  glow?: AgentGlow;
  children: ReactNode;
}) {
  return (
    <div className={`ic-float rounded-xl ${agentGlowRing(glow)} ${className}`}>{children}</div>
  );
}

export interface Vital {
  label: string;
  value: string;
  unit?: string;
  tone?: "ink" | "healthy" | "degraded" | "down" | "agent";
  /** Small print under the caption — the "why", kept tertiary. */
  note?: string;
  title?: string;
}

const VITAL_TONES: Record<NonNullable<Vital["tone"]>, string> = {
  ink: "text-ic-text",
  healthy: "text-ic-healthy",
  degraded: "text-ic-degraded",
  down: "text-ic-down",
  agent: "text-ic-accent",
};

/**
 * The vitals strip: the most important numbers in the console, rendered with
 * NO container at all — bare instrument numerals separated by vertical
 * hairlines. This is the deliberate proof that hierarchy does not require a
 * card, and it is where the type system does its most visible work: a 24px mono
 * numeral over a 9.5px tracked-out caption is a 2.5× scale jump inside one
 * element, where the old design's entire range was 9–14px.
 */
export function VitalsStrip({ items, className = "" }: { items: Vital[]; className?: string }) {
  return (
    /* One row of N at desktop; a two-column grid below 768px. Four 24px
       numerals cannot share ~280px of usable width — measured at 390px, the
       values collided with each other and with their own captions. The
       hairlines have to follow the wrap, so the dividers below are computed
       per-position rather than being a blanket `border-l` on every item but
       the first. */
    <div
      className={`flex shrink-0 items-stretch max-md:grid max-md:grid-cols-2 ${className}`}
      role="group"
      aria-label="Incident vitals"
    >
      {items.map((v, i) => (
        <div
          key={v.label}
          title={v.title}
          className={`flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-[11px] ${
            i > 0 ? "border-l border-ic-border/70" : ""
          } ${i % 2 === 0 ? "max-md:border-l-0" : ""} ${i >= 2 ? "max-md:border-t max-md:border-t-ic-border/70" : ""}`}
        >
          <div className="flex items-baseline gap-1">
            <span className={`ic-num text-[24px] ${VITAL_TONES[v.tone ?? "ink"]}`}>{v.value}</span>
            {v.unit && <span className="ic-num text-[12px] text-ic-text-faint">{v.unit}</span>}
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="ic-overline shrink-0">{v.label}</span>
            {v.note && (
              <>
                <span aria-hidden="true" className="shrink-0 text-[9px] leading-none text-ic-border-strong">
                  &middot;
                </span>
                <span className="truncate font-mono text-[9.5px] lowercase text-ic-text-faint">{v.note}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Atmosphere, in two cheap painted layers behind everything: a warm floor wash
 * and a vignette. Both read through the sheet, which is translucent for exactly
 * this reason — an opaque sheet would cover them completely and the depth
 * layering would be decorative only.
 *
 * Plain gradients on absolutely positioned divs: no `background-attachment:
 * fixed`, no filter, no animation. An earlier pass lost 6 Lighthouse performance
 * points to precisely those, and this spends none of that budget.
 */
export function Ground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <div
        className="absolute inset-x-0 bottom-0 h-[55vh]"
        style={{
          backgroundImage: "radial-gradient(ellipse 85% 100% at 74% 116%, rgb(206 156 94 / 0.1), transparent 66%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(ellipse 92% 78% at 50% 40%, transparent 38%, rgb(0 0 0 / 0.55))",
        }}
      />
    </div>
  );
}

export type GroundTone = "critical" | "warning" | "calm" | "neutral";

const LEAK_TINT: Record<GroundTone, string> = {
  critical: "242 97 95",
  warning: "234 165 66",
  calm: "111 207 151",
  neutral: "206 156 94",
};

/**
 * ═══ The identity signal ═══
 *
 * A light-leak across the top of the application sheet, tinted by the live
 * incident's severity: crimson at SEV-1, ember at SEV-2, jade once it is
 * recovering or resolved. The room the console sits in visibly changes colour
 * when production gets worse.
 *
 * It is the only large gradient in the whole system, which is what keeps it from
 * reading as decoration — and it is the reason a screenshot of this app stays
 * identifiable with the logo cropped off.
 *
 * It renders INSIDE the sheet, above the sheet's own background and below all
 * content. Behind the sheet it was invisible (an opaque surface covered it);
 * painted over the content it would tint the masthead type. This is the one
 * position where it is both visible and harmless.
 */
export function SeverityLeak({ tone }: { tone: GroundTone }) {
  const tint = LEAK_TINT[tone];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[38vh] transition-[background-image] duration-1000 ease-out"
      style={{
        backgroundImage: `radial-gradient(ellipse 108% 100% at 48% -30%, rgb(${tint} / 0.23), transparent 66%)`,
      }}
    />
  );
}

/** Fixed-dimension placeholder — the same box the real content will occupy, so nothing shifts on arrival (plan §21.2). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gradient-to-br from-ic-panel-2 to-ic-panel/40 ${className ?? ""}`}
    />
  );
}

/** Shared empty/placeholder voice: one centred line of tertiary mono, never a card. */
export function Hint({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      {icon && <span className="text-ic-text-faint/45">{icon}</span>}
      <p className="max-w-[34ch] font-mono text-[10.5px] leading-relaxed text-ic-text-faint">{children}</p>
    </div>
  );
}
