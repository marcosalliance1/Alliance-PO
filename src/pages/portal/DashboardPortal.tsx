import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, LogOut, CalendarClock, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePortalAuth } from '../../contexts/PortalAuthContext'
import allianceLogo from '../../assets/alliance-logo.png'
import type { Projeto, SecaoCusto, TAP, Receitas, CustoAdicional, ConciliacaoEverest } from '../../types'

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

// ─── Seção 1: Status do Evento ────────────────────────────────────────────────

// Cada categoria define o label visível e as palavras-chave para encontrar o item no projeto
const CATEGORIAS_FORNECEDOR = [
  { label: 'Buffet',     keywords: ['buffet', 'catering', 'alimentação'] },
  { label: 'Bar',        keywords: ['bar '] },
  { label: 'Cerveja',    keywords: ['cerveja', 'chopp'] },
  { label: 'Destilados', keywords: ['destilado'] },
  { label: 'Japa',       keywords: ['japa', 'japonês', 'sushi'] },
  { label: 'Som',        keywords: ['som', 'sonorização', 'audio'] },
  { label: 'Iluminação', keywords: ['iluminação', 'luz'] },
]

function SecaoEvento({ projeto }: { projeto: Projeto }) {
  const { tap, secoes } = projeto
  const todosItens = secoes.flatMap(s => s.itens)

  // Monta grid de categorias nomeadas: acha o primeiro item matching e mostra o fornecedor
  const categoriasGrid = CATEGORIAS_FORNECEDOR.map(cat => {
    const item = todosItens.find(i =>
      cat.keywords.some(k => i.item.toLowerCase().includes(k))
    )
    return { label: cat.label, fornecedor: item?.fornecedor?.trim() || '', fechado: !!item?.fornecedor?.trim() }
  })

  const secaoArtistica = secoes.find(s =>
    s.numero === '2.2' || s.nome.toLowerCase().includes('artíst') || s.nome.toLowerCase().includes('artist')
  )
  // Lineup: todos os itens artísticos, com ou sem fornecedor (para mostrar horários pendentes também)
  const lineup = secaoArtistica?.itens ?? []

  const itemCenografia = todosItens.find(i =>
    i.item.toLowerCase().includes('cenografia') || i.item.toLowerCase().includes('tema')
  )

  return (
    <div className="space-y-6">
      {/* Info do evento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Instituição', value: tap.instituicao || '—' },
          { label: 'Turma', value: tap.turma || '—' },
          { label: 'Data do Evento', value: tap.dataEvento ? fmtData(tap.dataEvento) : '—' },
          { label: 'Local', value: tap.local || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-bg rounded-xl px-4 py-3">
            <div className="text-text-muted text-xs mb-1">{label}</div>
            <div className="text-text-main text-sm font-semibold leading-snug">{value}</div>
          </div>
        ))}
      </div>

      {/* Grid de fornecedores nomeados */}
      <div>
        <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Fornecedores</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {categoriasGrid.map(({ label, fornecedor, fechado }) => (
            <div
              key={label}
              className={`rounded-xl px-4 py-3 border ${
                fechado ? 'border-success/25 bg-success/8' : 'border-white/8 bg-surface'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">{label}</span>
                {fechado
                  ? <CheckCircle2 size={13} className="text-success" />
                  : <AlertTriangle size={13} className="text-warning/70" />
                }
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
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === 'fechado' ? 'bg-success/20 text-success' : 'bg-warning/15 text-warning'
                      }`}>
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

      {/* Cenografia */}
      {itemCenografia && (
        <div>
          <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Cenografia / Tema</h3>
          <div className={`rounded-xl border px-4 py-3 ${itemCenografia.fornecedor ? 'border-success/25 bg-success/8' : 'border-white/8 bg-surface'}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-text-main">
                {itemCenografia.fornecedor || <span className="text-text-muted font-normal">Pendente</span>}
              </div>
              {itemCenografia.fornecedor
                ? <CheckCircle2 size={14} className="text-success" />
                : <AlertTriangle size={14} className="text-warning/70" />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Seção 2: Financeiro Resumido ─────────────────────────────────────────────

function SecaoFinanceiro({ projeto, vencimentos }: { projeto: Projeto; vencimentos: CapVencimento[] }) {
  const allItens = projeto.secoes.flatMap(s => s.itens)
  const totalOrcado = allItens.reduce((s, i) => s + i.valorOrcado, 0)
  const totalContratado = allItens.reduce((s, i) => s + i.valorContratado, 0)
  const totalPago = allItens.reduce((s, i) => s + i.valorPago, 0)
  const faltaPagar = allItens.reduce((s, i) => s + i.faltaPagar, 0)
  const pctContratado = totalOrcado > 0 ? (totalContratado / totalOrcado) * 100 : 0
  const pctPago = totalContratado > 0 ? (totalPago / totalContratado) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Linha 1: valores monetários */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orçado',     value: fmtBRL(totalOrcado),     color: 'text-text-main' },
          { label: 'Total Contratado', value: fmtBRL(totalContratado), color: 'text-primary' },
          { label: 'Total Pago',       value: fmtBRL(totalPago),       color: 'text-success' },
          { label: 'Falta Pagar',      value: fmtBRL(faltaPagar),      color: 'text-warning' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-bg rounded-xl px-4 py-4">
            <div className="text-text-muted text-xs mb-1">{label}</div>
            <div className={`text-lg font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      {/* Linha 2: porcentagens */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '% Contratado', pct: pctContratado, color: '#E63329' },
          { label: '% Pago',       pct: pctPago,       color: '#00b894' },
        ].map(({ label, pct, color }) => (
          <div key={label} className="bg-bg rounded-xl px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-muted text-xs">{label}</span>
              <span className="text-sm font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

      {vencimentos.length > 0 && (
        <div>
          <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <CalendarClock size={12} /> Próximos Vencimentos (30 dias)
          </h3>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted text-xs font-medium">Fornecedor</th>
                  <th className="text-left px-4 py-2 text-text-muted text-xs font-medium">Categoria</th>
                  <th className="text-right px-4 py-2 text-text-muted text-xs font-medium">Vencimento</th>
                  <th className="text-right px-4 py-2 text-text-muted text-xs font-medium">Valor</th>
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
        </div>
      )}

      {vencimentos.length === 0 && (
        <div className="text-text-muted text-sm text-center py-4">
          Sem vencimentos nos próximos 30 dias.
        </div>
      )}
    </div>
  )
}

// ─── Seção 3: PO Resumido ─────────────────────────────────────────────────────

function SecaoPO({ projeto }: { projeto: Projeto }) {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  const secoesVisiveis = projeto.secoes.filter(s => s.numero.startsWith('2.'))

  function toggle(id: string) {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-2">
      {secoesVisiveis.map(secao => {
        const totalOrcado = secao.itens.reduce((s, i) => s + i.valorOrcado, 0)
        const totalContratado = secao.itens.reduce((s, i) => s + i.valorContratado, 0)
        const pct = totalOrcado > 0 ? Math.min(100, (totalContratado / totalOrcado) * 100) : 0
        const aberto = expandidos[secao.id] ?? false

        // Agrupa itens por subcategoria para o drill-down
        const porSubcat: Record<string, { contratado: number; orcado: number }> = {}
        for (const item of secao.itens) {
          const sub = item.subcategoria?.trim() || item.area?.trim() || 'Geral'
          if (!porSubcat[sub]) porSubcat[sub] = { contratado: 0, orcado: 0 }
          porSubcat[sub].contratado += item.valorContratado
          porSubcat[sub].orcado += item.valorOrcado
        }
        const subcats = Object.entries(porSubcat)

        return (
          <div key={secao.id} className="bg-bg rounded-xl overflow-hidden">
            {/* Cabeçalho clicável */}
            <button
              onClick={() => toggle(secao.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
            >
              <span className="text-text-muted shrink-0">
                {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="text-text-muted text-xs w-8 shrink-0">{secao.numero}</span>
              <span className="flex-1 text-sm font-medium text-text-main">{secao.nome}</span>
              <span className="text-xs text-text-muted shrink-0">{fmtBRL(totalContratado)} / {fmtBRL(totalOrcado)}</span>
            </button>

            {/* Barra de progresso */}
            <div className="px-4 pb-3">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct >= 80 ? '#00b894' : pct >= 40 ? '#E63329' : '#f59e0b' }}
                />
              </div>
              <div className="text-right text-xs text-text-muted mt-1">{pct.toFixed(0)}% contratado</div>
            </div>

            {/* Drill-down: subcategorias */}
            {aberto && subcats.length > 0 && (
              <div className="border-t border-white/8 px-4 py-2 space-y-1 pb-3">
                {subcats.map(([sub, vals]) => {
                  const contratado = vals.contratado > 0
                  return (
                    <div key={sub} className="flex items-center gap-3 py-1.5">
                      {contratado
                        ? <CheckCircle2 size={13} className="text-success shrink-0" />
                        : <AlertTriangle size={13} className="text-warning/60 shrink-0" />
                      }
                      <span className={`text-sm flex-1 ${contratado ? 'text-text-main' : 'text-text-muted'}`}>{sub}</span>
                      <span className={`text-xs ${contratado ? 'text-success' : 'text-warning/70'}`}>
                        {contratado ? 'Contratado' : 'Pendente'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard Principal ──────────────────────────────────────────────────────

type Secao = 'evento' | 'financeiro' | 'po'

const SECOES: { id: Secao; label: string }[] = [
  { id: 'evento', label: 'Status do Evento' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'po', label: 'P.O. Resumido' },
]

export function DashboardPortal() {
  const { session, signOut } = usePortalAuth()
  const navigate = useNavigate()
  const [projeto, setProjeto] = useState<Projeto | null>(null)
  const [vencimentos, setVencimentos] = useState<CapVencimento[]>([])
  const [loading, setLoading] = useState(true)
  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('evento')

  function handleSignOut() {
    signOut()
    navigate('/portal', { replace: true })
  }

  useEffect(() => {
    if (!session?.projetoId) return

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('projetos')
        .select('*')
        .eq('id', session!.projetoId)
        .single()

      if (!data) { setLoading(false); return }

      const proj = rowToProjeto(data as Record<string, unknown>)
      setProjeto(proj)

      // Próximos vencimentos: busca por turma ou instituicao
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
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted text-sm">
        Projeto não encontrado.
      </div>
    )
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
              <div className="text-text-muted text-xs">{fmtData(projeto.tap.dataEvento)}{projeto.tap.local ? ` · ${projeto.tap.local}` : ''}</div>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-text-muted hover:text-text-main text-xs transition-colors"
        >
          <LogOut size={13} /> Sair
        </button>
      </header>

      {/* Nav tabs */}
      <div className="border-b border-white/10 px-4 sm:px-8">
        <div className="flex gap-1">
          {SECOES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSecaoAtiva(id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                secaoAtiva === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        {secaoAtiva === 'evento' && <SecaoEvento projeto={projeto} />}
        {secaoAtiva === 'financeiro' && <SecaoFinanceiro projeto={projeto} vencimentos={vencimentos} />}
        {secaoAtiva === 'po' && <SecaoPO projeto={projeto} />}
      </main>
    </div>
  )
}
