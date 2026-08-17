import type { TotaisSecao as TTotais } from '../../types'
import { ValorContabil } from './LinhaItem'

interface TotaisSecaoProps {
  totais: TTotais
  nomeSecao: string
}


export function TotaisSecaoRow({ totais, nomeSecao }: TotaisSecaoProps) {
  return (
    <>
      <tr className="row-total">
        <td colSpan={8} className="font-bold uppercase tracking-wide text-xs">
          TOTAL — {nomeSecao}
        </td>
        <td className="font-bold"><ValorContabil value={totais.totalVendido} /></td>
        <td />
        <td className="font-bold text-blue-400"><ValorContabil value={totais.totalProjetado} /></td>
        <td />
        <td />
        <td />
        <td className="font-bold"><ValorContabil value={totais.totalOrcado} /></td>
        <td />
        <td />
        <td />
        <td className="font-bold"><ValorContabil value={totais.totalContratado} /></td>
        <td />
        <td colSpan={2} />
        <td />
        <td className="font-bold"><ValorContabil value={totais.totalPago} /></td>
        <td className="font-bold"><ValorContabil value={totais.totalFaltaPagar} /></td>
        <td colSpan={1} />
      </tr>
      <tr className="row-cpf">
        <td colSpan={8}>Custo por formando</td>
        <td><ValorContabil value={totais.custoPorFormandoVendido} /></td>
        <td />
        <td />
        <td />
        <td />
        <td />
        <td><ValorContabil value={totais.custoPorFormandoOrcado} /></td>
        <td />
        <td />
        <td />
        <td><ValorContabil value={totais.custoPorFormandoContratado} /></td>
        <td />
        <td colSpan={2} />
        <td colSpan={4} />
      </tr>
    </>
  )
}
