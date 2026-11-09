// Blockchain anchoring panel on the Audit Trail page.
import * as React from 'react';
import { Blocks, ExternalLink, ShieldCheck, ShieldX, Anchor, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useLoad, useSession } from '@/lib/session';
import { Alert, Badge, Button, Card, CardHeader, Table, THead, TR, TD } from './ui';
import { useToast } from './toast';
import { fmtTime } from '@/lib/utils';

interface AnchorRow { id: string; created_at: string; entry_id: number; head_hash: string; tx_hash: string; tx_url: string; status: string; block_number: number | null; error?: string | null }
interface Status {
  enabled: boolean; reachable?: boolean; lowBalance?: boolean; anchorsLeft?: number | null; reason?: string; network: string; explorer: string;
  address?: string; addressUrl?: string; balance?: string | null; anchors: AnchorRow[];
}
interface VerifyResult { ok: boolean; checked: number; results: { id: string; entry_id: number; tx_url: string; ok: boolean; reason: string }[] }

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

export function BlockchainCard({ onChange }: { onChange?: () => void }) {
  const { can } = useSession();
  const toast = useToast();
  const { data, error, reload } = useLoad<Status>('/audit/blockchain');
  const [busy, setBusy] = React.useState<'anchor' | 'verify' | null>(null);
  const [verify, setVerify] = React.useState<VerifyResult | null>(null);
  const [err, setErr] = React.useState('');

  // While a transaction is pending, check again every 10 seconds.
  const pending = data?.anchors.some((a) => a.status === 'pending');
  React.useEffect(() => { if (!pending) return; const t = setInterval(reload, 10000); return () => clearInterval(t); }, [pending, reload]);

  if (error) return <Alert tone="red">{error}</Alert>;
  if (!data) return null;

  const anchor = async () => {
    setBusy('anchor'); setErr('');
    try { await api('/audit/blockchain/anchor', { method: 'POST', body: {} }); toast('Sent to the blockchain. It confirms in about 15 seconds.'); reload(); onChange?.(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(null); }
  };
  const runVerify = async () => {
    setBusy('verify'); setErr('');
    try { setVerify(await api<VerifyResult>('/audit/blockchain/verify')); reload(); onChange?.(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(null); }
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader icon={<Blocks className="size-4" />} title="Blockchain anchoring"
        description={data.enabled
          ? `The latest audit hash is published on the ${data.network}. No personal data goes on the blockchain, only hashes.`
          : 'Optional: publish the audit hash on a public blockchain so even a database administrator cannot rewrite history unnoticed.'}
        action={data.enabled && can('audit.verify') ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" loading={busy === 'verify'} disabled={!data.anchors.length} icon={<ShieldCheck className="size-4" />} onClick={runVerify}>Verify on blockchain</Button>
            <Button size="sm" loading={busy === 'anchor'} icon={<Anchor className="size-4" />} onClick={anchor}>Anchor now</Button>
          </div>
        ) : undefined} />

      {!data.enabled ? (
        <div className="p-5 text-sm text-slate-600">
          <Badge tone="slate">Off</Badge> <span className="ml-1">{data.reason}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Wallet className="size-3.5" />Bank wallet:{' '}
              <a href={data.addressUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-brand-700 hover:underline">{data.address && short(data.address)}</a></span>
            <span>Balance: <b className="font-semibold text-slate-700">{data.reachable === false ? 'network unreachable' : `${Number(data.balance || 0).toFixed(4)} test ETH`}</b></span>
            <span>Network: <b className="font-semibold text-slate-700">{data.network}</b></span>
            {data.anchorsLeft != null && !data.lowBalance && <span>Enough for about <b className="font-semibold text-slate-700">{data.anchorsLeft > 10000 ? '10,000+' : data.anchorsLeft.toLocaleString('en-IN')}</b> anchors</span>}
          </div>
          {data.reachable !== false && data.lowBalance && (
            <div className="px-5 pt-4"><Alert tone="amber" title="Anchoring paused: low test balance">The bank wallet needs free Sepolia test ETH. Paste the wallet address above into a Sepolia faucet. Everything else in the app keeps working normally.</Alert></div>
          )}
          {data.reachable === false && (
            <div className="px-5 pt-4"><Alert tone="amber" title="Blockchain network unreachable">Anchoring will work again when the network is reachable. Everything else keeps working normally.</Alert></div>
          )}
          {(err || verify) && (
            <div className="space-y-3 px-5 pt-4">
              {err && <Alert tone="red">{err}</Alert>}
              {verify && (verify.ok
                ? <Alert tone="green" icon={<ShieldCheck className="size-5" />} title="Matches the blockchain">{verify.checked === 1 ? 'The anchor was' : `All ${verify.checked} anchors were`} read back from the {data.network} and {verify.checked === 1 ? 'matches' : 'match'} the audit trail.</Alert>
                : <Alert tone="red" icon={<ShieldX className="size-5" />} title="Blockchain check failed">{verify.checked === 0 ? 'No confirmed anchors yet.' : verify.results.filter((r) => !r.ok).map((r) => r.reason).join(' ')}</Alert>)}
            </div>
          )}
          {data.anchors.length ? (
            <Table>
              <THead cols={['Anchored (IST)', 'Covers entries', 'Head hash', 'Transaction', 'Status']} />
              <tbody>
                {data.anchors.slice(0, 8).map((a) => {
                  const v = verify?.results.find((r) => r.id === a.id);
                  return (
                    <TR key={a.id}>
                      <TD className="whitespace-nowrap text-xs">{fmtTime(a.created_at)}</TD>
                      <TD className="text-xs">#1 to #{a.entry_id}</TD>
                      <TD className="font-mono text-xs text-slate-500"><span title={a.head_hash}>{short(a.head_hash)}</span></TD>
                      <TD><a href={a.tx_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-brand-700 hover:underline">{short(a.tx_hash)}<ExternalLink className="size-3" /></a></TD>
                      <TD>{v ? <Badge tone={v.ok ? 'green' : 'red'}>{v.ok ? 'verified' : 'mismatch'}</Badge> : (a.status === 'failed' && /replaced/i.test(a.error || '') ? <span title={a.error || ''}><Badge tone="slate">replaced</Badge></span> : <Badge dot>{a.status}</Badge>)}{a.block_number ? <span className="ml-2 text-[11px] text-slate-400">block {a.block_number}</span> : null}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          ) : <p className="px-5 py-4 text-sm text-slate-500">No anchors yet. Click <b>Anchor now</b> to publish the current audit hash.</p>}
        </>
      )}
    </Card>
  );
}
