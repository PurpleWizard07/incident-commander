const MAX_CHARS = 1500;

/**
 * Defensive backstop only (plan §6.6 rule 4) — every tool should already fit
 * the budget by construction (aggregate-then-sample, not truncate-then-hope).
 * This exists for the case a future scenario's data shape doesn't.
 */
export function capText(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  const cut = text.slice(0, MAX_CHARS - 60);
  const omitted = text.length - cut.length;
  return `${cut}\n… truncated (${omitted} more characters omitted).`;
}

export function hhmm(iso: string): string {
  return iso.slice(11, 16);
}

export function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
