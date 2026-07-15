import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { Rifa, RifaGanhador, RifaCompra } from '../../../hooks/useRifas'
import { calcularPipeline } from '../lib/rifaPipeline'
import { formatarData, formatarValor } from '../lib/formatadores'
import { PipelineDots } from './PipelineDots'
import { ContatoBadges } from './ContatoBadges'

interface PipelineDrawerProps {
  aberto: boolean
  onFechar: () => void
  rifa: Rifa | null
  ganhador: RifaGanhador | null
  compra: RifaCompra | null
}

// Painel lateral com o detalhe completo das 3 etapas de uma rifa (ou sorteio avulso) —
// usado a partir do card do Kanban.
export function PipelineDrawer({ aberto, onFechar, rifa, ganhador, compra }: PipelineDrawerProps) {
  useEffect(() => {
    if (!aberto) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [aberto, onFechar])

  if (!aberto) return null
  const status = calcularPipeline(rifa, ganhador, compra)
  const titulo = rifa?.turma ?? ganhador?.turma ?? 'Detalhe'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative bg-surface w-full max-w-md h-full shadow-card flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-text-main">{titulo}</h2>
          <button onClick={onFechar} className="text-text-muted hover:text-text-main transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5 text-sm">
          <PipelineDots status={status} />

          <div>
            <div className="text-text-muted uppercase text-[10px] font-semibold mb-1.5">Sorteio</div>
            {rifa ? (
              <div className="text-text-main space-y-0.5">
                <div>Situação: {rifa.situacao ?? '—'}</div>
                <div>Prêmio: {rifa.premio_descricao ?? '—'}</div>
                <div>Data prevista: {formatarData(rifa.dia_vencimento)}</div>
                <div>Valor do prêmio: {formatarValor(rifa.valor_boleto)}</div>
              </div>
            ) : <div className="text-text-muted">Sorteio avulso, sem rifa cadastrada.</div>}
          </div>

          <div>
            <div className="text-text-muted uppercase text-[10px] font-semibold mb-1.5">Ganhador</div>
            {ganhador ? (
              <div className="text-text-main space-y-1">
                <div>{ganhador.nome_ganhador ?? '—'}</div>
                <ContatoBadges contato={ganhador.contato} />
                <div>Contato feito: {ganhador.contato_feito ? 'sim' : 'não'}</div>
                <div>Prêmio entregue: {ganhador.premio_entregue ?? '—'}</div>
              </div>
            ) : <div className="text-text-muted">Ainda não tem ganhador registrado.</div>}
          </div>

          <div>
            <div className="text-text-muted uppercase text-[10px] font-semibold mb-1.5">Compra do prêmio</div>
            {compra ? (
              <div className="text-text-main space-y-0.5">
                <div>Status: {compra.status ?? '—'}</div>
                <div>Valor: {formatarValor(compra.valor)}</div>
                <div>Comprado em: {formatarData(compra.data_compra)}</div>
                <div>Entrega: {compra.data_entrega_raw ?? '—'}</div>
              </div>
            ) : <div className="text-text-muted">Ainda sem compra registrada.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
