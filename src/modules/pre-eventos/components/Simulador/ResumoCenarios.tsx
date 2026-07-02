import React from 'react'
import type { ResultadoCenario } from '../../utils/simulador'
import { formatBRL } from '../../utils/formatters'

interface Props {
  resultados: ResultadoCenario[]
}

function ValorFaixa({ min, max }: { min: number; max: number | null }) {
  if (max === null) {
    return <span className={min >= 0 ? 'text-success' : 'text-danger'}>a partir de {formatBRL(min)}</span>
  }
  if (min === max) {
    return <span className={min >= 0 ? 'text-success' : 'text-danger'}>{formatBRL(min)}</span>
  }
  return (
    <span>
      <span className={min >= 0 ? 'text-success' : 'text-danger'}>{formatBRL(min)}</span>
      {' – '}
      <span className={max >= 0 ? 'text-success' : 'text-danger'}>{formatBRL(max)}</span>
    </span>
  )
}

export const ResumoCenarios: React.FC<Props> = ({ resultados }) => {
  const custoTotal = resultados[0]?.custoTotal ?? 0

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">Cenários de Venda de Ingresso</h2>
        <p className="text-xs text-muted">
          Custo total estimado: <span className="text-white font-semibold">{formatBRL(custoTotal)}</span>
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {resultados.map((r) => (
          <div key={r.faixa.id} className="bg-surface border border-bordercol rounded-lg p-4">
            <p className="text-white font-semibold text-xs mb-3">{r.faixa.label}</p>
            <div className="space-y-2">
              <div>
                <p className="text-muted text-[10px]">Receita</p>
                <p className="text-sm font-medium">
                  <ValorFaixa min={r.receitaMin} max={r.receitaMax} />
                </p>
              </div>
              <div>
                <p className="text-muted text-[10px]">Saldo</p>
                <p className="text-base font-bold">
                  <ValorFaixa min={r.saldoMin} max={r.saldoMax} />
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
