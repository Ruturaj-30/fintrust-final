// Shown after sign-in to anyone who has no profile photo yet.
// The server refuses every other request until a photo is saved.
import { LogOut, UserSquare2 } from 'lucide-react';
import { api, type Me } from '@/lib/api';
import { PhotoUploader } from '@/components/PhotoUploader';
import { Logo } from '@/components/AppLayout';
import { GeometricPattern } from '@/components/Illustrations';
import { Card } from '@/components/ui';

export function PhotoRequired({ me, onDone }: { me: Me; onDone: () => void }) {
  const signOut = async () => { try { await api('/auth/logout', { method: 'POST', body: {} }); } finally { window.location.replace('/'); } };
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="relative overflow-hidden bg-brand-950 px-5 py-4 sm:px-8">
        <GeometricPattern className="absolute inset-0 size-full" />
        <div className="relative flex items-center justify-between">
          <Logo light />
          <button onClick={signOut} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-brand-100 hover:bg-white/10 cursor-pointer"><LogOut className="size-4" />Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-10 sm:py-16">
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-md bg-brand-50 p-2 text-brand-700 ring-1 ring-brand-100"><UserSquare2 className="size-5" /></div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Add your profile photo</h1>
              <p className="mt-1 text-sm text-slate-500">Welcome, {me.user.full_name.split(' ')[0]}. Every FinTrust account needs a photo so colleagues and approvers can recognise who they are working with. You can continue once it is saved.</p>
            </div>
          </div>
          <PhotoUploader userId={me.user.id} name={me.user.full_name} onSaved={onDone} />
        </Card>
        <p className="mt-6 text-center text-xs text-slate-400">Your photo is visible only to you and to staff who manage accounts, approvals and audits.</p>
      </main>
    </div>
  );
}
