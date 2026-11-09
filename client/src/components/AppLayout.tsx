import * as React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, KeyRound, ClipboardCheck, Layers, Users, ScrollText, ShieldCheck, Landmark, UserRound,
  LogOut, Menu, X, Search, ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Avatar, Badge } from './ui';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard, 'my-access': KeyRound, approvals: ClipboardCheck, access: Layers, users: Users,
  audit: ScrollText, policies: ShieldCheck, bank: Landmark, profile: UserRound,
};
const GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Overview', ids: ['dashboard'] },
  { title: 'Access', ids: ['my-access', 'approvals', 'access'] },
  { title: 'Administration', ids: ['users', 'audit', 'policies'] },
  { title: 'Organisation', ids: ['bank', 'profile'] },
];
export const pathFor = (id: string) => (id === 'dashboard' ? '/app' : `/app/${id}`);

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-saffron-400 to-saffron-500 text-lg font-bold text-brand-950 shadow-sm">₹</div>
      <div className="leading-tight">
        <div className={cn('text-[15px] font-semibold', light ? 'text-white' : 'text-slate-900')}>FinTrust Bank</div>
        <div className={cn('text-[11px] font-medium', light ? 'text-brand-200' : 'text-slate-500')}>Identity &amp; Access</div>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useSession();
  const allowed = new Map(me.nav.map((n) => [n.id, n.label]));
  return (
    <div className="flex h-full flex-col border-r border-white/5 bg-brand-950 text-brand-100">
      <div className="px-5 pb-6 pt-5"><Logo light /></div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3" aria-label="Main menu">
        {GROUPS.map((g) => {
          const items = g.ids.filter((id) => allowed.has(id));
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-300/70">{g.title}</div>
              <div className="space-y-0.5">
                {items.map((id) => {
                  const Icon = ICONS[id] || LayoutDashboard;
                  return (
                    <NavLink key={id} to={pathFor(id)} end={id === 'dashboard'} onClick={onNavigate}
                      className={({ isActive }) => cn('group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-white/10 text-white shadow-[inset_2px_0_0_var(--color-saffron-500)]' : 'text-brand-100/75 hover:bg-white/5 hover:text-white')}>
                      <Icon className="size-[18px] opacity-90" />
                      <span className="flex-1">{allowed.get(id)}</span>
                      {id === 'approvals' && me.pendingApprovals > 0 && (
                        <span className="rounded-full bg-saffron-500 px-2 py-0.5 text-[11px] font-bold text-brand-950">{me.pendingApprovals}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="m-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs">
        <div className="font-semibold text-white">{me.organization}</div>
        <div className="mt-0.5 text-brand-200/80">{me.user.branch_name}</div>
        <div className="mt-2 flex items-center gap-1.5 text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" />Session protected · {me.idleMinutes} min idle timeout</div>
      </div>
    </div>
  );
}

function UserMenu() {
  const { me } = useSession();
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const signOut = async () => {
    try { await api('/auth/logout', { method: 'POST', body: {} }); } finally { window.location.replace('/'); }
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-lg p-1 pr-2 hover:bg-slate-100 cursor-pointer" aria-expanded={open} aria-haspopup="menu">
        <Avatar name={me.user.full_name} userId={me.user.id} />
        <div className="hidden text-left leading-tight md:block">
          <div className="text-sm font-semibold text-slate-900">{me.user.full_name}</div>
          <div className="text-xs text-slate-500">{me.user.role}</div>
        </div>
        <ChevronDown className="hidden size-4 text-slate-400 md:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop animate-fade-in">
          <div className="px-3 py-2.5">
            <div className="text-sm font-semibold">{me.user.full_name}</div>
            <div className="truncate text-xs text-slate-500">{me.user.email}</div>
            <div className="mt-2 flex gap-1.5"><Badge tone="blue">{me.user.role}</Badge><Badge tone="slate">{me.user.employee_id}</Badge></div>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <button role="menuitem" onClick={() => { setOpen(false); navigate('/app/profile'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"><UserRound className="size-4" />My profile</button>
          <button role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 cursor-pointer"><LogOut className="size-4" />Sign out</button>
        </div>
      )}
    </div>
  );
}

function StaffSearch() {
  const { can } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = React.useState('');
  if (!can('users.view')) return <div className="flex-1" />;
  return (
    <form className="relative max-w-md flex-1" onSubmit={(e) => { e.preventDefault(); navigate(`/app/users?q=${encodeURIComponent(q.trim())}`); }} role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff by name, email or employee ID…" aria-label="Search staff"
        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand-500/15" />
    </form>
  );
}

export function AppLayout() {
  const { me } = useSession();
  const [drawer, setDrawer] = React.useState(false);
  const location = useLocation();
  React.useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar /></aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 animate-fade-in" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-up"><Sidebar onNavigate={() => setDrawer(false)} /></aside>
          <button className="absolute left-[19rem] top-4 rounded-lg bg-white/90 p-2 cursor-pointer" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="size-5" /></button>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="size-5" /></button>
        <div className="lg:hidden"><Logo /></div>
        <div className="hidden flex-1 lg:flex"><StaffSearch /></div>
        <div className="flex-1 lg:hidden" />
        {me.demoMode && <Badge tone="amber" className="hidden sm:inline-flex">Demo mode</Badge>}
        <UserMenu />
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div key={location.pathname} className="animate-fade-in"><Outlet /></div>
      </main>
    </div>
  );
}
