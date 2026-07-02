import React from 'react'
import type { ResultadoSimulacao } from '../../utils/simulador'
import { formatBRL } from '../../utils/formatters'

interface Props {
  resultado: ResultadoSimulacao
}

export const ResumoResultado: React.FC<Props> = ({ resultado }) => {
  const { custoTotal, totalIngressos, receitaTotal, saldo } = resultado

  const Row = ({ label, value, big }: { label: string; value: number; big?: boolean }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-bordercol/50 last:border-0">
      <span className={`text-sm ${big ? 'text-white font-semibold' : 'text-muted'}`}>{label}</span>
      <span className="font-semibold text-sm text-white">{formatBRL(value)}</span>
    </div>
  )

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-5">
      <h2 className="text-white font-semibold text-sm mb-4">Resultado da Simulação</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <Row label="Total Ingressos" value={totalIngressos} />
          <Row label="Custo Total Estimado" value={custoTotal} />
          <Row label="Receita Total (Bolsa Folia + Ingressos)" value={receitaTotal} big />
        </div>
        <div className={`rounded-lg p-4 border-2 ${saldo >= 0 ? 'border-success/50 bg-success/5' : 'border-danger/50 bg-danger/5'}`}>
          <p className="text-muted text-xs mb-1">Saldo Projetado</p>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatBRL(saldo)}
          </p>
          <p className="text-muted text-xs mt-2">Receita Total − Custo Total</p>
        </div>
      </div>
    </div>
  )
}
