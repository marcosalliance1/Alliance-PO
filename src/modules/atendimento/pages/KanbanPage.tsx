import { useMemo, useState } from 'react'
import { Search, Inbox, Trophy, ShoppingCart, CheckCircle2 } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { montarInstanciasPipeline, type InstanciaPipeline } from '../lib/rifaPipeline'
import { formatarValor } from '../lib/formatadores'
import { PipelineDrawer } from '../components/PipelineDrawer'
import { PipelineLegenda } from '../components/PipelineLegenda'
import { normalizarChave } from '../../../lib/rifasSync'
import type { Rifa, RifaGanhador, RifaCompra } from '../../../hooks/useRifas'

const DIAS_ATRASO_PADRAO = 7

type Coluna = 'informacoes' | 'sorteadas' | 'acompanhamento'

const COLUNAS: { id: Coluna; titulo: string; subtitulo: string; icone: typeof Inbox; corTexto: string; corBarra: string; corBorda: string }[] = [
  { id: 'informacoes', titulo: 'Informações', subtitulo: 'Aguardando sorteio', icone: Inbox, corTexto: 'text-text-muted', corBarra: 'bg-white/20', corBorda: 'border-l-white/20' },
  { id: 'sorteadas', titulo: 'Sorteadas', subtitulo: 'Aguardando contato', icone: Trophy, corTexto: 'text-primary', corBarra: 'bg-primary', corBorda: 'border-l-primary' },
  { id: 'acompanhamento', titulo: 'Acompanhamento', subtitulo: 'Contato e compra do prêmio', icone: ShoppingCart, corTexto: 'text-warning', corBarra: 'bg-warning', corBorda: 'border-l-warning' },
]

function colunaDaInstancia(inst: InstanciaPipeline): Coluna | null {
  switch (inst.etapa) {
    case 'aguardando_sorteio': return 'informacoes'
    case 'sorteada_sem_contato': return 'sorteadas'
    case 'contatado_sem_compra':
    case 'concluido':
      return 'acompanhamento'
    default: return null // "nao_vai_ter" fica fora do quadro
  }
}

// Aproximação: como o schema não guarda "quando entrou nessa coluna" (só created_at/
// updated_at gerais), usamos a data mais relevante de cada etapa como referência pra
// calcular o "parado há X dias". Não é um histórico real de transição de estado.
function diasParadoNaColuna(col: Coluna, rifa: Rifa | null, ganhador: RifaGanhador | null): number | null {
  let dataRef: string | null = null
  if (col === 'informacoes') dataRef = rifa?.created_at?.slice(0, 10) ?? null
  else if (col === 'sorteadas') dataRef = ganhador?.data_sorteio ?? rifa?.dia_vencimento ?? null
  else if (col === 'acompanhamento') dataRef = ganhador?.data_sorteio ?? null
  if (!dataRef) return null
  return Math.floor((Date.now() - new Date(dataRef).getTime()) / 86_400_000)
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function Avatar({ nome }: { nome: string }) {
  return (
    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
      {iniciais(nome) || '?'}
    </span>
  )
}

export function KanbanPage() {
  const { rifas, ganhadores, compras, dimensaoProjetos } = useAtendimento()
  const [detalhe, setDetalhe] = useState<{ rifa: Rifa | null; ganhador: RifaGanhador | null; compra: RifaCompra | null } | null>(null)
  const [diasAtrasoLimite, setDiasAtrasoLimite] = useState(DIAS_ATRASO_PADRAO)
  const [busca, setBusca] = useState('')
  const [filtroEnsino, setFiltroEnsino] = useState('')
  const [filtroInstituicao, setFiltroInstituicao] = useState('')

  const dimensaoPorId = useMemo(() => new Map(dimensaoProjetos.map(d => [d.id, d])), [dimensaoProjetos])
  const ensinos = useMemo(() => Array.from(new Set(dimensaoProjetos.map(d => d.ensino))).sort(), [dimensaoProjetos])
  const instituicoes = useMemo(() => {
    const base = filtroEnsino ? dimensaoProjetos.filter(d => d.ensino === filtroEnsino) : dimensaoProjetos
    return Array.from(new Set(base.map(d => d.instituicao))).sort()
  }, [dimensaoProjetos, filtroEnsino])

  const instancias = useMemo(() => montarInstanciasPipeline(rifas, ganhadores, compras), [rifas, ganhadores, compras])

  const instanciasFiltradas = useMemo(() => {
    const chaveBusca = busca.trim() ? normalizarChave(busca) : null
    return instancias.filter(inst => {
      if (filtroEnsino || filtroInstituicao) {
        const dim = inst.rifa?.dimensao_projeto_id ? dimensaoPorId.get(inst.rifa.dimensao_projeto_id) : null
        if (!dim) return false
        if (filtroEnsino && dim.ensino !== filtroEnsino) return false
        if (filtroInstituicao && dim.instituicao !== filtroInstituicao) return false
      }
      if (chaveBusca) {
        const nome = inst.rifa?.turma ?? inst.ganhador?.turma ?? ''
        if (!normalizarChave(nome).includes(chaveBusca) && !normalizarChave(inst.ganhador?.nome_ganhador ?? '').includes(chaveBusca)) return false
      }
      return true
    })
  }, [instancias, busca, filtroEnsino, filtroInstituicao, dimensaoPorId])

  const porColuna = useMemo(() => {
    const grupos: Record<Coluna, InstanciaPipeline[]> = { informacoes: [], sorteadas: [], acompanhamento: [] }
    for (const inst of instanciasFiltradas) {
      const col = colunaDaInstancia(inst)
      if (col) grupos[col].push(inst)
    }
    grupos.acompanhamento.sort((a, b) => (a.etapa === 'concluido' ? 1 : 0) - (b.etapa === 'concluido' ? 1 : 0))
    return grupos
  }, [instanciasFiltradas])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-text-main">Kanban</h1>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          Marcar atraso após
          <input
            type="number"
            min={1}
            value={diasAtrasoLimite}
            onChange={e => setDiasAtrasoLimite(Math.max(1, Number(e.target.value) || DIAS_ATRASO_PADRAO))}
            className="w-14 bg-surface border border-white/10 rounded-lg px-2 py-1 text-text-main text-center"
          />
          dias parado
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por turma ou nome do ganhador..."
            className="bg-surface border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-text-main w-64"
          />
        </div>
        <select
          value={filtroEnsino}
          onChange={e => { setFiltroEnsino(e.target.value); setFiltroInstituicao('') }}
          className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
        >
          <option value="">Todos os ensinos</option>
          {ensinos.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={filtroInstituicao}
          onChange={e => setFiltroInstituicao(e.target.value)}
          className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
        >
          <option value="">Todas as instituições</option>
          {instituicoes.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <PipelineLegenda compacta />
      </div>

      {/* Sem drag-and-drop nesta fase: a coluna é calculada a partir do status real
          (situação/contato/compra), não é um estado manual arrastável. Se no futuro
          quisermos permitir arrastar um card pra mudar de etapa direto no Alliance,
          isso precisaria escrever nos campos correspondentes e disparar a sincronização. */}
      <div className="grid grid-cols-1 md:grid-cols-3">
        {COLUNAS.map((col, idx) => {
          const itens = porColuna[col.id]
          const Icone = col.icone
          return (
            <div
              key={col.id}
              className={`flex flex-col px-4 first:pl-0 last:pr-0 ${idx < COLUNAS.length - 1 ? 'md:border-r md:border-white/10' : ''}`}
            >
              <div className="flex flex-col max-h-[70vh] overflow-y-auto pr-1">
                <div className="sticky top-0 z-10 bg-bg pb-3">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`rounded-lg p-1.5 bg-white/5 ${col.corTexto}`}>
                      <Icone size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-main leading-tight">{col.titulo}</div>
                      <div className="text-[10px] text-text-muted leading-tight">{col.subtitulo}</div>
                    </div>
                    <span className="text-xs font-semibold text-text-muted bg-white/5 rounded-full px-2 py-0.5">{itens.length}</span>
                  </div>
                  <div className={`h-0.5 rounded-full ${col.corBarra} opacity-60`} />
                </div>

                <div className="flex flex-col gap-2.5">
                  {itens.length === 0 && (
                    <div className="text-xs text-text-muted text-center py-8 border border-dashed border-white/10 rounded-xl">Nada por aqui</div>
                  )}
                  {itens.map((inst, i) => {
                    const { rifa: r, ganhador: g, compra: c, etapa } = inst
                    const nome = r?.turma ?? g?.turma ?? '—'
                    const diasParado = diasParadoNaColuna(col.id, r, g)
                    const atrasado = diasParado !== null && diasParado > diasAtrasoLimite
                    return (
                      <button
                        key={i}
                        onClick={() => setDetalhe({ rifa: r, ganhador: g, compra: c })}
                        className={`text-left bg-surface rounded-xl p-3.5 border-l-4 ${col.corBorda} border-y border-r border-white/5 hover:border-primary/30 hover:shadow-lg transition-all`}
                      >
                        <div className={`flex items-start justify-between gap-2 ${col.corTexto}`}>
                          <span className="text-sm font-semibold text-text-main">{nome}</span>
                          {etapa === 'concluido' && <CheckCircle2 size={15} className="text-success shrink-0" />}
                        </div>
                        <div className="text-xs text-text-muted truncate mt-0.5" title={r?.premio_descricao ?? g?.premio_descricao ?? ''}>
                          {r?.premio_descricao ?? g?.premio_descricao ?? 'Sem descrição de prêmio'}
                        </div>

                        {col.id === 'informacoes' && (
                          <div className="flex items-center justify-between mt-2.5 text-xs">
                            <span className="text-text-muted">{formatarValor(r?.valor_boleto ?? null)}</span>
                            {atrasado && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-danger/15 text-danger">parado há {diasParado}d</span>
                            )}
                          </div>
                        )}

                        {col.id === 'sorteadas' && (
                          <div className="flex items-center justify-between mt-2.5">
                            {g?.nome_ganhador ? (
                              <span className="flex items-center gap-1.5 text-xs text-text-main">
                                <Avatar nome={g.nome_ganhador} /> {g.nome_ganhador}
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted">Sem ganhador registrado</span>
                            )}
                            {atrasado ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-danger/15 text-danger">parado há {diasParado}d</span>
                            ) : (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">contato pendente</span>
                            )}
                          </div>
                        )}

                        {col.id === 'acompanhamento' && (
                          <div className="mt-2.5 space-y-1.5">
                            {g?.nome_ganhador && (
                              <span className="flex items-center gap-1.5 text-xs text-text-main">
                                <Avatar nome={g.nome_ganhador} /> {g.nome_ganhador}
                              </span>
                            )}
                            <div className="flex items-center justify-between text-xs">
                              <span className={c?.status === 'Comprado' ? 'text-success' : 'text-text-muted'}>
                                {c?.status ?? 'Sem compra registrada'}
                              </span>
                              <span className="text-text-muted">{formatarValor(c?.valor ?? null)}</span>
                            </div>
                            {atrasado && etapa !== 'concluido' && (
                              <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-danger/15 text-danger">parado há {diasParado}d</span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <PipelineDrawer
        aberto={!!detalhe}
        onFechar={() => setDetalhe(null)}
        rifa={detalhe?.rifa ?? null}
        ganhador={detalhe?.ganhador ?? null}
        compra={detalhe?.compra ?? null}
      />
    </div>
  )
}
