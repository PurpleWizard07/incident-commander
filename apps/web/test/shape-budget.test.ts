import { describe, it, expect } from "vitest";
import {
  formatLogsResult,
  formatTracesResult,
  formatCompareResult,
  type LogsResponse,
  type TracesResponse,
  type CompareResponse,
} from "../src/webmcp/tools/observability.js";
import { capText } from "../src/webmcp/shape.js";
import { SERVICE_IDS } from "@incident-commander/shared";

const MAX_CHARS = 1500;
const LONG_MESSAGE =
  "A deliberately long synthetic log message meant to simulate the worst case a real scenario could " +
  "produce, well beyond what any of our actual hero-incident messages are, to prove the shaper caps " +
  "regardless of input size rather than merely happening to fit today's specific data.";

describe("1.5K response budget (plan §6.6) — synthetic worst-case inputs, not today's data", () => {
  it("caps query_logs regardless of how many patterns/entries the API returns", () => {
    const worstCase: LogsResponse = {
      totalMatched: 5000,
      patterns: Array.from({ length: 200 }, (_, i) => ({ message: `${LONG_MESSAGE} (variant ${i})`, count: 25 })),
      entries: Array.from({ length: 200 }, (_, i) => ({
        timestamp: "2026-08-30T10:44:00.000Z",
        service: "checkout",
        level: "ERROR",
        deployment: "checkout-v3",
        message: `${LONG_MESSAGE} (entry ${i})`,
      })),
      truncated: true,
      note: "4950 further matching lines omitted; narrow with contains or level.",
    };
    expect(formatLogsResult(worstCase).length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it("caps search_traces regardless of how many spans/traces the API returns", () => {
    const worstCase: TracesResponse = {
      totalMatched: 500,
      failingSpanBreakdown: Array.from({ length: 50 }, (_, i) => ({ spanName: `service${i}.operation${i}`, count: 10, proportion: 0.02 })),
      sample: Array.from({ length: 20 }, (_, i) => ({
        traceId: `trace-${i}-${"a".repeat(20)}`,
        startedAt: "2026-08-30T10:44:00.000Z",
        failingSpanId: "span-1",
        spans: Array.from({ length: 10 }, (_, j) => ({
          spanId: `span-${j}`,
          name: `checkout.step${j}`,
          status: j === 0 ? "error" : "ok",
          errorMessage: j === 0 ? LONG_MESSAGE : null,
          attributes: { deployment: "checkout-v3", flag: "some-long-flag-name-value", extra: "more-attribute-text-here" },
        })).map((s, j) => (j === 0 ? { ...s, spanId: "span-1" } : s)),
      })),
      note: undefined,
    };
    expect(formatTracesResult(worstCase).length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it("caps compare_metrics regardless of how many service/metric pairs are present", () => {
    const services = SERVICE_IDS;
    const metrics = [
      "request_rate", "error_rate", "latency_p50", "latency_p95", "latency_p99",
      "cpu", "memory", "queue_depth", "db_pool_utilization", "db_pool_wait_ms",
      "gc_pause_ms", "external_call_error_rate", "external_call_latency",
    ];
    const worstCase: CompareResponse = {
      results: services.flatMap((service) =>
        metrics.map((metric) => ({ service, metric, present: true, baseline: 0.123456, current: 0.654321, onsetMinute: 42 }))
      ),
      orderedByOnset: services.map((service) => ({ service, metric: "error_rate", onsetMinute: 42 })),
      note: "No data for: some.metric — this metric does not apply to that service, not a zero value.",
    };
    expect(formatCompareResult(worstCase).length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it("capText itself never exceeds the budget no matter the input", () => {
    const huge = LONG_MESSAGE.repeat(50);
    expect(huge.length).toBeGreaterThan(MAX_CHARS);
    expect(capText(huge).length).toBeLessThanOrEqual(MAX_CHARS);
    expect(capText(huge)).toContain("truncated");
  });

  it("does not truncate a response that already fits", () => {
    const short = "checkout: DEGRADED, error_rate 61.2%";
    expect(capText(short)).toBe(short);
  });
});
