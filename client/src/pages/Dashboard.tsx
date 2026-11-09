// One dashboard for every role. The SERVER decides which numbers, charts
// and tables each role gets; this page only draws them.
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, MailPlus, Lock, ClipboardCheck, ShieldAlert, Activity, AppWindow, Hourglass, CheckCircle2, XCircle,
  Timer, ScrollText, ShieldCheck, Crown, Moon, UserX, ArrowUpRight, KeyRound, CalendarDays, MapPin,
} from 'lucide-react';
import { useLoad, useSession } from '@/lib/session';
import { Badge, Card, CardHeader, Empty, PageHeader, PageSkeleton, Alert, Table, THead, TR, TD } from '@/components/ui';
import { Chart, type ChartSpec } from '@/components/Charts';
import { cn, fmtDate, greeting, timeAgo } from '@/lib/utils';

interface Stat { label: string; value: number | string; tone: string; link: string }
interface Panel { title: string; columns: string[]; rows: Record<string, any>[]; link: string; empty: string }
interface DashboardData { role: string; roleInfo: string; stats: Stat[]; charts: ChartSpec[]; panels: Panel[] }

const ICON_RULES: [RegExp, React.ElementType][] = [
  [/staff accounts/i, Users], [/^active/i, UserCheck], [/invited|activate/i, MailPlus], [/locked/i, Lock],
  [/pending approvals|waiting for review/i, ClipboardCheck], [/alert|blocked|failed/i, ShieldAlert], [/signed in/i, Activity],
  [/my applications/i, AppWindow], [/pending requests/i, Hourglass], [/approved/i, CheckCircle2], [/rejected/i, XCircle],
  [/oldest|decision time/i, Timer], [/audit entries/i, ScrollText], [/audit chain/i, ShieldCheck], [/admin-level/i, Crown],
  [/dormant/i, Moon], [/leavers/i, UserX],
];
const iconFor = (label: string) => (ICON_RULES.find(([r]) => r.test(label)) || [null, KeyRound])[1];

const TONE: Record<string, { ring: string; icon: string; value: string }> = {
  blue: { ring: 'bg-brand-50 ring-brand-100', icon: 'text-brand-700', value: 'text-slate-900' },
  green: { ring: 'bg-emerald-50 ring-emerald-100', icon: 'text-emerald-700', value: 'text-slate-900' },
  amber: { ring: 'bg-amber-50 ring-amber-100', icon: 'text-amber-700', value: 'text-slate-900' },
  red: { ring: 'bg-rose-50 ring-rose-100', icon: 'text-rose-700', value: 'text-rose-700' },
  neutral: { ring: 'bg-slate-50 ring-slate-200', icon: 'text-slate-500', value: 'text-slate-900' },
};

function StatCard({ s }: { s: Stat }) {
  const Icon = iconFor(s.label);
  const t = TONE[s.tone] || TONE.neutral;
  const body = (
    <Card className={cn('group h-full p-5 transition-colors', s.link && 'hover:border-brand-300')}>
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-slate-500">{s.label}</div>
        <div className={cn('rounded-md p-1.5 ring-1', t.ring)}><Icon className={cn('size-4', t.icon)} /></div>
      </div>
      <div className={cn('mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums', t.value)}>{s.value}</div>
      {s.link && <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors group-hover:text-brand-700">View details<ArrowUpRight className="size-3.5" /></div>}
    </Card>
  );
  if (!s.link) return body;
  const [p, q] = s.link.split('?');
  return <Link to={{ pathname: p === 'dashboard' ? '/app' : `/app/${p}`, search: q ? `?${q}` : '' }} className="block">{body}</Link>;
}

function Cell({ v }: { v: any }) {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300">—</span>;
  if (typeof v !== 'object') return <>{String(v)}</>;
  if (v.badge !== undefined) return <Badge>{v.badge}</Badge>;
  if (v.date !== undefined) return <span className="whitespace-nowrap">{fmtDate(v.date)}</span>;
  if (v.time !== undefined) return <span className="whitespace-nowrap text-slate-500">{timeAgo(v.time)}</span>;
  if (v.since !== undefined) return <span className="whitespace-nowrap">{timeAgo(v.since).replace(' ago', '')}</span>;
  if (v.user !== undefined) return <Link className="font-medium text-brand-700 hover:underline" to={`/app/users/${v.user}`}>{v.text}</Link>;
  return null;
}

function linkTo(link: string) {
  const [p, q] = link.split('?');
  return { pathname: `/app/${p}`, search: q ? `?${q}` : '' };
}

export function Dashboard() {
  const { me } = useSession();
  const { data, error } = useLoad<DashboardData>('/dashboard');
  if (error) return <Alert tone="red">{error}</Alert>;
  if (!data) return <PageSkeleton />;
  const [mainChart, ...otherCharts] = data.charts;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={data.role} title={`${greeting()}, ${me.user.full_name.split(' ')[0]}`} description={data.roleInfo}
        actions={<div className="flex flex-col items-end gap-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{me.user.branch_name}</span>
        </div>} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {data.stats.map((s) => <StatCard key={s.label} s={s} />)}
      </div>

      {mainChart && (
        <div className={cn('grid gap-6', otherCharts.length ? (mainChart.type === 'area' ? 'xl:grid-cols-3' : 'xl:grid-cols-2') : '')}>
          <Card className={cn(otherCharts.length && mainChart.type === 'area' ? 'xl:col-span-2' : '')}>
            <CardHeader title={mainChart.title} />
            <div className="p-4 sm:p-5"><Chart spec={mainChart} /></div>
          </Card>
          {otherCharts.map((c) => (
            <Card key={c.title} className={cn(c.type === 'bar' && mainChart.type === 'area' ? 'xl:col-span-3' : '')}>
              <CardHeader title={c.title} />
              <div className="p-4 sm:p-5"><Chart spec={c} height={240} /></div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {data.panels.map((p) => (
          <Card key={p.title} className="overflow-hidden">
            <CardHeader title={p.title} action={p.link ? <Link to={linkTo(p.link)} className="text-xs font-medium text-brand-700 hover:underline">View all</Link> : undefined} />
            {p.rows.length ? (
              <Table>
                <THead cols={p.columns} />
                <tbody>{p.rows.map((r, i) => <TR key={i}>{p.columns.map((c) => <TD key={c}><Cell v={r[c]} /></TD>)}</TR>)}</tbody>
              </Table>
            ) : <Empty title={p.empty} />}
          </Card>
        ))}
      </div>
    </div>
  );
}
