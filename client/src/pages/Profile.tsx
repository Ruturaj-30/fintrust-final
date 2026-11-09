import * as React from 'react';
import { Link } from 'react-router-dom';
import { Phone, KeyRound, ShieldCheck, AppWindow } from 'lucide-react';
import { api, type Grant, type User } from '@/lib/api';
import { useLoad, useSession } from '@/lib/session';
import { Alert, Avatar, Badge, Button, Card, CardHeader, DL, Empty, Field, Input, PageHeader, PageSkeleton } from '@/components/ui';
import { useToast } from '@/components/toast';
import { PhotoUploader } from '@/components/PhotoUploader';
import { fmtDate, fmtTime } from '@/lib/utils';

export function Profile() {
  const { me } = useSession();
  const { data, error } = useLoad<{ user: User; grants: Grant[] }>(`/users/${me.user.id}`);
  const toast = useToast();
  const [phone, setPhone] = React.useState('');
  const [pw, setPw] = React.useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErr, setPwErr] = React.useState('');
  const [busy, setBusy] = React.useState<'phone' | 'pw' | null>(null);
  React.useEffect(() => { if (data) setPhone(data.user.phone || ''); }, [data]);
  if (error) return <Alert tone="red">{error}</Alert>;
  if (!data) return <PageSkeleton />;
  const u = data.user;

  const savePhone = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy('phone');
    try { await api('/profile', { method: 'PATCH', body: { phone } }); toast('Mobile number saved.'); } catch (x: any) { toast(x.message, 'error'); } finally { setBusy(null); }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault(); setPwErr('');
    if (pw.newPassword !== pw.confirm) return setPwErr('The two new passwords are not the same.');
    setBusy('pw');
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      toast('Password changed. Other devices were signed out.'); setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (x: any) { setPwErr(x.message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Only the System Administrator can change your role, department or branch." />
      <Card className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-center gap-5">
          <Avatar name={u.full_name} userId={u.id} size="lg" />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{u.full_name}</h2>
            <p className="text-sm text-slate-500">{u.designation} · {u.department}</p>
            <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="blue">{u.role}</Badge><Badge tone="slate">{u.employee_id}</Badge><Badge dot>{u.status}</Badge></div>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-5 md:max-w-sm md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div className="mb-3 text-sm font-semibold text-slate-900">Profile photo <span className="font-normal text-slate-500">(required)</span></div>
          <PhotoUploader userId={u.id} name={u.full_name} compact onSaved={() => toast('Profile photo saved.')} />
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="My details" icon={<ShieldCheck className="size-4" />} />
          <div className="px-5 py-2"><DL items={[
            ['Email', u.email], ['Branch', u.branch_name], ['Reports to', u.manager_name || '—'],
            ['Last sign-in', fmtTime(u.last_login_at)], ['Password changed', fmtDate(u.password_changed_at)], ['Member since', fmtDate(u.created_at)],
          ]} /></div>
          <form onSubmit={savePhone} className="flex items-end gap-3 border-t border-slate-100 p-5">
            <Field label="Mobile number" htmlFor="phone" className="flex-1"><Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98200 12345" /></Field>
            <Button type="submit" variant="secondary" loading={busy === 'phone'} icon={<Phone className="size-4" />}>Save</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Change password" icon={<KeyRound className="size-4" />} description="You will be signed out on all other devices." />
          <form onSubmit={changePw} className="space-y-4 p-5">
            {pwErr && <Alert tone="red">{pwErr}</Alert>}
            <Field label="Current password" htmlFor="cp"><Input id="cp" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password" htmlFor="np"><Input id="np" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
              <Field label="Type it again" htmlFor="np2"><Input id="np2" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            </div>
            <Button type="submit" loading={busy === 'pw'}>Change password</Button>
          </form>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="My application access" icon={<AppWindow className="size-4" />} action={<Link to="/app/my-access" className="text-xs font-medium text-brand-700 hover:underline">Request access</Link>} />
        {data.grants.filter((g) => g.status === 'active').length ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.grants.filter((g) => g.status === 'active').map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div><div className="text-sm font-medium text-slate-800">{g.application_name}</div><div className="text-xs text-slate-500">since {fmtDate(g.granted_at)}</div></div>
                <Badge>{g.access_level}</Badge>
              </div>
            ))}
          </div>
        ) : <Empty title="No application access yet" />}
      </Card>
    </div>
  );
}
