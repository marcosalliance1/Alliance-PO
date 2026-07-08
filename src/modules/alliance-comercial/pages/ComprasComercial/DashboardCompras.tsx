import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, AreaChart, Area,
} from 'recharts'
import { useComprasComercial } from '../../hooks/useComprasComercial'
import { KPICard } from '../../../../components/dashboard/KPICard'
import { fmtCompact, mesAno } from '../../../../utils/parseFinanceiro'

const C_PRIMARY = '#e94560'

function TTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-white/10 rounded-inner p-3 text-xs shadow-card">
      <p className="text-text-main font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-text-muted">{p.name}: <span style={{ color: p.color }}>{fmtCompact(p.value)}</span></p>
      ))}
    </div>
  )
}

function EmptyChart({ label = 'Sem dados' }: { label?: string }) {
  return <div className="flex items-center justify-center h-40 text-text-muted text-sm">{label}</div>
}

export default function DashboardCompras() {
  const { compras, carregando } = useComprasComercial()

  const { totalGeral, totalMesAtual, mesAtualLabel, topContas, topCentros, evolucaoMensal } = useMemo(() => {
    const hoje = new Date()
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

    let totalGeral = 0
    let totalMesAtual = 0
    const porConta = new Map<string, number>()
    const porCentro = new Map<string, number>()
    const porMes = new Map<string, number>()

    for (const c of compras) {
      totalGeral += c.valor
      if (c.data.startsWith(mesAtual)) totalMesAtual += c.valor
      porConta.set(c.desc_conta_gerencial, (porConta.get(c.desc_conta_gerencial) ?? 0) + c.valor)
      porCentro.set(c.desc_centro_custo, (porCentro.get(c.desc_centro_custo) ?? 0) + c.valor)
      const chaveMes = c.data.slice(0, 7)
      porMes.set(chaveMes, (porMes.get(chaveMes) ?? 0) + c.valor)
    }

    const topN = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))

    const evolucaoMensal = [...porMes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([chave, valor]) => ({ mes: mesAno(`${chave}-01`) ?? chave, valor }))

    return {
      totalGeral,
      totalMesAtual,
      mesAtualLabel: mesAno(`${mesAtual}-01`) ?? mesAtual,
      topContas: topN(porConta),
      topCentros: topN(porCentro),
      evolucaoMensal,
    }
  }, [compras])

  if (carregando) {
    return <div className="py-16 text-center text-text-muted text-sm">Carregando…</div>
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Geral" value={fmtCompact(totalGeral)} color={C_PRIMARY} />
        <KPICard title={`Gasto em ${mesAtualLabel}`} value={fmtCompact(totalMesAtual)} color="#0078d4" />
        <KPICard title="Lançamentos" value={String(compras.length)} color="#8892b0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-4">Gastos por Conta Gerencial</h3>
          {topContas.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topContas} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip content={<TTip />} />
                <Bar dataKey="value" name="Valor" fill={C_PRIMARY} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-4">Gastos por Centro de Custo</h3>
          {topCentros.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topCentros} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip content={<TTip />} />
                <Bar dataKey="value" name="Valor" fill="#0078d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      <div className="card">
        <h3 className="text-text-main text-sm font-semibold mb-4">Evolução Mensal</h3>
        {evolucaoMensal.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={evolucaoMensal}>
              <defs>
                <linearGradient id="comprasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C_PRIMARY} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C_PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<TTip />} />
              <Area type="monotone" dataKey="valor" name="Gastos" stroke={C_PRIMARY} fill="url(#comprasGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </div>
    </div>
  )
}
