import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import {
  FileText, TrendingUp, DollarSign, BarChart2,
  ChevronDown, ChevronRight, SlidersHorizontal, Calendar, MapPin, Music,
} from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '../../data/defaults'
import { formatBRL, formatDate, parseLocalDate } from '../../utils/formatters'
import { RankingAgrupado, type RankingItem, type EventoBreakdown } from '../../components/Dashboard/RankingAgrupado'
import MultiComboboxFornecedor from '../../components/UI/MultiComboboxFornecedor'
import type { EventType, OrcamentoStatus, ItemOrcamento, Orcamento } from '../../types'

const LINE_COLOR = '#3B82F6'

// Gradiente harmônico azul → verde → âmbar → vermelho, distribuído entre N itens.
function escalaGradiente(n: number): string[] {
  if (n <= 1) return ['#3B82F6']
  const hueInicio = 210 // azul
  const hueFim = 0      // vermelho
  return Array.from({ length: n }, (_, i) => {
    const hue = hueInicio + (hueFim - hueInicio) * (i / (n - 1))
    return `hsl(${hue}, 72%, 55%)`
  })
}

function allItemsOf(o: ReturnType<typeof useAppContext>['orcamentos'][0]) {
  return [...o.operacaoEstrutura, ...o.equipe, ...o.atracao, ...o.abBebidas, ...o.extras]
}
function orcadoOf(o: ReturnType<typeof useAppContext>['orcamentos'][0]) {
  return allItemsOf(o).reduce((s, i) => s + i.totalOrcado, 0)
}
function pagoOf(o: ReturnType<typeof useAppContext>['orcamentos'][0]) {
  return allItemsOf(o).reduce((s, i) => s + i.totalPagoReal, 0)
}

function labelEvento(o: Orcamento): string {
  const t = EVENT_TYPE_LABELS[o.tipo]
  return o.turma && t ? `${o.turma} — ${t}` : (o.turma || t || 'Sem nome')
}

// Agrupa itens por uma "chave" (fornecedor, ou nome do item), somando pago/orçado
// e guardando o breakdown por evento (pra drill-down clicável no ranking).
function agruparRanking(
  orcs: Orcamento[],
  itensDe: (o: Orcamento) => ItemOrcamento[],
  chavesDe: (i: ItemOrcamento) => string[],
): RankingItem[] {
  const map = new Map<string, { pago: number; orcado: number; eventos: Map<string, EventoBreakdown> }>()
  for (const o of orcs) {
    const label = labelEvento(o)
    for (const item of itensDe(o))
      for (const chave of chavesDe(item)) {
        if (!chave) continue
        const g = map.get(chave) ?? { pago: 0, orcado: 0, eventos: new Map<string, EventoBreakdown>() }
        g.pago += item.totalPagoReal
        g.orcado += item.totalOrcado
        const v = item.totalPagoReal || item.totalOrcado
        const ev = g.eventos.get(o.id) ?? { id: o.id, label, valor: 0 }
        ev.valor += v
        g.eventos.set(o.id, ev)
        map.set(chave, g)
      }
  }
  return [...map.entries()]
    .map(([nome, g]) => ({ nome, pago: g.pago, orcado: g.orcado, eventos: [...g.eventos.values()].sort((a, b) => b.valor - a.valor) }))
    .sort((a, b) => (b.pago - a.pago) || (b.orcado - a.orcado))
}

const fornecedoresDe = (i: ItemOrcamento) => (i.fornecedor || '').split('||').map(f => f.trim()).filter(Boolean)

const BarraPercentualPago: React.FC<{ orcado: number; pago: number }> = ({ orcado, pago }) => {
  const pct = orcado > 0 ? Math.min((pago / orcado) * 100, 100) : 0
  return (
    <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
      <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill?: string; color?: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-2 border border-bordercol rounded-lg p-3 text-xs shadow-lg max-w-[200px]">
      <p className="text-white font-semibold mb-2 truncate">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill ?? p.color }}>{p.name}: {formatBRL(p.value)}</p>
      ))}
    </div>
  )
}

export const DashboardPage: React.FC = () => {
  const { orcamentos } = useAppContext()
  const navigate = useNavigate()

  const [filtroTipo,       setFiltroTipo]       = useState<EventType | ''>('')
  const [filtroStatus,     setFiltroStatus]     = useState<OrcamentoStatus | ''>('')
  const [filtroInst,       setFiltroInst]       = useState('')
  const [filtroTurma,      setFiltroTurma]      = useState('')
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  const [expandidos,       setExpandidos]       = useState<Record<string, boolean>>({})

  const instituicoes = useMemo(() =>
    [...new Set(orcamentos.map(o => o.instituicao).filter(Boolean))].sort(),
  [orcamentos])

  const corDaInstituicao = useMemo(() => {
    const cores = escalaGradiente(instituicoes.length)
    const map = new Map<string, string>()
    instituicoes.forEach((inst, i) => map.set(inst, cores[i]))
    return (nome: string) => map.get(nome) ?? '#64748B'
  }, [instituicoes])

  const turmasDaInst = useMemo(() =>
    filtroInst
      ? [...new Set(orcamentos.filter(o => o.instituicao === filtroInst).map(o => o.turma).filter(Boolean))].sort()
      : [],
  [orcamentos, filtroInst])

  const fornecedoresUsados = useMemo(() => {
    const names = new Set<string>()
    for (const o of orcamentos)
      for (const item of allItemsOf(o))
        if (item.fornecedor?.trim()) names.add(item.fornecedor.trim())
    return [...names].sort()
  }, [orcamentos])

  // Multi-seleção: filtroFornecedor guarda os selecionados separados por "||".
  const fornsSelecionados = useMemo(
    () => filtroFornecedor.split('||').map(s => s.trim()).filter(Boolean),
    [filtroFornecedor],
  )

  const filtered = useMemo(() => orcamentos.filter(o => {
    if (filtroTipo   && o.tipo        !== filtroTipo)   return false
    if (filtroStatus && o.status      !== filtroStatus) return false
    if (filtroInst   && o.instituicao !== filtroInst)   return false
    if (filtroTurma  && o.turma       !== filtroTurma)  return false
    if (fornsSelecionados.length && !allItemsOf(o).some(i => fornecedoresDe(i).some(f => fornsSelecionados.includes(f)))) return false
    return true
  }), [orcamentos, filtroTipo, filtroStatus, filtroInst, filtroTurma, fornsSelecionados])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalOrcado = 0, totalPago = 0, totalBV = 0, bolsaFolia = 0, sympla = 0
    for (const o of filtered) {
      const items = allItemsOf(o)
      totalOrcado += items.reduce((s, i) => s + i.totalOrcado, 0)
      totalPago   += items.reduce((s, i) => s + i.totalPagoReal, 0)
      totalBV     += items.reduce((s, i) => s + (i.valorPassadoCliente - i.totalPagoReal), 0)
      bolsaFolia  += o.bolsaFolia
      sympla      += o.receitasSympla.reduce((s, l) => s + l.total, 0)
    }
    const totalReceitas = bolsaFolia + sympla
    return { count: filtered.length, totalOrcado, totalPago, totalBV, bolsaFolia, sympla, totalReceitas, saldo: totalReceitas - totalPago }
  }, [filtered])

  // ── Resumo dos fornecedores selecionados: quanto pagamos SÓ a eles ────────────
  const resumoFornecedor = useMemo(() => {
    if (fornsSelecionados.length === 0) return null
    let pago = 0, orcado = 0
    const festas = new Set<string>()
    for (const o of filtered)
      for (const item of allItemsOf(o))
        if (fornecedoresDe(item).some(f => fornsSelecionados.includes(f))) {
          pago += item.totalPagoReal; orcado += item.totalOrcado; festas.add(o.id)
        }
    return { pago, orcado, festas: festas.size }
  }, [filtered, fornsSelecionados])

  // ── Ranking de lugares: espaço = fornecedor do item "Locação" ─────────────────
  const rankingLugares = useMemo(
    () => agruparRanking(filtered, o => allItemsOf(o).filter(i => /loca[çc][ãa]o/i.test(i.item)), fornecedoresDe),
    [filtered],
  )

  // ── Cachês de atrações: agrupa pelo NOME da atração (o item), excluindo "Rider"
  //    (camarim, não é cachê). ──
  const rankingAtracoes = useMemo(
    () => agruparRanking(
      filtered,
      o => o.atracao.filter(i => !/rider/i.test(i.item)),
      i => [i.item.trim()].filter(Boolean),
    ),
    [filtered],
  )

  // ── Gráfico 1: Rosca por instituição ─────────────────────────────────────────
  const donutData = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of filtered) {
      const k = o.instituicao || 'Sem instituição'
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // ── Gráfico 2: Barras horizontais por instituição ─────────────────────────────
  const barInstData = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of filtered) {
      const k = o.instituicao || 'Sem instituição'
      map.set(k, (map.get(k) ?? 0) + orcadoOf(o))
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // ── Gráfico 3: Timeline ───────────────────────────────────────────────────────
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const em30  = useMemo(() => new Date(hoje.getTime() + 30 * 86400000), [hoje])

  const timeline = useMemo(() =>
    [...filtered]
      .filter(o => o.data)
      .map(o => {
        const d = parseLocalDate(o.data)
        const diffDias = Math.ceil((d.getTime() - hoje.getTime()) / 86400000)
        return { ...o, _date: d, _diffDias: diffDias }
      })
      .sort((a, b) => a._date.getTime() - b._date.getTime()),
  [filtered, hoje])

  // ── Gráfico 4: Eventos por mês ────────────────────────────────────────────────
  const eventosPorMes = useMemo(() => {
    const map = new Map<string, { label: string; value: number; eventos: string[] }>()
    for (const o of filtered) {
      if (!o.data) continue
      const d = parseLocalDate(o.data)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      const label = `${mes.charAt(0).toUpperCase()}${mes.slice(1)}/${String(d.getFullYear()).slice(2)}`
      const tipoLabel = EVENT_TYPE_LABELS[o.tipo]
      const nomeEvento = o.turma && tipoLabel ? `${o.turma} - ${tipoLabel}` : (o.turma || tipoLabel || '—')
      const cur = map.get(key)
      if (cur) { cur.value += 1; cur.eventos.push(nomeEvento) }
      else map.set(key, { label, value: 1, eventos: [nomeEvento] })
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
  }, [filtered])

  const EventosLabel = (props: { x?: string | number; y?: string | number; index?: number }) => {
    const { x, y, index } = props
    if (x === undefined || y === undefined || index === undefined) return null
    const nx = Number(x), ny = Number(y)
    const eventos = eventosPorMes[index]?.eventos ?? []
    return (
      <text textAnchor="middle" fill="#fff" fontSize={9}>
        {eventos.map((ev, i) => (
          <tspan key={i} x={nx} y={ny - 10 - i * 11}>{ev}</tspan>
        ))}
      </text>
    )
  }

  // ── Drilldown por instituição ─────────────────────────────────────────────────
  const drilldown = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const o of filtered) {
      const k = o.instituicao || 'Sem instituição'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(o)
    }
    return [...map.entries()]
      .map(([inst, orcs]) => {
        const sorted = [...orcs].sort((a, b) => {
          if (!a.data && !b.data) return 0
          if (!a.data) return 1
          if (!b.data) return -1
          return new Date(a.data).getTime() - new Date(b.data).getTime()
        })
        return {
          inst,
          orcs: sorted,
          total: orcs.reduce((s, o) => s + orcadoOf(o), 0),
          totalPago: orcs.reduce((s, o) => s + pagoOf(o), 0),
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [filtered])

  function toggleInst(inst: string) {
    setExpandidos(p => ({ ...p, [inst]: !p[inst] }))
  }

  const cardCls = 'bg-surface-2 border border-bordercol rounded-card p-4 flex items-center gap-3'
  const selectCls = 'bg-surface-2 border border-bordercol rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent hover:border-accent/50 transition-colors'

  return (
    <div className="space-y-5">
      {/* ── Filtros ── */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted pr-2 border-r border-bordercol mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Filtros</span>
        </div>

        <select value={filtroInst}
          onChange={e => { setFiltroInst(e.target.value); setFiltroTurma('') }}
          className={selectCls}>
          <option value="">Todas as instituições</option>
          {instituicoes.map(i => <option key={i} value={i}>{i}</option>)}
        </select>

        {filtroInst && turmasDaInst.length > 0 && (
          <select value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)} className={selectCls}>
            <option value="">Todas as turmas</option>
            {turmasDaInst.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <select value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as EventType | '')}
          className={selectCls}>
          <option value="">Todos os tipos</option>
          {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
        </select>

        <select value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as OrcamentoStatus | '')}
          className={selectCls}>
          <option value="">Todos os status</option>
          <option value="RASCUNHO">Rascunho</option>
          <option value="EM_ANDAMENTO">Em Andamento</option>
          <option value="CONCLUIDO">Concluído</option>
        </select>

        {fornecedoresUsados.length > 0 && (
          <div className="min-w-[220px]">
            <MultiComboboxFornecedor
              value={filtroFornecedor}
              onChange={setFiltroFornecedor}
              fornecedores={fornecedoresUsados}
              placeholder="Todos os fornecedores"
            />
          </div>
        )}

        {(filtroInst || filtroTurma || filtroTipo || filtroStatus || filtroFornecedor) && (
          <button
            onClick={() => { setFiltroInst(''); setFiltroTurma(''); setFiltroTipo(''); setFiltroStatus(''); setFiltroFornecedor('') }}
            className="ml-auto text-xs text-muted hover:text-white transition-colors underline underline-offset-2">
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Resumo do fornecedor filtrado ── */}
      {resumoFornecedor && (
        <div className="bg-accent/5 border-2 border-accent/40 rounded-card p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] text-muted uppercase tracking-wide">
                {fornsSelecionados.length > 1 ? `${fornsSelecionados.length} fornecedores selecionados` : 'Fornecedor selecionado'}
              </p>
              <p className="text-white font-bold text-lg truncate" title={fornsSelecionados.join(', ')}>{fornsSelecionados.join(', ')}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-[11px] text-muted">Pago a ele</p>
                <p className="text-success font-bold text-lg">{formatBRL(resumoFornecedor.pago)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Orçado</p>
                <p className="text-white font-bold text-lg">{formatBRL(resumoFornecedor.orcado)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Festas</p>
                <p className="text-white font-bold text-lg">{resumoFornecedor.festas}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs linha 1: receitas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`${cardCls} border-success/30`}>
          <div className="w-9 h-9 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-muted text-xs">Bolsa Folia</p>
            <p className="text-success font-bold text-sm truncate">{formatBRL(kpis.bolsaFolia)}</p>
          </div>
        </div>
        <div className={`${cardCls} border-success/30`}>
          <div className="w-9 h-9 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-muted text-xs">Sympla</p>
            <p className="text-success font-bold text-sm truncate">{formatBRL(kpis.sympla)}</p>
          </div>
        </div>
        <div className={`${cardCls} border-success/30`}>
          <div className="w-9 h-9 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-muted text-xs">Total Receitas</p>
            <p className="text-success font-bold text-sm truncate">{formatBRL(kpis.totalReceitas)}</p>
          </div>
        </div>
        <div className={`${cardCls} border-2 ${kpis.saldo >= 0 ? 'border-success/60 bg-success/5' : 'border-danger/60 bg-danger/5'}`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kpis.saldo >= 0 ? 'bg-success/20' : 'bg-danger/20'}`}>
            <BarChart2 className={`w-4 h-4 ${kpis.saldo >= 0 ? 'text-success' : 'text-danger'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-muted text-xs font-semibold">Saldo das Turmas</p>
            <p className={`font-bold text-sm truncate ${kpis.saldo >= 0 ? 'text-success' : 'text-danger'}`}>{formatBRL(kpis.saldo)}</p>
          </div>
        </div>
      </div>

      {/* ── KPIs linha 2: custos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={cardCls}>
          <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-muted text-xs">Orçamentos</p>
            <p className="text-white font-bold text-xl">{kpis.count}</p>
          </div>
        </div>
        <div className={cardCls}>
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
            <BarChart2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-muted text-xs">Total Orçado</p>
            <p className="text-white font-bold text-sm truncate">{formatBRL(kpis.totalOrcado)}</p>
          </div>
        </div>
        <div className={cardCls}>
          <div className="w-9 h-9 rounded-lg bg-danger/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 text-danger" />
          </div>
          <div className="min-w-0">
            <p className="text-muted text-xs">Total Pago</p>
            <p className="text-white font-bold text-sm truncate">{formatBRL(kpis.totalPago)}</p>
          </div>
        </div>
        <div className={cardCls}>
          <div className="w-9 h-9 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-muted text-xs">Total BV</p>
            <p className={`font-bold text-sm truncate ${kpis.totalBV >= 0 ? 'text-success' : 'text-danger'}`}>{formatBRL(kpis.totalBV)}</p>
          </div>
        </div>
      </div>

      {/* ── 3 Gráficos ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Gráfico 1: Rosca por instituição */}
        <div className="bg-surface-2 border border-bordercol rounded-card p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Distribuição por Instituição</h2>
          {donutData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                  <Pie data={donutData} innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value"
                    label={({ percent }: { percent?: number }) => percent ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}>
                    {donutData.map(d => <Cell key={d.name} fill={corDaInstituicao(d.name)} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [`${v} orçamento${Number(v) !== 1 ? 's' : ''}`, String(name)]}
                    contentStyle={{ background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {donutData.slice(0, 5).map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: corDaInstituicao(d.name) }} />
                    <span className="text-muted flex-1 truncate">{d.name}</span>
                    <span className="text-white font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted text-sm">Sem dados</div>
          )}
        </div>

        {/* Gráfico 2: Barras horizontais por instituição */}
        <div className="bg-surface-2 border border-bordercol rounded-card p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Valor Orçado por Instituição</h2>
          {barInstData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barInstData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: '#8892a4' }}
                  tickFormatter={v => `${((v as number) / 1000).toFixed(0)}k`}
                  axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8892a4' }}
                  axisLine={false} tickLine={false} width={75} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Orçado" radius={[0, 4, 4, 0]}>
                  {barInstData.map(d => <Cell key={d.name} fill={corDaInstituicao(d.name)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted text-sm">Sem dados</div>
          )}
        </div>

        {/* Gráfico 3: Timeline */}
        <div className="bg-surface-2 border border-bordercol rounded-card p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            Próximos Eventos
          </h2>
          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
            {timeline.length === 0 ? (
              <div className="text-muted text-sm text-center py-10">Sem datas cadastradas</div>
            ) : timeline.map(o => {
              const past = o._diffDias < 0
              const soon = !past && o._diffDias <= 30
              return (
                <button key={o.id}
                  onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                  className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors ${past ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{o.turma || '—'}</p>
                    <p className="text-muted text-[10px] truncate">{o.instituicao}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-muted text-[10px]">{formatDate(o.data)}</p>
                    {soon && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent/20 text-accent">
                        {o._diffDias === 0 ? 'HOJE' : `${o._diffDias}d`}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Gráfico 4: Eventos por mês */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Eventos por Mês</h2>
        {eventosPorMes.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={eventosPorMes} margin={{ top: 36, right: 20, left: 20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8892a4' }} axisLine={false} tickLine={false} />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                formatter={(_, __, item) => [(item.payload.eventos as string[]).join(', '), `${item.payload.value} evento${item.payload.value !== 1 ? 's' : ''}`]}
                contentStyle={{ background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="value" stroke={LINE_COLOR} strokeWidth={2}
                dot={{ fill: LINE_COLOR, r: 4 }} activeDot={{ r: 6 }}>
                <LabelList dataKey="eventos" content={EventosLabel} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-muted text-sm">Sem dados</div>
        )}
      </div>

      {/* ── Rankings: Lugares + Cachês de Atrações (lado a lado) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <RankingAgrupado
          titulo="Lugares"
          subtitulo="quanto pagamos por espaço"
          icone={<MapPin className="w-4 h-4 text-accent" />}
          itens={rankingLugares}
          onAbrirEvento={id => navigate(`/pre-eventos/orcamentos/${id}`)}
        />
        <RankingAgrupado
          titulo="Cachês de Atrações"
          subtitulo="quanto pagamos por atração"
          icone={<Music className="w-4 h-4 text-accent" />}
          itens={rankingAtracoes}
          onAbrirEvento={id => navigate(`/pre-eventos/orcamentos/${id}`)}
        />
      </div>

      {/* ── Drilldown por instituição → turma ── */}
      <div className="bg-surface-2 border border-bordercol rounded-card overflow-hidden">
        <div className="px-5 py-3 border-b border-bordercol">
          <h2 className="text-white font-semibold text-sm">Orçamento por Turma</h2>
        </div>
        {drilldown.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted text-sm">Nenhum orçamento</div>
        ) : drilldown.map(({ inst, orcs, total, totalPago }) => (
          <div key={inst}>
            {/* Nível 1: Instituição */}
            <button
              onClick={() => toggleInst(inst)}
              className="w-full flex items-center gap-3 px-5 py-3 text-left border-b border-bordercol/50 hover:bg-white/[0.03] transition-colors">
              {expandidos[inst]
                ? <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted shrink-0" />}
              <span className="text-white font-semibold text-sm flex-1 uppercase tracking-wide">{inst}</span>
              <span className="text-muted text-xs mr-4">{orcs.length} evento{orcs.length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] text-muted leading-tight">
                    Orçado <span className="text-white font-semibold">{formatBRL(total)}</span>
                    {'  ·  '}
                    Pago <span className="text-success font-semibold">{formatBRL(totalPago)}</span>
                  </p>
                </div>
                <BarraPercentualPago orcado={total} pago={totalPago} />
              </div>
            </button>

            {/* Nível 2: Turmas */}
            {expandidos[inst] && orcs.map(o => {
              const eventDate = o.data ? parseLocalDate(o.data) : null
              const past = eventDate && eventDate < hoje
              const soon = eventDate && !past && eventDate <= em30
              return (
                <button key={o.id}
                  onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 pl-12 border-b border-bordercol/30 hover:bg-white/[0.03] transition-colors bg-black/10 text-left ${past ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm text-white">
                      {o.turma || o.id.slice(0, 8)}
                      {o.tipo && <span className="text-muted"> - {EVENT_TYPE_LABELS[o.tipo]}</span>}
                    </span>
                    {eventDate && (
                      <span className="text-muted text-xs">{formatDate(o.data)}</span>
                    )}
                    {soon && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/20 text-accent">30 dias</span>
                    )}
                    {past && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-muted">realizado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-[10px] text-muted leading-tight text-right">
                      Orçado <span className="text-white font-semibold">{formatBRL(orcadoOf(o))}</span>
                      {'  ·  '}
                      Pago <span className="text-success font-semibold">{formatBRL(pagoOf(o))}</span>
                    </p>
                    <BarraPercentualPago orcado={orcadoOf(o)} pago={pagoOf(o)} />
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-surface-2 border border-bordercol rounded-card p-12 text-center">
          <FileText className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-white font-semibold">Nenhum orçamento encontrado</p>
          <p className="text-muted text-sm mt-1">
            {orcamentos.length === 0
              ? 'Crie seu primeiro orçamento clicando em "Novo Orçamento"'
              : 'Ajuste os filtros para ver resultados'}
          </p>
        </div>
      )}
    </div>
  )
}
