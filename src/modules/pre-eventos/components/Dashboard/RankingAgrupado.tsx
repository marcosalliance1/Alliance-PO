import React, { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { formatBRL } from '../../utils/formatters'

export interface EventoBreakdown { id: string; label: string; valor: number }
export interface RankingItem { nome: string; pago: number; orcado: number; eventos: EventoBreakdown[] }

interface Props {
  titulo: string
  subtitulo?: string
  icone: React.ReactNode
  itens: RankingItem[]
  onAbrirEvento: (id: string) => void
  limiteInicial?: number
}

export const RankingAgrupado: React.FC<Props> = ({ titulo, subtitulo, icone, itens, onAbrirEvento, limiteInicial = 8 }) => {
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})
  const [mostrarTodos, setMostrarTodos] = useState(false)

  const max = itens[0] ? (itens[0].pago || itens[0].orcado || 1) : 1
  const visiveis = mostrarTodos ? itens : itens.slice(0, limiteInicial)

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-5 h-full">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">{icone}</span>
        <div className="min-w-0">
          <h2 className="text-white font-semibold text-sm leading-tight">{titulo}</h2>
          {subtitulo && <p className="text-[11px] text-muted">{subtitulo}</p>}
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="text-xs text-muted py-6 text-center">Nenhum dado ainda.</p>
      ) : (
        <div className="space-y-0.5">
          {visiveis.map((l, i) => {
            const valor = l.pago || l.orcado
            const soOrcado = l.pago === 0
            const temDrill = l.eventos.length > 1
            const aberto = expandido[l.nome]
            const abrir = () => temDrill ? setExpandido(p => ({ ...p, [l.nome]: !p[l.nome] })) : onAbrirEvento(l.eventos[0]?.id)

            return (
              <div key={l.nome}>
                <button onClick={abrir} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i < 3 ? 'bg-accent/20 text-accent' : 'bg-white/5 text-muted'}`}>{i + 1}</span>
                    <span className="text-sm text-white truncate flex-1 group-hover:text-accent transition-colors" title={l.nome}>{l.nome}</span>
                    <span className="text-sm font-semibold text-white shrink-0">{formatBRL(valor)}</span>
                    {temDrill
                      ? (aberto ? <ChevronDown className="w-4 h-4 text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted shrink-0" />)
                      : <ExternalLink className="w-3.5 h-3.5 text-muted/40 shrink-0 group-hover:text-accent transition-colors" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 pl-7">
                    <div className="h-1 rounded-full overflow-hidden bg-white/5 flex-1">
                      <div className="h-full rounded-full bg-accent/60" style={{ width: `${(valor / max) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted shrink-0">{l.eventos.length} ev{soOrcado ? ' · orç.' : ''}</span>
                  </div>
                </button>

                {temDrill && aberto && (
                  <div className="ml-9 mt-0.5 mb-1 space-y-0.5 border-l border-bordercol pl-3">
                    {l.eventos.map(ev => (
                      <button key={ev.id} onClick={() => onAbrirEvento(ev.id)}
                        className="w-full flex items-center gap-2 text-[11px] text-muted hover:text-accent transition-colors group py-0.5">
                        <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-50 group-hover:opacity-100" />
                        <span className="truncate flex-1 text-left">{ev.label}</span>
                        <span className="shrink-0 text-gray-300 group-hover:text-accent">{formatBRL(ev.valor)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {itens.length > limiteInicial && (
            <button onClick={() => setMostrarTodos(m => !m)} className="mt-3 ml-2 text-xs text-accent hover:underline">
              {mostrarTodos ? 'Ver menos' : `Ver todos (${itens.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
