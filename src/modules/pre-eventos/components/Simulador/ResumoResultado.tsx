import React from 'react'
import type { ResultadoSimulacao, EscalaLote } from '../../utils/simulador'
import { formatBRL } from '../../utils/formatters'

interface Props {
  resultado: ResultadoSimulacao
  escala: EscalaLote[]
  temPrecoInicial: boolean
}

export const ResumoResultado: React.FC<Props> = ({ resultado, escala, temPrecoInicial }) => {
  const { custoTotal, totalIngressos, receitaTotal, saldo, necessarioIngressos } = resultado
  const precisaVender = necessarioIngressos > 0
  const totalIngressosEscala = escala.reduce((s, l) => s + l.qtde, 0)

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
        <div className="flex flex-col gap-3">
          <div className={`rounded-lg p-4 border-2 ${saldo >= 0 ? 'border-success/50 bg-success/5' : 'border-danger/50 bg-danger/5'}`}>
            <p className="text-muted text-xs mb-1">Saldo Projetado</p>
            <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatBRL(saldo)}
            </p>
            <p className="text-muted text-xs mt-2">Receita Total − Custo Total</p>
          </div>
          <div className="rounded-lg p-4 border-2 border-accent/50 bg-accent/5">
            <p className="text-muted text-xs mb-1">Ponto de Equilíbrio (0 a 0)</p>
            <p className="text-2xl font-bold text-accent">
              {precisaVender ? formatBRL(necessarioIngressos) : formatBRL(0)}
            </p>
            <p className="text-muted text-xs mt-2">
              {precisaVender
                ? 'Precisa vender isso em ingressos pra cobrir o custo total'
                : `Bolsa Folia já cobre o custo — sobra ${formatBRL(-necessarioIngressos)} sem vender ingresso`}
            </p>
            {precisaVender && escala.length > 0 && (
              <div className="mt-3 pt-3 border-t border-accent/20 space-y-1">
                <p className="text-muted text-[10px] mb-1">
                  Escala de lotes sugerida (10% dos convidados por lote, +R$15 a cada lote):
                </p>
                {escala.map((l) => (
                  <div key={l.numero} className="flex justify-between items-center text-xs">
                    <span className="text-muted truncate pr-2">{l.numero}º Lote ({formatBRL(l.preco)})</span>
                    <span className="text-white font-semibold shrink-0">{l.qtde} ingressos</span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-xs pt-1.5 mt-1 border-t border-accent/20">
                  <span className="text-muted font-semibold">Total de ingressos</span>
                  <span className="text-white font-bold">{totalIngressosEscala}</span>
                </div>
              </div>
            )}
            {precisaVender && escala.length === 0 && !temPrecoInicial && (
              <p className="text-muted text-[10px] mt-3 pt-3 border-t border-accent/20">
                Preencha o 1º lote de ingressos e a quantidade de convidados pra ver a escala sugerida.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
