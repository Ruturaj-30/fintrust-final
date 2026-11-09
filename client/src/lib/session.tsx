// Holds the signed-in user (as returned by the server) and the form lists.
import * as React from 'react';
import { api, type Me, type Meta } from './api';

interface Session {
  me: Me;
  meta: Meta;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
}

const Ctx = React.createContext<Session | null>(null);

export function SessionProvider({ me, meta, children, onRefresh }: { me: Me; meta: Meta; children: React.ReactNode; onRefresh: () => Promise<void> }) {
  const value = React.useMemo<Session>(() => ({
    me, meta, can: (p) => me.permissions.includes(p), refresh: onRefresh,
  }), [me, meta, onRefresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = React.useContext(Ctx);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

// Loads data for a page, with loading and error states.
export function useLoad<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!path) return;
    let live = true;
    setError(null);
    api<T>(path).then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, setData };
}
