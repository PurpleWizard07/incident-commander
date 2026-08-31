/**
 * Shared className recipes so every panel/button/badge across the console
 * comes from one visual vocabulary instead of each component inventing its
 * own ad hoc Tailwind string. Plain string helpers — no runtime cost, no new
 * dependency, and every className stays a static string Tailwind's build-time
 * scanner can see (no dynamic class construction that would get purged).
 */

export function pillToggle(active: boolean, extra = ""): string {
  return `rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ease-out active:scale-95 ${
    active
      ? "bg-ic-accent text-ic-bg shadow-[0_0_0_1px_rgb(34_211_238/0.5)]"
      : "bg-ic-panel-2 text-ic-text-dim hover:bg-ic-panel-3 hover:text-ic-text"
  } ${extra}`;
}

export type BadgeTone = "critical" | "warning" | "healthy" | "neutral" | "accent";

const BADGE_TONES: Record<BadgeTone, string> = {
  critical: "bg-ic-down/15 text-ic-down ring-1 ring-inset ring-ic-down/30",
  warning: "bg-ic-degraded/15 text-ic-degraded ring-1 ring-inset ring-ic-degraded/30",
  healthy: "bg-ic-healthy/15 text-ic-healthy ring-1 ring-inset ring-ic-healthy/30",
  neutral: "bg-ic-panel-3 text-ic-text-dim ring-1 ring-inset ring-ic-border-strong",
  accent: "bg-ic-accent/15 text-ic-accent ring-1 ring-inset ring-ic-accent/30",
};

export function badge(tone: BadgeTone, extra = ""): string {
  return `inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide whitespace-nowrap ${BADGE_TONES[tone]} ${extra}`;
}

export type ActionVariant = "primary" | "secondary" | "danger";

const ACTION_VARIANTS: Record<ActionVariant, string> = {
  primary: "bg-ic-accent text-ic-bg hover:brightness-110 shadow-[0_0_20px_-6px_rgb(34_211_238/0.65)]",
  secondary: "bg-ic-panel-3 text-ic-text hover:bg-ic-border-strong",
  danger: "bg-ic-down/15 text-ic-down hover:bg-ic-down/25 ring-1 ring-inset ring-ic-down/30",
};

export function actionButton(variant: ActionVariant = "secondary", extra = ""): string {
  return `rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${ACTION_VARIANTS[variant]} ${extra}`;
}

export function fieldClass(extra = ""): string {
  return `w-full rounded-lg border border-ic-border bg-ic-panel-2 px-2.5 py-1.5 font-mono text-[11px] text-ic-text placeholder:text-ic-text-faint transition-colors duration-150 focus:border-ic-accent focus:bg-ic-panel-3 ${extra}`;
}

/** Panel border/shadow for the tool-reactivity glow (plan §9) — shared so every panel breathes the same way while a call is pending vs. holds the same steady glow once settled. */
export function glowClass(glow: "pending" | "settled" | null | undefined): string {
  if (glow === "pending") return "border-ic-accent/70 shadow-glow-accent-soft animate-glow-pulse";
  if (glow === "settled") return "border-ic-accent shadow-glow-accent";
  return "border-ic-border";
}

/**
 * `behavior: "smooth"` passed explicitly to scrollIntoView/scrollTo always
 * animates regardless of CSS `scroll-behavior` — the `prefers-reduced-motion`
 * media query in index.css can't reach it, so call sites that scroll
 * programmatically need to check this themselves.
 */
export function scrollBehavior(): "smooth" | "auto" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
