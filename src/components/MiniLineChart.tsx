import { formatNumber, formatShortDate } from '../utils/stats';

interface ChartDatum {
  date: string;
  value: number;
  detail: string;
}

interface MiniLineChartProps {
  data: ChartDatum[];
  unitLabel: string;
}

export function MiniLineChart({ data, unitLabel }: MiniLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-[#5C6677] border border-dashed border-white/10 rounded-xl">
        Log at least one session to view progression.
      </div>
    );
  }

  const width = 360;
  const height = 168;
  const padX = 28;
  const padTop = 22;
  const padBottom = 28;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin;
  const minVal = spread === 0 ? Math.max(0, rawMin * 0.85) : Math.max(0, rawMin - spread * 0.15);
  const maxVal = spread === 0 ? rawMax * 1.15 + 1 : rawMax + spread * 0.15;
  const range = maxVal - minVal || 1;

  const coords = data.map((d, i) => {
    const x =
      data.length === 1
        ? padX + plotW / 2
        : padX + (i / (data.length - 1)) * plotW;
    const y = padTop + plotH - ((d.value - minVal) / range) * plotH;
    return { ...d, x, y };
  });

  const linePath = coords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const first = coords[0];
  const last = coords[coords.length - 1];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-44 overflow-visible"
        role="img"
        aria-label={`Progression chart in ${unitLabel}`}
      >
        <defs>
          <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle horizontal reference lines */}
        {[0, 0.5, 1].map((t) => {
          const y = padTop + plotH * t;
          const labelVal = maxVal - range * t;
          return (
            <g key={t}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 3"
              />
              <text
                x={padX - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#5C6677] text-[9px] font-mono"
              >
                {formatNumber(labelVal)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#progressFill)" />}

        {/* Line */}
        {coords.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="#F97316"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {coords.map((pt, i) => {
          const isLatest = i === coords.length - 1;
          return (
            <g key={`${pt.date}-${i}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isLatest ? 5 : 3.5}
                fill={isLatest ? '#F97316' : '#12161E'}
                stroke="#F97316"
                strokeWidth={2}
              >
                <title>{`${formatShortDate(pt.date)}: ${formatNumber(pt.value)} ${unitLabel} (${pt.detail})`}</title>
              </circle>
              {isLatest && (
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor={coords.length === 1 ? 'middle' : 'end'}
                  className="fill-[#F3F5F8] text-[10px] font-mono font-bold"
                >
                  {formatNumber(pt.value)} {unitLabel}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis first & last date */}
        <text
          x={first.x}
          y={height - 6}
          textAnchor={coords.length === 1 ? 'middle' : 'start'}
          className="fill-[#8E98A8] text-[10px] font-mono"
        >
          {formatShortDate(first.date)}
        </text>
        {coords.length > 1 && (
          <text
            x={last.x}
            y={height - 6}
            textAnchor="end"
            className="fill-[#8E98A8] text-[10px] font-mono"
          >
            {formatShortDate(last.date)}
          </text>
        )}
      </svg>
    </div>
  );
}
