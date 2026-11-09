import * as React from 'react';
import { ArrowLeft, Lock, Mail, KeyRound, Terminal, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, CopyField, Field, Input } from '@/components/ui';
import { useToast } from '@/components/toast';

type Step = 'password' | 'code' | 'forgot';
interface DemoAccount { role: string; name: string; email: string }

export function Login() {
  const toast = useToast();
  const [step, setStep] = React.useState<Step>('password');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [challenge, setChallenge] = React.useState<{ id: string; info: string; demoCode?: string } | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState(() => { const n = sessionStorage.getItem('ft_notice') || ''; sessionStorage.removeItem('ft_notice'); return n; });
  const [demo, setDemo] = React.useState<{ accounts: DemoAccount[]; passwordHint: string | null } | null>(null);
  const [forgotDone, setForgotDone] = React.useState<{ message: string; link?: string } | null>(null);
  const passRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    api<{ signedIn: boolean }>('/auth/session').then((r) => { if (r.signedIn) window.location.replace('/app'); }).catch(() => {});
    api('/auth/demo-accounts').then((r) => { if (r.accounts.length) setDemo(r); }).catch(() => {});
  }, []);

  const go = (s: Step) => { setStep(s); setError(''); setNotice(''); };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError('Enter your email and password.');
    setBusy(true); setError('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email, password } });
      setChallenge({
        id: r.challengeId,
        demoCode: r.demoCode,
        info: r.emailMode === 'console'
          ? `Console email mode: the code is printed in the server terminal. It expires in ${r.expiresInMinutes} minutes.`
          : `We sent a 6-digit code to ${r.sentTo}. It expires in ${r.expiresInMinutes} minutes.`,
      });
      setPassword(''); setCode(''); go('code');
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError('Enter the 6-digit code.');
    setBusy(true); setError('');
    try {
      await api('/auth/verify', { method: 'POST', body: { challengeId: challenge?.id, code } });
      window.location.replace('/app');
    } catch (err: any) {
      setError(err.message); setCode('');
      if (/sign in again/i.test(err.message)) setTimeout(() => go('password'), 1800);
    } finally { setBusy(false); }
  };

  const resend = async () => {
    try {
      const r = await api('/auth/resend', { method: 'POST', body: { challengeId: challenge?.id } });
      setChallenge((c) => (c ? { ...c, demoCode: r.demoCode } : c));
      setError(''); toast('A new code has been sent. Older codes no longer work.');
    } catch (err: any) { setError(err.message); }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api('/auth/forgot', { method: 'POST', body: { email } });
      setForgotDone({ message: r.message, link: r.demoLink });
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell>
      {step === 'password' && (
        <form onSubmit={submitPassword} noValidate className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Staff sign-in</h2>
            <p className="mt-1.5 text-sm text-slate-500">Use the work email your account was created with.</p>
          </div>
          {notice && <Alert tone="blue" icon={<Info className="size-4" />}>{notice}</Alert>}
          {error && <Alert tone="red">{error}</Alert>}
          <Field label="Work email" htmlFor="email">
            <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input id="email" type="email" autoComplete="username" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@fintrustbank.example" /></div>
          </Field>
          <Field label="Password" htmlFor="password">
            <div className="relative"><Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input ref={passRef} id="password" type="password" autoComplete="current-password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Continue</Button>
          <div className="text-center"><Button type="button" variant="link" onClick={() => { setForgotDone(null); go('forgot'); }}>Forgot password?</Button></div>

          {demo && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</span>
                {demo.passwordHint && <span className="text-xs text-slate-500">Password: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-slate-200">{demo.passwordHint}</code></span>}
              </div>
              <div className="grid gap-1">
                {demo.accounts.map((a) => (
                  <button type="button" key={a.email} onClick={() => { setEmail(a.email); setError(''); passRef.current?.focus(); }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-white hover:shadow-sm cursor-pointer">
                    <span className="font-medium text-brand-700">{a.role}</span><span className="text-xs text-slate-500">{a.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      )}

      {step === 'code' && challenge && (
        <form onSubmit={submitCode} noValidate className="space-y-5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><KeyRound className="size-6" /></div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
            <p className="mt-1.5 text-sm text-slate-500">{challenge.info}</p>
          </div>
          {challenge.demoCode && <Alert tone="amber" icon={<Terminal className="size-4" />} title="Demo mode">Your code is <b className="font-mono tracking-widest">{challenge.demoCode}</b></Alert>}
          {error && <Alert tone="red">{error}</Alert>}
          <Field label="6-digit code" htmlFor="code">
            <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="h-14 text-center font-mono text-2xl font-semibold tracking-[0.5em]" placeholder="••••••" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Verify and sign in</Button>
          <div className="flex justify-between text-sm">
            <Button type="button" variant="link" onClick={resend}>Send a new code</Button>
            <Button type="button" variant="link" onClick={() => go('password')}>Use another account</Button>
          </div>
        </form>
      )}

      {step === 'forgot' && (
        <form onSubmit={submitForgot} noValidate className="space-y-5">
          <button type="button" onClick={() => go('password')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 cursor-pointer"><ArrowLeft className="size-4" />Back to sign-in</button>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
            <p className="mt-1.5 text-sm text-slate-500">We'll email you a one-time link to choose a new password.</p>
          </div>
          {error && <Alert tone="red">{error}</Alert>}
          {forgotDone ? (
            <div className="space-y-3">
              <Alert tone="green">{forgotDone.message}</Alert>
              {forgotDone.link && <><p className="text-xs text-slate-500">Demo mode link:</p><CopyField value={forgotDone.link} /></>}
            </div>
          ) : (
            <>
              <Field label="Work email" htmlFor="femail"><Input id="femail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
              <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
            </>
          )}
        </form>
      )}
    </AuthShell>
  );
}
