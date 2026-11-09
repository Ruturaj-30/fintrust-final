import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export interface ChartSpec {
  type: 'area' | 'bar' | 'donut';
  title: string;
  data: Record<string, any>[];
  series: { key: string; label: string; color: string }[];
}

const axis = { fontSize: 11, fill: '#64748b' };

export function Chart({ spec, height = 260 }: { spec: ChartSpec; height?: number }) {
  if (spec.type === 'donut') {
    const total = spec.data.reduce((s, d) => s + (d.value || 0), 0);
    const data = spec.data.filter((d) => d.value > 0);
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-[200px] w-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {data.map((d) => <Cell key={d.label} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500">total</span>
          </div>
        </div>
        <ul className="grid w-full grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {spec.data.map((d) => (
            <li key={d.label} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-sm" ref={(el) => { if (el) el.style.backgroundColor = d.color; }} />
              <span className="flex-1 text-slate-600">{d.label}</span>
              <span className="font-semibold tabular-nums text-slate-900">{d.value}</span>
              <span className="w-10 text-right text-xs tabular-nums text-slate-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (spec.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={spec.data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={0} angle={spec.data.length > 6 ? -30 : 0} textAnchor={spec.data.length > 6 ? 'end' : 'middle'} height={spec.data.length > 6 ? 50 : 30} />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} />
          <Bar isAnimationActive={false} dataKey="value" name={spec.series[0]?.label} radius={[6, 6, 0, 0]} maxBarSize={42}>
            {spec.data.map((d) => <Cell key={d.label} fill={d.color || spec.series[0]?.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={spec.data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          {spec.series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {spec.series.map((s) => (
          <Area isAnimationActive={false} key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
