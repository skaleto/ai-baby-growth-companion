import type { GrowthReferencePoint } from "../data/growthReference";

export interface GrowthChartPoint {
  ageMonths: number;
  value: number;
}

interface GrowthChartProps {
  /** 用户实测点（已换算成月龄 + 数值），按月龄升序 */
  points: GrowthChartPoint[];
  /** 该指标 + 性别对应的 P3/P50/P97 参考曲线；性别未知时为 null（只画实测点） */
  reference: GrowthReferencePoint[] | null;
  unit: string;
  maxMonths?: number;
}

const W = 320;
const H = 200;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 24;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export function GrowthChart({ points, reference, unit, maxMonths = 36 }: GrowthChartProps) {
  const refInRange = (reference ?? []).filter((r) => r.ageMonths <= maxMonths);

  const values: number[] = [];
  for (const r of refInRange) values.push(r.p3, r.p97);
  for (const p of points) values.push(p.value);
  if (values.length === 0) return null;

  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;

  const xScale = (m: number) => PAD_L + (Math.max(0, Math.min(m, maxMonths)) / maxMonths) * PLOT_W;
  const yScale = (v: number) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * PLOT_H;

  const bandPath =
    refInRange.length >= 2
      ? `M ${refInRange.map((r) => `${xScale(r.ageMonths)},${yScale(r.p97)}`).join(" L ")} L ${[...refInRange]
          .reverse()
          .map((r) => `${xScale(r.ageMonths)},${yScale(r.p3)}`)
          .join(" L ")} Z`
      : "";
  const medianLine =
    refInRange.length >= 2 ? refInRange.map((r) => `${xScale(r.ageMonths)},${yScale(r.p50)}`).join(" ") : "";
  const userLine = points.map((p) => `${xScale(p.ageMonths)},${yScale(p.value)}`).join(" ");

  const xTicks = [0, 6, 12, 18, 24, 30, 36].filter((t) => t <= maxMonths);
  const yTicks = [yMax - yPad, yMin + (yMax - yMin) / 2, yMin + yPad];

  return (
    <svg className="growth-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="成长曲线对比图">
      {bandPath ? <path className="growth-chart-band" d={bandPath} /> : null}
      {medianLine ? <polyline className="growth-chart-median" points={medianLine} /> : null}

      {yTicks.map((v, i) => (
        <g key={`y-${i}`}>
          <line className="growth-chart-grid" x1={PAD_L} y1={yScale(v)} x2={W - PAD_R} y2={yScale(v)} />
          <text className="growth-chart-axis" x={PAD_L - 4} y={yScale(v) + 3} textAnchor="end">
            {Number(v.toFixed(v >= 20 ? 0 : 1))}
          </text>
        </g>
      ))}
      {xTicks.map((m) => (
        <text key={`x-${m}`} className="growth-chart-axis" x={xScale(m)} y={H - 8} textAnchor="middle">
          {m}
        </text>
      ))}

      {points.length > 1 ? <polyline className="growth-chart-user-line" points={userLine} /> : null}
      {points.map((p, i) => (
        <circle key={`pt-${i}`} className="growth-chart-user-dot" cx={xScale(p.ageMonths)} cy={yScale(p.value)} r={3} />
      ))}

      <text className="growth-chart-axis" x={PAD_L - 4} y={PAD_T - 2} textAnchor="end">
        {unit}
      </text>
      <text className="growth-chart-axis" x={W - PAD_R} y={H - 8} textAnchor="end">
        月龄
      </text>
    </svg>
  );
}
