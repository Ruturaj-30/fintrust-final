import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, Unlock, KeyRound, MailPlus, LogOut, UserCog, PencilLine, PauseCircle, PlayCircle, UserX, Activity, ImageOff } from 'lucide-react';
import { usePhotos } from '@/lib/photos';
import { api, type Grant, type User, type AuditEntry } from '@/lib/api';
import { useLoad, useSession } from '@/lib/session';
import { Alert, Avatar, Badge, Button, Card, CardHeader, CopyField, DL, Dialog, Empty, Field, Input, PageSkeleton, Select, Table, THead, TR, TD } from '@/components/ui';
import { useToast } from '@/components/toast';
import { fmtDate, fmtTime, timeAgo } from '@/lib/utils';

interface Detail { user: User; grants: Grant[]; history: AuditEntry[]; reports: { id: string; full_name: string; designation: string }[]; sessions: number }
type Action = 'photo' | 'role' | 'details' | 'suspend' | 'activate' | 'disable' | 'unlock' | 'reset' | 'invite' | 'signout';

export function UserDetail() {
  const { id } = useParams();
  const { can, me } = useSession();
  const { data, error, reload } = useLoad<Detail>(`/users/${id}`, [id]);
  const [action, setAction] = React.useState<Action | null>(null);
  const { photos } = usePhotos();
  if (error) return <Alert tone="red">{error}</Alert>;
  if (!data) return <PageSkeleton />;
  const u = data.user;
  const self = u.id === me.user.id;
  const btn = (perm: string, a: Action, label: string, icon: React.ReactNode, show = true, variant: 'secondary' | 'danger' | 'success' = 'secondary') =>
    can(perm) && show ? <Button key={a} size="sm" variant={variant} icon={icon} onClick={() => setAction(a)}>{label}</Button> : null;
  const actions = self ? [] : [
    btn('users.change_role', 'role', 'Change role', <UserCog className="size-4" />),
    btn('users.edit_details', 'details', 'Edit details', <PencilLine className="size-4" />),
    btn('users.unlock', 'unlock', 'Unlock', <Unlock className="size-4" />, u.is_locked),
    btn('users.send_reset', 'reset', 'Send password reset', <KeyRound className="size-4" />, u.status === 'active'),
    btn('users.resend_invite', 'invite', 'Re-send invitation', <MailPlus className="size-4" />, u.status === 'invited'),
    btn('users.edit_details', 'photo', 'Remove photo', <ImageOff className="size-4" />, Boolean(photos[u.id])),
    btn('sessions.revoke', 'signout', 'Sign out everywhere', <LogOut className="size-4" />, !!u.signed_in_now),
    btn('users.change_status', 'activate', 'Re-activate', <PlayCircle className="size-4" />, ['suspended', 'disabled'].includes(u.status) && u.has_password, 'success'),
    btn('users.change_status', 'suspend', 'Suspend', <PauseCircle className="size-4" />, u.status === 'active', 'danger'),
    btn('users.change_status', 'disable', 'Disable (leaver)', <UserX className="size-4" />, ['active', 'suspended'].includes(u.status), 'danger'),
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <Link to="/app/users" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" />Staff &amp; Accounts</Link>
      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={u.full_name} userId={u.id} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{u.full_name}</h1>
              <Badge dot>{u.status}</Badge>{u.is_locked && <Badge tone="red"><Lock className="size-3" />Locked</Badge>}
              {u.signed_in_now && <Badge tone="green"><Activity className="size-3" />Online</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">{u.designation} · {u.department} · {u.branch_name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="blue">{u.role}</Badge><Badge tone="slate">{u.employee_id}</Badge></div>
          </div>
        </div>
        {self ? <div className="mt-5"><Link to="/app/profile" className="text-sm font-medium text-brand-700 hover:underline">This is you. Open My Profile →</Link></div>
          : actions.length > 0 && <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">{actions}</div>}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Account" icon={<ShieldCheck className="size-4" />} />
          <div className="px-5 py-2">
            <DL items={[
              ['Email', u.email], ['Mobile', u.phone || '—'], ['Reports to', u.manager_name || '—'],
              ['Locked until', u.is_locked ? fmtTime(u.locked_until) : 'Not locked'],
              ['Last sign-in', u.last_login_at ? `${fmtTime(u.last_login_at)} (${timeAgo(u.last_login_at)})` : 'Never'],
              ['Password changed', fmtDate(u.password_changed_at)], ['Account created', fmtDate(u.created_at)],
              ['Team members', data.reports.length ? data.reports.map((r, i) => <React.Fragment key={r.id}>{i ? ', ' : ''}<Link className="text-brand-700 hover:underline" to={`/app/users/${r.id}`}>{r.full_name}</Link></React.Fragment>) : '—'],
            ]} />
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Application access" description={`${data.grants.filter((g) => g.status === 'active').length} active`} />
          {data.grants.length ? (
            <Table><THead cols={['Application', 'Level', 'Status', 'Since']} />
              <tbody>{data.grants.map((g) => <TR key={g.id}><TD className="font-medium text-slate-800">{g.application_name}</TD><TD><Badge>{g.access_level}</Badge></TD><TD><Badge dot>{g.status}</Badge></TD><TD className="whitespace-nowrap">{fmtDate(g.granted_at)}</TD></TR>)}</tbody>
            </Table>
          ) : <Empty title="No application access" />}
        </Card>
      </div>

      {data.history.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Recent activity" description="From the audit trail" />
          <ol className="divide-y divide-slate-100">
            {data.history.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${e.outcome === 'success' ? 'bg-emerald-500' : e.outcome === 'denied' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                <div className="min-w-0 flex-1"><div className="text-sm text-slate-800">{e.action}</div><div className="text-xs text-slate-500">{e.actor_name} · {e.actor_role}</div></div>
                <div className="whitespace-nowrap text-xs text-slate-400">{fmtTime(e.at)}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {action && <ActionDialog action={action} user={u} onClose={() => setAction(null)} onDone={() => { setAction(null); reload(); }} />}
    </div>
  );
}

const STATUS_TEXT = {
  activate: { title: 'Re-activate account', text: 'They will be able to sign in again.', status: 'active', label: 'Re-activate', variant: 'success' },
  suspend: { title: 'Suspend account', text: 'They are signed out immediately and cannot sign in until re-activated. Their access is kept.', status: 'suspended', label: 'Suspend', variant: 'danger' },
  disable: { title: 'Disable account (leaver)', text: 'For staff who leave the bank. They are signed out, ALL their application access is revoked, and pending requests are cancelled.', status: 'disabled', label: 'Disable', variant: 'danger' },
} as const;

function ActionDialog({ action, user: u, onClose, onDone }: { action: Action; user: User; onClose: () => void; onDone: () => void }) {
  const { meta } = useSession();
  const toast = useToast();
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [role, setRole] = React.useState(u.role);
  const [details, setDetails] = React.useState({ designation: u.designation, phone: u.phone || '', department: u.department, branch_id: u.branch_id, manager_id: u.manager_id || '' });
  const [managers, setManagers] = React.useState<User[]>([]);
  const [link, setLink] = React.useState<string | null>(null);
  const { reload: reloadPhotos } = usePhotos();
  React.useEffect(() => { if (action === 'details') api<{ users: User[] }>('/users?status=active').then((r) => setManagers(r.users.filter((m) => m.id !== u.id))).catch(() => {}); }, [action, u.id]);

  const run = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true); setError('');
    try {
      const r = await fn();
      toast(typeof msg === 'string' ? msg : 'Done.');
      if (r && r.link) { setLink(r.link); setBusy(false); return; }
      onDone();
    } catch (err: any) { setError(err.message); setBusy(false); }
  };

  if (link) {
    return (
      <Dialog open onClose={onDone} title="One-time link" description="Sent by email. For your demo (or if the email failed), here is the same link:" footer={<Button onClick={onDone}>Done</Button>}>
        <CopyField value={link} />
      </Dialog>
    );
  }

  let title = ''; let description: React.ReactNode = ''; let body: React.ReactNode = null; let confirm = 'Confirm'; let variant: 'primary' | 'danger' | 'success' = 'primary'; let submit = () => {};
  if (action === 'role') {
    title = `Change role · ${u.full_name}`; description = 'They are signed out so the new permissions apply at the next sign-in.'; confirm = 'Change role';
    body = (<>
      <Field label="New role" htmlFor="role"><Select id="role" value={role} onChange={(e) => setRole(e.target.value)}>{meta.roles.map((r) => <option key={r.name}>{r.name}</option>)}</Select></Field>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{meta.roles.find((r) => r.name === role)?.description}</p>
      <Field label="Reason (saved in the audit trail)" htmlFor="reason"><Input id="reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Promoted to Access Manager" /></Field>
    </>);
    submit = () => run(() => api(`/users/${u.id}/role`, { method: 'PATCH', body: { role, reason } }), 'Role changed.');
  } else if (action === 'details') {
    title = `Edit details · ${u.full_name}`; confirm = 'Save changes';
    const d = (k: keyof typeof details) => ({ id: k, value: details[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDetails({ ...details, [k]: e.target.value }) });
    body = (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Designation" htmlFor="designation"><Input {...d('designation')} /></Field>
        <Field label="Mobile" htmlFor="phone"><Input {...d('phone')} /></Field>
        <Field label="Department" htmlFor="department"><Select {...d('department')}>{meta.departments.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Branch" htmlFor="branch_id"><Select {...d('branch_id')}>{meta.branches.map((b) => <option key={b.id} value={b.id}>{b.city} · {b.name}</option>)}</Select></Field>
        <Field label="Reports to" htmlFor="manager_id" className="sm:col-span-2"><Select {...d('manager_id')}><option value="">None</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select></Field>
      </div>
    );
    submit = () => run(() => api(`/users/${u.id}/details`, { method: 'PATCH', body: details }), 'Details saved.');
  } else if (action === 'suspend' || action === 'activate' || action === 'disable') {
    const t = STATUS_TEXT[action];
    title = `${t.title} · ${u.full_name}`; description = t.text; confirm = t.label; variant = t.variant;
    body = <Field label="Reason (saved in the audit trail)" htmlFor="reason"><Input id="reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>;
    submit = () => run(() => api(`/users/${u.id}/status`, { method: 'PATCH', body: { status: t.status, reason } }), action === 'disable' ? 'Account disabled and all access revoked.' : 'Status updated.');
  } else if (action === 'unlock') {
    title = 'Unlock account'; description = `${u.full_name} will be able to sign in again straight away.`; confirm = 'Unlock';
    submit = () => run(() => api(`/users/${u.id}/unlock`, { method: 'POST', body: {} }), 'Account unlocked.');
  } else if (action === 'reset') {
    title = 'Send password reset link'; description = `${u.full_name} gets an email with a one-time link. You never see or set their password.`; confirm = 'Send link';
    submit = () => run(() => api(`/users/${u.id}/send-reset`, { method: 'POST', body: {} }), 'Reset link sent.');
  } else if (action === 'invite') {
    title = 'Re-send invitation'; description = 'A new link is emailed. The old one stops working.'; confirm = 'Re-send';
    submit = () => run(() => api(`/users/${u.id}/resend-invite`, { method: 'POST', body: {} }), 'Invitation sent again.');
  } else if (action === 'photo') {
    title = `Remove photo · ${u.full_name}`; confirm = 'Remove photo'; variant = 'danger';
    description = 'Use this for an unsuitable or outdated photo. A photo is required, so they must upload a new one at their next request before they can continue.';
    submit = () => run(async () => { const r = await api(`/users/${u.id}/photo`, { method: 'DELETE', body: {} }); await reloadPhotos(); return r; }, 'Photo removed. They must add a new one.');
  } else if (action === 'signout') {
    title = 'Sign out everywhere'; description = `Ends every active session of ${u.full_name}.`; confirm = 'Sign out'; variant = 'danger';
    submit = () => run(() => api(`/users/${u.id}/revoke-sessions`, { method: 'POST', body: {} }), 'Signed out of all sessions.');
  }

  return (
    <Dialog open wide={action === 'details'} onClose={onClose} title={title} description={description}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="act" type="submit" variant={variant} loading={busy}>{confirm}</Button></>}>
      <form id="act" className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {error && <Alert tone="red">{error}</Alert>}
        {body || <p className="text-sm text-slate-600">Please confirm.</p>}
      </form>
    </Dialog>
  );
}
