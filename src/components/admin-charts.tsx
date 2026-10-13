type Point = { day: string; value: number };
type Slice = { label: string; value: number };

const COLORS = ["#0f766e", "#0e7490", "#4338ca", "#b45309", "#be123c", "#365314"];

function maxValue(points: Point[]) {
  return Math.max(1, ...points.map((point) => point.value));
}

export function LineChart({ points, format }: { points: Point[]; format?: (value: number) => string }) {
  const width = 560;
  const height = 180;
  const pad = 28;
  const max = maxValue(points);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const coords = points.map((point, index) => {
    const x = pad + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad + innerH - (point.value / max) * innerH;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img">
      <polyline fill="none" stroke="#0f766e" strokeWidth="2.5" points={coords.join(" ")} />
      {points.map((point, index) => {
        const [x, y] = coords[index].split(",");
        return <circle key={point.day} cx={x} cy={y} r="3" fill="#0f766e" />;
      })}
      <text x={pad} y={16} className="fill-slate-500" fontSize="11">
        {format ? format(max) : max}
      </text>
    </svg>
  );
}

export function BarChart({ points }: { points: Point[] }) {
  const max = maxValue(points);
  return (
    <div className="flex h-44 items-end gap-1">
      {points.map((point) => (
        <div key={point.day} className="flex h-full flex-1 flex-col justify-end" title={`${point.day}: ${point.value}`}>
          <div
            className="w-full rounded-t bg-teal-700"
            style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function StatBars({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  return (
    <ul className="flex flex-col gap-2">
      {slices.length === 0 ? <li className="text-sm text-slate-600">—</li> : null}
      {slices.map((slice, index) => (
        <li key={slice.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{slice.label}</span>
            <span className="font-medium">{slice.value}</span>
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
