// Two-column layout for the sign-in and set-password screens.
import * as React from 'react';
import { ShieldCheck, Fingerprint, ScrollText, Users } from 'lucide-react';
import { Logo } from './AppLayout';
import { GeometricPattern } from './Illustrations';

const POINTS = [
  { icon: Fingerprint, title: 'Two-step verification', text: 'Password and a one-time email code for every sign-in.' },
  { icon: Users, title: 'Invitation-only accounts', text: 'Accounts are created by administrators, never self-registered.' },
  { icon: ShieldCheck, title: 'Role-based access control', text: 'Every request is authorised on the server, with approvals.' },
  { icon: ScrollText, title: 'Tamper-evident audit trail', text: 'Each action is recorded in a SHA-256 hash chain.' },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden h-screen overflow-hidden bg-brand-950 px-12 py-10 text-white lg:sticky lg:top-0 lg:flex lg:flex-col xl:px-16">
        <GeometricPattern className="absolute inset-0 size-full" />
        <div className="relative"><Logo light /></div>

        <div className="relative my-auto max-w-lg py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-saffron-400">Identity &amp; Access Management</p>
          <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.15] tracking-tight">Secure access for every employee, in every branch.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-200">One console to control who can sign in, what they can open, and who approved it, across FinTrust Bank's 9 branches.</p>

          <ul className="mt-10 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04]"><p.icon className="size-4 text-brand-200" /></div>
                <div>
                  <div className="text-sm font-medium text-white">{p.title}</div>
                  <div className="mt-0.5 text-[13px] text-brand-300">{p.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-xs text-brand-300">
          <span>© FinTrust Bank Ltd. · Head Office, Nariman Point, Mumbai</span>
          <span>Fictional bank · College project</span>
        </div>
      </section>

      <main className="flex flex-col bg-white">
        {/* phone and tablet header */}
        <div className="relative overflow-hidden bg-brand-950 px-5 py-5 lg:hidden">
          <GeometricPattern className="absolute inset-0 size-full" />
          <div className="relative"><Logo light /></div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[400px] animate-fade-in">{children}</div>
        </div>
        <p className="px-5 pb-6 text-center text-xs text-slate-400">Authorised FinTrust staff only. All activity is monitored and recorded.</p>
      </main>
    </div>
  );
}
