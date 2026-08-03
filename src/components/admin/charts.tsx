// 仪表盘图表：零依赖手写 SVG，颜色取自 CSS 变量（--accent / --muted）

export interface TrendDay {
  label: string;
  count: number;
}

// 近 14 天发文趋势（柱状图）
export function PublishTrendChart({ days }: { days: TrendDay[] }) {
  const W = 560;
  const H = 190;
  const padL = 8;
  const padB = 22;
  const padT = 12;
  const chartH = H - padT - padB;
  const max = Math.max(1, ...days.map((d) => d.count));
  const bw = (W - padL * 2) / Math.max(1, days.length);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="近 14 天发文趋势">
        {/* 网格线 */}
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={r}
            x1={padL}
            x2={W - padL}
            y1={padT + chartH * (1 - r)}
            y2={padT + chartH * (1 - r)}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray={r === 0 ? "" : "3 4"}
          />
        ))}
        {days.map((d, i) => {
          const h = Math.max(d.count > 0 ? 3 : 1, (d.count / max) * chartH);
          const x = padL + i * bw + bw * 0.25;
          const y = padT + chartH - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={bw * 0.5}
                height={h}
                rx={2}
                fill="var(--accent)"
                opacity={d.count > 0 ? 0.9 : 0.18}
              >
                <title>{`${d.label}：发布 ${d.count} 篇`}</title>
              </rect>
              {i % 2 === 0 || i === days.length - 1 ? (
                <text
                  x={x + bw * 0.25}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--muted)"
                >
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-muted">
        最近 14 天共发布 {days.reduce((s, d) => s + d.count, 0)} 篇
      </p>
    </div>
  );
}

export interface CategoryRow {
  name: string;
  count: number;
  views: number;
}

// 分类分布（横向条形）
export function CategoryBarChart({ rows }: { rows: CategoryRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">暂无分类数据</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-foreground">{r.name}</span>
            <span className="text-muted">
              {r.count} 篇 · {r.views} 次浏览
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border/60">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.count / max) * 100}%`, background: "var(--accent)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
