import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FileText, TrendingUp, DollarSign, BarChart2,
  ChevronRight, ArrowLeft, ArrowUpDown, SlidersHorizontal, Package,
} from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '../../data/defaults'
import { formatBRL } from '../../utils/formatters'
import type { EventType, OrcamentoStatus } from '../../types'


type Agrupamento = 'todos' | 'instituicao' | 'tipo'
type SortKey = 'instituicao' | 'turma' | 'tipo' | 'receitas' | 'custoOrcado' | 'custoPago' | 'saldo' | 'bv'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-2 border border-bordercol rounded-lg p-3 text-xs shadow-lg max-w-[200px]">
      <p className="text-white font-semibold mb-2 truncate">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }}>{p.name}: {formatBRL(p.value)}</p>
      ))}
    </div>
  )
}

function allItemsOf(o: ReturnType<typeof useAppContext>['orcamentos'][0]) {
  return [...o.operacaoEstrutura, ...o.equipe, ...o.atracao, ...o.abBebidas, ...o.extras]
}
function receitasOf(o: ReturnType<typeof useAppContext>['orcamentos'][0]) {
  return o.bolsaFolia + o.receitasSympla.reduce((s, l) => s + l.total, 0)
}

export const DashboardPage: React.FC = () => {
  const { orcamentos } = useAppContext()
  const navigate = useNavigate()

  const [filtroTipo,       setFiltroTipo]       = useState<EventType | ''>('')
  const [filtroStatus,     setFiltroStatus]     = useState<OrcamentoStatus | ''>('')
  const [filtroInst,       setFiltroInst]       = useState('')
  const [filtroTurma,      setFiltroTurma]      = useState('')
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  const [agrupamento,      setAgrupamento]      = useState<Agrupamento>('todos')
  const [drillInst,        setDrillInst]        = useState<string | null>(null)
  const [sortKey,          setSortKey]          = useState<SortKey>('instituicao')
  const [sortDir,          setSortDir]          = useState<'asc' | 'desc'>('asc')

  const instituicoes = useMemo(() =>
    [...new Set(orcamentos.map(o => o.instituicao).filter(Boolean))].sort(),
  [orcamentos])

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

  const filtered = useMemo(() => orcamentos.filter(o => {
    if (filtroTipo       && o.tipo        !== filtroTipo)   return false
    if (filtroStatus     && o.status      !== filtroStatus) return false
    if (filtroInst       && o.instituicao !== filtroInst)   return false
    if (filtroTurma      && o.turma       !== filtroTurma)  return false
    if (filtroFornecedor && !allItemsOf(o).some(i => i.fornecedor?.trim() === filtroFornecedor)) return false
    return true
  }), [orcamentos, filtroTipo, filtroStatus, filtroInst, filtroTurma, filtroFornecedor])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalOrcado = 0, totalPago = 0, totalBV = 0, bolsaFolia = 0, sympla = 0
    for (const o of filtered) {
      const items = allItemsOf(o)
      totalOrcado += items.reduce((s, i) => s + i.totalOrcado, 0)
      totalPago   += items.reduce((s, i) => s + i.totalPagoReal, 0)
      totalBV     += items.reduce((s, i) => s + i.bvAbsoluto, 0)
      bolsaFolia  += o.bolsaFolia
      sympla      += o.receitasSympla.reduce((s, l) => s + l.total, 0)
    }
    const totalReceitas = bolsaFolia + sympla
    return { count: filtered.length, totalOrcado, totalPago, totalBV, bolsaFolia, sympla, totalReceitas, saldo: totalReceitas - totalPago }
  }, [filtered])

  // ── Bar data com agrupamento / drill-down ─────────────────────────────────────
  const barData = useMemo(() => {
    const base = drillInst ? filtered.filter(o => o.instituicao === drillInst) : filtered

    // Quando filtro de fornecedor ativo, soma só os itens daquele fornecedor
    const itemsForn = (o: typeof filtered[0]) => {
      const all = allItemsOf(o)
      return filtroFornecedor ? all.filter(i => i.fornecedor?.trim() === filtroFornecedor) : all
    }

    if (agrupamento === 'instituicao' && !drillInst) {
      const map = new Map<string, { Orçado: number; Pago: number; Receitas: number }>()
      for (const o of base) {
        const k = o.instituicao || 'Sem Inst.'
        const prev = map.get(k) ?? { Orçado: 0, Pago: 0, Receitas: 0 }
        const items = itemsForn(o)
        map.set(k, {
          Orçado:   prev.Orçado   + items.reduce((s, i) => s + i.totalOrcado, 0),
          Pago:     prev.Pago     + items.reduce((s, i) => s + i.totalPagoReal, 0),
          Receitas: prev.Receitas + (filtroFornecedor ? 0 : receitasOf(o)),
        })
      }
      return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }))
    }

    if (agrupamento === 'tipo') {
      const map = new Map<string, { Orçado: number; Pago: number; Receitas: number }>()
      for (const o of base) {
        const k = EVENT_TYPE_LABELS[o.tipo]
        const prev = map.get(k) ?? { Orçado: 0, Pago: 0, Receitas: 0 }
        const items = itemsForn(o)
        map.set(k, {
          Orçado:   prev.Orçado   + items.reduce((s, i) => s + i.totalOrcado, 0),
          Pago:     prev.Pago     + items.reduce((s, i) => s + i.totalPagoReal, 0),
          Receitas: prev.Receitas + (filtroFornecedor ? 0 : receitasOf(o)),
        })
      }
      return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }))
    }

    // Todos / drill individual
    return base.map(o => {
      const items = itemsForn(o)
      return {
        name: o.turma || o.id.slice(0, 6),
        orcamentoId: o.id,
        Orçado:   items.reduce((s, i) => s + i.totalOrcado, 0),
        Pago:     items.reduce((s, i) => s + i.totalPagoReal, 0),
        Receitas: filtroFornecedor ? 0 : receitasOf(o),
      }
    })
  }, [filtered, agrupamento, drillInst, filtroFornecedor])

  function handleBarClick(data: any) {
    if (agrupamento === 'instituicao' && !drillInst && data?.activeLabel) {
      setDrillInst(data.activeLabel)
    } else if (drillInst && data?.activePayload?.[0]?.payload?.orcamentoId) {
      navigate(`/pre-eventos/orcamentos/${data.activePayload[0].payload.orcamentoId}`)
    }
  }

  // ── Top Fornecedores ─────────────────────────────────────────────────────────
  const topFornecedores = useMemo(() => {
    const map = new Map<string, { orcado: number; pago: number }>()
    for (const o of filtered) {
      for (const item of allItemsOf(o)) {
        const key = item.fornecedor?.trim() || 'Sem fornecedor'
        if (!item.totalOrcado && !item.totalPagoReal) continue
        const prev = map.get(key) ?? { orcado: 0, pago: 0 }
        map.set(key, { orcado: prev.orcado + item.totalOrcado, pago: prev.pago + item.totalPagoReal })
      }
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.orcado - a.orcado)
      .slice(0, 8)
  }, [filtered])

  // ── Tabela resumo ─────────────────────────────────────────────────────────────
  interface TRow {
    id: string; instituicao: string; turma: string; tipo: EventType
    receitas: number; custoOrcado: number; custoPago: number; saldo: number; bv: number
  }

  const tabelaRows = useMemo<TRow[]>(() => filtered.map(o => {
    const items = allItemsOf(o)
    const receitas    = receitasOf(o)
    const custoOrcado = items.reduce((s, i) => s + i.totalOrcado, 0)
    const custoPago   = items.reduce((s, i) => s + i.totalPagoReal, 0)
    const bv          = items.reduce((s, i) => s + i.bvAbsoluto, 0)
    return { id: o.id, instituicao: o.instituicao, turma: o.turma, tipo: o.tipo, receitas, custoOrcado, custoPago, saldo: receitas - custoPago, bv }
  }), [filtered])

  const sortedRows = useMemo(() => [...tabelaRows].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey]
    if (typeof va === 'string' && typeof vb === 'string')
      return sortDir === 'asc' ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR')
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  }), [tabelaRows, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k
    return (
      <th className={`px-3 py-2 text-xs font-medium cursor-pointer select-none whitespace-nowrap ${active ? 'text-accent' : 'text-muted'} hover:text-white transition-colors`}
        onClick={() => toggleSort(k)}>
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </span>
      </th>
    )
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
          <select value={filtroFornecedor} onChange={e => setFiltroFornecedor(e.target.value)} className={selectCls}>
            <option value="">Todos os fornecedores</option>
            {fornecedoresUsados.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}

        {(filtroInst || filtroTurma || filtroTipo || filtroStatus || filtroFornecedor) && (
          <button
            onClick={() => { setFiltroInst(''); setFiltroTurma(''); setFiltroTipo(''); setFiltroStatus(''); setFiltroFornecedor('') }}
            className="ml-auto text-xs text-muted hover:text-white transition-colors underline underline-offset-2">
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── KPIs — linha 1: receitas ── */}
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
        {/* Saldo em destaque */}
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

      {/* ── KPIs — linha 2: custos ── */}
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

      {/* ── Gráfico ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface-2 border border-bordercol rounded-card p-5">
          {/* Toolbar gráfico */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-white font-semibold text-sm flex-1">
              {filtroFornecedor ? `Despesa: ${filtroFornecedor}` : 'Comparativo'}
            </h2>
            {drillInst && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <button onClick={() => setDrillInst(null)} className="text-accent hover:underline flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Todas
                </button>
                <ChevronRight className="w-3 h-3" />
                <span className="text-white">{drillInst}</span>
              </div>
            )}
            <select value={agrupamento}
              onChange={e => { setAgrupamento(e.target.value as Agrupamento); setDrillInst(null) }}
              className="bg-surface border border-bordercol rounded px-2 py-1 text-xs text-white outline-none focus:border-accent">
              <option value="todos">Todos</option>
              <option value="instituicao">Por Instituição</option>
              <option value="tipo">Por Tipo de Evento</option>
            </select>
          </div>

          {barData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm">Nenhum dado</div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <div style={{ minWidth: 420 }}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} onClick={handleBarClick}
                    style={{ cursor: agrupamento === 'instituicao' && !drillInst ? 'pointer' : 'default' }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8892a4' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#8892a4' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#8892a4' }} />
                    <Bar dataKey="Orçado"   fill="#3b82f6" radius={[3,3,0,0]} />
                    <Bar dataKey="Pago"     fill="#e94560" radius={[3,3,0,0]} />
                    <Bar dataKey="Receitas" fill="#00b894" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {agrupamento === 'instituicao' && !drillInst && (
            <p className="text-muted text-[10px] mt-2 text-center">Clique em uma barra para ver detalhes da instituição</p>
          )}
        </div>

        {/* Top Fornecedores */}
        <div className="bg-surface-2 border border-bordercol rounded-card p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-accent" />
            </div>
            <h2 className="text-white font-semibold text-sm">Top Fornecedores</h2>
          </div>
          {topFornecedores.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">Sem dados</div>
          ) : (
            <div className="space-y-3">
              {topFornecedores.map((f, i) => {
                const maxOrcado = topFornecedores[0].orcado
                const pct = maxOrcado > 0 ? (f.orcado / maxOrcado) * 100 : 0
                const pagoPct = f.orcado > 0 ? (f.pago / f.orcado) * 100 : 0
                return (
                  <div key={f.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-muted w-3 text-right shrink-0">{i + 1}</span>
                      <span className="text-xs text-white truncate flex-1" title={f.name}>{f.name}</span>
                      <span className="text-xs font-medium text-white shrink-0">{formatBRL(f.orcado)}</span>
                    </div>
                    <div className="ml-5 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full relative" style={{ width: `${pct}%`, background: 'rgba(59,130,246,0.5)' }}>
                        <div className="absolute inset-y-0 left-0 rounded-full bg-success/80" style={{ width: `${pagoPct}%` }} />
                      </div>
                    </div>
                    <div className="ml-5 flex gap-3 mt-0.5">
                      <span className="text-[9px] text-blue-400">Orç. {formatBRL(f.orcado)}</span>
                      <span className="text-[9px] text-success">Pago {formatBRL(f.pago)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-[10px] text-muted mt-4 text-center">azul = orçado · verde = pago</p>
        </div>
      </div>

      {/* ── Tabela Resumo Ordenável ── */}
      {sortedRows.length > 0 && (
        <div className="bg-surface-2 border border-bordercol rounded-card overflow-hidden">
          <div className="px-5 py-3 border-b border-bordercol">
            <h2 className="text-white font-semibold text-sm">Resumo por Orçamento</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 600 }}>
              <thead className="bg-surface2/50">
                <tr>
                  <SortTh k="instituicao" label="Instituição" />
                  <SortTh k="turma"       label="Turma" />
                  <SortTh k="tipo"        label="Tipo" />
                  <SortTh k="receitas"    label="Receitas" />
                  <SortTh k="custoOrcado" label="Custo Orç." />
                  <SortTh k="custoPago"   label="Custo Pago" />
                  <SortTh k="saldo"       label="Saldo" />
                  <SortTh k="bv"          label="BV" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => (
                  <tr key={row.id}
                    className="border-t border-bordercol/50 hover:bg-white/[0.03] cursor-pointer transition-colors"
                    onClick={() => navigate(`/pre-eventos/orcamentos/${row.id}`)}>
                    <td className="px-3 py-2 text-white font-medium">{row.instituicao || '—'}</td>
                    <td className="px-3 py-2 text-gray-300">{row.turma || '—'}</td>
                    <td className="px-3 py-2 text-muted">{EVENT_TYPE_LABELS[row.tipo]}</td>
                    <td className="px-3 py-2 text-right text-success font-medium">{formatBRL(row.receitas)}</td>
                    <td className="px-3 py-2 text-right text-gray-300">{formatBRL(row.custoOrcado)}</td>
                    <td className="px-3 py-2 text-right text-gray-300">{formatBRL(row.custoPago)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.saldo >= 0 ? 'text-success' : 'text-danger'}`}>{formatBRL(row.saldo)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.bv >= 0 ? 'text-success' : 'text-danger'}`}>{formatBRL(row.bv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
