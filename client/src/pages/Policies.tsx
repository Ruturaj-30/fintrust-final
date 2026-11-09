import * as React from 'react';
import { Save, KeyRound, Lock, Timer, MailCheck, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useLoad, useSession } from '@/lib/session';
import { Alert, Button, Card, CardHeader, Field, Input, PageHeader, PageSkeleton } from '@/components/ui';
import { useToast } from '@/components/toast';
import { fmtTime } from '@/lib/utils';

interface Rule { label: string; min: number; max: number; unit: string }
interface PolicyData { values: Record<string, number>; rules: Record<string, Rule>; defaults: Record<string, number>; updated_at: string | null; updated_by: string | null }

const GROUPS = [
  { title: 'Passwords', icon: KeyRound, keys: ['password_min_length'] },
  { title: 'Lockout', icon: Lock, keys: ['max_failed_logins', 'lockout_minutes'] },
  { title: 'Sign-in codes', icon: MailCheck, keys: ['otp_expiry_minutes', 'otp_max_attempts'] },
  { title: 'Sessions', icon: Timer, keys: ['session_idle_minutes', 'session_max_hours'] },
  { title: 'One-time links', icon: RotateCcw, keys: ['invite_expiry_hours', 'reset_expiry_minutes'] },
];

export function Policies() {
  const { can } = useSession();
  const edit = can('policies.manage');
  const { data, error, reload } = useLoad<PolicyData>('/policies');
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const toast = useToast();
  React.useEffect(() => { if (data) setValues(Object.fromEntries(Object.entries(data.values).map(([k, v]) => [k, String(v)]))); }, [data]);
  if (error) return <Alert tone="red">{error}</Alert>;
  if (!data) return <PageSkeleton />;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await api('/policies', { method: 'PUT', body: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) });
      toast(r.changed ? `Security policy saved (${r.changed} change${r.changed === 1 ? '' : 's'}).` : 'Nothing changed.');
      reload();
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save}>
      <PageHeader title="Security Policy" description={edit ? 'Rules applied to every staff account. Every change is recorded in the audit trail.' : 'Read-only view of the rules applied to every staff account.'}
        actions={edit ? <Button type="submit" loading={busy} icon={<Save className="size-4" />}>Save policy</Button> : undefined} />
      {err && <div className="mb-4"><Alert tone="red">{err}</Alert></div>}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <Card key={g.title}>
            <CardHeader title={g.title} icon={<g.icon className="size-4" />} />
            <div className="space-y-4 p-5">
              {g.keys.map((k) => {
                const r = data.rules[k];
                return (
                  <Field key={k} label={r.label} htmlFor={k} hint={`${r.min}–${r.max} ${r.unit} · default ${data.defaults[k]}`}>
                    <div className="relative">
                      <Input id={k} type="number" min={r.min} max={r.max} disabled={!edit} value={values[k] ?? ''} onChange={(e) => setValues({ ...values, [k]: e.target.value })} className="pr-24" />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{r.unit}</span>
                    </div>
                  </Field>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      {data.updated_by && <p className="mt-4 text-xs text-slate-500">Last changed by {data.updated_by} on {fmtTime(data.updated_at)}</p>}
    </form>
  );
}
