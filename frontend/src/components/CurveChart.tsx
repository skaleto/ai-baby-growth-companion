import type { GrowthCurveData } from "../appContracts";

// 通用曲线图:从成长曲线抽出的可复用 SVG(gridlines + polyline + 数据点 + x 轴标签 + 上下刻度 + 最新值)。
// 成长、奶量、睡眠共用一套渲染,只用 variant 换配色(见 mobile-app.css 的 .curve-milk / .curve-sleep)。
// 数据形状复用 GrowthCurveData(points 已算好 x/y、polyline 字符串、min/max/latest 文案)。
export function CurveChart({
  data,
  variant,
  ariaLabel,
  emptyHint,
}: {
  data: GrowthCurveData;
  variant: "growth" | "milk" | "sleep";
  ariaLabel: string;
  emptyHint: string;
}) {
  if (!data.points.length) {
    return <p className="growth-curve-empty">{emptyHint}</p>;
  }
  return (
    <div className={`growth-curve-frame curve-${variant}`}>
      <div className="growth-curve-scale" aria-hidden="true">
        <span>{data.maxLabel}</span>
        <span>{data.minLabel}</span>
      </div>
      <svg className="growth-curve-svg" viewBox="0 0 304 144" role="img" aria-label={ariaLabel}>
        <line x1="20" x2="284" y1="24" y2="24" />
        <line x1="20" x2="284" y1="71" y2="71" />
        <line x1="20" x2="284" y1="118" y2="118" />
        <polyline points={data.polyline} />
        {data.points.map((point) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} r="4.5">
              <title>{`${point.label} ${point.valueLabel}`}</title>
            </circle>
            <text x={point.x} y="136" textAnchor="middle">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="growth-curve-latest">最新：{data.latestLabel}</p>
    </div>
  );
}
