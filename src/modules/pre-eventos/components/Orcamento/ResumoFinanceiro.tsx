import React, { useMemo } from 'react'
import type { Orcamento } from '../../types'
import { formatBRL } from '../../utils/formatters'

interface Props { orc: Orcamento }

export const ResumoFinanceiro: React.FC<Props> = ({ orc }) => {
  const r = useMemo(() => {
    const totalReceitas = orc.bolsaFolia + orc.receitasSympla.reduce((s, l) => s + l.total, 0)
    const secoes = [orc.operacaoEstrutura, orc.equipe, orc.atracao, orc.abBebidas, orc.extras]
    let totalOrcado = 0, totalPago = 0, totalBV = 0, totalCliente = 0, totalPagoComissao = 0
    for (const s of secoes) {
      totalOrcado  += s.reduce((acc, i) => acc + i.totalOrcado, 0)
      totalPago    += s.reduce((acc, i) => acc + i.totalPagoReal, 0)
      totalCliente += s.reduce((acc, i) => acc + i.valorPassadoCliente, 0)
      // Pago Comissão = o que a comissão bancou do bolso (itens com status PAGO_COMISSAO).
      totalPagoComissao += s.reduce((acc, i) => acc + (i.status === 'PAGO_COMISSAO' ? i.valorPassadoCliente : 0), 0)
      // Itens "Pago (Comissão)" não geram BV (a comissão pagou; não é margem da Alliance).
      totalBV      += s.reduce((acc, i) => acc + (i.status === 'PAGO_COMISSAO' ? 0 : i.valorPassadoCliente - i.totalPagoReal), 0)
    }
    // Saldo da Turma = Receitas − o valor cheio consumido no evento (não importa quem pagou).
    const saldo  = totalReceitas - totalCliente
    const bvPct  = totalPago > 0 ? (totalBV / totalPago) * 100 : 0
    return { totalReceitas, totalOrcado, totalPago, totalCliente, totalPagoComissao, saldo, totalBV, bvPct }
  }, [orc])

  const Row = ({ label, value, accent, big }: { label: string; value: number; accent?: boolean; big?: boolean }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-bordercol/50 last:border-0">
      <span className={`text-sm ${big ? 'text-white font-semibold' : 'text-muted'}`}>{label}</span>
      <span className={`font-semibold text-sm ${accent ? (value >= 0 ? 'text-success' : 'text-danger') : 'text-white'}`}>
        {formatBRL(value)}
      </span>
    </div>
  )

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-5 mt-6">
      <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-accent rounded-full inline-block" />
        Resumo Financeiro
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Ótica da TURMA + margem da ALLIANCE */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted/70 font-semibold mb-1">Turma</p>
          <Row label="Total Receitas"     value={r.totalReceitas} />
          <Row label="Total Passado ao Cliente" value={r.totalCliente} />
          <p className="text-[11px] uppercase tracking-wide text-muted/70 font-semibold mb-1 mt-4">Alliance</p>
          <Row label="Resultado Alliance (BV)" value={r.totalBV} accent />
          <div className="flex justify-between items-center py-1.5 border-b border-bordercol/50">
            <span className="text-muted text-sm">BV (% sobre pagos)</span>
            <span className={`font-semibold text-sm ${r.bvPct >= 0 ? 'text-success' : 'text-danger'}`}>
              {r.bvPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Ótica de EXECUÇÃO / conta (bate com o Everest) */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted/70 font-semibold mb-1">Execução (Everest)</p>
          <Row label="Total Custos Orçados" value={r.totalOrcado} />
          <Row label="Pago Alliance"        value={r.totalPago} />
          <Row label="Pago Comissão"        value={r.totalPagoComissao} />
        </div>

        {/* Saldo da Turma em destaque */}
        <div className={`rounded-lg p-4 border-2 h-fit ${r.saldo >= 0 ? 'border-success/50 bg-success/5' : 'border-danger/50 bg-danger/5'}`}>
          <p className="text-muted text-xs mb-1">Saldo da Turma</p>
          <p className={`text-2xl font-bold ${r.saldo >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatBRL(r.saldo)}
          </p>
          <p className="text-muted text-xs mt-2">Receitas − Passado ao Cliente</p>
        </div>
      </div>
    </div>
  )
}
