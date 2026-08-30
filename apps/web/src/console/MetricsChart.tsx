import { useMemo, useState } from "react";
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
import type { RawMetricSeries } from "./api.js";

const SERIES_COLORS = ["#38bdf8", "#f97316", "#a78bfa", "#f472b6", "#4ade80", "#facc15", "#f87171"];

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 px-2 pt-2">
        {metrics.map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`rounded px-2 py-0.5 text-[11px] ${
              m === active ? "bg-ic-accent text-ic-bg" : "bg-ic-panel-2 text-ic-text-dim"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="var(--color-ic-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="minute"
              tick={{ fontSize: 10, fill: "var(--color-ic-text-dim)" }}
              label={{ value: "minute", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "var(--color-ic-text-dim)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-ic-text-dim)" }}
              width={40}
              label={{ value: unit, angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--color-ic-text-dim)" }}
            />
            <Tooltip
              contentStyle={{ background: "var(--color-ic-panel)", border: "1px solid var(--color-ic-border)", fontSize: 11 }}
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
            {services.map((service, i) => (
              <Line
                key={service}
                type="monotone"
                dataKey={service}
                name={SERVICES[service].displayName}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
