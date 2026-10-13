type Point = { day: string; value: number };
type Slice = { label: string; value: number };

const COLORS = ["#0f766e", "#0e7490", "#4338ca", "#b45309", "#be123c", "#365314"];

function maxValue(points: Point[]) {
  return Math.max(1, ...points.map((point) => point.value));
}

function dayLabel(day: string) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

function defaultFormat(value: number) {
  return String(value);
}

export function LineChart({ points, format = defaultFormat }: { points: Point[]; format?: (value: number) => string }) {
  const width = 720;
  const height = 240;
  const pad = { top: 28, right: 16, bottom: 36, left: 72 };
  const max = maxValue(points);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const coords = points.map((point, index) => {
    const x = pad.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.top + innerH - (point.value / max) * innerH;
    return { x, y, point };
  });
  const ticks = [0, 0.5, 1].map((ratio) => ({
    y: pad.top + innerH - ratio * innerH,
    label: format(Math.round(max * ratio)),
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full" role="img">
        {ticks.map((tick) => (
          <g key={tick.y}>
            <line x1={pad.left} x2={width - pad.right} y1={tick.y} y2={tick.y} stroke="#e2e8f0" />
            <text x={pad.left - 8} y={tick.y + 4} textAnchor="end" className="fill-slate-500" fontSize="11">
              {tick.label}
            </text>
          </g>
        ))}
        <polyline fill="none" stroke="#0f766e" strokeWidth="2.5" points={coords.map((c) => `${c.x},${c.y}`).join(" ")} />
        {coords.map(({ x, y, point }) => (
          <g key={point.day}>
            <circle cx={x} cy={y} r="3.5" fill="#0f766e">
              <title>{`${dayLabel(point.day)}: ${format(point.value)}`}</title>
            </circle>
            {point.value > 0 ? (
              <text x={x} y={y - 10} textAnchor="middle" className="fill-slate-800" fontSize="10" fontWeight="600">
                {format(point.value)}
              </text>
            ) : null}
          </g>
        ))}
        {coords.map(({ x, point }, index) =>
          index % 2 === 0 || index === coords.length - 1 ? (
            <text key={point.day} x={x} y={height - 12} textAnchor="middle" className="fill-slate-500" fontSize="10">
              {dayLabel(point.day)}
            </text>
          ) : null,
        )}
      </svg>
      <ValueList points={points} format={format} />
    </div>
  );
}

export function BarChart({ points, format = defaultFormat }: { points: Point[]; format?: (value: number) => string }) {
  const max = maxValue(points);
  return (
    <div>
      <div className="flex h-52 items-end gap-1">
        {points.map((point) => {
          const height = point.value <= 0 ? 0 : Math.max(8, (point.value / max) * 100);
          return (
            <div key={point.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold text-slate-800">{point.value > 0 ? format(point.value) : ""}</span>
              <div
                className="w-full rounded-t bg-teal-700"
                style={{ height: `${height}%` }}
                title={`${dayLabel(point.day)}: ${format(point.value)}`}
              />
              <span className="text-[9px] text-slate-500">{dayLabel(point.day)}</span>
            </div>
          );
        })}
      </div>
      <ValueList points={points} format={format} />
    </div>
  );
}

function ValueList({ points, format }: { points: Point[]; format: (value: number) => string }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
      {points.map((point) => (
        <li key={point.day}>
          <span className="text-slate-500">{dayLabel(point.day)}</span>
          {": "}
          <span className="font-medium text-slate-800">{format(point.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatBars({ slices, format = defaultFormat }: { slices: Slice[]; format?: (value: number) => string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  return (
    <ul className="flex flex-col gap-2">
      {slices.length === 0 ? <li className="text-sm text-slate-600">—</li> : null}
      {slices.map((slice, index) => (
        <li key={slice.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{slice.label}</span>
            <span className="font-medium">
              {format(slice.value)}
              <span className="ml-2 text-xs text-slate-500">{Math.round((slice.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full rounded"
              style={{ width: `${(slice.value / total) * 100}%`, background: COLORS[index % COLORS.length] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
