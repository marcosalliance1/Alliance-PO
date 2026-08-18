import React, { useMemo, useState } from 'react'
import { Plus, Lightbulb, ChevronDown, ChevronRight, Utensils } from 'lucide-react'
import type { Orcamento } from '../../types'
import { formatBRL } from '../../utils/formatters'
import { gerarItensDoHistorico, custoPerCapitaAB, type ItemEstimado } from '../../utils/estimativa'
import { SECOES, type SecaoKeyEverest } from '../../utils/matchEverest'
import { useAppContext } from '../../contexts/AppContext'

interface Props {
  orc: Orcamento
  onAdicionar: (secao: SecaoKeyEverest, item: ItemEstimado) => void
}

// Itens raros do histórico (de eventos específicos) que a atendente pode
// adicionar com 1 clique se aquele orçamento também for ter.
export const PainelSugestoes: React.FC<Props> = ({ orc, onAdicionar }) => {
  const { orcamentos } = useAppContext()
  const [aberto, setAberto] = useState(false)

  const porSecao = useMemo(() => {
    const g = gerarItensDoHistorico(orcamentos, orc.tipo, orc.quantidadeConvidados)
    return SECOES.map(s => {
      const jaTem = new Set(orc[s.key].map(i => i.item.trim().toLowerCase()))
      const sugestoes = g.sugestoesPorSecao[s.key].filter(e => !jaTem.has(e.item.trim().toLowerCase()))
      return { secao: s, sugestoes }
    }).filter(x => x.sugestoes.length > 0)
  }, [orcamentos, orc])

  const total = useMemo(() => porSecao.reduce((s, x) => s + x.sugestoes.length, 0), [porSecao])

  // Referência de quanto se gasta por pessoa em cada item de A&B (Buffet, Chopp,
  // Bar de Drinks...), pela mediana histórica do tipo. Guia pra quem preenche à mão.
  const perCapitaAB = useMemo(() => custoPerCapitaAB(orcamentos, orc.tipo), [orcamentos, orc.tipo])
  const conv = orc.quantidadeConvidados || 0

  if (porSecao.length === 0 && perCapitaAB.length === 0) return null

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card mt-6">
      <button
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center justify-between gap-2 p-5 text-left"
      >
        <span className="text-white font-bold text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-warning" />
          Sugestões do histórico
          {total > 0 && <span className="text-xs font-normal text-muted">({total})</span>}
        </span>
        {aberto ? <ChevronDown className="w-5 h-5 text-muted" /> : <ChevronRight className="w-5 h-5 text-muted" />}
      </button>

      {aberto && (
        <div className="px-5 pb-5 space-y-4">
          {perCapitaAB.length > 0 && (
            <div>
              <p className="text-[11px] text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Utensils className="w-3 h-3 text-accent" /> Referência A&amp;B por pessoa
                <span className="normal-case tracking-normal text-muted/70">· quanto costumamos gastar por pessoa{conv > 0 ? ` (≈ pra ${conv} convidados)` : ''}</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {perCapitaAB.map(i => (
                  <div key={i.item} className="bg-surface border border-bordercol/50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-muted uppercase truncate" title={i.item}>{i.item}</p>
                    <p className="text-sm text-white font-semibold">
                      {formatBRL(i.perCapita)}<span className="text-[10px] text-muted font-normal"> /pessoa</span>
                    </p>
                    {conv > 0 && <p className="text-[10px] text-muted">≈ {formatBRL(i.perCapita * conv)} · {i.amostras}am</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {porSecao.length > 0 && (
          <p className="text-xs text-muted">Itens que apareceram em eventos parecidos. Clique pra adicionar se este também for ter.</p>
          )}
          {porSecao.map(({ secao, sugestoes }) => (
          <div key={secao.key}>
            <p className="text-[11px] text-muted uppercase tracking-wide mb-1.5">{secao.label}</p>
            <div className="flex flex-wrap gap-2">
              {sugestoes.map(e => (
                <button
                  key={e.item}
                  onClick={() => onAdicionar(secao.key, e)}
                  title={`${e.amostras} evento(s) — ${formatBRL(e.custoUnitario * e.qtde)}`}
                  className="inline-flex items-center gap-1.5 border border-bordercol hover:border-accent hover:bg-accent/5 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 hover:text-white transition-colors"
                >
                  <Plus className="w-3 h-3 text-accent" />
                  {e.item}
                  <span className="text-muted">· {formatBRL(e.custoUnitario * e.qtde)}</span>
                </button>
              ))}
            </div>
          </div>
          ))}
        </div>
      )}
    </div>
  )
}
