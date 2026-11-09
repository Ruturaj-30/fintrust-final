import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Lock, Download } from 'lucide-react';
import { api, type User } from '@/lib/api';
import { useLoad, useSession } from '@/lib/session';
import { Alert, Avatar, Badge, Button, Card, CopyField, Dialog, Empty, Field, Input, PageHeader, PageSkeleton, Select, Table, THead, TR, TD } from '@/components/ui';
import { useToast } from '@/components/toast';
import { timeAgo } from '@/lib/utils';

export function Users() {
  const { meta, can } = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = React.useState(params.get('q') || '');
  React.useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  const { data, error, reload } = useLoad<{ users: User[] }>(`/users?${params.toString()}`);
  const [inviting, setInviting] = React.useState(false);
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };
  React.useEffect(() => {
    const t = setTimeout(() => { if ((params.get('q') || '') !== q) set('q', q); }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    if (!data) return;
    const head = ['Employee ID', 'Name', 'Email', 'Role', 'Status', 'Department', 'Branch', 'Designation', 'Last sign-in'];
    const lines = data.users.map((u) => [u.employee_id, u.full_name, u.email, u.role, u.is_locked ? 'locked' : u.status, u.department, u.branch_name, u.designation, u.last_login_at || ''].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    const url = URL.createObjectURL(new Blob([`﻿${head.join(',')}\n${lines.join('\n')}`], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'fintrust-staff.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Staff & Accounts" description="Everyone who works at FinTrust Bank and the state of their account."
        actions={<>
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv}>Export</Button>
          {can('users.invite') && <Button icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>Invite staff member</Button>}
        </>} />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative md:col-span-2 xl:col-span-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, employee ID" aria-label="Search staff" /></div>
          <Select value={params.get('role') || ''} onChange={(e) => set('role', e.target.value)} aria-label="Role"><option value="">All roles</option>{meta.roles.map((r) => <option key={r.name}>{r.name}</option>)}</Select>
          <Select value={params.get('status') || ''} onChange={(e) => set('status', e.target.value)} aria-label="Status"><option value="">All statuses</option>{[...meta.statuses, 'locked'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</Select>
          <Select value={params.get('department') || ''} onChange={(e) => set('department', e.target.value)} aria-label="Department"><option value="">All departments</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}</Select>
          <Select value={params.get('branch') || ''} onChange={(e) => set('branch', e.target.value)} aria-label="Branch"><option value="">All branches</option>{meta.branches.map((b) => <option key={b.id} value={b.id}>{b.city} · {b.name}</option>)}</Select>
        </div>
      </Card>
      {error ? <Alert tone="red">{error}</Alert> : !data ? <PageSkeleton /> : (
        <Card className="overflow-hidden">
          {data.users.length === 0 ? <Empty title="No staff match these filters" /> : (
            <Table>
              <THead cols={['Name', 'Role', 'Department · Branch', 'Status', 'Last sign-in', 'Apps']} />
              <tbody>
                {data.users.map((u) => (
                  <TR key={u.id} onClick={() => navigate(`/app/users/${u.id}`)}>
                    <TD><div className="flex items-center gap-3"><Avatar name={u.full_name} userId={u.id} /><div className="min-w-0"><div className="font-medium text-slate-900">{u.full_name}</div><div className="truncate text-xs text-slate-500">{u.employee_id} · {u.email}</div></div></div></TD>
                    <TD className="whitespace-nowrap">{u.role}</TD>
                    <TD><div>{u.department}</div><div className="text-xs text-slate-500">{u.branch_city}</div></TD>
                    <TD><div className="flex flex-wrap gap-1"><Badge dot>{u.status}</Badge>{u.is_locked && <Badge tone="red"><Lock className="size-3" />Locked</Badge>}</div></TD>
                    <TD className="whitespace-nowrap text-slate-500">{u.last_login_at ? timeAgo(u.last_login_at) : 'never'}</TD>
                    <TD className="tabular-nums">{u.active_access}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{data.users.length} staff member(s)</div>
        </Card>
      )}
      {inviting && <InviteDialog onClose={() => setInviting(false)} onDone={(id) => { setInviting(false); reload(); navigate(`/app/users/${id}`); }} />}
    </div>
  );
}

function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { meta } = useSession();
  const toast = useToast();
  const [form, setForm] = React.useState({ full_name: '', email: '', role: 'Employee', designation: '', department: '', branch_id: '', phone: '', manager_id: '' });
  const [managers, setManagers] = React.useState<User[]>([]);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ id: string; link?: string; emailSent: boolean; name: string } | null>(null);
  React.useEffect(() => { api<{ users: User[] }>('/users?status=active').then((r) => setManagers(r.users)).catch(() => {}); }, []);
  const f = (k: keyof typeof form) => ({ id: k, value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value }) });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api('/users/invite', { method: 'POST', body: form });
      toast(`${r.user.full_name} has been invited.`);
      if (r.link) setResult({ id: r.user.id, link: r.link, emailSent: r.emailSent, name: r.user.full_name });
      else onDone(r.user.id);
    } catch (err: any) { setError(err.message); setBusy(false); }
  };
  if (result) {
    return (
      <Dialog open onClose={() => onDone(result.id)} title="Invitation created" description={result.emailSent ? `An email was sent to ${result.name}. You can also share the link below.` : 'The email could not be sent. Share this one-time link yourself (WhatsApp, email…).'}
        footer={<Button onClick={() => onDone(result.id)}>Done</Button>}>
        <CopyField value={result.link!} />
        <p className="mt-2 text-xs text-slate-500">The link works once and expires. Nobody except the new staff member ever knows their password.</p>
      </Dialog>
    );
  }
  return (
    <Dialog open wide onClose={onClose} title="Invite a new staff member" description="They receive a one-time link to set their own password."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="inv" type="submit" loading={busy} icon={<UserPlus className="size-4" />}>Send invitation</Button></>}>
      <form id="inv" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="red">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full_name"><Input {...f('full_name')} placeholder="e.g. Ananya Iyer" maxLength={80} /></Field>
          <Field label="Email" htmlFor="email"><Input {...f('email')} type="email" placeholder="name@gmail.com" /></Field>
          <Field label="Role" htmlFor="role"><Select {...f('role')}>{meta.roles.map((r) => <option key={r.name}>{r.name}</option>)}</Select></Field>
          <Field label="Designation" htmlFor="designation"><Input {...f('designation')} placeholder="e.g. Relationship Manager" maxLength={80} /></Field>
          <Field label="Department" htmlFor="department"><Select {...f('department')}><option value="">Choose…</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Branch" htmlFor="branch_id"><Select {...f('branch_id')}><option value="">Choose…</option>{meta.branches.map((b) => <option key={b.id} value={b.id}>{b.city} · {b.name}</option>)}</Select></Field>
          <Field label="Mobile (optional)" htmlFor="phone"><Input {...f('phone')} placeholder="+91 98200 12345" /></Field>
          <Field label="Reporting manager (optional)" htmlFor="manager_id"><Select {...f('manager_id')}><option value="">None</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.designation})</option>)}</Select></Field>
        </div>
        <p className="text-xs text-slate-500">{meta.roles.find((r) => r.name === form.role)?.description}</p>
      </form>
    </Dialog>
  );
}
