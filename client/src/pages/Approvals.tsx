import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, X, ShieldAlert, PartyPopper } from 'lucide-react';
import { api, type AccessRequest } from '@/lib/api';
import { useLoad, useSession } from '@/lib/session';
import { Alert, Avatar, Badge, Button, Card, Dialog, Empty, Field, PageHeader, PageSkeleton, Table, Tabs, Textarea, THead, TR, TD } from '@/components/ui';
import { useToast } from '@/components/toast';
import { fmtDate, timeAgo } from '@/lib/utils';

export function Approvals() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'pending' | 'history') || 'pending';
  const { data, error, reload } = useLoad<{ requests: AccessRequest[] }>(tab === 'pending' ? '/access-requests?status=pending' : '/access-requests');
  const [deciding, setDeciding] = React.useState<{ r: AccessRequest; approve: boolean } | null>(null);
  const { refresh } = useSession();

  if (error) return <Alert tone="red">{error}</Alert>;
  const rows = data ? (tab === 'pending' ? data.requests : data.requests.filter((r) => r.status !== 'pending')) : [];

  return (
    <div>
      <PageHeader title="Approvals" description="Review access requests. Segregation of duties: you can never approve your own request." />
      <div className="mb-5"><Tabs value={tab} onChange={(v) => setParams(v === 'pending' ? {} : { tab: v })} tabs={[{ value: 'pending', label: 'Waiting for review', count: tab === 'pending' && data ? rows.length : undefined }, { value: 'history', label: 'Decided' }]} /></div>
      {!data ? <PageSkeleton /> : (
        <Card className="overflow-hidden">
          {rows.length === 0 ? <Empty icon={<PartyPopper className="size-6" />} title={tab === 'pending' ? 'All caught up' : 'No decisions yet'} text={tab === 'pending' ? 'There are no requests waiting for review.' : undefined} /> : (
            <Table>
              <THead cols={tab === 'pending' ? ['Employee', 'Application', 'Level', 'Reason given', 'Waiting', 'Decision'] : ['Employee', 'Application', 'Level', 'Status', 'Reviewer', 'Decided']} />
              <tbody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.user_name} userId={r.user_id} size="sm" />
                        <div><Link to={`/app/users/${r.user_id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.user_name}</Link><div className="text-xs text-slate-500">{r.user_department}</div></div>
                      </div>
                    </TD>
                    <TD><div className="font-medium text-slate-800">{r.application_name}</div><Badge className="mt-1">{r.application_risk}</Badge></TD>
                    <TD><Badge>{r.access_level}</Badge></TD>
                    {tab === 'pending' ? (
                      <>
                        <TD className="max-w-sm text-slate-600">{r.justification}</TD>
                        <TD className="whitespace-nowrap text-slate-500">{timeAgo(r.created_at).replace(' ago', '')}</TD>
                        <TD>
                          {r.can_review ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="success" icon={<Check className="size-4" />} onClick={() => setDeciding({ r, approve: true })}>Approve</Button>
                              <Button size="sm" variant="secondary" icon={<X className="size-4" />} onClick={() => setDeciding({ r, approve: false })}>Reject</Button>
                            </div>
                          ) : <div className="flex max-w-[220px] items-start gap-1.5 text-xs text-slate-500"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />{r.review_block}</div>}
                        </TD>
                      </>
                    ) : (
                      <>
                        <TD><Badge dot>{r.status}</Badge></TD>
                        <TD><div>{r.reviewer_name || '—'}</div>{r.review_comment && <div className="max-w-xs text-xs text-slate-500">{r.review_comment}</div>}</TD>
                        <TD className="whitespace-nowrap">{fmtDate(r.reviewed_at)}</TD>
                      </>
                    )}
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
      {deciding && <DecisionDialog {...deciding} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); reload(); refresh(); }} />}
    </div>
  );
}

function DecisionDialog({ r, approve, onClose, onDone }: { r: AccessRequest; approve: boolean; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api(`/access-requests/${r.id}/decision`, { method: 'POST', body: { decision: approve ? 'approve' : 'reject', comment } });
      toast(approve ? `Approved. ${r.user_name} now has ${r.access_level} access to ${r.application_name}.` : 'Request rejected.');
      onDone();
    } catch (err: any) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={approve ? 'Approve and grant access' : 'Reject request'}
      description={`${r.user_name} · ${r.application_name} (${r.access_level})`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="dec" type="submit" variant={approve ? 'success' : 'danger'} loading={busy}>{approve ? 'Approve' : 'Reject'}</Button></>}>
      <form id="dec" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="red">{error}</Alert>}
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><span className="font-medium text-slate-800">Reason given:</span> {r.justification}</div>
        <Field label={approve ? 'Comment (optional)' : 'Reason for rejection'} htmlFor="cmt">
          <Textarea id="cmt" maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={approve ? 'e.g. Approved for the loan audit project.' : 'e.g. Read access is enough for your role.'} />
        </Field>
      </form>
    </Dialog>
  );
}
