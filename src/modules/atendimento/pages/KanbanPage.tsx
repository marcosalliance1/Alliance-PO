import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { etapaPipeline, type EtapaPipeline } from '../lib/rifaPipeline'
import { formatarValor } from '../lib/formatadores'
import { PipelineDrawer } from '../components/PipelineDrawer'
import { PipelineLegenda } from '../components/PipelineLegenda'
import { normalizarChave } from '../../../lib/rifasSync'
import type { Rifa, RifaGanhador, RifaCompra } from '../../../hooks/useRifas'

const DIAS_ATRASO_PADRAO = 7

const COLUNAS = [
  { titulo: 'Aguardando Sorteio', cor: 'border-t-text-muted' },
  { titulo: 'Sorteada, sem contato', cor: 'border-t-warning' },
  { titulo: 'Contatado, sem compra', cor: 'border-t-primary' },
  { titulo: 'Concluído', cor: 'border-t-success' },
]

interface CardInfo {
  rifa: Rifa
  ganhador: RifaGanhador | null
  compra: RifaCompra | null
  coluna: number
  diasParado: number | null
}

// Aproximação: como o schema não guarda "quando entrou nessa coluna" (só created_at/
// updated_at gerais), usamos a data mais relevante de cada etapa como referência pra
// calcular o "parado há X dias". Não é um histórico real de transição de estado.
function diasParadoNaColuna(coluna: number, rifa: Rifa, ganhador: RifaGanhador | null): number | null {
  let dataRef: string | null = null
  if (coluna === 0) dataRef = rifa.created_at?.slice(0, 10) ?? null
  else if (coluna === 1) dataRef = ganhador?.data_sorteio ?? rifa.dia_vencimento
  else if (coluna === 2) dataRef = ganhador?.data_sorteio ?? null
  if (!dataRef) return null
  return Math.floor((Date.now() - new Date(dataRef).getTime()) / 86_400_000)
}

const ETAPA_PARA_COLUNA: Record<EtapaPipeline, number> = {
  aguardando_sorteio: 0,
  sorteada_sem_contato: 1,
  contatado_sem_compra: 2,
  concluido: 3,
  nao_vai_ter: -1, // fora do quadro operacional
}

function colunaDoCard(rifa: Rifa, ganhador: RifaGanhador | null, compra: RifaCompra | null): number {
  return ETAPA_PARA_COLUNA[etapaPipeline(rifa, ganhador, compra)]
}

export function KanbanPage() {
  const { rifas, ganhadores, compras, dimensaoProjetos } = useAtendimento()
  const [detalhe, setDetalhe] = useState<CardInfo | null>(null)
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

  const cards = useMemo(() => {
    const lista: CardInfo[] = []
    const chaveBusca = busca.trim() ? normalizarChave(busca) : null
    for (const rifa of rifas) {
      if (filtroEnsino || filtroInstituicao) {
        const dim = rifa.dimensao_projeto_id ? dimensaoPorId.get(rifa.dimensao_projeto_id) : null
        if (!dim) continue
        if (filtroEnsino && dim.ensino !== filtroEnsino) continue
        if (filtroInstituicao && dim.instituicao !== filtroInstituicao) continue
      }
      const ganhador = ganhadores.find(g => g.rifa_id === rifa.id) ?? null
      if (chaveBusca && !normalizarChave(rifa.turma).includes(chaveBusca) && !normalizarChave(ganhador?.nome_ganhador ?? '').includes(chaveBusca)) continue
      const compra = ganhador ? compras.find(c => c.ganhador_id === ganhador.id) ?? null : null
      const coluna = colunaDoCard(rifa, ganhador, compra)
      if (coluna === -1) continue
      lista.push({ rifa, ganhador, compra, coluna, diasParado: diasParadoNaColuna(coluna, rifa, ganhador) })
    }
    return lista
  }, [rifas, ganhadores, compras, busca, filtroEnsino, filtroInstituicao, dimensaoPorId])

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

      <div className="flex flex-wrap items-center gap-3 mb-4">
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

      {/* Sem drag-and-drop nesta fase: o estado vem do sync com a planilha. Se no
          futuro quisermos permitir arrastar um card pra mudar de etapa direto no
          Alliance, isso precisaria escrever de volta pros campos correspondentes
          (contato_feito, status da compra etc.) e disparar a sincronização. */}
      <div className="grid grid-cols-4 gap-4">
        {COLUNAS.map((col, idx) => {
          const cardsColuna = cards.filter(c => c.coluna === idx)
          return (
            <div key={idx} className={`card border-t-4 ${col.cor} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text-main">{col.titulo}</h2>
                <span className="text-xs text-text-muted bg-white/5 rounded-full px-2 py-0.5">{cardsColuna.length}</span>
              </div>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {cardsColuna.length === 0 && <div className="text-xs text-text-muted text-center py-6">Nada por aqui.</div>}
                {cardsColuna.map(c => {
                  const atrasado = c.diasParado !== null && c.diasParado > diasAtrasoLimite
                  return (
                    <button
                      key={c.rifa.id}
                      onClick={() => setDetalhe(c)}
                      className="w-full text-left bg-bg rounded-lg p-3 border border-white/5 hover:border-primary/30 transition-colors"
                    >
                      <div className="text-sm font-semibold text-text-main">{c.rifa.turma}</div>
                      <div className="text-xs text-text-muted truncate mt-0.5" title={c.rifa.premio_descricao ?? ''}>{c.rifa.premio_descricao ?? '—'}</div>
                      {c.ganhador?.nome_ganhador && <div className="text-xs text-text-main mt-1">🏆 {c.ganhador.nome_ganhador}</div>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-text-muted">{formatarValor(c.rifa.valor_boleto)}</span>
                        {atrasado && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-danger/15 text-danger">
                            parado há {c.diasParado}d
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
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
