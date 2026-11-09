// Small design-system components (shadcn/ui style, written for this project).
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Inbox, Loader2, X } from 'lucide-react';
import { avatarColor, cn, initials } from '@/lib/utils';
import { usePhotos, photoUrl } from '@/lib/photos';

// ---------------------------------------------------------------- Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'link';
const BTN: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  link: 'text-brand-700 hover:underline px-0! h-auto!',
};
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap cursor-pointer',
        size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-sm',
        BTN[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

// ---------------------------------------------------------------- Card
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-card', className)} {...p} />;
}
export function CardHeader({ title, description, action, icon }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
      {icon && <div className="mt-0.5 rounded-md bg-slate-50 p-1.5 text-slate-600 ring-1 ring-slate-200">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function CardBody({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...p} />;
}

// ---------------------------------------------------------------- Badge
const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  navy: 'bg-brand-900 text-white ring-brand-900',
} as const;
export type Tone = keyof typeof TONES;
const WORD_TONE: Record<string, Tone> = {
  active: 'green', approved: 'green', success: 'green', intact: 'green',
  pending: 'amber', invited: 'amber', high: 'amber', failure: 'amber',
  rejected: 'red', denied: 'red', suspended: 'red', disabled: 'red', critical: 'red', locked: 'red', broken: 'red',
  write: 'blue', medium: 'blue', auth: 'blue', admin: 'navy',
  revoked: 'slate', cancelled: 'slate', read: 'slate', low: 'slate',
  account: 'violet', access: 'green', security: 'red', policy: 'violet',
};
export function Badge({ children, tone, dot, className }: { children: React.ReactNode; tone?: Tone; dot?: boolean; className?: string }) {
  const t = tone || WORD_TONE[String(children).toLowerCase()] || 'slate';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset whitespace-nowrap', TONES[t], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Forms
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-slate-700', className)} {...p} />;
}
const fieldBase = 'block w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15 disabled:bg-slate-50 disabled:text-slate-500';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...p} />
));
Input.displayName = 'Input';
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-24 py-2', className)} {...p} />
));
Textarea.displayName = 'Textarea';
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(fieldBase, 'h-10 pr-8', className)} {...p} />
));
Select.displayName = 'Select';
export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Alert
export function Alert({ tone = 'blue', title, children, icon }: { tone?: Tone; title?: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg px-4 py-3 text-sm ring-1 ring-inset', TONES[tone])}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div>{title && <p className="font-semibold">{title}</p>}{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Avatar
export function Avatar({ name, userId, size = 'md' }: { name: string; userId?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const { photos } = usePhotos();
  const v = userId ? photos[userId] : undefined;
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [v]);
  const box = size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-14 text-lg' : 'size-9 text-xs';
  if (userId && v && !failed) {
    return <img src={photoUrl(userId, v)} alt={name} onError={() => setFailed(true)} className={cn('shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-slate-200', box)} />;
  }
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', avatarColor(name), box)}>
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------- Loading & empty
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />;
}
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}
export function Empty({ title, text, icon }: { title: string; text?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">{icon || <Inbox className="size-6" />}</div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Table
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function THead({ cols }: { cols: React.ReactNode[] }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50/70">
      <tr>{cols.map((c, i) => <th key={i} className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{c}</th>)}</tr>
    </thead>
  );
}
export function TR({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr onClick={onClick} className={cn('border-b border-slate-100 last:border-0', onClick && 'cursor-pointer hover:bg-slate-50', className)}>
      {children}
    </tr>
  );
}
export function TD({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle text-slate-700', className)}>{children}</td>;
}

// ---------------------------------------------------------------- Tabs
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cn('flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition cursor-pointer',
            value === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          {t.label}
          {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-xs', value === t.value ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Page header
export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Dialog
export function Dialog({ open, onClose, title, description, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button[type=submit]');
      first?.focus();
    }, 20);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-pop animate-slide-up sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Copy link field
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Link" />
      <Button variant="secondary" type="button" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        onClick={() => navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- Description list
export function DL({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-slate-500">{k}</dt>
          <dd className="text-sm text-slate-900 sm:col-span-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
