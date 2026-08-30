import type { Trace, Span } from "../sharedTypes.js";
import { isoForMinute } from "../clock.js";
import type { TraceShape, SpanOutcome, TraceRequestContext } from "../types.js";
import { Rng, deriveSeed } from "../prng.js";

function defaultResolve(): SpanOutcome {
  return { status: "ok" };
}

function generateOneTrace(shape: TraceShape, minute: number, rng: Rng): Trace {
  const traceId = rng.hexId(8);
  const ctx: TraceRequestContext = { minute, rng, resolved: new Map() };

  const spanRecords: Span[] = [];
  const idByName = new Map<string, string>();
  const failedNames = new Set<string>();
  let offsetMs = 0;
  let failingSpanId: string | null = null;

  for (const spec of shape.spans) {
    // An ancestor already failed: the call never reached this span. Mark
    // THIS span's name as failed too (not just spans that were actually
    // evaluated), so this unreachability propagates transitively to any of
    // its own children — otherwise a grandchild whose direct parent was
    // itself skipped (rather than evaluated-and-failed) would incorrectly
    // resume execution one level below the real failure.
    if (spec.parent && failedNames.has(spec.parent)) {
      failedNames.add(spec.name);
      continue;
    }

    const spanId = rng.hexId(6);
    idByName.set(spec.name, spanId);

    const outcome = (spec.resolve ?? defaultResolve)(ctx);
    ctx.resolved.set(spec.name, outcome);

    const duration = Math.round(rng.range(spec.durationMsRange[0], spec.durationMsRange[1]));
    spanRecords.push({
      spanId,
      parentSpanId: spec.parent ? (idByName.get(spec.parent) ?? null) : null,
      service: spec.service,
      name: spec.name,
      startOffsetMs: offsetMs,
      durationMs: duration,
      status: outcome.status,
      errorMessage: outcome.errorMessage ?? null,
      attributes: outcome.attributes ?? {},
    });

    if (outcome.status === "error") {
      failedNames.add(spec.name);
      failingSpanId = spanId;
    }
    offsetMs += duration;
  }

  return {
    traceId,
    startedAt: isoForMinute(minute),
    minute,
    durationMs: offsetMs,
    status: failingSpanId ? "error" : "ok",
    rootService: shape.rootService,
    spans: spanRecords,
    failingSpanId,
  };
}

/**
 * `baseSeed` is a plain number — each shape derives its own independent stream
 * keyed by `shape.id`, for the same prefix-stability reason as generateLogs.
 * With today's single-shape hero scenario this couldn't yet manifest, but
 * Phase 8's scenarios will have more than one shape and must not need engine
 * changes to stay correct.
 */
export function generateTraces(shapes: TraceShape[], fromMinute: number, toMinute: number, baseSeed: number): Trace[] {
  const traces: Trace[] = [];
  for (const shape of shapes) {
    const rng = new Rng(deriveSeed(shape.id, baseSeed));
    const activeFrom = Math.max(fromMinute, shape.activeFrom);
    const activeTo = Math.min(toMinute, shape.activeTo ?? toMinute);
    for (let minute = activeFrom; minute <= activeTo; minute++) {
      const whole = Math.floor(shape.volumePerMinute);
      const count = whole + (rng.bool(shape.volumePerMinute - whole) ? 1 : 0);
      for (let i = 0; i < count; i++) {
        traces.push(generateOneTrace(shape, minute, rng));
      }
    }
  }
  return traces;
}

/** service -> minute -> traceIds touching that service at that minute. Used for log attachTrace. */
export function indexTraceIdsByServiceMinute(traces: Trace[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const trace of traces) {
    const servicesInTrace = new Set(trace.spans.map((s) => s.service));
    for (const service of servicesInTrace) {
      const key = `${service}:${trace.minute}`;
      const list = index.get(key);
      if (list) list.push(trace.traceId);
      else index.set(key, [trace.traceId]);
    }
  }
  return index;
}
