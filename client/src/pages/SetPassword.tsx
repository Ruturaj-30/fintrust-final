// Invitation and password-reset page.
// The one-time token is after "#token=" in the link. Browsers never send
// the part after # to the server, so it never appears in server logs.
import * as React from 'react';
import { CheckCircle2, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, Field, Input, Skeleton, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

export function SetPassword() {
  const [token] = React.useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [info, setInfo] = React.useState<{ type: string; full_name: string; email: string; role: string; minLength: number } | null>(null);
  const [error, setError] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    window.history.replaceState(null, '', '/set-password'); // remove the token from the address bar
    if (!token) { setError('This page needs the link from your email. Open the link exactly as it was sent.'); return; }
    api('/auth/link-info', { method: 'POST', body: { token } }).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  const rules = info ? [
    { ok: pw.length >= info.minLength, text: `At least ${info.minLength} characters` },
    { ok: [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length >= 3, text: '3 of: lowercase, uppercase, number, symbol' },
    { ok: pw.length > 0 && pw === pw2, text: 'Both passwords match' },
  ] : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setError('The two passwords are not the same.');
    setBusy(true); setError('');
    try { await api('/auth/set-password', { method: 'POST', body: { token, password: pw } }); setDone(true); }
    catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell>
      {done ? (
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
          <div><h2 className="text-2xl font-semibold">Password saved</h2><p className="mt-1.5 text-sm text-slate-500">Your account is ready. Sign in with your email, your new password and the code we email you.</p></div>
          <a href="/" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-700 text-sm font-medium text-white hover:bg-brand-800">Go to sign-in</a>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {!info && !error && <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-10 w-full" /></div>}
          {info && (
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{info.type === 'invite' ? 'Welcome to FinTrust Bank' : 'Choose a new password'}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{info.full_name} · {info.email}</p>
              <div className="mt-2"><Badge tone="blue">{info.role}</Badge></div>
            </div>
          )}
          {error && <Alert tone="red">{error}</Alert>}
          {info && (
            <>
              <Field label="New password" htmlFor="pw"><Input id="pw" type="password" autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
              <Field label="Type it again" htmlFor="pw2"><Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
              <ul className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
                {rules.map((r) => (
                  <li key={r.text} className={cn('flex items-center gap-2', r.ok ? 'text-emerald-700' : 'text-slate-500')}>
                    {r.ok ? <Check className="size-4" /> : <X className="size-4" />}{r.text}
                  </li>
                ))}
                <li className="pl-6 text-xs text-slate-400">Don't use your name or email.</li>
              </ul>
              <Button type="submit" size="lg" className="w-full" loading={busy}>Save password</Button>
            </>
          )}
          {error && <a className="block text-center text-sm text-brand-700 hover:underline" href="/">Back to sign-in</a>}
        </form>
      )}
    </AuthShell>
  );
}
