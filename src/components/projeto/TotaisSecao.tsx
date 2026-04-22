import type { TotaisSecao as TTotais } from '../../types'
import { formatBRL } from '../../utils/formatters'

interface TotaisSecaoProps {
  totais: TTotais
  nomeSecao: string
}

const SPAN = 26

export function TotaisSecaoRow({ totais, nomeSecao }: TotaisSecaoProps) {
  return (
    <>
      <tr className="row-total">
        <td colSpan={9} className="font-bold uppercase tracking-wide text-xs">
          TOTAL — {nomeSecao}
        </td>
        <td className="font-bold">{formatBRL(totais.totalVendido)}</td>
        <td />
        <td />
        <td />
        <td />
        <td />
        <td className="font-bold">{formatBRL(totais.totalOrcado)}</td>
        <td />
        <td />
        <td />
        <td className="font-bold">{formatBRL(totais.totalContratado)}</td>
        <td colSpan={3} />
        <td className="font-bold">{formatBRL(totais.totalPago)}</td>
        <td className="font-bold">{formatBRL(totais.totalFaltaPagar)}</td>
        <td colSpan={SPAN - 24} />
      </tr>
      <tr className="row-cpf">
        <td colSpan={9}>Custo por formando</td>
        <td>{formatBRL(totais.custoPorFormandoVendido)}</td>
        <td />
        <td />
        <td />
        <td />
        <td />
        <td>{formatBRL(totais.custoPorFormandoOrcado)}</td>
        <td />
        <td />
        <td />
        <td>{formatBRL(totais.custoPorFormandoContratado)}</td>
        <td colSpan={SPAN - 20} />
      </tr>
    </>
  )
}
