import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, LogOut, CalendarClock } from 'lucide-react'
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

const FORNECEDORES_CHAVE = ['buffet', 'bar', 'cerveja', 'destilados', 'japa', 'chopp', 'food', 'bebida', 'catering']

function SecaoEvento({ projeto }: { projeto: Projeto }) {
  const { tap, secoes } = projeto

  const todosItens = secoes.flatMap(s => s.itens)

  const fornecedoresGrid = todosItens
    .filter(i => FORNECEDORES_CHAVE.some(k => i.item.toLowerCase().includes(k)))
    .map(i => ({ nome: i.item, fechado: i.fornecedor.trim() !== '' }))

  const secaoArtistica = secoes.find(s =>
    s.numero === '2.2' || s.nome.toLowerCase().includes('artíst') || s.nome.toLowerCase().includes('artist')
  )
  const lineup = (secaoArtistica?.itens ?? []).filter(i => i.fornecedor.trim() !== '')

  const itemCenografia = todosItens.find(i =>
    i.item.toLowerCase().includes('cenografia') || i.item.toLowerCase().includes('tema')
  )

  return (
    <div className="space-y-6">
      {/* Info do evento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Instituição', value: tap.instituicao || '—' },
          { label: 'Turma', value: tap.turma || '—' },
          { label: 'Data do Evento', value: tap.dataEvento ? fmtData(tap.dataEvento) : '—' },
          { label: 'Local', value: tap.local || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-bg rounded-lg px-4 py-3">
            <div className="text-text-muted text-xs mb-1">{label}</div>
            <div className="text-text-main text-sm font-medium truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Grid de fornecedores */}
      {fornecedoresGrid.length > 0 && (
        <div>
          <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Fornecedores</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {fornecedoresGrid.map(({ nome, fechado }) => (
              <div
                key={nome}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm ${
                  fechado
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-warning/30 bg-warning/10 text-warning'
                }`}
              >
                {fechado
                  ? <CheckCircle2 size={14} className="shrink-0" />
                  : <AlertTriangle size={14} className="shrink-0" />
                }
                <span className="truncate text-xs">{nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lineup artístico */}
      {lineup.length > 0 && (
        <div>
          <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Lineup Artístico</h3>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted text-xs font-medium">Atração / Horário</th>
                  <th className="text-left px-4 py-2 text-text-muted text-xs font-medium">Artista / Fornecedor</th>
                  <th className="text-right px-4 py-2 text-text-muted text-xs font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {lineup.map(item => (
                  <tr key={item.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-text-main text-xs">{item.item}</td>
                    <td className="px-4 py-2.5 text-text-main text-xs">{item.fornecedor}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === 'fechado' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                      }`}>
                        {item.status}
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
          <div className="bg-bg rounded-lg px-4 py-3 text-sm">
            <div className="text-text-main">{itemCenografia.fornecedor || '—'}</div>
            {itemCenografia.notas && <div className="text-text-muted text-xs mt-1">{itemCenografia.notas}</div>}
          </div>
        </div>
      )}

      {fornecedoresGrid.length === 0 && lineup.length === 0 && (
        <div className="text-text-muted text-sm text-center py-8">
          Detalhes do evento ainda não disponíveis.
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

  const kpis = [
    { label: 'Total Orçado', value: totalOrcado, color: 'text-text-main' },
    { label: 'Total Contratado', value: totalContratado, color: 'text-primary' },
    { label: 'Total Pago', value: totalPago, color: 'text-success' },
    { label: 'Falta Pagar', value: faltaPagar, color: 'text-warning' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="bg-bg rounded-lg px-4 py-4">
            <div className="text-text-muted text-xs mb-1">{label}</div>
            <div className={`text-lg font-semibold ${color}`}>{fmtBRL(value)}</div>
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
  const secoesVisiveis = projeto.secoes.filter(s =>
    s.numero.startsWith('2.') || ['2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'].includes(s.numero)
  )

  return (
    <div className="space-y-3">
      {secoesVisiveis.map(secao => {
        const totalOrcado = secao.itens.reduce((s, i) => s + i.valorOrcado, 0)
        const totalContratado = secao.itens.reduce((s, i) => s + i.valorContratado, 0)
        const pct = totalOrcado > 0 ? Math.min(100, (totalContratado / totalOrcado) * 100) : 0

        return (
          <div key={secao.id} className="bg-bg rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-text-main">
                <span className="text-text-muted text-xs mr-2">{secao.numero}</span>
                {secao.nome}
              </div>
              <div className="text-xs text-text-muted">
                {fmtBRL(totalContratado)} / {fmtBRL(totalOrcado)}
              </div>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: pct >= 80 ? '#00b894' : pct >= 40 ? '#E63329' : '#f59e0b' }}
              />
            </div>
            <div className="text-right text-xs text-text-muted mt-1">{pct.toFixed(0)}% contratado</div>
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
