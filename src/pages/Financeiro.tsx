import { useState, useRef, useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { Upload, Loader, TrendingUp, CreditCard, BarChart2, ChevronDown, ChevronRight, Table2, Search, ChevronLeft, RefreshCw } from 'lucide-react'
import { useFinanceiro, type CAPRecord, type CARRecord, type TarifasRecord } from '../hooks/useFinanceiro'
import { fmtCompact, tempoDesde, mesAno, nivelEnsino } from '../utils/parseFinanceiro'
import { useGoogleAuth } from '../contexts/GoogleAuthContext'
import { Toast } from '../components/ui/Toast'
import { KPICard } from '../components/dashboard/KPICard'

// ─── Constantes visuais ───────────────────────────────────────────
const C_RECEITA = '#00b894'
const C_DESPESA = '#e94560'
const C_AZUL    = '#0078d4'
const C_CORAL   = '#f97316'
const CORES_ENSINO = ['#0078d4', '#a855f7', '#f97316']

const ABAS = [
  { id: 'resultado', label: 'Resultado Projetos', Icon: TrendingUp },
  { id: 'fluxo',    label: 'Fluxo de Caixa',      Icon: CreditCard },
  { id: 'despesas', label: 'Controle de Despesas', Icon: BarChart2 },
  { id: 'dados',    label: 'Dados',                Icon: Table2 },
] as const
type AbaId = typeof ABAS[number]['id']

// ─── Tooltip reutilizável ─────────────────────────────────────────
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

// ─── Aba 1: Resultado Projetos ────────────────────────────────────
function ResultadoProjetos({ cap, car, tarifas }: { cap: CAPRecord[]; car: CARRecord[]; tarifas: TarifasRecord[] }) {
  const [filtroProj, setFiltroProj] = useState('')

  const fp = filtroProj.toLowerCase()
  const capF     = fp ? cap.filter(r => r.desc_centro_custo.toLowerCase().includes(fp))     : cap
  const carF     = fp ? car.filter(r => r.desc_centro_custo.toLowerCase().includes(fp))     : car
  const tarifasF = fp ? tarifas.filter(r => r.desc_centro_custo.toLowerCase().includes(fp)) : tarifas

  const totalReceitas = carF.reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const totalDespesas = capF.reduce((s, i) => s + (i.v_titulo ?? 0), 0)
                      + tarifasF.reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const resultado = totalReceitas - totalDespesas
  const margem = totalReceitas > 0 ? (resultado / totalReceitas) * 100 : 0

  const porAno: Record<string, { ano: string; receitas: number; despesas: number }> = {}
  for (const i of carF) {
    const ano = i.competencia?.slice(0, 4); if (!ano) continue
    porAno[ano] ??= { ano, receitas: 0, despesas: 0 }
    porAno[ano].receitas += i.v_lancamento ?? 0
  }
  for (const i of capF) {
    const ano = i.d_competencia?.slice(0, 4); if (!ano) continue
    porAno[ano] ??= { ano, receitas: 0, despesas: 0 }
    porAno[ano].despesas += i.v_titulo ?? 0
  }
  for (const i of tarifasF) {
    const ano = i.d_competencia?.slice(0, 4); if (!ano) continue
    porAno[ano] ??= { ano, receitas: 0, despesas: 0 }
    porAno[ano].despesas += i.v_lancamento ?? 0
  }
  const dadosAnos = Object.values(porAno).sort((a, b) => a.ano.localeCompare(b.ano))

  const porNivel: Record<string, number> = {}
  for (const i of carF) {
    const n = nivelEnsino(i.desc_centro_custo)
    porNivel[n] = (porNivel[n] ?? 0) + (i.v_lancamento ?? 0)
  }
  const totalNivel = Object.values(porNivel).reduce((s, v) => s + v, 0)
  const donut = Object.entries(porNivel).map(([name, value]) => ({
    name, value, pct: totalNivel > 0 ? ((value / totalNivel) * 100).toFixed(1) : '0',
  }))

  const projMap: Record<string, { receita: number; despesa: number }> = {}
  for (const i of carF)     { projMap[i.desc_centro_custo] ??= { receita: 0, despesa: 0 }; projMap[i.desc_centro_custo].receita += i.v_lancamento ?? 0 }
  for (const i of capF)     { projMap[i.desc_centro_custo] ??= { receita: 0, despesa: 0 }; projMap[i.desc_centro_custo].despesa += i.v_titulo ?? 0 }
  for (const i of tarifasF) { projMap[i.desc_centro_custo] ??= { receita: 0, despesa: 0 }; projMap[i.desc_centro_custo].despesa += i.v_lancamento ?? 0 }
  const top10 = Object.entries(projMap)
    .filter(([n]) => n)
    .map(([nome, { receita, despesa }]) => ({ nome, resultado: receita - despesa }))
    .sort((a, b) => b.resultado - a.resultado)
    .slice(0, 10)
  const maxRes = Math.abs(top10[0]?.resultado ?? 1) || 1

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="relative w-60">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={filtroProj}
            onChange={e => setFiltroProj(e.target.value)}
            placeholder="Filtrar por projeto…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Receitas Totais"  value={fmtCompact(totalReceitas)} color={C_RECEITA} />
        <KPICard title="Despesas Totais"  value={fmtCompact(totalDespesas)} color={C_DESPESA} />
        <KPICard title="Resultado"        value={fmtCompact(resultado)}     color={resultado >= 0 ? C_RECEITA : C_DESPESA} />
        <KPICard title="Margem"           value={`${margem.toFixed(1)}%`}   color={C_AZUL} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card col-span-2">
          <h3 className="text-text-main text-sm font-semibold mb-4">Receitas vs Despesas por Ano</h3>
          {dadosAnos.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dadosAnos}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="ano" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<TTip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
                <Bar dataKey="receitas" name="Receitas" fill={C_RECEITA} radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill={C_DESPESA} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-4">Receita por Nível de Ensino</h3>
          {donut.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={donut} innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" label={({ percent }: { percent?: number }) => percent ? `${(percent * 100).toFixed(1)}%` : ''} labelLine={false}>
                    {donut.map((_, i) => <Cell key={i} fill={CORES_ENSINO[i % CORES_ENSINO.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtCompact(Number(v))} contentStyle={{ background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {donut.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CORES_ENSINO[i % CORES_ENSINO.length] }} />
                    <span className="text-text-muted flex-1">{d.name}</span>
                    <span className="text-text-main font-semibold">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </div>
      </div>

      <div className="card">
        <h3 className="text-text-main text-sm font-semibold mb-4">Top 10 Projetos por Resultado</h3>
        {top10.length > 0 ? (
          <div className="space-y-3">
            {top10.map((p, idx) => {
              const pct = Math.max(0, (Math.abs(p.resultado) / maxRes) * 100)
              const cor = p.resultado >= 0 ? C_RECEITA : C_DESPESA
              return (
                <div key={p.nome}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-text-muted truncate flex-1 pr-3">{idx + 1}. {p.nome}</span>
                    <span className="text-xs font-semibold shrink-0" style={{ color: cor }}>{fmtCompact(p.resultado)}</span>
                  </div>
                  <div className="h-1.5 bg-black/30 rounded-full">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor, opacity: 0.75 }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : <EmptyChart />}
      </div>
    </div>
  )
}

// ─── Aba 2: Fluxo de Caixa ────────────────────────────────────────
function FluxoCaixa({ cap }: { cap: CAPRecord[] }) {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [expandidosProjetos, setExpandidosProjetos] = useState<Record<string, boolean>>({})
  const [expandidosContas, setExpandidosContas] = useState<Record<string, boolean>>({})
  const hoje = new Date().toISOString().slice(0, 10)
  const em7  = new Date(Date.now() + 7  * 86400000).toISOString().slice(0, 10)
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const capAtivo = cap.filter(i => i.situacao === 'ATIVO')
  const totalAberto  = capAtivo.reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const totalVencido = capAtivo.filter(i => i.d_vencimento && i.d_vencimento < hoje).reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const aVencer7     = capAtivo.filter(i => i.d_vencimento && i.d_vencimento >= hoje && i.d_vencimento <= em7).reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const aVencer30    = capAtivo.filter(i => i.d_vencimento && i.d_vencimento >= hoje && i.d_vencimento <= em30).reduce((s, i) => s + (i.v_titulo ?? 0), 0)

  const porMes: Record<string, { mes: string; sortKey: string; valor: number }> = {}
  for (const i of capAtivo) {
    const key = mesAno(i.d_vencimento); if (!key || !i.d_vencimento) continue
    porMes[key] ??= { mes: key, sortKey: i.d_vencimento.slice(0, 7), valor: 0 }
    porMes[key].valor += i.v_titulo ?? 0
  }
  const dadosMes = Object.values(porMes).sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  type FornMap = Record<string, number>
  type ContaFC = { total: number; fornecedores: FornMap }
  type ProjFC  = { total: number; contas: Record<string, ContaFC> }
  type MesFC   = { mes: string; sortKey: string; total: number; vencido: boolean; projetos: Record<string, ProjFC> }
  const pagPorMes: Record<string, MesFC> = {}
  for (const i of capAtivo) {
    const key  = mesAno(i.d_vencimento); if (!key || !i.d_vencimento) continue
    const proj = i.desc_centro_custo     || '(sem projeto)'
    const g    = i.desc_conta_gerencial  || '(sem categoria)'
    const forn = i.fantasia_fornecedor   || '(sem fornecedor)'
    pagPorMes[key] ??= { mes: key, sortKey: i.d_vencimento.slice(0, 7), total: 0, vencido: i.d_vencimento < hoje, projetos: {} }
    pagPorMes[key].total += i.v_titulo ?? 0
    pagPorMes[key].projetos[proj] ??= { total: 0, contas: {} }
    pagPorMes[key].projetos[proj].total += i.v_titulo ?? 0
    pagPorMes[key].projetos[proj].contas[g] ??= { total: 0, fornecedores: {} }
    pagPorMes[key].projetos[proj].contas[g].total += i.v_titulo ?? 0
    pagPorMes[key].projetos[proj].contas[g].fornecedores[forn] = (pagPorMes[key].projetos[proj].contas[g].fornecedores[forn] ?? 0) + (i.v_titulo ?? 0)
  }
  const linhasPag = Object.values(pagPorMes).sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Total em Aberto"    value={fmtCompact(totalAberto)}  color="#94a3b8" />
        <KPICard title="Total Vencido"      value={fmtCompact(totalVencido)} color={C_DESPESA} subtitle="ATIVO com data passada" />
        <KPICard title="A Vencer 7 dias"    value={fmtCompact(aVencer7)}    color="#f59e0b" />
        <KPICard title="A Vencer 30 dias"   value={fmtCompact(aVencer30)}   color={C_AZUL} />
      </div>

      <div className="card">
        <h3 className="text-text-main text-sm font-semibold mb-4">Total a Pagar por Mês (títulos ATIVO)</h3>
        {dadosMes.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<TTip />} />
              <Bar dataKey="valor" name="A Pagar" fill={C_AZUL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart label="Nenhum título ATIVO com data de vencimento" />}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-text-main text-sm font-semibold">Pagamentos em Aberto por Mês</div>
        {linhasPag.length > 0 ? linhasPag.map(({ mes, total, vencido, projetos }) => (
          <div key={mes}>
            <button
              onClick={() => setExpandidos(p => ({ ...p, [mes]: !p[mes] }))}
              className="w-full flex items-center gap-2 px-5 py-3 text-left text-sm text-text-muted hover:bg-white/5 transition-colors border-b border-white/5"
            >
              {expandidos[mes] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="flex-1">{mes}</span>
              {vencido && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 mr-2">VENCIDO</span>}
              <span className={`font-semibold ${vencido ? 'text-danger' : 'text-text-main'}`}>{fmtCompact(total)}</span>
            </button>
            {expandidos[mes] && Object.entries(projetos).sort((a, b) => b[1].total - a[1].total).map(([proj, { total: pTotal, contas }]) => {
              const pk = `${mes}::${proj}`
              return (
                <div key={proj}>
                  <button
                    onClick={() => setExpandidosProjetos(p => ({ ...p, [pk]: !p[pk] }))}
                    className="w-full flex items-center gap-2 px-5 py-2 pl-10 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/20"
                  >
                    {expandidosProjetos[pk] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span className="flex-1 truncate">{proj}</span>
                    <span className={`font-medium ${vencido ? 'text-red-400' : 'text-text-main'}`}>{fmtCompact(pTotal)}</span>
                  </button>
                  {expandidosProjetos[pk] && Object.entries(contas).sort((a, b) => b[1].total - a[1].total).map(([conta, { total: cTotal, fornecedores }]) => {
                    const ck = `${mes}::${proj}::${conta}`
                    return (
                      <div key={conta}>
                        <button
                          onClick={() => setExpandidosContas(c => ({ ...c, [ck]: !c[ck] }))}
                          className="w-full flex items-center gap-2 px-5 py-2 pl-14 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/25"
                        >
                          {expandidosContas[ck] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          <span className="flex-1 truncate">{conta}</span>
                          <span>{fmtCompact(cTotal)}</span>
                        </button>
                        {expandidosContas[ck] && Object.entries(fornecedores).sort((a, b) => b[1] - a[1]).map(([forn, fVal]) => (
                          <div key={forn} className="flex justify-between px-5 py-1.5 pl-20 text-xs text-text-muted border-b border-white/5 bg-black/35">
                            <span className="truncate flex-1 pr-3">{forn}</span>
                            <span className="shrink-0">{fmtCompact(fVal)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )) : <div className="px-5 py-8 text-center text-text-muted text-sm">Nenhum título em aberto</div>}
      </div>
    </div>
  )
}

// ─── Aba 3: Controle de Despesas ──────────────────────────────────
function ControleDespesas({ cap, tarifas }: { cap: CAPRecord[]; tarifas: TarifasRecord[] }) {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [expandidosContas, setExpandidosContas] = useState<Record<string, boolean>>({})

  const totalDespesasCap    = cap.reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const totalDespesasTar    = tarifas.reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const totalDespesas       = totalDespesasCap + totalDespesasTar
  const totalLiquidado      = cap.filter(i => i.situacao === 'LIQUIDADO').reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const totalAberto         = cap.filter(i => i.situacao === 'ATIVO').reduce((s, i) => s + (i.v_titulo ?? 0), 0)

  const porGerencial: Record<string, number> = {}
  for (const i of cap)     { const g = i.desc_conta_gerencial || '(sem categoria)'; porGerencial[g] = (porGerencial[g] ?? 0) + (i.v_titulo ?? 0) }
  for (const i of tarifas) { const g = i.desc_conta_gerencial || 'TARIFAS BANCARIAS'; porGerencial[g] = (porGerencial[g] ?? 0) + (i.v_lancamento ?? 0) }
  const top10Ger = Object.entries(porGerencial).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))

  const porAno: Record<string, number> = {}
  for (const i of cap)     { const ano = i.d_competencia?.slice(0, 4); if (!ano) continue; porAno[ano] = (porAno[ano] ?? 0) + (i.v_titulo ?? 0) }
  for (const i of tarifas) { const ano = i.d_competencia?.slice(0, 4); if (!ano) continue; porAno[ano] = (porAno[ano] ?? 0) + (i.v_lancamento ?? 0) }
  const dadosAno = Object.entries(porAno).sort((a, b) => a[0].localeCompare(b[0])).map(([ano, valor]) => ({ ano, valor }))

  const porProj: Record<string, { total: number; contas: Record<string, { total: number; fornecedores: Record<string, number> }> }> = {}
  for (const i of cap) {
    const proj = i.desc_centro_custo || '(sem projeto)'
    const g    = i.desc_conta_gerencial || '(sem categoria)'
    const forn = i.fantasia_fornecedor || '(sem fornecedor)'
    porProj[proj] ??= { total: 0, contas: {} }
    porProj[proj].total += i.v_titulo ?? 0
    porProj[proj].contas[g] ??= { total: 0, fornecedores: {} }
    porProj[proj].contas[g].total += i.v_titulo ?? 0
    porProj[proj].contas[g].fornecedores[forn] = (porProj[proj].contas[g].fornecedores[forn] ?? 0) + (i.v_titulo ?? 0)
  }
  for (const i of tarifas) {
    const proj = i.desc_centro_custo || '(sem projeto)'
    const g    = i.desc_conta_gerencial || 'TARIFAS BANCARIAS'
    const forn = i.fantasia_empresa || i.razao_social || '(tarifa bancária)'
    porProj[proj] ??= { total: 0, contas: {} }
    porProj[proj].total += i.v_lancamento ?? 0
    porProj[proj].contas[g] ??= { total: 0, fornecedores: {} }
    porProj[proj].contas[g].total += i.v_lancamento ?? 0
    porProj[proj].contas[g].fornecedores[forn] = (porProj[proj].contas[g].fornecedores[forn] ?? 0) + (i.v_lancamento ?? 0)
  }
  const projetos = Object.entries(porProj).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Total Despesas"  value={fmtCompact(totalDespesas)}  color="#94a3b8" />
        <KPICard title="Total Liquidado" value={fmtCompact(totalLiquidado)} color={C_RECEITA} />
        <KPICard title="Total em Aberto" value={fmtCompact(totalAberto)}    color={C_CORAL} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-4">Top 10 Contas Gerenciais</h3>
          {top10Ger.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={top10Ger} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip content={<TTip />} />
                <Bar dataKey="value" name="Valor" fill={C_CORAL} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-4">Evolução de Despesas por Ano</h3>
          {dadosAno.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dadosAno}>
                <defs>
                  <linearGradient id="coralGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C_CORAL} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C_CORAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="ano" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<TTip />} />
                <Area type="monotone" dataKey="valor" name="Despesas" stroke={C_CORAL} fill="url(#coralGrad)" strokeWidth={2} dot={{ fill: C_CORAL, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-text-main text-sm font-semibold">Despesas por Projeto</div>
        {projetos.length > 0 ? projetos.map(([proj, { total, contas }]) => (
          <div key={proj}>
            <button
              onClick={() => setExpandidos(p => ({ ...p, [proj]: !p[proj] }))}
              className="w-full flex items-center gap-2 px-5 py-3 text-left text-sm text-text-muted hover:bg-white/5 transition-colors border-b border-white/5"
            >
              {expandidos[proj] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="flex-1 truncate">{proj}</span>
              <span className="font-semibold text-text-main">{fmtCompact(total)}</span>
            </button>
            {expandidos[proj] && Object.entries(contas).sort((a, b) => b[1].total - a[1].total).map(([conta, { total: cTotal, fornecedores }]) => {
              const ck = `${proj}::${conta}`
              return (
                <div key={conta}>
                  <button
                    onClick={() => setExpandidosContas(p => ({ ...p, [ck]: !p[ck] }))}
                    className="w-full flex items-center gap-2 px-5 py-2.5 pl-10 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/20"
                  >
                    {expandidosContas[ck] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span className="flex-1 truncate">{conta}</span>
                    <span className="font-medium">{fmtCompact(cTotal)}</span>
                  </button>
                  {expandidosContas[ck] && Object.entries(fornecedores).sort((a, b) => b[1] - a[1]).map(([forn, fVal]) => (
                    <div key={forn} className="flex justify-between px-5 py-1.5 pl-16 text-xs text-text-muted border-b border-white/5 bg-black/30">
                      <span className="truncate flex-1 pr-3">{forn}</span>
                      <span className="shrink-0">{fmtCompact(fVal)}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )) : <div className="px-5 py-8 text-center text-text-muted text-sm">Nenhum dado disponível</div>}
      </div>
    </div>
  )
}

// ─── Aba 4: Dados (tabelas brutas) ────────────────────────────────
const PAGE_SIZE = 100

function TabelaDados({ cap, car }: { cap: CAPRecord[]; car: CARRecord[] }) {
  const [tabela, setTabela] = useState<'CAP' | 'CAR'>('CAP')
  const [filtro, setFiltro] = useState('')
  const [pagina, setPagina] = useState(0)

  const filtradas = useMemo(() => {
    const f = filtro.toLowerCase().trim()
    if (tabela === 'CAP') {
      return f
        ? cap.filter(r => r.desc_centro_custo.toLowerCase().includes(f) || r.fantasia_fornecedor.toLowerCase().includes(f) || r.desc_conta_gerencial.toLowerCase().includes(f))
        : cap
    } else {
      return f
        ? car.filter(r => r.desc_centro_custo.toLowerCase().includes(f) || r.desc_conta_gerencial.toLowerCase().includes(f))
        : car
    }
  }, [cap, car, tabela, filtro])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginaAtual  = Math.min(pagina, totalPaginas - 1)
  const inicio       = paginaAtual * PAGE_SIZE
  const pagina_dados = filtradas.slice(inicio, inicio + PAGE_SIZE)

  function trocarTabela(t: 'CAP' | 'CAR') { setTabela(t); setFiltro(''); setPagina(0) }
  function trocarFiltro(v: string)          { setFiltro(v); setPagina(0) }

  const totalFiltrado = tabela === 'CAP'
    ? (filtradas as CAPRecord[]).reduce((s, r) => s + (r.v_titulo ?? 0), 0)
    : (filtradas as CARRecord[]).reduce((s, r) => s + (r.v_lancamento ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Seletor CAP / CAR */}
      <div className="flex gap-2">
        {(['CAP', 'CAR'] as const).map(t => (
          <button
            key={t}
            onClick={() => trocarTabela(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              tabela === t
                ? 'bg-primary/20 border-primary/40 text-primary'
                : 'bg-white/5 border-white/10 text-text-muted hover:text-text-main'
            }`}
          >
            {t === 'CAP' ? 'Contas a Pagar (CAP)' : 'Contas a Receber (CAR)'}
          </button>
        ))}
      </div>

      {/* Barra de busca + totalizador */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={filtro}
            onChange={e => trocarFiltro(e.target.value)}
            placeholder={tabela === 'CAP' ? 'Filtrar por fornecedor, c. custo ou gerencial…' : 'Filtrar por c. custo ou gerencial…'}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="text-xs text-text-muted shrink-0">
          <span className="text-text-main font-semibold">{filtradas.length.toLocaleString('pt-BR')}</span> linhas
          {filtro && <span className="ml-1">(filtrado)</span>}
          {' · '}
          <span className="text-text-main font-semibold">{fmtCompact(totalFiltrado)}</span>
          {' · '}pág. {paginaAtual + 1}/{totalPaginas}
        </div>
      </div>

      {/* Tabela CAP */}
      {tabela === 'CAP' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Fornecedor</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">C. Custo</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">C. Gerencial</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Portador</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Vencimento</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Competência</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">V. Título</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Situação</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Dias Atraso</th>
                </tr>
              </thead>
              <tbody>
                {(pagina_dados as CAPRecord[]).map((r, i) => (
                  <tr key={r.id ?? i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 text-text-main max-w-[160px] truncate" title={r.fantasia_fornecedor}>{r.fantasia_fornecedor || '—'}</td>
                    <td className="px-3 py-2 text-text-main max-w-[180px] truncate" title={r.desc_centro_custo}>{r.desc_centro_custo || '—'}</td>
                    <td className="px-3 py-2 text-text-muted max-w-[160px] truncate" title={r.desc_conta_gerencial}>{r.desc_conta_gerencial || '—'}</td>
                    <td className="px-3 py-2 text-text-muted max-w-[120px] truncate" title={r.portador}>{r.portador || '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r.d_vencimento ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r.d_competencia ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-text-main whitespace-nowrap">{r.v_titulo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.situacao === 'LIQUIDADO' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {r.situacao}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-text-muted">{r.dias_atraso > 0 ? r.dias_atraso : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela CAR */}
      {tabela === 'CAR' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">C. Custo</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">C. Gerencial</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Competência</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Liquidação</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">V. Lançamento</th>
                </tr>
              </thead>
              <tbody>
                {(pagina_dados as CARRecord[]).map((r, i) => (
                  <tr key={r.id ?? i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 text-text-main max-w-[200px] truncate" title={r.desc_centro_custo}>{r.desc_centro_custo || '—'}</td>
                    <td className="px-3 py-2 text-text-muted max-w-[180px] truncate" title={r.desc_conta_gerencial}>{r.desc_conta_gerencial || '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r.competencia ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r.liquidacao ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-text-main whitespace-nowrap">{r.v_lancamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPagina(p => Math.max(0, p - 1))}
            disabled={paginaAtual === 0}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-text-muted hover:text-text-main disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(7, totalPaginas) }, (_, i) => {
            const offset = Math.max(0, Math.min(paginaAtual - 3, totalPaginas - 7))
            const pg = i + offset
            return (
              <button
                key={pg}
                onClick={() => setPagina(pg)}
                className={`w-7 h-7 rounded-lg text-xs transition-colors ${
                  pg === paginaAtual
                    ? 'bg-primary text-white'
                    : 'bg-white/5 border border-white/10 text-text-muted hover:text-text-main'
                }`}
              >
                {pg + 1}
              </button>
            )
          })}
          <button
            onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
            disabled={paginaAtual >= totalPaginas - 1}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-text-muted hover:text-text-main disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Empty state genérico ─────────────────────────────────────────
function EmptyChart({ label = 'Sem dados' }: { label?: string }) {
  return <div className="flex items-center justify-center h-40 text-text-muted text-sm">{label}</div>
}

// ─── Página principal ─────────────────────────────────────────────
export function Financeiro() {
  const { cap, car, tarifas, uploads, carregando, uploadCAP, uploadCAR, atualizarTarifas } = useFinanceiro()
  const { accessToken, conectado, logando, conectar } = useGoogleAuth()
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('resultado')
  const [processando, setProcessando] = useState({ CAP: false, CAR: false, TARIFAS: false })
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'sucesso' | 'erro' } | null>(null)
  const capRef = useRef<HTMLInputElement>(null)
  const carRef = useRef<HTMLInputElement>(null)

  const semDados = cap.length === 0 && car.length === 0

  async function handleArquivo(tipo: 'CAP' | 'CAR', arquivo: File | undefined) {
    if (!arquivo) return
    if (!arquivo.name.toLowerCase().endsWith('.xlsx')) {
      setToast({ mensagem: 'Envie um arquivo .xlsx válido.', tipo: 'erro' })
      return
    }
    setProcessando(p => ({ ...p, [tipo]: true }))
    try {
      const fn = tipo === 'CAP' ? uploadCAP : uploadCAR
      const { totalLinhas } = await fn(arquivo)
      setToast({ mensagem: `${tipo} atualizado — ${totalLinhas.toLocaleString('pt-BR')} registros importados.`, tipo: 'sucesso' })
    } catch (err: unknown) {
      const e = err as { message?: string; tipo?: string }
      setToast({ mensagem: e.tipo === 'ABA_NAO_ENCONTRADA' ? (e.message ?? 'Erro') : `Erro ao processar ${tipo}: ${e.message}`, tipo: 'erro' })
    } finally {
      setProcessando(p => ({ ...p, [tipo]: false }))
      if (tipo === 'CAP' && capRef.current) capRef.current.value = ''
      if (tipo === 'CAR' && carRef.current) carRef.current.value = ''
    }
  }

  async function handleAtualizarTarifas() {
    if (!conectado || !accessToken) { conectar(); return }
    setProcessando(p => ({ ...p, TARIFAS: true }))
    try {
      const { totalLinhas, totalValor } = await atualizarTarifas(accessToken)
      setToast({
        mensagem: `Tarifas atualizadas — ${totalLinhas.toLocaleString('pt-BR')} registros · ${fmtCompact(totalValor)}`,
        tipo: 'sucesso',
      })
    } catch (err: unknown) {
      const e = err as { message?: string; tipo?: string }
      if (e.tipo === 'TOKEN_EXPIRADO') { conectar(); return }
      setToast({ mensagem: `Erro ao importar Tarifas: ${e.message}`, tipo: 'erro' })
    } finally {
      setProcessando(p => ({ ...p, TARIFAS: false }))
    }
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-text-main text-xl font-bold">Financeiro</h1>
          <p className="text-text-muted text-xs mt-0.5">Contas a Pagar (CAP), Contas a Receber (CAR) e Tarifas Bancárias</p>
        </div>

        <div className="flex gap-3 flex-wrap">
          {(['CAP', 'CAR'] as const).map(tipo => {
            const ref = tipo === 'CAP' ? capRef : carRef
            const uploado = tipo === 'CAP' ? uploads.CAP : uploads.CAR
            const busy = processando[tipo]
            return (
              <div key={tipo} className="flex flex-col items-end gap-1">
                <input ref={ref} type="file" accept=".xlsx" className="hidden"
                  onChange={e => handleArquivo(tipo, e.target.files?.[0])} />
                <button
                  onClick={() => ref.current?.click()}
                  disabled={busy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    tipo === 'CAP'
                      ? 'bg-white/5 border border-white/10 text-text-muted hover:text-text-main hover:bg-white/10'
                      : 'bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20'
                  }`}
                >
                  {busy ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                  Atualizar {tipo}
                </button>
                {uploado && (
                  <span className="text-xs text-text-muted">
                    Atualizado {tempoDesde(uploado.uploaded_at)} · {(uploado.total_linhas ?? 0).toLocaleString('pt-BR')} linhas
                  </span>
                )}
              </div>
            )
          })}

          {/* Botão Atualizar Tarifas */}
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleAtualizarTarifas}
              disabled={processando.TARIFAS || logando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
            >
              {processando.TARIFAS || logando ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {!conectado ? 'Conectar Google' : 'Atualizar Tarifas'}
            </button>
            {uploads.TARIFAS && (
              <span className="text-xs text-text-muted">
                Atualizado {tempoDesde(uploads.TARIFAS.uploaded_at)} · {(uploads.TARIFAS.total_linhas ?? 0).toLocaleString('pt-BR')} linhas
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 border-b border-white/10 mb-5">
        {ABAS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              abaAtiva === id
                ? 'text-primary border-primary'
                : 'text-text-muted border-transparent hover:text-text-main'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {carregando ? (
        <div className="flex items-center justify-center h-64 gap-3 text-text-muted">
          <Loader size={20} className="animate-spin" />
          <span className="text-sm">Carregando dados financeiros...</span>
        </div>
      ) : semDados ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="rounded-inner p-3 bg-white/5">
            <Upload size={24} className="text-text-muted" />
          </div>
          <p className="text-text-muted font-medium">Nenhum dado financeiro carregado</p>
          <p className="text-text-muted text-xs max-w-sm leading-relaxed">
            Use os botões <strong className="text-text-main">Atualizar CAP</strong> e{' '}
            <strong className="text-primary">Atualizar CAR</strong> para importar os dados.
          </p>
        </div>
      ) : (
        <>
          {abaAtiva === 'resultado' && <ResultadoProjetos cap={cap} car={car} tarifas={tarifas} />}
          {abaAtiva === 'fluxo'    && <FluxoCaixa cap={cap} />}
          {abaAtiva === 'despesas' && <ControleDespesas cap={cap} tarifas={tarifas} />}
          {abaAtiva === 'dados'    && <TabelaDados cap={cap} car={car} />}
        </>
      )}

      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onFechar={() => setToast(null)} />}
    </div>
  )
}
