import React, { useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import type { Orcamento, ItemOrcamento } from '../../types'
import { CARTOES } from '../../types'
import { formatBRL } from '../../utils/formatters'

const secoesDe = (o: Orcamento): ItemOrcamento[] =>
  [...o.operacaoEstrutura, ...o.equipe, ...o.atracao, ...o.abBebidas, ...o.extras]

// Breakdown do que foi pago em cada cartão da Alliance neste evento (só cartões com itens).
// Igual ao Estoque Alliance: são custos reais (contam no Total Pago), aqui só destacados —
// úteis porque só entram no Everest quando a fatura do cartão fecha.
export const PainelCartoes: React.FC<{ orc: Orcamento }> = ({ orc }) => {
  const r = useMemo(() => {
    const porCartao = new Map<string, { valor: number; n: number }>()
    for (const i of secoesDe(orc)) {
      const c = CARTOES.find(x => x.status === i.status)
      if (!c) continue
      const v = i.totalPagoReal || i.totalOrcado
      if (v <= 0) continue
      const acc = porCartao.get(c.status) ?? { valor: 0, n: 0 }
      acc.valor += v; acc.n += 1
      porCartao.set(c.status, acc)
    }
    const total = [...porCartao.values()].reduce((s, x) => s + x.valor, 0)
    return { porCartao, total }
  }, [orc])

  if (r.total === 0) return null

  const cartoesComItens = CARTOES.filter(c => r.porCartao.has(c.status))

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-5 mt-6">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h3 className="text-white font-bold text-base flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-full inline-block" />
          <CreditCard className="w-4 h-4 text-accent" /> Pago no Cartão
        </h3>
        <span className="text-lg font-bold text-white tabular-nums">{formatBRL(r.total)}</span>
      </div>
      <p className="text-muted text-[11px] mb-4">Total pago em cartões da Alliance neste evento — entra no Everest só quando a fatura fecha.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cartoesComItens.map(c => {
          const d = r.porCartao.get(c.status)!
          return (
            <div key={c.status} className="rounded-lg border border-bordercol/50 p-3">
              <p className="text-[11px] text-muted flex items-center gap-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: c.cor }} /> {c.label}
              </p>
              <p className="text-lg font-bold text-white tabular-nums">{formatBRL(d.valor)}</p>
              <p className="text-[11px] text-muted">{d.n} {d.n === 1 ? 'item' : 'itens'}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
