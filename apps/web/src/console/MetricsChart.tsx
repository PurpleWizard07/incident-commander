import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
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
import { chipToggle } from "./ui.js";

interface OnsetMarker {
  minute: number;
  metric: MetricName;
  label: string;
}

/**
 * A categorical palette drawn from the console's own warm range rather than a
 * generic rainbow, so the chart belongs to the interface instead of looking
 * imported. Bone leads — it is almost always the incident's own service, and it
 * should dominate — then ember, rose-clay, brass, iris, sage, terracotta:
 * warm-leaning, ordered by prominence, and separable from each other at 2px.
 *
 * Deliberately CONTAINS NO BLUE. The agent's steel blue is reserved system-wide
 * for machine-originated marks, and this chart draws onset markers in it: a
 * service's own line rendered in the same blue, right beside them, would break
 * the one colour rule the rest of the console teaches.
 */
const SERIES_COLORS = ["#f4f0e9", "#eaa542", "#d98fa0", "#b9a46e", "#9e8fd9", "#8fc9a8", "#e0785f"];

type Row = { minute: number } & Partial<Record<ServiceId, number>>;

/** Minutes of history the plot shows; `null` is everything the series holds. */
const WINDOWS: { label: string; minutes: number | null }[] = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "all", minutes: null },
];

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

function formatValue(v: number): string {
  if (v >= 1000) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
}

/**
 * The default recharts tooltip is a white box with a grey border — the single
 * most recognisable "this chart was not designed" tell. This one is the only
 * floating surface inside the plot, so it uses the same glass grammar as an
 * approval card, and it sorts descending by value so the series that is
 * actually spiking is the first line your eye lands on.
 */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const rows = [...payload]
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (b.value as number) - (a.value as number));
  return (
    <div className="ic-float min-w-[168px] rounded-lg px-3 py-2.5">
      <div className="ic-overline mb-2 flex items-baseline justify-between gap-3">
        <span>minute</span>
        <span className="ic-num text-[11px] tracking-normal text-ic-text">{label}</span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((p) => (
          <div key={String(p.dataKey)} className="flex items-baseline gap-2">
            <span aria-hidden="true" className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-ic-text-dim">{p.name}</span>
            <span className="ic-num text-[11.5px] text-ic-text">{formatValue(p.value as number)}</span>
            {unit && <span className="font-mono text-[9px] text-ic-text-faint">{unit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricsChart({ series, deployments }: { series: RawMetricSeries[]; deployments: Deployment[] }) {
  const metrics = useMemo(() => [...new Set(series.map((s) => s.metric))], [series]);
  const [metric, setMetric] = useState<MetricName>(metrics[0] ?? "error_rate");
  const active = metric && metrics.includes(metric) ? metric : metrics[0];

  const [windowMinutes, setWindowMinutes] = useState<number | null>(30);

  const filtered = useMemo(() => series.filter((s) => s.metric === active), [series, active]);
  const allRows = useMemo(() => mergeSeries(filtered), [filtered]);
  const rows = useMemo(() => {
    if (windowMinutes === null || allRows.length === 0) return allRows;
    const latest = allRows[allRows.length - 1].minute;
    return allRows.filter((r) => r.minute >= latest - windowMinutes);
  }, [allRows, windowMinutes]);
  const services = filtered.map((s) => s.service);
  const unit = filtered[0]?.unit ?? "";
  const relevantDeploys = deployments.filter((d) => services.includes(d.service));

  /**
   * `compare_metrics`'s visible effect (plan §9): "compared series are drawn
   * together with onset markers." Reuses the same endpoint the tool itself calls
   * (`/api/metrics/compare`) rather than re-deriving onset logic here — the tool
   * already strips series down to onset/baseline/current, which is exactly what
   * a marker overlay needs. Auto-selects the metric the agent compared if we
   * already have its series loaded.
   */
  const compareGlow = useGlowingCall(["compare_metrics"]);
  const [onsetMarkers, setOnsetMarkers] = useState<OnsetMarker[]>([]);
  const appliedCompareId = useRef<string | null>(null);

  useEffect(() => {
    if (!compareGlow || compareGlow.pending) return;
    if (compareGlow.record.id === appliedCompareId.current) return;
    appliedCompareId.current = compareGlow.record.id;
    const args = compareGlow.record.args as {
      services?: string[];
      metrics?: string[];
      fromMinute?: number;
      toMinute?: number;
    };
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

  const axis = { fontSize: 9.5, fill: "var(--color-ic-text-faint)", fontFamily: "var(--font-mono)" };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2">
        <div className="flex items-center gap-1">
          {metrics.map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={chipToggle(m === active)}>
              {m}
            </button>
          ))}
          {unit && (
            <span className="ml-1 flex items-center gap-1.5 font-mono text-[9.5px] text-ic-text-faint">
              <span aria-hidden="true">&middot;</span>
              {unit}
            </span>
          )}
        </div>

        <div
          role="group"
          aria-label="Time window"
          className="relative grid grid-cols-3 rounded-[5px] border border-ic-border bg-ic-bg/50 p-[2px]"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-[2px] left-[2px] w-[calc((100%-4px)/3)] rounded-[3px] bg-ic-panel-3 transition-transform duration-200 ease-out"
            style={{ transform: `translateX(${WINDOWS.findIndex((w) => w.minutes === windowMinutes) * 100}%)` }}
          />
          {WINDOWS.map((w) => (
            <button
              key={w.label}
              onClick={() => setWindowMinutes(w.minutes)}
              aria-pressed={w.minutes === windowMinutes}
              className={`relative px-1.5 py-[3px] font-mono text-[9.5px] tracking-[0.06em] transition-colors duration-150 ${
                w.minutes === windowMinutes ? "text-ic-text" : "text-ic-text-faint hover:text-ic-text-dim"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        {/* The legend belongs beside the metric switch, not floating in the plot:
            it answers "which line is which service", which you ask before you
            read the chart, not while you are inside it. */}
        {services.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {services.map((service, i) => {
              const dimmed = emphasizing && !compareServices!.includes(service);
              return (
                <span
                  key={service}
                  className="flex items-center gap-1.5 font-mono text-[9.5px] text-ic-text-dim transition-opacity duration-200"
                  style={{ opacity: dimmed ? 0.35 : 1 }}
                >
                  <span
                    aria-hidden="true"
                    className="h-[2px] w-3 rounded-full"
                    style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  />
                  {SERVICES[service].displayName}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 pr-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 18, right: 22, left: 0, bottom: 2 }}>
            <defs>
              {services.map((service, i) => {
                const c = SERIES_COLORS[i % SERIES_COLORS.length];
                return (
                  <linearGradient key={service} id={`fill-${service}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            {/* Horizontal rules only, at hairline weight. A full dashed lattice
                behind four thin lines is noise competing with the data. */}
            <CartesianGrid stroke="var(--color-ic-border)" strokeOpacity={0.55} vertical={false} />
            <XAxis
              dataKey="minute"
              tick={axis}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              minTickGap={56}
              padding={{ left: 4, right: 12 }}
            />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={44} tickMargin={4} tickFormatter={formatValue} />
            <Tooltip
              content={<ChartTooltip unit={unit} />}
              cursor={{ stroke: "var(--color-ic-border-strong)", strokeWidth: 1 }}
            />

            {/* Baselines: what normal looked like. Ghosted, never labelled — they
                are a reference the eye uses, not a series it reads. */}
            {filtered.map((s, i) => (
              <ReferenceLine
                key={`baseline-${s.service}`}
                y={s.baseline}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeDasharray="1 5"
                strokeOpacity={0.4}
              />
            ))}

            {/* A deploy is a change to the world, so it is ember — the same
                colour a change pin gets on the timeline. */}
            {relevantDeploys.map((d) => (
              <ReferenceLine
                key={d.id}
                x={d.deployedAtMinute}
                stroke="var(--color-ic-degraded)"
                strokeOpacity={0.65}
                strokeDasharray="3 3"
                label={{
                  value: `${d.service} ${d.version}`,
                  position: "top",
                  offset: 8,
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--color-ic-degraded)",
                }}
              />
            ))}

            {/* An onset marker is the machine's analysis, so it is the agent's
                blue — consistent with every other agent-derived mark. */}
            {/* Onset labels are staggered: two services usually onset within a
                few minutes of each other, and pinned to one corner their labels
                overlapped into an unreadable smear. */}
            {visibleOnsetMarkers.map((m, idx) => (
              <ReferenceLine
                key={`onset-${m.metric}-${m.minute}-${m.label}`}
                x={m.minute}
                stroke="var(--color-ic-accent)"
                strokeWidth={1.5}
                label={{
                  value: m.label,
                  position: idx % 2 === 0 ? "insideBottomLeft" : "insideTopLeft",
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  fill: "var(--color-ic-accent)",
                }}
              />
            ))}

            {services.map((service) => {
              const dimmed = emphasizing && !compareServices!.includes(service);
              return (
                <Area
                  key={`area-${service}`}
                  type="monotone"
                  dataKey={service}
                  stroke="none"
                  fill={`url(#fill-${service})`}
                  fillOpacity={dimmed ? 0.15 : 1}
                  isAnimationActive={false}
                  activeDot={false}
                  legendType="none"
                />
              );
            })}
            {services.map((service, i) => {
              const dimmed = emphasizing && !compareServices!.includes(service);
              return (
                <Line
                  key={service}
                  type="monotone"
                  dataKey={service}
                  name={SERVICES[service].displayName}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeOpacity={dimmed ? 0.22 : 1}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  strokeWidth={emphasizing && !dimmed ? 2.5 : 1.75}
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
