import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './index.css';
import { api, type Me, type Meta } from '@/lib/api';
import { SessionProvider } from '@/lib/session';
import { ToastProvider } from '@/components/toast';
import { AppLayout } from '@/components/AppLayout';
import { PageSkeleton, Card, Button } from '@/components/ui';
import { Login } from '@/pages/Login';
import { SetPassword } from '@/pages/SetPassword';
import { Dashboard } from '@/pages/Dashboard';
import { MyAccess } from '@/pages/MyAccess';
import { Approvals } from '@/pages/Approvals';
import { AccessRegister } from '@/pages/AccessRegister';
import { Users } from '@/pages/Users';
import { UserDetail } from '@/pages/UserDetail';
import { Audit } from '@/pages/Audit';
import { Policies } from '@/pages/Policies';
import { Bank } from '@/pages/Bank';
import { Profile } from '@/pages/Profile';
import { PhotoRequired } from '@/pages/PhotoRequired';
import { PhotosProvider } from '@/lib/photos';
import { ShieldOff } from 'lucide-react';

// Shows a page only if the server's menu for this role includes it.
// (Real protection is on the server; this just avoids broken screens.)
function Allowed({ id, me, children }: { id: string; me: Me; children: React.ReactNode }) {
  if (me.nav.some((n) => n.id === id)) return <>{children}</>;
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <ShieldOff className="mx-auto mb-3 size-10 text-slate-400" />
      <h1 className="text-lg font-semibold">Not available for your role</h1>
      <p className="mt-1 text-sm text-slate-500">Your role ({me.user.role}) cannot open this page. The server would refuse the data too.</p>
      <Button className="mt-5" onClick={() => window.history.back()}>Go back</Button>
    </Card>
  );
}

function SignedInApp() {
  const [state, setState] = React.useState<{ me: Me; meta: Meta } | null>(null);
  const location = useLocation();
  const load = React.useCallback(async () => {
    const me = await api<Me>('/auth/me');
    const meta = await api<Meta>('/meta');
    setState({ me, meta });
  }, []);
  React.useEffect(() => { load().catch(() => window.location.replace('/')); }, [load]);
  // Refresh the badge counts when moving between pages.
  React.useEffect(() => { if (state) api<Me>('/auth/me').then((me) => setState((s) => (s ? { ...s, me } : s))).catch(() => {}); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state) return <div className="p-8"><PageSkeleton /></div>;
  const { me } = state;
  if (me.photoRequired) return <PhotosProvider><PhotoRequired me={me} onDone={() => { load().catch(() => window.location.replace('/')); }} /></PhotosProvider>;
  const guard = (id: string, el: React.ReactNode) => <Allowed id={id} me={me}>{el}</Allowed>;
  return (
    <SessionProvider me={state.me} meta={state.meta} onRefresh={load}>
     <PhotosProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="my-access" element={guard('my-access', <MyAccess />)} />
          <Route path="approvals" element={guard('approvals', <Approvals />)} />
          <Route path="access" element={guard('access', <AccessRegister />)} />
          <Route path="users" element={guard('users', <Users />)} />
          <Route path="users/:id" element={guard('users', <UserDetail />)} />
          <Route path="audit" element={guard('audit', <Audit />)} />
          <Route path="policies" element={guard('policies', <Policies />)} />
          <Route path="bank" element={<Bank />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Routes>
     </PhotosProvider>
    </SessionProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/app/*" element={<SignedInApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>,
);
