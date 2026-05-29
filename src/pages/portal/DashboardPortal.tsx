import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { CheckCircle2, AlertTriangle, LogOut, CalendarClock, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePortalAuth } from '../../contexts/PortalAuthContext'
import { calcResumoProjeto, filtrarItensCalculo } from '../../utils/calculos'
import allianceLogo from '../../assets/alliance-logo.png'
import type { Projeto, SecaoCusto, TAP, Receitas, CustoAdicional, ConciliacaoEverest } from '../../types'
import type { Orcamento, ItemOrcamento } from '../../modules/pre-eventos/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtData(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function rowToProjeto(row: Record<string, unknown>): Projeto {
  return {
    id: row.id as string,
    tap: row.tap as TAP,
    secoes: (row.secoes as SecaoCusto[]) ?? [],
    receitas: (row.receitas as Receitas) ?? {},
    custosAdicionais: (row.custos_adicionais as CustoAdicional[]) ?? [],
    conciliacaoEverest: (row.conciliacao_everest as ConciliacaoEverest) ?? undefined,
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    sheetsUrl: (row.sheets_url as string) ?? undefined,
  }
}

interface CapVencimento {
  fantasia_fornecedor: string
  desc_conta_gerencial: string
  d_vencimento: string | null
  v_titulo: number
}

// ─── Chart constants ──────────────────────────────────────────────────────────

const PIE_COLORS = ['#E63329', '#F56060', '#C44242', '#FF7A6E', '#B8302A', '#FF9B8C', '#A02525', '#FF6B5B']
const TOOLTIP_STYLE = { backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }
const AXIS_STYLE = { fill: '#8892a4', fontSize: 11 }

// ─── Seção 1: Status do Evento ────────────────────────────────────────────────

const CATEGORIAS_FORNECEDOR = [
  { label: 'Buffet',     keywords: ['buffet', 'catering'] },
  { label: 'Bar',        keywords: ['bar '] },
  { label: 'Cerveja',    keywords: ['cerveja', 'chopp'] },
  { label: 'Destilados', keywords: ['destilado'] },
  { label: 'Japa',       keywords: ['japa', 'japonês', 'sushi'] },
  { label: 'Som',        keywords: ['som', 'sonorização', 'audio'] },
  { label: 'Iluminação', keywords: ['iluminação', 'luz'] },
  { label: 'Cenografia', keywords: ['cenografia', 'tema'] },
]

function SecaoEvento({ projeto }: { projeto: Projeto }) {
  const { tap, secoes } = projeto
  const todosItens = secoes.flatMap(s => s.itens)

  const categoriasGrid = CATEGORIAS_FORNECEDOR.map(cat => {
    const item = todosItens.find(i =>
      cat.keywords.some(k => i.item.toLowerCase().includes(k))
    )
    const fornecedor = item?.fornecedor?.trim() || ''
    return { label: cat.label, fornecedor, fechado: !!fornecedor }
  })

  const secaoArtistica = secoes.find(s =>
    s.numero === '2.2' || s.nome.toLowerCase().includes('artíst') || s.nome.toLowerCase().includes('artist')
  )
  const lineup = secaoArtistica?.itens ?? []

  return (
    <div className="space-y-6">
      {/* Dados gerais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Instituição',  value: tap.instituicao || '—' },
          { label: 'Turma',        value: tap.turma || '—' },
          { label: 'Data',         value: tap.dataEvento ? fmtData(tap.dataEvento) : '—' },
          { label: 'Local',        value: tap.local || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-bg rounded-xl px-4 py-3">
            <div className="text-text-muted text-xs mb-1">{label}</div>
            <div className="text-text-main text-sm font-semibold leading-snug">{value}</div>
          </div>
        ))}
      </div>

      {/* Grid fornecedores */}
      <div>
        <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Fornecedores</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categoriasGrid.map(({ label, fornecedor, fechado }) => (
            <div
              key={label}
              className={`rounded-xl px-4 py-3 border ${fechado ? 'border-success/25 bg-success/8' : 'border-white/8 bg-surface'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">{label}</span>
                {fechado ? <CheckCircle2 size={13} className="text-success" /> : <AlertTriangle size={13} className="text-warning/70" />}
              </div>
              <div className={`text-sm font-semibold ${fechado ? 'text-text-main' : 'text-text-muted'}`}>
                {fechado ? fornecedor : 'Pendente'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lineup artístico */}
      {lineup.length > 0 && (
        <div>
          <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Lineup Artístico</h3>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-white/10">
                  <th className="text-left px-4 py-2.5 text-text-muted text-xs font-medium">Horário / Atração</th>
                  <th className="text-left px-4 py-2.5 text-text-muted text-xs font-medium">Artista</th>
                  <th className="text-right px-4 py-2.5 text-text-muted text-xs font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {lineup.map(item => (
                  <tr key={item.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-text-main text-xs">{item.item}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-text-main">
                      {item.fornecedor || <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'fechado' ? 'bg-success/20 text-success' : 'bg-warning/15 text-warning'}`}>
                        {item.status === 'fechado' ? 'Fechado' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Seção 2: Financeiro ──────────────────────────────────────────────────────

function SecaoFinanceiro({ projeto, vencimentos }: { projeto: Projeto; vencimentos: CapVencimento[] }) {
  const resumo = useMemo(() => calcResumoProjeto(projeto), [projeto])
  const { contratado: totalContratado, pago: totalPago, faltaPagar, orcado: totalOrcado } = resumo.custoTotal
  const pctPago = totalContratado > 0 ? Math.min(100, (totalPago / totalContratado) * 100) : 0
  const dentroOrcamento = totalOrcado === 0 || totalContratado <= totalOrcado

  const chartData = resumo.custos
    .filter(c => c.contratado > 0 || c.pago > 0)
    .map(c => ({ nome: c.nome.split(' ')[0], Contratado: Math.round(c.contratado), Pago: Math.round(c.pago) }))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Contratado', value: fmtBRL(totalContratado), color: 'text-primary' },
          { label: 'Total Pago',       value: fmtBRL(totalPago),       color: 'text-success' },
          { label: 'Falta Pagar',      value: fmtBRL(faltaPagar),      color: 'text-warning' },
          { label: '% Pago',           value: `${pctPago.toFixed(1)}%`, color: pctPago >= 80 ? 'text-success' : 'text-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-bg rounded-xl px-4 py-4">
            <div className="text-text-muted text-xs mb-1">{label}</div>
            <div className={`text-lg font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico Contratado × Pago por seção */}
      {chartData.length > 0 && (
        <div className="bg-bg rounded-xl p-4">
          <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-4">Contratado × Pago por Seção</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="nome" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={52} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [fmtBRL(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8892a4' }} />
              <Bar dataKey="Contratado" fill="#E63329" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Pago"       fill="#00b894" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Barra de progresso de pagamento */}
      <div className="bg-bg rounded-xl px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-muted text-xs">Progresso de Pagamento</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dentroOrcamento ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            {dentroOrcamento ? 'Dentro do orçamento' : 'Acima do orçamento'}
          </span>
        </div>
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pctPago}%`, background: '#00b894' }} />
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-1.5">
          <span>{fmtBRL(totalPago)} pago</span>
          <span>{pctPago.toFixed(1)}% de {fmtBRL(totalContratado)}</span>
        </div>
      </div>

      {/* Próximos vencimentos */}
      <div>
        <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarClock size={12} /> Próximos Vencimentos (30 dias)
        </h3>
        {vencimentos.length > 0 ? (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-white/10">
                  <th className="text-left px-4 py-2.5 text-text-muted text-xs font-medium">Fornecedor</th>
                  <th className="text-left px-4 py-2.5 text-text-muted text-xs font-medium">Categoria</th>
                  <th className="text-right px-4 py-2.5 text-text-muted text-xs font-medium">Vencimento</th>
                  <th className="text-right px-4 py-2.5 text-text-muted text-xs font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {vencimentos.map((v, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-text-main text-xs">{v.fantasia_fornecedor || '—'}</td>
                    <td className="px-4 py-2.5 text-text-muted text-xs">{v.desc_conta_gerencial || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-warning text-xs">{fmtData(v.d_vencimento ?? '')}</td>
                    <td className="px-4 py-2.5 text-right text-text-main text-xs font-medium">{fmtBRL(v.v_titulo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-text-muted text-sm text-center py-4 bg-bg rounded-xl">Sem vencimentos nos próximos 30 dias.</div>
        )}
      </div>
    </div>
  )
}

// ─── Seção 3: P.O. Resumido ───────────────────────────────────────────────────

function SecaoPO({ projeto }: { projeto: Projeto }) {
  const [drillSecaoId, setDrillSecaoId] = useState<string | null>(null)
  const resumo = useMemo(() => calcResumoProjeto(projeto), [projeto])

  const pieData = useMemo(() =>
    resumo.custos
      .filter(c => c.contratado > 0)
      .map((c, i) => ({ name: c.nome.split(' ')[0], fullName: c.nome, value: c.contratado, secaoId: c.secaoId, color: PIE_COLORS[i % PIE_COLORS.length] })),
    [resumo]
  )

  const barData = resumo.custos
    .filter(c => c.contratado > 0 || c.pago > 0)
    .map(c => ({ nome: c.nome.split(' ')[0], Contratado: Math.round(c.contratado), Pago: Math.round(c.pago) }))

  const drillSecao = drillSecaoId ? projeto.secoes.find(s => s.id === drillSecaoId) : null
  const drillLabel = drillSecaoId ? pieData.find(p => p.secaoId === drillSecaoId)?.fullName : null

  return (
    <div className="space-y-6">
      {/* Donut + Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Donut */}
        {pieData.length > 0 && (
          <div className="bg-bg rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider">Composição Contratada</h3>
              {drillSecaoId && (
                <button onClick={() => setDrillSecaoId(null)} className="text-xs text-text-muted hover:text-text-main underline">
                  ← Ver todos
                </button>
              )}
            </div>
            <div className="flex gap-4 flex-wrap items-start">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={82}
                    dataKey="value"
                    onClick={d => {
                      const e = d as unknown as typeof pieData[0]
                      setDrillSecaoId(e.secaoId === drillSecaoId ? null : e.secaoId)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map(entry => (
                      <Cell
                        key={entry.secaoId}
                        fill={entry.color}
                        opacity={drillSecaoId && drillSecaoId !== entry.secaoId ? 0.3 : 1}
                        stroke={drillSecaoId === entry.secaoId ? '#fff' : 'transparent'}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _n, p) => [fmtBRL(Number(v)), (p.payload as typeof pieData[0])?.fullName ?? '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1 pt-1">
                {pieData.map(entry => (
                  <button
                    key={entry.secaoId}
                    onClick={() => setDrillSecaoId(entry.secaoId === drillSecaoId ? null : entry.secaoId)}
                    className={`w-full flex items-center gap-2 text-left py-0.5 transition-opacity ${drillSecaoId && drillSecaoId !== entry.secaoId ? 'opacity-30' : ''}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
                    <span className="text-xs text-text-muted flex-1 truncate">{entry.name}</span>
                    <span className="text-xs text-text-main font-medium">{fmtBRL(entry.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bar chart */}
        {barData.length > 0 && (
          <div className="bg-bg rounded-xl p-4">
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Contratado × Pago</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="nome" tick={AXIS_STYLE} />
                <YAxis tick={AXIS_STYLE} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={48} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [fmtBRL(Number(v)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8892a4' }} />
                <Bar dataKey="Contratado" fill="#E63329" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Pago"       fill="#00b894" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Drill-down subcategorias */}
      {drillSecao && (
        <div className="bg-bg rounded-xl p-4">
          <h3 className="text-text-main text-sm font-semibold mb-3">{drillLabel}</h3>
          {(() => {
            const itensFiltrados = filtrarItensCalculo(drillSecao.itens)
            const porSubcat: Record<string, { contratado: number; pago: number }> = {}
            for (const item of itensFiltrados) {
              const sub = item.subcategoria?.trim() || item.area?.trim() || 'Geral'
              if (!porSubcat[sub]) porSubcat[sub] = { contratado: 0, pago: 0 }
              porSubcat[sub].contratado += item.valorContratado
              porSubcat[sub].pago += item.valorPago
            }
            return (
              <div className="space-y-2">
                {Object.entries(porSubcat).map(([sub, vals]) => {
                  const pct = vals.contratado > 0 ? Math.min(100, (vals.pago / vals.contratado) * 100) : 0
                  return (
                    <div key={sub} className="space-y-1">
                      <div className="flex items-center gap-3">
                        {vals.contratado > 0
                          ? <CheckCircle2 size={13} className="text-success shrink-0" />
                          : <AlertTriangle size={13} className="text-warning/60 shrink-0" />
                        }
                        <span className="text-sm text-text-main flex-1">{sub}</span>
                        <span className="text-xs text-success">{fmtBRL(vals.pago)}</span>
                        <span className="text-xs text-text-muted">/ {fmtBRL(vals.contratado)}</span>
                      </div>
                      {vals.contratado > 0 && (
                        <div className="ml-[25px] h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-success/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Lista de seções com barra de progresso */}
      <div className="space-y-2">
        {resumo.custos.map(c => {
          const pct = c.contratado > 0 ? Math.min(100, (c.pago / c.contratado) * 100) : 0
          return (
            <button
              key={c.secaoId}
              onClick={() => setDrillSecaoId(c.secaoId === drillSecaoId ? null : c.secaoId)}
              className="w-full bg-bg rounded-xl px-4 py-3 text-left hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-text-muted">{drillSecaoId === c.secaoId ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                <span className="flex-1 text-sm font-medium text-text-main">{c.nome}</span>
                <span className="text-xs text-success">{fmtBRL(c.pago)}</span>
                <span className="text-xs text-text-muted">/ {fmtBRL(c.contratado)}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct >= 80 ? '#00b894' : pct >= 40 ? '#E63329' : '#f59e0b' }}
                />
              </div>
              <div className="text-right text-xs text-text-muted mt-1">{pct.toFixed(0)}% pago</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Seção 4: Pré-Eventos ─────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  FESTA_INTEGRACAO: 'Integração',
  FESTA_START: 'Start',
  FESTA_1_6: '1/6',
  FESTA_FIM_CICLO_BASICO: 'Fim Ciclo Básico',
  FESTA_MEIO_CURSO: 'Meio Curso',
  VIAGEM_MEIO_CURSO: 'Viagem Meio Curso',
  FESTA_PRE_INTERNATO: 'Pré-Internato',
  FESTA_X_DIAS: 'Festa X Dias',
}

const CATS_PE = [
  { label: 'Buffet', secao: 'operacaoEstrutura' as const, keyword: 'buffet' },
  { label: 'Bar',    secao: 'abBebidas' as const,         keyword: 'bar' },
  { label: 'Chopp',  secao: 'abBebidas' as const,         keyword: 'chopp' },
]

function fornecedorPE(orc: Orcamento, secao: keyof Orcamento, keyword: string): ItemOrcamento | undefined {
  const items = orc[secao] as ItemOrcamento[] | undefined
  return items?.find(i => i.item.toLowerCase().includes(keyword))
}

function SecaoPreEventos({ projeto }: { projeto: Projeto }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  const hoje = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('orcamentos').select('dados')
      const todos: Orcamento[] = ((data ?? []) as { dados: Orcamento }[]).map(r => r.dados)

      const instBase = projeto.tap.instituicao.toLowerCase().split(' ')[0]
      const filtrados = todos
        .filter(o => {
          const matchInst = o.instituicao?.toLowerCase().includes(instBase)
          const isBV = o.turma?.toLowerCase().includes('bv') || o.tipo?.toLowerCase().includes('veterano')
          return matchInst && !isBV
        })
        .sort((a, b) => {
          const aPast = a.data < hoje
          const bPast = b.data < hoje
          if (aPast && !bPast) return 1
          if (!aPast && bPast) return -1
          return (a.data || '').localeCompare(b.data || '')
        })

      setOrcamentos(filtrados)
      setLoading(false)
    }
    load()
  }, [projeto.tap.instituicao]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="text-text-muted text-sm text-center py-8">Carregando pré-eventos…</div>
  if (orcamentos.length === 0) return <div className="text-text-muted text-sm text-center py-8">Nenhum pré-evento encontrado.</div>

  return (
    <div className="space-y-3">
      {orcamentos.map(orc => {
        const isPast = orc.data && orc.data < hoje
        const isOpen = expandidos[orc.id] ?? false
        const lineup = orc.atracao?.filter(i => i.fornecedor?.trim()) ?? []
        const extras = orc.extras?.filter(i => i.status !== 'PENDENTE') ?? []

        return (
          <div key={orc.id} className={`bg-bg rounded-xl overflow-hidden transition-opacity ${isPast ? 'opacity-50' : ''}`}>
            {/* Cabeçalho */}
            <button
              onClick={() => setExpandidos(prev => ({ ...prev, [orc.id]: !prev[orc.id] }))}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/3 transition-colors text-left"
            >
              <span className="text-text-muted shrink-0">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-text-main font-semibold text-sm">{TIPO_LABEL[orc.tipo] ?? orc.tipo}</div>
                <div className="text-text-muted text-xs mt-0.5">{orc.turma}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-text-main text-xs font-medium">{fmtData(orc.data)}</div>
                {isPast && <div className="text-text-muted text-xs">Realizado</div>}
              </div>
            </button>

            {/* Expandido */}
            {isOpen && (
              <div className="border-t border-white/8 px-4 py-4 space-y-5">
                {/* Grid de fornecedores */}
                <div>
                  <h4 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Fornecedores</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {CATS_PE.map(({ label, secao, keyword }) => {
                      const item = fornecedorPE(orc, secao, keyword)
                      const fechado = !!(item?.fornecedor?.trim())
                      return (
                        <div key={label} className={`rounded-xl px-3 py-2.5 border ${fechado ? 'border-success/25 bg-success/8' : 'border-white/8 bg-surface'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-text-muted">{label}</span>
                            {fechado ? <CheckCircle2 size={12} className="text-success" /> : <AlertTriangle size={12} className="text-warning/70" />}
                          </div>
                          <div className={`text-xs font-semibold ${fechado ? 'text-text-main' : 'text-text-muted'}`}>
                            {fechado ? item!.fornecedor : 'Pendente'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Lineup artístico */}
                {lineup.length > 0 && (
                  <div>
                    <h4 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">Lineup</h4>
                    <div className="space-y-1">
                      {lineup.map(item => (
                        <div key={item.id} className="flex items-center gap-3 py-1">
                          <CheckCircle2 size={12} className="text-success shrink-0" />
                          <span className="text-xs text-text-muted flex-1">{item.item}</span>
                          <span className="text-xs font-medium text-text-main">{item.fornecedor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extras */}
                {extras.length > 0 && (
                  <div>
                    <h4 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">Extras</h4>
                    <div className="flex flex-wrap gap-2">
                      {extras.map(item => (
                        <span key={item.id} className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                          {item.item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard Principal ──────────────────────────────────────────────────────

type TabId = 'evento' | 'financeiro' | 'po' | 'pre-eventos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'evento',       label: 'Status do Evento' },
  { id: 'financeiro',   label: 'Financeiro' },
  { id: 'po',           label: 'P.O. Resumido' },
  { id: 'pre-eventos',  label: 'Pré-Eventos' },
]

export function DashboardPortal() {
  const { session, signOut } = usePortalAuth()
  const navigate = useNavigate()
  const [projeto, setProjeto] = useState<Projeto | null>(null)
  const [vencimentos, setVencimentos] = useState<CapVencimento[]>([])
  const [loading, setLoading] = useState(true)
  const [tabAtiva, setTabAtiva] = useState<TabId>('evento')

  function handleSignOut() {
    signOut()
    navigate('/portal', { replace: true })
  }

  useEffect(() => {
    if (!session?.projetoId) return
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('projetos').select('*').eq('id', session!.projetoId).single()
      if (!data) { setLoading(false); return }

      const proj = rowToProjeto(data as Record<string, unknown>)
      setProjeto(proj)

      const filtro = proj.tap.turma || proj.tap.instituicao || ''
      if (filtro) {
        const hoje = new Date().toISOString().slice(0, 10)
        const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
        const { data: capData } = await supabase
          .from('financeiro_cap')
          .select('fantasia_fornecedor, desc_conta_gerencial, d_vencimento, v_titulo')
          .eq('situacao', 'ATIVO')
          .gte('d_vencimento', hoje)
          .lte('d_vencimento', em30)
          .ilike('desc_centro_custo', `%${filtro}%`)
          .order('d_vencimento')
          .limit(20)
        setVencimentos((capData ?? []) as CapVencimento[])
      }
      setLoading(false)
    }
    load()
  }, [session?.projetoId])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted text-sm gap-2">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Carregando...
      </div>
    )
  }

  if (!projeto) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted text-sm">Projeto não encontrado.</div>
  }

  const nomeEvento = [projeto.tap.instituicao, projeto.tap.turma].filter(Boolean).join(' — ')

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface border-b border-white/10 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={allianceLogo} alt="Alliance" className="h-7 w-auto" style={{ mixBlendMode: 'screen' }} />
          <div>
            <div className="text-text-main font-semibold text-sm">{nomeEvento}</div>
            {projeto.tap.dataEvento && (
              <div className="text-text-muted text-xs">
                {fmtData(projeto.tap.dataEvento)}{projeto.tap.local ? ` · ${projeto.tap.local}` : ''}
              </div>
            )}
          </div>
        </div>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-text-muted hover:text-text-main text-xs transition-colors">
          <LogOut size={13} /> Sair
        </button>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10 px-4 sm:px-8 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTabAtiva(id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tabAtiva === id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        {tabAtiva === 'evento'      && <SecaoEvento projeto={projeto} />}
        {tabAtiva === 'financeiro'  && <SecaoFinanceiro projeto={projeto} vencimentos={vencimentos} />}
        {tabAtiva === 'po'          && <SecaoPO projeto={projeto} />}
        {tabAtiva === 'pre-eventos' && <SecaoPreEventos projeto={projeto} />}
      </main>
    </div>
  )
}
