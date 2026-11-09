import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ShieldCheck, ShieldX, Search, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { api, type AuditEntry } from '@/lib/api';
import { useLoad, useSession } from '@/lib/session';
import { Alert, Badge, Button, Card, Empty, Input, PageHeader, PageSkeleton, Select, Table, THead, TR, TD } from '@/components/ui';
import { fmtTime } from '@/lib/utils';
import { BlockchainCard } from '@/components/BlockchainCard';

interface Page { total: number; page: number; pages: number; entries: AuditEntry[] }

export function Audit() {
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = React.useState(params.get('q') || '');
  const { data, error } = useLoad<Page>(`/audit?${params.toString()}`);
  const [verify, setVerify] = React.useState<{ ok: boolean; checked: number; brokenAt?: number; reason?: string } | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); if (k !== 'page') p.delete('page'); setParams(p, { replace: true }); };
  React.useEffect(() => { const t = setTimeout(() => { if ((params.get('q') || '') !== q) set('q', q); }, 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportQs = new URLSearchParams(params); exportQs.delete('page');

  const runVerify = async () => {
    setVerifying(true);
    try { setVerify(await api('/audit/verify')); } catch (e: any) { setVerify({ ok: false, checked: 0, reason: e.message }); } finally { setVerifying(false); }
  };

  return (
    <div>
      <PageHeader title="Audit Trail" description="Every sign-in, change and decision. Each entry is chained to the previous one with a SHA-256 hash, so any edit or deletion is detectable."
        actions={<>
          {can('audit.verify') && <Button variant="secondary" loading={verifying} icon={<ShieldCheck className="size-4" />} onClick={runVerify}>Verify integrity</Button>}
          <a href={`/api/audit/export?${exportQs}`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-800"><Download className="size-4" />Export CSV</a>
        </>} />
      {verify && (
        <div className="mb-4">
          {verify.ok
            ? <Alert tone="green" icon={<ShieldCheck className="size-5" />} title="Audit trail intact">All {verify.checked} entries verified. No changes or deletions detected.</Alert>
            : <Alert tone="red" icon={<ShieldX className="size-5" />} title="Tampering detected">{verify.brokenAt ? `Entry #${verify.brokenAt}: ` : ''}{verify.reason}</Alert>}
        </div>
      )}
      <BlockchainCard />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative md:col-span-2 xl:col-span-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, person, IP" aria-label="Search audit" /></div>
          <Select value={params.get('category') || ''} onChange={(e) => set('category', e.target.value)} aria-label="Category"><option value="">All categories</option>{['auth', 'account', 'access', 'security', 'policy'].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</Select>
          <Select value={params.get('outcome') || ''} onChange={(e) => set('outcome', e.target.value)} aria-label="Result"><option value="">All results</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></Select>
          <Input type="date" value={params.get('from') || ''} onChange={(e) => set('from', e.target.value)} aria-label="From date" />
          <Input type="date" value={params.get('to') || ''} onChange={(e) => set('to', e.target.value)} aria-label="To date" />
        </div>
      </Card>
      {error ? <Alert tone="red">{error}</Alert> : !data ? <PageSkeleton /> : (
        <Card className="overflow-hidden">
          {data.entries.length === 0 ? <Empty title="No audit entries match" /> : (
            <Table>
              <THead cols={['#', 'Time (IST)', 'Actor', 'Action', 'Target', 'Details', 'Result', 'IP / Hash']} />
              <tbody>
                {data.entries.map((e) => (
                  <TR key={e.id}>
                    <TD className="font-mono text-xs text-slate-400">{e.id}</TD>
                    <TD className="whitespace-nowrap text-xs">{fmtTime(e.at)}</TD>
                    <TD><div className="font-medium text-slate-800">{e.actor_name}</div><div className="text-xs text-slate-500">{e.actor_role}</div></TD>
                    <TD><div className="text-slate-800">{e.action}</div><Badge className="mt-1">{e.category}</Badge></TD>
                    <TD className="max-w-[200px] text-xs">{e.target_label || '—'}</TD>
                    <TD className="max-w-[260px] text-xs text-slate-500">{Object.entries(e.details || {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') || '—'}</TD>
                    <TD><Badge dot>{e.outcome}</Badge></TD>
                    <TD><div className="font-mono text-xs">{e.ip}</div><div className="flex items-center gap-1 font-mono text-[10px] text-slate-400" title={e.hash}><Link2 className="size-3" />{e.hash.slice(0, 10)}…</div></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>{data.total} entries · page {data.page} of {data.pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={data.page <= 1} icon={<ChevronLeft className="size-4" />} onClick={() => set('page', String(data.page - 1))}>Newer</Button>
              <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => set('page', String(data.page + 1))}>Older<ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
