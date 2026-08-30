import type { LogEntry, Deployment } from "../sharedTypes.js";
import { isoForMinute } from "../clock.js";
import type { LogTemplate } from "../types.js";
import { Rng, deriveSeed } from "../prng.js";
import { activeDeploymentAt } from "./deployments.js";

function interpolate(message: string, vars: Record<string, string>): string {
  return message.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? `{{${key}}}`);
}

/**
 * `baseSeed` is a plain number, not a shared Rng — each template derives its OWN
 * independent stream keyed by `tmpl.id`. A shared, sequentially-consumed rng
 * would make one template's minute range (which depends on `toMinute`) steal a
 * variable number of draws before the next template even starts, silently
 * breaking prefix-stability as `toMinute` grows (see world.ts for the full story
 * — this is the same bug fixed there for metric series, applied here too since
 * Phase 8 adds more templates and must not need engine changes to stay correct).
 */
export function generateLogs(
  templates: LogTemplate[],
  deployments: Deployment[],
  fromMinute: number,
  toMinute: number,
  baseSeed: number,
  traceIdsByServiceMinute: Map<string, string[]>
): LogEntry[] {
  const entries: LogEntry[] = [];

  for (const tmpl of templates) {
    const rng = new Rng(deriveSeed(tmpl.id, baseSeed));
    const activeFrom = Math.max(fromMinute, tmpl.activeFrom);
    const activeTo = Math.min(toMinute, tmpl.activeTo ?? toMinute);

    for (let minute = activeFrom; minute <= activeTo; minute++) {
      const active = activeDeploymentAt(deployments, tmpl.service, minute);
      if (tmpl.onlyWhenDeployment && active?.id !== tmpl.onlyWhenDeployment) continue;

      const rate = typeof tmpl.ratePerMinute === "function" ? tmpl.ratePerMinute(minute) : tmpl.ratePerMinute;
      const whole = Math.floor(rate);
      const count = whole + (rng.bool(rate - whole) ? 1 : 0);

      for (let i = 0; i < count; i++) {
        const candidates = traceIdsByServiceMinute.get(`${tmpl.service}:${minute}`) ?? [];
        const traceId = tmpl.attachTrace && candidates.length > 0 ? rng.pick(candidates) : null;

        entries.push({
          timestamp: isoForMinute(minute + rng.float()),
          minute,
          service: tmpl.service,
          level: tmpl.level,
          deployment: active?.id ?? null,
          message: interpolate(tmpl.message, { deployment: active?.id ?? "unknown", traceId: traceId ?? "" }),
          traceId,
          attributes: {},
        });
      }
    }
  }

  return entries.sort((a, b) => a.minute - b.minute || a.timestamp.localeCompare(b.timestamp));
}
