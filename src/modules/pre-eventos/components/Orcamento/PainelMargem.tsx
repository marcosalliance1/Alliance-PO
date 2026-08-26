import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, Coins, Users } from 'lucide-react'
import type { Orcamento } from '../../types'
import { formatBRL } from '../../utils/formatters'

// Painel de resultado: PLANEJAMENTO (orçado) + EXECUÇÃO (pago). A atendente vê se
// o evento fecha no plano, e o pago mostra o real (gasto previsto que não veio,
// ou que ainda vai vir).
export const PainelMargem: React.FC<{ orc: Orcamento }> = ({ orc }) => {
  const r = useMemo(() => {
    const secoes = [orc.operacaoEstrutura, orc.equipe, orc.atracao, orc.abBebidas, orc.extras]
    const custoOrcado = secoes.reduce((s, sec) => s + sec.reduce((a, i) => a + i.totalOrcado, 0), 0)
    const custoPago = secoes.reduce((s, sec) => s + sec.reduce((a, i) => a + i.totalPagoReal, 0), 0)
    // Custo do CLIENTE = soma do V. Cliente (o que a turma paga à Alliance).
    const custoCliente = secoes.reduce((s, sec) => s + sec.reduce((a, i) => a + i.valorPassadoCliente, 0), 0)
    const receita = orc.bolsaFolia + orc.receitasSympla.reduce((s, l) => s + l.total, 0)
    const resultadoOrcado = receita - custoOrcado
    const resultadoPago = receita - custoPago
    const resultadoCliente = receita - custoCliente // saldo da turma
    return {
      custoOrcado, custoPago, custoCliente, receita, resultadoOrcado, resultadoPago, resultadoCliente,
      margemOrcada: receita > 0 ? (resultadoOrcado / receita) * 100 : 0,
      margemPaga: receita > 0 ? (resultadoPago / receita) * 100 : 0,
      margemCliente: receita > 0 ? (resultadoCliente / receita) * 100 : 0,
    }
  }, [orc])

  const corDe = (v: number) => (v >= 0 ? 'text-success' : 'text-danger')
  const bgDe = (v: number) => (v >= 0 ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5')

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-lg border border-bordercol/50 p-3">
          <p className="text-[11px] text-muted uppercase tracking-wide flex items-center gap-1.5 mb-1">
            <Coins className="w-3.5 h-3.5" /> Custo Orçado
          </p>
          <p className="text-lg font-bold text-white">{formatBRL(r.custoOrcado)}</p>
          <p className="text-[11px] text-muted mt-0.5">Pago: {formatBRL(r.custoPago)}</p>
        </div>

        <div className="rounded-lg border border-bordercol/50 p-3">
          <p className="text-[11px] text-muted uppercase tracking-wide flex items-center gap-1.5 mb-1">
            <Wallet className="w-3.5 h-3.5" /> Receita Esperada
          </p>
          <p className="text-lg font-bold text-white">{formatBRL(r.receita)}</p>
        </div>

        <div className={`rounded-lg border-2 p-3 ${bgDe(r.resultadoOrcado)}`}>
          <p className="text-[11px] text-muted uppercase tracking-wide flex items-center gap-1.5 mb-1">
            {r.resultadoOrcado >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />} Resultado Orçado
          </p>
          <p className={`text-lg font-bold ${corDe(r.resultadoOrcado)}`}>{formatBRL(r.resultadoOrcado)}</p>
          <p className={`text-[11px] ${corDe(r.resultadoOrcado)}`}>
            {r.resultadoOrcado >= 0 ? '✓ fecha' : '⚠ não fecha'}
            {r.receita > 0 && ` · ${r.margemOrcada.toFixed(1)}% margem`}
          </p>
        </div>

        <div className={`rounded-lg border-2 p-3 ${bgDe(r.resultadoPago)}`}>
          <p className="text-[11px] text-muted uppercase tracking-wide flex items-center gap-1.5 mb-1">
            {r.resultadoPago >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />} Resultado Pago
          </p>
          <p className={`text-lg font-bold ${corDe(r.resultadoPago)}`}>{formatBRL(r.resultadoPago)}</p>
          <p className="text-[11px] text-muted">
            sobre o que já foi pago
            {r.receita > 0 && ` · ${r.margemPaga.toFixed(1)}%`}
          </p>
        </div>

        <div className={`rounded-lg border-2 p-3 ${bgDe(r.resultadoCliente)}`}>
          <p className="text-[11px] text-muted uppercase tracking-wide flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5" /> Resultado Cliente
          </p>
          <p className={`text-lg font-bold ${corDe(r.resultadoCliente)}`}>{formatBRL(r.resultadoCliente)}</p>
          <p className="text-[11px] text-muted">
            saldo da turma (Receita − V. Cliente)
            {r.receita > 0 && ` · ${r.margemCliente.toFixed(1)}%`}
          </p>
        </div>
      </div>
    </div>
  )
}
