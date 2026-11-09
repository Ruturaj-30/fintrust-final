import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const IST = { timeZone: 'Asia/Kolkata' } as const;

export function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export function timeAgo(iso?: string | null) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  if (a < 60) return future ? 'in a moment' : 'just now';
  let t: string;
  if (a < 3600) t = `${Math.round(a / 60)} min`;
  else if (a < 86400) t = `${Math.round(a / 3600)} h`;
  else { const d = Math.round(a / 86400); t = `${d} ${d === 1 ? 'day' : 'days'}`; }
  return future ? `in ${t}` : `${t} ago`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

// A stable colour per person, for avatars.
const AVATAR = ['bg-brand-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600', 'bg-teal-600', 'bg-sky-600', 'bg-fuchsia-600'];
export function avatarColor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
}

export function greeting() {
  const hour = Number(new Date().toLocaleString('en-IN', { ...IST, hour: 'numeric', hour12: false }));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
