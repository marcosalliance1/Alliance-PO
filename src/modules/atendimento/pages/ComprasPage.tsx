import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { SyncBar } from '../components/SyncBar'
import { formatarData, formatarValor } from '../lib/formatadores'
import { normalizarChave } from '../../../lib/rifasSync'

function Badge({ children, cor }: { children: React.ReactNode; cor: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cor}`}>{children}</span>
}

export function ComprasPage() {
  const { compras, carregando, atualizarCompra } = useAtendimento()
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [busca, setBusca] = useState('')

  const comprasFiltradas = useMemo(() => {
    let arr = compras
    if (filtroStatus) arr = arr.filter(c => c.status === filtroStatus)
    if (busca.trim()) {
      const chave = normalizarChave(busca)
      arr = arr.filter(c => normalizarChave(c.nome_ganhador ?? '').includes(chave) || normalizarChave(c.turma ?? '').includes(chave))
    }
    // "Não comprado" primeiro, depois por valor decrescente — prioriza resolver as
    // compras de maior valor pendentes.
    return [...arr].sort((a, b) => {
      const pa = a.status === 'Comprado' ? 1 : 0
      const pb = b.status === 'Comprado' ? 1 : 0
      if (pa !== pb) return pa - pb
      return (b.valor ?? 0) - (a.valor ?? 0)
    })
  }, [compras, filtroStatus, busca])

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-4">Acompanhamento de Compra</h1>
      <SyncBar />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou turma..."
            className="bg-surface border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-text-main w-64"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
        >
          <option value="">Todos os status</option>
          <option value="Comprado">Comprado</option>
          <option value="Não comprado">Não comprado</option>
        </select>
        <span className="text-[10px] text-text-muted ml-auto">Clique no status pra marcar como comprado</span>
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
                    {!c.ganhador_id && <span className="ml-1.5 text-[10px] text-danger" title="Não encontramos o ganhador relacionado — revisar manualmente.">sem vínculo</span>}
                  </td>
                  <td className="px-4 py-2 text-text-muted max-w-xs truncate" title={c.premio_descricao ?? ''}>{c.premio_descricao ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted">{c.nome_ganhador ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted">{c.site ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatarValor(c.valor)}</td>
                  <td className="px-4 py-2">
                    <select
                      value={c.status ?? ''}
                      onChange={e => atualizarCompra(c.id, {
                        status: e.target.value || null,
                        data_compra: e.target.value === 'Comprado' && !c.data_compra ? new Date().toISOString().slice(0, 10) : c.data_compra,
                      })}
                      className={`rounded-full text-[11px] font-semibold border-0 px-2 py-0.5 cursor-pointer ${c.status === 'Comprado' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}
                    >
                      <option value="Não comprado">Não comprado</option>
                      <option value="Comprado">Comprado</option>
                    </select>
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
