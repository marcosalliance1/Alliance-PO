import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader, ListChecks, CheckCircle2, Clock, AlertTriangle, Flame, Search } from 'lucide-react'
import { useMarketing, type MarketingGrupo } from '../hooks/useMarketing'
import { KPICard } from '../components/dashboard/KPICard'
import { TabelaArvore, type TabelaArvoreItem } from '../components/marketing/TabelaArvore'

const C_PRIMARY = '#e94560'
const C_SUCCESS = '#00b894'
const C_ABERTO  = '#fdcb6e'
const C_DANGER  = '#e17055'
const C_AZUL    = '#0078d4'

type Modo = 'responsavel' | 'projeto'

interface OpcaoBusca {
  valor: string
  label: string
  tag?: string
}

function BuscaSelect({ opcoes, valorSelecionado, onSelecionar, placeholder }: {
  opcoes: OpcaoBusca[]
  valorSelecionado: string | null
  onSelecionar: (opcao: OpcaoBusca) => void
  placeholder: string
}) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)

  const filtradas = opcoes.filter(o => o.label.toLowerCase().includes(busca.toLowerCase())).slice(0, 50)
  const labelSelecionado = opcoes.find(o => o.valor === valorSelecionado)?.label ?? ''

  return (
    <div className="relative w-full sm:w-80">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
      <input
        value={aberto ? busca : labelSelecionado}
        onChange={e => { setBusca(e.target.value); setAberto(true) }}
        onFocus={() => { setAberto(true); setBusca('') }}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
      />
      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-surface border border-white/10 rounded-lg shadow-card">
            {filtradas.map(o => (
              <button
                key={o.valor}
                onClick={() => { onSelecionar(o); setAberto(false) }}
                className="w-full text-left px-3 py-2 text-sm text-text-main hover:bg-white/5 flex items-center justify-between gap-2"
              >
                <span className="truncate">{o.label}</span>
                {o.tag && <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded bg-white/10 text-text-muted">{o.tag}</span>}
              </button>
            ))}
            {filtradas.length === 0 && <div className="px-3 py-2 text-sm text-text-muted">Nada encontrado.</div>}
          </div>
        </>
      )}
    </div>
  )
}

export function MarketingDetalhe() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { grupos, demandas, responsaveis, subitens, carregando } = useMarketing()

  const modoInicial: Modo = searchParams.get('modo') === 'projeto' ? 'projeto' : 'responsavel'
  const [modo, setModo] = useState<Modo>(modoInicial)
  const [selResponsavel, setSelResponsavel] = useState<string | null>(
    modoInicial === 'responsavel' ? searchParams.get('valor') : null
  )
  const [selProjeto, setSelProjeto] = useState<{ valor: string; oficial: boolean } | null>(
    modoInicial === 'projeto' && searchParams.get('valor')
      ? { valor: searchParams.get('valor')!, oficial: searchParams.get('oficial') === '1' }
      : null
  )
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [filtroGrupo, setFiltroGrupo] = useState<string | null>(null)

  const grupoMap = useMemo(() => {
    const m = new Map<string, MarketingGrupo>()
    for (const g of grupos) m.set(g.group_id, g)
    return m
  }, [grupos])

  const respPorItem = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const r of responsaveis) {
      const arr = m.get(r.item_id) ?? []
      arr.push(r.person_name)
      m.set(r.item_id, arr)
    }
    return m
  }, [responsaveis])

  const subitensPorItem = useMemo(() => {
    const m = new Map<number, typeof subitens>()
    for (const s of subitens) {
      const arr = m.get(s.item_id) ?? []
      arr.push(s)
      m.set(s.item_id, arr)
    }
    return m
  }, [subitens])

  // ── Opções dos dois modos ────────────────────────────────────────
  const opcoesResponsavel: OpcaoBusca[] = useMemo(() => {
    const nomes = new Set<string>()
    for (const r of responsaveis) nomes.add(r.person_name)
    for (const s of subitens) if (s.owner_person_name) nomes.add(s.owner_person_name)
    return Array.from(nomes).sort((a, b) => a.localeCompare(b)).map(n => ({ valor: n, label: n }))
  }, [responsaveis, subitens])

  const opcoesProjeto: (OpcaoBusca & { oficial: boolean })[] = useMemo(() => {
    const porCliente = new Map<string, { valor: string; label: string; oficial: boolean }>()
    for (const d of demandas) {
      if (!d.cliente_extraido || porCliente.has(d.cliente_extraido)) continue
      if (d.match_dimensao && d.dimensao_nome_projeto) {
        porCliente.set(d.cliente_extraido, { valor: d.dimensao_nome_projeto, label: d.dimensao_nome_projeto, oficial: true })
      } else {
        porCliente.set(d.cliente_extraido, { valor: d.cliente_extraido, label: d.cliente_extraido, oficial: false })
      }
    }
    // Várias variantes de cliente_extraido (ex: "CMMG 82" e "CMMG82") podem resolver para o
    // mesmo nome oficial da dimensão — dedupe também pelo valor final, não só pela chave bruta.
    const porValorFinal = new Map<string, { valor: string; label: string; oficial: boolean }>()
    for (const o of porCliente.values()) {
      if (!porValorFinal.has(o.valor)) porValorFinal.set(o.valor, o)
    }
    return Array.from(porValorFinal.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(o => ({ ...o, tag: o.oficial ? 'oficial' : 'aproximado' }))
  }, [demandas])

  // ── Seleção principal ────────────────────────────────────────────
  const itensSelecionados = useMemo(() => {
    if (modo === 'responsavel') {
      if (!selResponsavel) return []
      return demandas.filter(d => !!respPorItem.get(d.id)?.includes(selResponsavel))
    }
    if (!selProjeto) return []
    return demandas.filter(d => (selProjeto.oficial ? d.dimensao_nome_projeto === selProjeto.valor : d.cliente_extraido === selProjeto.valor))
  }, [demandas, modo, selResponsavel, selProjeto, respPorItem])

  const subitensSelecionados = useMemo(() => {
    if (modo === 'responsavel') {
      if (!selResponsavel) return []
      return subitens.filter(s => s.owner_person_name === selResponsavel)
    }
    const idsItens = new Set(itensSelecionados.map(d => d.id))
    return subitens.filter(s => idsItens.has(s.item_id))
  }, [subitens, modo, selResponsavel, itensSelecionados])

  const hoje = new Date().toISOString().slice(0, 10)

  const resumoItens = useMemo(() => {
    const total = itensSelecionados.length
    const done = itensSelecionados.filter(d => d.status_is_done).length
    const atrasadas = itensSelecionados.filter(d => !d.status_is_done && !!d.data_fim && d.data_fim < hoje).length
    const urgentes = itensSelecionados.filter(d => !d.status_is_done && d.prioridade === 'Urgente').length
    return { total, done, abertos: total - done, atrasadas, urgentes }
  }, [itensSelecionados, hoje])

  const resumoSubitens = useMemo(() => {
    const total = subitensSelecionados.length
    const done = subitensSelecionados.filter(s => s.status_is_done).length
    const atrasados = subitensSelecionados.filter(s => !s.status_is_done && !!s.data && s.data < hoje).length
    return { total, done, abertos: total - done, atrasados }
  }, [subitensSelecionados, hoje])

  // ── Filtros secundários ──────────────────────────────────────────
  const gruposDisponiveis = useMemo(() => {
    const nomes = new Set<string>()
    for (const d of itensSelecionados) nomes.add((d.group_id ? grupoMap.get(d.group_id)?.nome : null) ?? '(sem grupo)')
    return Array.from(nomes).sort((a, b) => a.localeCompare(b))
  }, [itensSelecionados, grupoMap])

  const statusDisponiveis = useMemo(() => {
    const nomes = new Set<string>()
    for (const d of itensSelecionados) nomes.add(d.status)
    return Array.from(nomes).sort((a, b) => a.localeCompare(b))
  }, [itensSelecionados])

  const itensTabela: TabelaArvoreItem[] = useMemo(() => {
    return itensSelecionados
      .filter(d => !filtroStatus || d.status === filtroStatus)
      .filter(d => !filtroGrupo || ((d.group_id ? grupoMap.get(d.group_id)?.nome : null) ?? '(sem grupo)') === filtroGrupo)
      .map(d => ({
        id: d.id,
        nome: d.nome,
        status: d.status,
        statusIsDone: d.status_is_done,
        grupo: (d.group_id ? grupoMap.get(d.group_id)?.nome : null) ?? '(sem grupo)',
        responsavel: respPorItem.get(d.id)?.join(', ') || '—',
        dataFim: d.data_fim,
        prioridade: d.prioridade,
        subitens: (subitensPorItem.get(d.id) ?? []).map(s => ({
          id: s.id,
          nome: s.nome,
          status: s.status,
          statusIsDone: s.status_is_done,
          owner: s.owner_person_name,
          data: s.data,
        })),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [itensSelecionados, filtroStatus, filtroGrupo, grupoMap, respPorItem, subitensPorItem])

  function trocarModo(novoModo: Modo) {
    setModo(novoModo)
    setSelResponsavel(null)
    setSelProjeto(null)
    setFiltroStatus(null)
    setFiltroGrupo(null)
    setSearchParams(novoModo === 'projeto' ? { modo: 'projeto' } : {})
  }

  function selecionarResponsavel(opcao: OpcaoBusca) {
    setSelResponsavel(opcao.valor)
    setFiltroStatus(null)
    setFiltroGrupo(null)
    setSearchParams({ modo: 'responsavel', valor: opcao.valor })
  }

  function selecionarProjeto(opcao: OpcaoBusca & { oficial: boolean }) {
    setSelProjeto({ valor: opcao.valor, oficial: opcao.oficial })
    setFiltroStatus(null)
    setFiltroGrupo(null)
    setSearchParams({ modo: 'projeto', valor: opcao.valor, oficial: opcao.oficial ? '1' : '0' })
  }

  const temSelecao = modo === 'responsavel' ? !!selResponsavel : !!selProjeto

  if (carregando) {
    return (
      <div className="min-h-screen bg-bg p-6 max-w-screen-xl mx-auto flex items-center justify-center h-64 gap-3 text-text-muted">
        <Loader size={20} className="animate-spin" />
        <span className="text-sm">Carregando dados de marketing...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="p-6 max-w-screen-xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate('/marketing')}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main transition-colors mb-2"
          >
            <ArrowLeft size={13} /> Voltar ao Marketing
          </button>
          <h1 className="text-text-main text-xl font-bold">Detalhe por Responsável / Projeto-Turma</h1>
          <p className="text-text-muted text-xs mt-0.5">Explore a carga de trabalho por pessoa ou por cliente/projeto, com subitens em árvore.</p>
        </div>

        {/* Seletor de modo + busca */}
        <div className="card">
          <div className="flex items-center gap-1 text-xs bg-white/5 rounded-lg p-0.5 w-fit mb-4">
            <button
              onClick={() => trocarModo('responsavel')}
              className={`px-3 py-1.5 rounded-md transition-colors ${modo === 'responsavel' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-main'}`}
            >
              Por Responsável
            </button>
            <button
              onClick={() => trocarModo('projeto')}
              className={`px-3 py-1.5 rounded-md transition-colors ${modo === 'projeto' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-main'}`}
            >
              Por Projeto/Turma
            </button>
          </div>

          {modo === 'responsavel' ? (
            <BuscaSelect
              opcoes={opcoesResponsavel}
              valorSelecionado={selResponsavel}
              onSelecionar={selecionarResponsavel}
              placeholder="Buscar responsável..."
            />
          ) : (
            <BuscaSelect
              opcoes={opcoesProjeto}
              valorSelecionado={selProjeto?.valor ?? null}
              onSelecionar={(o) => selecionarProjeto(o as OpcaoBusca & { oficial: boolean })}
              placeholder="Buscar projeto/turma..."
            />
          )}
        </div>

        {!temSelecao ? (
          <div className="card flex items-center justify-center h-40 text-text-muted text-sm">
            Selecione {modo === 'responsavel' ? 'um responsável' : 'um projeto/turma'} para ver o detalhe.
          </div>
        ) : (
          <>
            {/* Cards de resumo — itens */}
            <div>
              <p className="text-text-muted text-xs font-semibold uppercase tracking-wide mb-2">Itens (demandas)</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <KPICard title="Total" value={resumoItens.total.toLocaleString('pt-BR')} icon={ListChecks} color={C_PRIMARY} />
                <KPICard title="Concluídos" value={resumoItens.done.toLocaleString('pt-BR')} icon={CheckCircle2} color={C_SUCCESS} />
                <KPICard title="Em Aberto" value={resumoItens.abertos.toLocaleString('pt-BR')} icon={Clock} color={C_ABERTO} />
                <KPICard title="Atrasadas" value={resumoItens.atrasadas.toLocaleString('pt-BR')} icon={AlertTriangle} color={C_DANGER} />
                <KPICard title="Urgentes em Aberto" value={resumoItens.urgentes.toLocaleString('pt-BR')} icon={Flame} color={C_PRIMARY} />
              </div>
            </div>

            {/* Cards de resumo — subitens */}
            <div>
              <p className="text-text-muted text-xs font-semibold uppercase tracking-wide mb-2">Subitens</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="Total" value={resumoSubitens.total.toLocaleString('pt-BR')} icon={ListChecks} color={C_AZUL} />
                <KPICard title="Concluídos" value={resumoSubitens.done.toLocaleString('pt-BR')} icon={CheckCircle2} color={C_SUCCESS} />
                <KPICard title="Em Aberto" value={resumoSubitens.abertos.toLocaleString('pt-BR')} icon={Clock} color={C_ABERTO} />
                <KPICard title="Atrasados" value={resumoSubitens.atrasados.toLocaleString('pt-BR')} icon={AlertTriangle} color={C_DANGER} />
              </div>
            </div>

            {/* Tabela em árvore + filtros secundários */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
                <span className="text-text-main text-sm font-semibold">
                  Itens {modo === 'responsavel' ? `de ${selResponsavel}` : `de ${selProjeto?.valor}`}
                  <span className="text-xs text-text-muted font-normal"> ({itensTabela.length})</span>
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={filtroGrupo ?? ''}
                    onChange={e => setFiltroGrupo(e.target.value || null)}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary/50"
                  >
                    <option value="">Todos os grupos</option>
                    {gruposDisponiveis.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select
                    value={filtroStatus ?? ''}
                    onChange={e => setFiltroStatus(e.target.value || null)}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary/50"
                  >
                    <option value="">Todos os status</option>
                    {statusDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <TabelaArvore itens={itensTabela} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
