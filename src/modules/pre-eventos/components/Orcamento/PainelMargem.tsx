import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, Coins, Users, Banknote, Receipt } from 'lucide-react'
import type { Orcamento } from '../../types'
import { formatBRL } from '../../utils/formatters'

// Painel de resultado — espelho rápido do fluxo do dinheiro (mesma lógica do Resumo
// Financeiro): quanto entrou, quanto a Alliance pagou, quanto a comissão bancou, o
// valor cheio passado ao cliente e o saldo real da turma. O orçado vive na barra de
// progresso e no Resumo — aqui foco no realizado.
export const PainelMargem: React.FC<{ orc: Orcamento }> = ({ orc }) => {
  const r = useMemo(() => {
    const secoes = [orc.operacaoEstrutura, orc.equipe, orc.atracao, orc.abBebidas, orc.extras]
    const custoPago = secoes.reduce((s, sec) => s + sec.reduce((a, i) => a + i.totalPagoReal, 0), 0)
    // Pago Comissão = o que a comissão bancou do bolso (itens com status PAGO_COMISSAO).
    const pagoComissao = secoes.reduce((s, sec) => s + sec.reduce((a, i) => a + (i.status === 'PAGO_COMISSAO' ? i.valorPassadoCliente : 0), 0), 0)
    // V. Cliente = valor cheio passado à turma (o que ela paga à Alliance).
    const custoCliente = secoes.reduce((s, sec) => s + sec.reduce((a, i) => a + i.valorPassadoCliente, 0), 0)
    const receita = orc.bolsaFolia + orc.receitasSympla.reduce((s, l) => s + l.total, 0)
    const resultadoCliente = receita - custoCliente // saldo da turma
    const pct = (v: number) => (receita > 0 ? (v / receita) * 100 : 0)
    return {
      custoPago, pagoComissao, custoCliente, receita, resultadoCliente,
      pctPago: pct(custoPago), pctComissao: pct(pagoComissao), pctCliente: pct(custoCliente),
      margemCliente: pct(resultadoCliente),
    }
  }, [orc])

  const corDe = (v: number) => (v >= 0 ? 'text-success' : 'text-danger')
  const bgDe = (v: number) => (v >= 0 ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5')

  const Card = ({ icon, label, value, pct }: { icon: React.ReactNode; label: string; value: number; pct?: number }) => (
    <div className="rounded-lg border border-bordercol/50 p-3">
      <p className="text-[11px] text-muted uppercase tracking-wide flex items-center gap-1.5 mb-1">
        {icon} {label}
      </p>
      <p className="text-lg font-bold text-white">{formatBRL(value)}</p>
      {pct !== undefined && <p className="text-[11px] text-muted mt-0.5">{pct.toFixed(1)}% da receita</p>}
    </div>
  )

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card icon={<Wallet className="w-3.5 h-3.5" />}   label="Receita Total"        value={r.receita} />
        <Card icon={<Coins className="w-3.5 h-3.5" />}    label="Total Pago (Alliance)" value={r.custoPago} pct={r.pctPago} />
        <Card icon={<Banknote className="w-3.5 h-3.5" />} label="Pago Comissão"         value={r.pagoComissao} pct={r.pctComissao} />
        <Card icon={<Receipt className="w-3.5 h-3.5" />}  label="V. Cliente"            value={r.custoCliente} pct={r.pctCliente} />

        <div className={`rounded-lg border-2 p-3 ${bgDe(r.resultadoCliente)}`}>
          <p className="text-[11px] text-muted uppercase tracking-wide flex items-center gap-1.5 mb-1">
            {r.resultadoCliente >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />} Resultado Cliente
          </p>
          <p className={`text-lg font-bold ${corDe(r.resultadoCliente)}`}>{formatBRL(r.resultadoCliente)}</p>
          <p className="text-[11px] text-muted flex items-center gap-1">
            <Users className="w-3 h-3" /> saldo da turma
            {r.receita > 0 && ` · ${r.margemCliente.toFixed(1)}%`}
          </p>
        </div>
      </div>
    </div>
  )
}
