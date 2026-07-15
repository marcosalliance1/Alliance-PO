import { useMemo, useState } from 'react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { isRifaPipelineCompleto } from '../lib/rifaPipeline'
import { formatarValor } from '../lib/formatadores'
import { PipelineDrawer } from '../components/PipelineDrawer'
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

function colunaDoCard(rifa: Rifa, ganhador: RifaGanhador | null, compra: RifaCompra | null): number {
  if (isRifaPipelineCompleto(rifa, ganhador, compra)) return 3
  if (ganhador?.contato_feito) return 2
  if (rifa.situacao === 'SORTEADA') return 1
  if (rifa.situacao === 'EM ANDAMENTO') return 0
  return -1 // ex: "NÃO VAI TER" — fora do quadro operacional
}

export function KanbanPage() {
  const { rifas, ganhadores, compras } = useAtendimento()
  const [detalhe, setDetalhe] = useState<CardInfo | null>(null)
  const [diasAtrasoLimite, setDiasAtrasoLimite] = useState(DIAS_ATRASO_PADRAO)

  const cards = useMemo(() => {
    const lista: CardInfo[] = []
    for (const rifa of rifas) {
      const ganhador = ganhadores.find(g => g.rifa_id === rifa.id) ?? null
      const compra = ganhador ? compras.find(c => c.ganhador_id === ganhador.id) ?? null : null
      const coluna = colunaDoCard(rifa, ganhador, compra)
      if (coluna === -1) continue
      lista.push({ rifa, ganhador, compra, coluna, diasParado: diasParadoNaColuna(coluna, rifa, ganhador) })
    }
    return lista
  }, [rifas, ganhadores, compras])

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
