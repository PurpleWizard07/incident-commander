import { useEffect, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { Deployment, MetricName, ServiceId } from "@incident-commander/shared";
import { SERVICES } from "@incident-commander/shared";
import { compareMetrics as fetchCompareMetrics, type RawMetricSeries } from "./api.js";
import { useGlowingCall } from "./toolActivity.js";
import { pillToggle } from "./ui.js";

interface OnsetMarker {
  minute: number;
  metric: MetricName;
  label: string;
}

const SERIES_COLORS = ["#22d3ee", "#fb923c", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#fb7185"];

type Row = { minute: number } & Partial<Record<ServiceId, number>>;

function mergeSeries(series: RawMetricSeries[]): Row[] {
  const byMinute = new Map<number, Row>();
  for (const s of series) {
    for (const p of s.points) {
      const row = byMinute.get(p.minute) ?? { minute: p.minute };
      row[s.service] = p.value;
      byMinute.set(p.minute, row);
    }
  }
  return [...byMinute.values()].sort((a, b) => a.minute - b.minute);
}

export function MetricsChart({
  series,
  deployments,
}: {
  series: RawMetricSeries[];
  deployments: Deployment[];
}) {
  const metrics = useMemo(() => [...new Set(series.map((s) => s.metric))], [series]);
  const [metric, setMetric] = useState<MetricName>(metrics[0] ?? "error_rate");
  const active = metric && metrics.includes(metric) ? metric : metrics[0];

  const filtered = useMemo(() => series.filter((s) => s.metric === active), [series, active]);
  const rows = useMemo(() => mergeSeries(filtered), [filtered]);
  const services = filtered.map((s) => s.service);
  const unit = filtered[0]?.unit ?? "";
  const relevantDeploys = deployments.filter((d) => services.includes(d.service));

  /**
   * `compare_metrics`'s visible effect (plan §9): "compared series are drawn
   * together with onset markers." Reuses the same endpoint the tool itself
   * calls (`/api/metrics/compare`) rather than re-deriving onset logic here
   * — the tool already strips series down to onset/baseline/current, which
   * is exactly what a marker overlay needs. Auto-selects the metric the
   * agent compared if we already have its series loaded.
   */
  const compareGlow = useGlowingCall(["compare_metrics"]);
  const [onsetMarkers, setOnsetMarkers] = useState<OnsetMarker[]>([]);
  const appliedCompareId = useRef<string | null>(null);

  useEffect(() => {
    if (!compareGlow || compareGlow.pending) return;
    if (compareGlow.record.id === appliedCompareId.current) return;
    appliedCompareId.current = compareGlow.record.id;
    const args = compareGlow.record.args as { services?: string[]; metrics?: string[]; fromMinute?: number; toMinute?: number };
    if (args.metrics?.length && metrics.includes(args.metrics[0] as MetricName)) {
      setMetric(args.metrics[0] as MetricName);
    }
    fetchCompareMetrics(args)
      .then((r) => {
        setOnsetMarkers(
          r.orderedByOnset.map((o) => ({ minute: o.onsetMinute, metric: o.metric, label: `${o.service} onset` }))
        );
      })
      .catch(() => {});
  }, [compareGlow, metrics]);

  const compareServices = compareGlow?.record.args.services as string[] | undefined;
  const emphasizing = compareGlow !== null && !!compareServices?.length;
  const visibleOnsetMarkers = compareGlow ? onsetMarkers.filter((m) => m.metric === active) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 pt-2.5">
        <div className="flex gap-1.5">
          {metrics.map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={pillToggle(m === active)}>
              {m}
            </button>
          ))}
        </div>
        {services.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] text-ic-text-dim">
            {services.map((service, i) => {
              const dimmed = emphasizing && !compareServices!.includes(service);
              return (
                <span key={service} className="flex items-center gap-1" style={{ opacity: dimmed ? 0.4 : 1 }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  {SERVICES[service].displayName}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="var(--color-ic-border)" strokeDasharray="3 3" strokeOpacity={0.6} />
            <XAxis
              dataKey="minute"
              tick={{ fontSize: 10, fill: "var(--color-ic-text-faint)" }}
              tickLine={{ stroke: "var(--color-ic-border)" }}
              axisLine={{ stroke: "var(--color-ic-border)" }}
              label={{ value: "minute", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "var(--color-ic-text-faint)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-ic-text-faint)" }}
              tickLine={{ stroke: "var(--color-ic-border)" }}
              axisLine={{ stroke: "var(--color-ic-border)" }}
              width={40}
              label={{ value: unit, angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--color-ic-text-faint)" }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-ic-panel-2)",
                border: "1px solid var(--color-ic-border-strong)",
                borderRadius: 10,
                fontSize: 11,
                boxShadow: "0 16px 40px -16px rgb(0 0 0 / 0.7)",
              }}
              labelStyle={{ color: "var(--color-ic-text-dim)" }}
            />
            {filtered.map((s, i) => (
              <ReferenceLine
                key={`baseline-${s.service}`}
                y={s.baseline}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeDasharray="2 4"
                strokeOpacity={0.5}
              />
            ))}
            {relevantDeploys.map((d) => (
              <ReferenceLine
                key={d.id}
                x={d.deployedAtMinute}
                stroke="var(--color-ic-accent)"
                strokeDasharray="4 4"
                label={{
                  value: `${d.service} ${d.version}`,
                  position: "top",
                  fontSize: 10,
                  fill: "var(--color-ic-accent)",
                }}
              />
            ))}
            {visibleOnsetMarkers.map((m) => (
              <ReferenceLine
                key={`onset-${m.metric}-${m.minute}-${m.label}`}
                x={m.minute}
                stroke="var(--color-ic-degraded)"
                strokeDasharray="1 3"
                label={{ value: m.label, position: "insideTopLeft", fontSize: 9, fill: "var(--color-ic-degraded)" }}
              />
            ))}
            {services.map((service, i) => {
              const dimmed = emphasizing && !compareServices!.includes(service);
              return (
                <Line
                  key={service}
                  type="monotone"
                  dataKey={service}
                  name={SERVICES[service].displayName}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeOpacity={dimmed ? 0.25 : 1}
                  dot={false}
                  strokeWidth={emphasizing && !dimmed ? 3 : 2}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
