import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Ban } from 'lucide-react';
import { api, type Grant } from '@/lib/api';
import { useLoad, useSession } from '@/lib/session';
import { Alert, Avatar, Badge, Button, Card, Dialog, Empty, Field, Input, PageHeader, PageSkeleton, Select, Table, THead, TR, TD } from '@/components/ui';
import { useToast } from '@/components/toast';
import { fmtDate } from '@/lib/utils';

export function AccessRegister() {
  const { meta, can, me } = useSession();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'active';
  const application = params.get('application') || '';
  const [q, setQ] = React.useState(params.get('q') || '');
  const qs = new URLSearchParams({ status, ...(application ? { application } : {}) }).toString();
  const { data, error, reload } = useLoad<{ grants: Grant[] }>(`/access-grants?${qs}`);
  const [revoking, setRevoking] = React.useState<Grant | null>(null);
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  if (error) return <Alert tone="red">{error}</Alert>;
  const rows = (data?.grants || []).filter((g) => !q || `${g.user_name} ${g.user_employee_id} ${g.application_name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Access Register" description="Who can use which bank application, at what level, and who approved it." />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[2fr_1.4fr_1fr]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, employee ID, application" aria-label="Search" /></div>
          <Select value={application} onChange={(e) => set('application', e.target.value)} aria-label="Application">
            <option value="">All applications</option>{meta.applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => set('status', e.target.value === 'active' ? '' : e.target.value)} aria-label="Status">
            <option value="active">Active access</option><option value="revoked">Revoked</option><option value="all">All</option>
          </Select>
        </div>
      </Card>
      {!data ? <PageSkeleton /> : (
        <Card className="overflow-hidden">
          {rows.length === 0 ? <Empty title="No access records match" /> : (
            <Table>
              <THead cols={['Employee', 'Application', 'Level', 'Granted', 'Status', '']} />
              <tbody>
                {rows.map((g) => (
                  <TR key={g.id}>
                    <TD><div className="flex items-center gap-3"><Avatar name={g.user_name} userId={g.user_id} size="sm" /><div><Link to={`/app/users/${g.user_id}`} className="font-medium text-slate-900 hover:text-brand-700">{g.user_name}</Link><div className="text-xs text-slate-500">{g.user_employee_id} · {g.user_department}</div></div></div></TD>
                    <TD><div className="font-medium text-slate-800">{g.application_name}</div><Badge className="mt-1">{g.application_risk}</Badge></TD>
                    <TD><Badge>{g.access_level}</Badge></TD>
                    <TD className="whitespace-nowrap">{fmtDate(g.granted_at)}<div className="text-xs text-slate-500">by {g.granted_by_name}</div></TD>
                    <TD><Badge dot>{g.status}</Badge>{g.revoke_reason && <div className="mt-1 max-w-[200px] text-xs text-slate-500">{g.revoke_reason}</div>}</TD>
                    <TD>{g.status === 'active' && can('access.revoke') && g.user_id !== me.user.id && <Button size="sm" variant="ghost" icon={<Ban className="size-4" />} onClick={() => setRevoking(g)}>Revoke</Button>}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{rows.length} record(s)</div>
        </Card>
      )}
      {revoking && <RevokeDialog g={revoking} onClose={() => setRevoking(null)} onDone={() => { setRevoking(null); reload(); }} />}
    </div>
  );
}

function RevokeDialog({ g, onClose, onDone }: { g: Grant; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api(`/access-grants/${g.id}/revoke`, { method: 'POST', body: { reason } }); toast('Access revoked.'); onDone(); }
    catch (err: any) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title="Revoke access" description={`${g.application_name} (${g.access_level}) for ${g.user_name}. Takes effect immediately.`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="rv" type="submit" variant="danger" loading={busy}>Revoke</Button></>}>
      <form id="rv" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="red">{error}</Alert>}
        <Field label="Reason" htmlFor="rsn"><Input id="rsn" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Moved to another department" /></Field>
      </form>
    </Dialog>
  );
}
