import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Landmark, Send, ShieldAlert, Clock, Search } from 'lucide-react';
import { api, type AccessRequest, type Application } from '@/lib/api';
import { useLoad } from '@/lib/session';
import { Alert, Badge, Button, Card, Dialog, Empty, Field, Input, PageHeader, PageSkeleton, Select, Table, Tabs, Textarea, THead, TR, TD } from '@/components/ui';
import { useToast } from '@/components/toast';
import { fmtDate } from '@/lib/utils';

const RISK_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function MyAccess() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'apps' | 'requests') || 'apps';
  const apps = useLoad<{ applications: Application[] }>('/applications');
  const reqs = useLoad<{ requests: AccessRequest[] }>('/access-requests/mine');
  const [requesting, setRequesting] = React.useState<Application | null>(null);
  const [cancelling, setCancelling] = React.useState<AccessRequest | null>(null);
  const [filter, setFilter] = React.useState('');
  const toast = useToast();

  if (apps.error || reqs.error) return <Alert tone="red">{apps.error || reqs.error}</Alert>;
  if (!apps.data || !reqs.data) return <PageSkeleton />;
  const list = apps.data.applications
    .filter((a) => !filter || `${a.name} ${a.description} ${a.owner_department}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  const reload = () => { apps.reload(); reqs.reload(); };

  return (
    <div>
      <PageHeader title="My Access" description="Request access to FinTrust Bank applications. Every request is reviewed by an Access Manager." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={(v) => setParams(v === 'apps' ? {} : { tab: v })}
          tabs={[{ value: 'apps', label: 'Applications', count: apps.data.applications.length }, { value: 'requests', label: 'My requests', count: reqs.data.requests.length }]} />
        {tab === 'apps' && (
          <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Filter applications" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter applications" /></div>
        )}
      </div>

      {tab === 'apps' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <Card key={a.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-mono text-xs font-bold text-brand-700">{a.id}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold leading-snug text-slate-900">{a.name}</h3>
                  <p className="text-xs text-slate-500">{a.owner_department}</p>
                </div>
                <Badge>{a.risk}</Badge>
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-600">{a.description}</p>
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                {a.my_level ? <span className="flex items-center gap-1.5 text-sm text-slate-600">You have <Badge>{a.my_level}</Badge></span> : <span className="text-sm text-slate-400">No access</span>}
                {a.my_pending && <span className="flex items-center gap-1 text-xs text-amber-700"><Clock className="size-3.5" />{a.my_pending} pending</span>}
                <span className="flex-1" />
                {!a.my_pending && <Button size="sm" variant={a.my_level ? 'secondary' : 'primary'} onClick={() => setRequesting(a)}>{a.my_level ? 'Change level' : 'Request'}</Button>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          {reqs.data.requests.length ? (
            <Table>
              <THead cols={['Application', 'Level', 'Reason', 'Status', 'Requested', 'Reviewer note', '']} />
              <tbody>
                {reqs.data.requests.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium text-slate-900">{r.application_name}</TD>
                    <TD><Badge>{r.access_level}</Badge></TD>
                    <TD className="max-w-xs text-slate-500">{r.justification}</TD>
                    <TD><Badge dot>{r.status}</Badge></TD>
                    <TD className="whitespace-nowrap">{fmtDate(r.created_at)}</TD>
                    <TD className="max-w-xs">{r.reviewer_name ? <><span>{r.review_comment || '—'}</span><div className="text-xs text-slate-400">{r.reviewer_name}</div></> : <span className="text-slate-300">—</span>}</TD>
                    <TD>{r.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>Cancel</Button>}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : <Empty title="No requests yet" text="Open the Applications tab and request the access you need." />}
        </Card>
      )}

      {requesting && <RequestDialog app={requesting} onClose={() => setRequesting(null)} onDone={() => { setRequesting(null); toast('Request submitted. You will see the decision under My requests.'); setParams({ tab: 'requests' }); reload(); }} />}
      <Dialog open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel this request?" description="Reviewers will no longer see it."
        footer={<><Button variant="secondary" onClick={() => setCancelling(null)}>Keep it</Button>
          <Button variant="danger" onClick={async () => {
            try { await api(`/access-requests/${cancelling!.id}/cancel`, { method: 'POST', body: {} }); toast('Request cancelled.'); reload(); } catch (e: any) { toast(e.message, 'error'); }
            setCancelling(null);
          }}>Cancel request</Button></>} />
    </div>
  );
}

function RequestDialog({ app, onClose, onDone }: { app: Application; onClose: () => void; onDone: () => void }) {
  const levels = app.levels.filter((l) => l !== app.my_level);
  const [level, setLevel] = React.useState(levels[0]);
  const [why, setWhy] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/access-requests', { method: 'POST', body: { application_id: app.id, access_level: level, justification: why } }); onDone(); }
    catch (err: any) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={`Request access · ${app.name}`} description={app.description}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="req-form" type="submit" loading={busy} icon={<Send className="size-4" />}>Submit request</Button></>}>
      <form id="req-form" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="red">{error}</Alert>}
        {app.risk === 'critical' && <Alert tone="amber" icon={<ShieldAlert className="size-4" />} title="Critical system">"Admin" level must be approved by a System Administrator.</Alert>}
        <Field label="Access level" htmlFor="lvl" hint="Read = view only · Write = daily work · Admin = configure the system. Ask for the lowest level you need.">
          <Select id="lvl" value={level} onChange={(e) => setLevel(e.target.value)}>{levels.map((l) => <option key={l}>{l}</option>)}</Select>
        </Field>
        <Field label="Why do you need it?" htmlFor="why" hint={`${why.trim().length}/15 characters minimum`}>
          <Textarea id="why" maxLength={500} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. I process home loan files for Shivajinagar branch customers." />
        </Field>
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500"><Landmark className="size-4" />Owner: {app.owner_department} · Risk: {app.risk}</div>
      </form>
    </Dialog>
  );
}
