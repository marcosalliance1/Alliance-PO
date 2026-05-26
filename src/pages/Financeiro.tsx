import { useState, useRef } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { Upload, Loader, TrendingUp, CreditCard, BarChart2, ChevronDown, ChevronRight } from 'lucide-react'
import { useFinanceiro, type CAPRecord, type CARRecord } from '../hooks/useFinanceiro'
import { fmtCompact, tempoDesde, mesAno, nivelEnsino } from '../utils/parseFinanceiro'
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
function ResultadoProjetos({ cap, car }: { cap: CAPRecord[]; car: CARRecord[] }) {
  const totalReceitas = car.reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const totalDespesas = cap.reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const resultado = totalReceitas - totalDespesas
  const margem = totalReceitas > 0 ? (resultado / totalReceitas) * 100 : 0

  const porAno: Record<string, { ano: string; receitas: number; despesas: number }> = {}
  for (const i of car) {
    const ano = i.competencia?.slice(0, 4); if (!ano) continue
    porAno[ano] ??= { ano, receitas: 0, despesas: 0 }
    porAno[ano].receitas += i.v_lancamento ?? 0
  }
  for (const i of cap) {
    const ano = i.d_competencia?.slice(0, 4); if (!ano) continue
    porAno[ano] ??= { ano, receitas: 0, despesas: 0 }
    porAno[ano].despesas += i.v_titulo ?? 0
  }
  const dadosAnos = Object.values(porAno).sort((a, b) => a.ano.localeCompare(b.ano))

  const porNivel: Record<string, number> = {}
  for (const i of car) {
    const n = nivelEnsino(i.desc_centro_custo)
    porNivel[n] = (porNivel[n] ?? 0) + (i.v_lancamento ?? 0)
  }
  const totalNivel = Object.values(porNivel).reduce((s, v) => s + v, 0)
  const donut = Object.entries(porNivel).map(([name, value]) => ({
    name, value, pct: totalNivel > 0 ? ((value / totalNivel) * 100).toFixed(1) : '0',
  }))

  const projMap: Record<string, { receita: number; despesa: number }> = {}
  for (const i of car) { projMap[i.desc_centro_custo] ??= { receita: 0, despesa: 0 }; projMap[i.desc_centro_custo].receita += i.v_lancamento ?? 0 }
  for (const i of cap) { projMap[i.desc_centro_custo] ??= { receita: 0, despesa: 0 }; projMap[i.desc_centro_custo].despesa += i.v_titulo ?? 0 }
  const top10 = Object.entries(projMap)
    .filter(([n]) => n)
    .map(([nome, { receita, despesa }]) => ({ nome, resultado: receita - despesa }))
    .sort((a, b) => b.resultado - a.resultado)
    .slice(0, 10)
  const maxRes = Math.abs(top10[0]?.resultado ?? 1) || 1

  return (
    <div className="space-y-5">
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

  const vencidos = capAtivo.filter(i => i.d_vencimento && i.d_vencimento < hoje)
  const vencPorMes: Record<string, { mes: string; sortKey: string; total: number; projetos: Record<string, number> }> = {}
  for (const i of vencidos) {
    const key = mesAno(i.d_vencimento); if (!key || !i.d_vencimento) continue
    vencPorMes[key] ??= { mes: key, sortKey: i.d_vencimento.slice(0, 7), total: 0, projetos: {} }
    vencPorMes[key].total += i.v_titulo ?? 0
    const p = i.desc_centro_custo || '(sem projeto)'
    vencPorMes[key].projetos[p] = (vencPorMes[key].projetos[p] ?? 0) + (i.v_titulo ?? 0)
  }
  const linhasVenc = Object.values(vencPorMes).sort((a, b) => a.sortKey.localeCompare(b.sortKey))

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
        <div className="px-5 py-3 border-b border-white/10 text-text-main text-sm font-semibold">Vencidos por Mês</div>
        {linhasVenc.length > 0 ? linhasVenc.map(({ mes, total, projetos }) => (
          <div key={mes}>
            <button
              onClick={() => setExpandidos(p => ({ ...p, [mes]: !p[mes] }))}
              className="w-full flex items-center gap-2 px-5 py-3 text-left text-sm text-text-muted hover:bg-white/5 transition-colors border-b border-white/5"
            >
              {expandidos[mes] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="flex-1">{mes}</span>
              <span className="font-semibold text-danger">{fmtCompact(total)}</span>
            </button>
            {expandidos[mes] && Object.entries(projetos).sort((a, b) => b[1] - a[1]).map(([proj, val]) => (
              <div key={proj} className="flex justify-between px-5 py-2 pl-10 text-xs text-text-muted border-b border-white/5 bg-black/20">
                <span>{proj}</span>
                <span className="text-red-400 font-medium">{fmtCompact(val)}</span>
              </div>
            ))}
          </div>
        )) : <div className="px-5 py-8 text-center text-text-muted text-sm">Nenhum título vencido</div>}
      </div>
    </div>
  )
}

// ─── Aba 3: Controle de Despesas ──────────────────────────────────
function ControleDespesas({ cap }: { cap: CAPRecord[] }) {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  const totalDespesas  = cap.reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const totalLiquidado = cap.filter(i => i.situacao === 'LIQUIDADO').reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const totalAberto    = cap.filter(i => i.situacao === 'ATIVO').reduce((s, i) => s + (i.v_titulo ?? 0), 0)

  const porGerencial: Record<string, number> = {}
  for (const i of cap) { const g = i.desc_conta_gerencial || '(sem categoria)'; porGerencial[g] = (porGerencial[g] ?? 0) + (i.v_titulo ?? 0) }
  const top10Ger = Object.entries(porGerencial).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))

  const porAno: Record<string, number> = {}
  for (const i of cap) { const ano = i.d_competencia?.slice(0, 4); if (!ano) continue; porAno[ano] = (porAno[ano] ?? 0) + (i.v_titulo ?? 0) }
  const dadosAno = Object.entries(porAno).sort((a, b) => a[0].localeCompare(b[0])).map(([ano, valor]) => ({ ano, valor }))

  const porProj: Record<string, { total: number; contas: Record<string, number> }> = {}
  for (const i of cap) {
    const proj = i.desc_centro_custo || '(sem projeto)'
    porProj[proj] ??= { total: 0, contas: {} }
    porProj[proj].total += i.v_titulo ?? 0
    const g = i.desc_conta_gerencial || '(sem categoria)'
    porProj[proj].contas[g] = (porProj[proj].contas[g] ?? 0) + (i.v_titulo ?? 0)
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
            {expandidos[proj] && Object.entries(contas).sort((a, b) => b[1] - a[1]).map(([conta, val]) => (
              <div key={conta} className="flex justify-between px-5 py-2 pl-10 text-xs text-text-muted border-b border-white/5 bg-black/20">
                <span>{conta}</span>
                <span>{fmtCompact(val)}</span>
              </div>
            ))}
          </div>
        )) : <div className="px-5 py-8 text-center text-text-muted text-sm">Nenhum dado disponível</div>}
      </div>
    </div>
  )
}

// ─── Empty state genérico ─────────────────────────────────────────
function EmptyChart({ label = 'Sem dados' }: { label?: string }) {
  return <div className="flex items-center justify-center h-40 text-text-muted text-sm">{label}</div>
}

// ─── Página principal ─────────────────────────────────────────────
export function Financeiro() {
  const { cap, car, uploads, carregando, uploadCAP, uploadCAR } = useFinanceiro()
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('resultado')
  const [processando, setProcessando] = useState({ CAP: false, CAR: false })
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

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-text-main text-xl font-bold">Financeiro</h1>
          <p className="text-text-muted text-xs mt-0.5">Contas a Pagar (CAP) e Contas a Receber (CAR)</p>
        </div>

        <div className="flex gap-3">
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
          {abaAtiva === 'resultado' && <ResultadoProjetos cap={cap} car={car} />}
          {abaAtiva === 'fluxo'    && <FluxoCaixa cap={cap} />}
          {abaAtiva === 'despesas' && <ControleDespesas cap={cap} />}
        </>
      )}

      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onFechar={() => setToast(null)} />}
    </div>
  )
}
