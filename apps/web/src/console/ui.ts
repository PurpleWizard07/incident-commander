/**
 * One visual vocabulary for the whole console, so no component invents its own
 * ad hoc Tailwind string. Plain string helpers — no runtime cost, no new
 * dependency, and every className stays a static literal Tailwind's build-time
 * scanner can see (nothing is assembled dynamically and then purged).
 *
 * The rules these encode, in one place:
 *   · Warm chrome, cool agent, saturated = state of the world.
 *   · Shape is deliberately NOT uniform: dense data rows are square-edged,
 *     controls get a 6px radius, only genuinely floating surfaces get 12px+.
 *     Everything-rounded-the-same is a large part of why the old UI read as
 *     generic.
 */

/* ── Tabs ─────────────────────────────────────────────────────────────────
   An underlined tab bar, not a row of pills. Pills read as filter chips and
   we already use a chip language for filters — reusing it for navigation
   flattened the hierarchy. */
export function tabButton(active: boolean, extra = ""): string {
  return `relative -mb-px border-b px-3 pb-2 pt-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] transition-colors duration-150 ${
    active
      ? "border-ic-text text-ic-text"
      : "border-transparent text-ic-text-faint hover:border-ic-border-strong hover:text-ic-text-dim"
  } ${extra}`;
}

/* ── Filter chips ─────────────────────────────────────────────────────────
   Genuinely a toggle: off is an outline, on is filled. Square-ish, 5px, so
   it never gets mistaken for a status badge (which is a full pill). */
export function chipToggle(active: boolean, extra = ""): string {
  return `rounded-[5px] px-2 py-1 font-mono text-[10px] font-medium tracking-[0.06em] transition-all duration-150 ease-out active:scale-[0.97] ${
    active
      ? "bg-ic-panel-3 text-ic-text ring-1 ring-inset ring-ic-border-strong"
      : "text-ic-text-faint ring-1 ring-inset ring-ic-border hover:text-ic-text-dim hover:ring-ic-border-strong"
  } ${extra}`;
}

/** Segmented control — one continuous instrument switch, not N buttons. */
export function segment(active: boolean, extra = ""): string {
  return `relative px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em] transition-colors duration-150 ${
    active ? "text-ic-bg" : "text-ic-text-faint hover:text-ic-text-dim"
  } ${extra}`;
}

/* ── Badges ───────────────────────────────────────────────────────────────
   Full pill, uppercase mono, tinted fill + inset ring. Reserved for STATE
   (severity, health, outcome, risk) — never used decoratively, which is what
   makes a red one mean something. */
export type BadgeTone = "critical" | "warning" | "healthy" | "neutral" | "accent";

const BADGE_TONES: Record<BadgeTone, string> = {
  critical: "bg-ic-down/12 text-ic-down ring-1 ring-inset ring-ic-down/30",
  warning: "bg-ic-degraded/12 text-ic-degraded ring-1 ring-inset ring-ic-degraded/30",
  healthy: "bg-ic-healthy/12 text-ic-healthy ring-1 ring-inset ring-ic-healthy/30",
  neutral: "bg-ic-panel-3 text-ic-text-dim ring-1 ring-inset ring-ic-border-strong",
  accent: "bg-ic-accent/12 text-ic-accent ring-1 ring-inset ring-ic-accent/30",
};

export function badge(tone: BadgeTone, extra = ""): string {
  return `inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[9.5px] font-medium uppercase tracking-[0.11em] whitespace-nowrap ${BADGE_TONES[tone]} ${extra}`;
}

/* ── Buttons ──────────────────────────────────────────────────────────────
   `primary` is bone-on-ink, deliberately NOT the agent's blue: the primary
   action in this console is always a human's. Approving a production change
   in the agent's own colour would be exactly the wrong signal. */
export type ActionVariant = "primary" | "secondary" | "ghost" | "danger";

const ACTION_VARIANTS: Record<ActionVariant, string> = {
  primary: "bg-ic-text text-ic-bg hover:bg-white shadow-[0_2px_14px_-4px_rgb(244_240_233/0.35)]",
  secondary: "bg-ic-panel-3 text-ic-text ring-1 ring-inset ring-ic-border-strong hover:bg-ic-border-strong/60",
  ghost: "text-ic-text-dim ring-1 ring-inset ring-ic-border hover:text-ic-text hover:ring-ic-border-strong",
  danger: "bg-ic-down/12 text-ic-down ring-1 ring-inset ring-ic-down/35 hover:bg-ic-down/20",
};

export function actionButton(variant: ActionVariant = "secondary", extra = ""): string {
  return `rounded-md px-3 py-1.5 font-sans text-[11.5px] font-semibold tracking-[-0.005em] transition-all duration-150 ease-out active:scale-[0.975] disabled:opacity-40 disabled:pointer-events-none ${ACTION_VARIANTS[variant]} ${extra}`;
}

/* ── Fields ───────────────────────────────────────────────────────────────
   A recessed well, not a raised box: inputs read as cut into the sheet. */
export function fieldClass(extra = ""): string {
  return `w-full rounded-md border border-ic-border bg-ic-bg/70 px-2.5 py-2 font-mono text-[11.5px] text-ic-text shadow-[inset_0_1px_3px_0_rgb(0_0_0/0.4)] transition-colors duration-150 placeholder:text-ic-text-faint focus:border-ic-border-strong focus:bg-ic-bg focus:outline-none ${extra}`;
}

/** A `<select>` stripped of its native chrome; pair with a chevron glyph. */
export function selectClass(extra = ""): string {
  return `cursor-pointer appearance-none rounded-md border border-ic-border bg-ic-panel-2 py-1 pl-2.5 pr-7 font-mono text-[11px] text-ic-text transition-colors duration-150 hover:border-ic-border-strong focus:outline-none ${extra}`;
}

/* ── Tables ───────────────────────────────────────────────────────────────
   Five different views in this console are tables (evidence deployments and
   changes, Services, Deployments, Alerts, Audit). They share these four
   strings rather than each re-deriving a header and row style, which is what
   makes them read as one product. No card wrapper: a table IS the region. */
export const thClass = "ic-overline px-3 pb-2 pt-1 text-left font-normal";
export const tdClass = "px-3 py-[7px]";
export const theadRowClass = "sticky top-0 z-[1] bg-ic-bg-elevated shadow-[0_1px_0_0_var(--color-ic-border)]";
export const dataRowClass = "ic-row border-b border-ic-border/50";

/* ── Agent presence ───────────────────────────────────────────────────────
   The panel-level half of the reactivity contract (plan §9). `pending`
   breathes while a call is in flight; `settled` holds steady for the hold
   window after it returns, so nothing appears finished early. */
export function agentGlowRing(glow: "pending" | "settled" | null | undefined): string {
  if (glow === "pending") return "shadow-agent-soft animate-agent-breathe";
  if (glow === "settled") return "shadow-agent";
  return "";
}

/** The hairline at a region's top edge, lit while the agent is working in it. */
export function agentEdge(glow: "pending" | "settled" | null | undefined): string {
  if (glow) return "bg-ic-accent";
  return "bg-transparent";
}

/**
 * `behavior: "smooth"` passed explicitly to scrollIntoView/scrollTo always
 * animates regardless of CSS `scroll-behavior`, so the `prefers-reduced-motion`
 * block in index.css cannot reach it — call sites that scroll programmatically
 * have to check for themselves.
 */
export function scrollBehavior(): "smooth" | "auto" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
