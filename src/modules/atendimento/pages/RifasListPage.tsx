import { useAtendimento } from '../contexts/AtendimentoContext'
import { SyncBar } from '../components/SyncBar'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatarValor(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const SITUACAO_COR: Record<string, string> = {
  'EM ANDAMENTO': 'text-warning',
  'SORTEADA': 'text-success',
  'FECHADA': 'text-text-muted',
  'NÃO VAI TER': 'text-danger',
}

export function RifasListPage() {
  const { rifas, carregando } = useAtendimento()

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-4">Rifas</h1>
      <SyncBar />

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3 font-semibold">Turma</th>
                <th className="px-4 py-3 font-semibold">Edição</th>
                <th className="px-4 py-3 font-semibold">Formação</th>
                <th className="px-4 py-3 font-semibold">Ano</th>
                <th className="px-4 py-3 font-semibold">Vencimento</th>
                <th className="px-4 py-3 font-semibold">Prêmio</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Situação</th>
                <th className="px-4 py-3 font-semibold">Vínculo</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">Carregando...</td></tr>
              )}
              {!carregando && rifas.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">Nenhuma rifa sincronizada ainda.</td></tr>
              )}
              {rifas.map(r => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2 text-text-main">{r.turma}</td>
                  <td className="px-4 py-2 text-text-muted">{r.edicao ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted">{r.formacao ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted">{r.ano_formatura ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatarData(r.dia_vencimento)}</td>
                  <td className="px-4 py-2 text-text-muted max-w-xs truncate" title={r.premio_descricao ?? ''}>{r.premio_descricao ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatarValor(r.valor_boleto)}</td>
                  <td className={`px-4 py-2 font-semibold whitespace-nowrap ${SITUACAO_COR[r.situacao ?? ''] ?? 'text-text-muted'}`}>{r.situacao ?? '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {r.dimensao_projeto_id
                      ? <span className={r.match_manual ? 'text-success' : 'text-text-muted'}>{r.match_manual ? 'manual' : `auto (${Math.round((r.match_confianca ?? 0) * 100)}%)`}</span>
                      : <span className="text-danger">pendente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
