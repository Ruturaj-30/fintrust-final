import * as React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Toast = { id: number; message: string; tone: 'success' | 'error' };
const Ctx = React.createContext<(message: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const push = React.useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, message, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-pop animate-slide-up',
            t.tone === 'error' ? 'border-rose-200' : 'border-emerald-200')}>
            {t.tone === 'error' ? <AlertCircle className="size-5 shrink-0 text-rose-600" /> : <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />}
            <p className="flex-1 text-sm text-slate-700">{t.message}</p>
            <button className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Dismiss" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))}><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => React.useContext(Ctx);
