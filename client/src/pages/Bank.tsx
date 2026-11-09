import { Building2, MapPin, Landmark, Network, AppWindow } from 'lucide-react';
import { useLoad } from '@/lib/session';
import { GeometricPattern } from '@/components/Illustrations';
import { Alert, Badge, Card, CardHeader, DL, PageHeader, PageSkeleton, Table, THead, TR, TD } from '@/components/ui';

interface BankData {
  organization: Record<string, any>;
  branches: { id: string; name: string; city: string; state: string; type: string; pincode: string; staff: number }[];
  departments: { id: string; name: string; staff: number }[];
  partner_banks: { id: string; name: string; ifsc_prefix: string; sector: string; headquarters: string; relationship: string }[];
  applications: { id: string; name: string; description: string; owner_department: string; risk: string }[];
}

export function Bank() {
  const { data, error } = useLoad<BankData>('/bank');
  if (error) return <Alert tone="red">{error}</Alert>;
  if (!data) return <PageSkeleton />;
  const o = data.organization;
  const maxStaff = Math.max(1, ...data.departments.map((d) => d.staff));
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-0 bg-brand-950 p-8 text-white">
        <GeometricPattern className="absolute inset-0 size-full" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-saffron-400">Est. {o.established} · {o.type}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{o.name}</h1>
          <p className="mt-2 max-w-2xl text-brand-200">{o.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <div className="min-w-28 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3"><div className="text-2xl font-semibold">{data.branches.length}</div><div className="text-brand-200">Branches</div></div>
            <div className="min-w-28 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3"><div className="text-2xl font-semibold">{data.departments.reduce((s, d) => s + d.staff, 0)}</div><div className="text-brand-200">Staff</div></div>
            <div className="min-w-28 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3"><div className="text-2xl font-semibold">{data.applications.length}</div><div className="text-brand-200">Applications</div></div>
            <div className="min-w-28 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3"><div className="text-2xl font-semibold">{data.partner_banks.length}</div><div className="text-brand-200">Partner banks</div></div>
          </div>
        </div>
      </Card>
      <PageHeader title="About the bank" description={o.note} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Bank profile" icon={<Building2 className="size-4" />} />
          <div className="px-5 py-2"><DL items={[
            ['Head office', o.headquarters], ['IFSC prefix', <code className="font-mono">{o.ifsc_prefix}</code>], ['SWIFT', <code className="font-mono">{o.swift}</code>],
            ['CIN', <code className="font-mono text-xs">{o.cin}</code>], ['Regulator', o.regulator],
            ['Payment systems', <div className="flex flex-wrap gap-1">{(o.payment_systems || []).map((p: string) => <Badge key={p} tone="blue" className="normal-case">{p}</Badge>)}</div>],
          ]} /></div>
        </Card>
        <Card>
          <CardHeader title="Departments" icon={<Network className="size-4" />} />
          <div className="space-y-3 p-5">
            {data.departments.map((d) => (
              <div key={d.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-slate-700">{d.name}</span><span className="tabular-nums text-slate-500">{d.staff}</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" ref={(el) => { if (el) el.style.width = `${(d.staff / maxStaff) * 100}%`; }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="Branch network" icon={<MapPin className="size-4" />} description="Branch codes follow the RBI IFSC format: 4-letter bank code + 0 + 6 characters." />
        <Table><THead cols={['IFSC', 'Branch', 'City', 'State', 'Type', 'Staff']} />
          <tbody>{data.branches.map((b) => <TR key={b.id}><TD className="font-mono text-xs">{b.id}</TD><TD className="font-medium text-slate-800">{b.name}</TD><TD>{b.city} {b.pincode}</TD><TD>{b.state}</TD><TD><Badge tone={b.type === 'Branch' ? 'slate' : 'blue'} className="normal-case">{b.type}</Badge></TD><TD className="tabular-nums">{b.staff}</TD></TR>)}</tbody>
        </Table>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Partner banks" icon={<Landmark className="size-4" />} description="Settlement and correspondent relationships (simulated)." />
          <Table><THead cols={['Bank', 'IFSC', 'Relationship']} />
            <tbody>{data.partner_banks.map((b) => <TR key={b.id}><TD><div className="font-medium text-slate-800">{b.name}</div><div className="text-xs text-slate-500">{b.sector} · HQ {b.headquarters}</div></TD><TD className="font-mono text-xs">{b.ifsc_prefix}0XXXXXX</TD><TD className="text-xs">{b.relationship}</TD></TR>)}</tbody>
          </Table>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Bank applications" icon={<AppWindow className="size-4" />} />
          <Table><THead cols={['Code', 'Application', 'Owner', 'Risk']} />
            <tbody>{data.applications.map((a) => <TR key={a.id}><TD className="font-mono text-xs">{a.id}</TD><TD className="font-medium text-slate-800">{a.name}</TD><TD className="text-xs">{a.owner_department}</TD><TD><Badge>{a.risk}</Badge></TD></TR>)}</tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
