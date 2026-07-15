import { useMemo, useState } from 'react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { SyncBar } from '../components/SyncBar'
import { formatarData, formatarValor } from '../lib/formatadores'

function Badge({ children, cor }: { children: React.ReactNode; cor: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cor}`}>{children}</span>
}

export function ComprasPage() {
  const { compras, carregando } = useAtendimento()
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const comprasFiltradas = useMemo(() => {
    let arr = compras
    if (filtroStatus) arr = arr.filter(c => c.status === filtroStatus)
    // "Não comprado" primeiro, depois por valor decrescente — prioriza resolver as
    // compras de maior valor pendentes.
    return [...arr].sort((a, b) => {
      const pa = a.status === 'Comprado' ? 1 : 0
      const pb = b.status === 'Comprado' ? 1 : 0
      if (pa !== pb) return pa - pb
      return (b.valor ?? 0) - (a.valor ?? 0)
    })
  }, [compras, filtroStatus])

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-4">Acompanhamento de Compra</h1>
      <SyncBar />

      <div className="flex gap-3 mb-4">
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
        >
          <option value="">Todos os status</option>
          <option value="Comprado">Comprado</option>
          <option value="Não comprado">Não comprado</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3 font-semibold">Turma</th>
                <th className="px-4 py-3 font-semibold">Prêmio</th>
                <th className="px-4 py-3 font-semibold">Ganhador</th>
                <th className="px-4 py-3 font-semibold">Site</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Data da Compra</th>
                <th className="px-4 py-3 font-semibold">Data Entrega</th>
                <th className="px-4 py-3 font-semibold">Cartão</th>
                <th className="px-4 py-3 font-semibold">Na Planilha</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Carregando...</td></tr>
              )}
              {!carregando && comprasFiltradas.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Nenhuma compra encontrada.</td></tr>
              )}
              {comprasFiltradas.map(c => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2 text-text-main">
                    {c.turma ?? '—'}
                    {!c.ganhador_id && <span className="ml-1.5 text-[10px] text-danger" title="Sem vínculo automático com um ganhador — revisar manualmente.">sem vínculo</span>}
                  </td>
                  <td className="px-4 py-2 text-text-muted max-w-xs truncate" title={c.premio_descricao ?? ''}>{c.premio_descricao ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted">{c.nome_ganhador ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted">{c.site ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatarValor(c.valor)}</td>
                  <td className="px-4 py-2">
                    <Badge cor={c.status === 'Comprado' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}>{c.status ?? '—'}</Badge>
                  </td>
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatarData(c.data_compra)}</td>
                  <td className="px-4 py-2 text-text-muted">{c.data_entrega_raw ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted">{c.nome_cartao ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge cor={c.preenchido_planilha ? 'bg-success/15 text-success' : 'bg-white/10 text-text-muted'}>{c.preenchido_planilha ? 'Sim' : 'Não'}</Badge>
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
