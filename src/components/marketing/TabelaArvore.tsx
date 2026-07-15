import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface TabelaArvoreSubitem {
  id: number
  nome: string
  status: string | null
  statusIsDone: boolean
  owner: string | null
  data: string | null
}

export interface TabelaArvoreItem {
  id: number
  nome: string
  status: string
  statusIsDone: boolean
  grupo: string
  responsavel: string
  dataFim: string | null
  prioridade: string | null
  subitens: TabelaArvoreSubitem[]
}

export function TabelaArvore({ itens }: { itens: TabelaArvoreItem[] }) {
  const [expandidos, setExpandidos] = useState<Record<number, boolean>>({})
  const toggle = (id: number) => setExpandidos(e => ({ ...e, [id]: !e[id] }))

  return (
    <div className="overflow-x-auto">
      <div className="max-h-[32rem] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5 sticky top-0">
            <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
              <th className="px-4 py-2 font-semibold">Item</th>
              <th className="px-4 py-2 font-semibold">Grupo</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Responsável</th>
              <th className="px-4 py-2 font-semibold">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {itens.map(item => {
              const aberto = !!expandidos[item.id]
              const temSub = item.subitens.length > 0
              return (
                <Fragment key={item.id}>
                  <tr
                    onClick={() => temSub && toggle(item.id)}
                    className={`border-t border-white/5 hover:bg-white/5 ${temSub ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-4 py-2 text-text-main">
                      <span className="inline-flex items-center gap-1.5">
                        {temSub ? (
                          aberto ? <ChevronDown size={12} className="text-text-muted shrink-0" /> : <ChevronRight size={12} className="text-text-muted shrink-0" />
                        ) : <span className="w-3 shrink-0" />}
                        <span className="truncate max-w-md" title={item.nome}>{item.nome}</span>
                        {temSub && <span className="text-[10px] text-text-muted shrink-0">({item.subitens.length})</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap">{item.grupo}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={item.statusIsDone ? 'text-success' : 'text-text-muted'}>{item.status}</span>
                      {item.prioridade === 'Urgente' && !item.statusIsDone && <span className="ml-1.5 text-primary font-semibold">Urgente</span>}
                    </td>
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap">{item.responsavel}</td>
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap">{item.dataFim ?? '—'}</td>
                  </tr>
                  {aberto && item.subitens.map(sub => (
                    <tr key={`${item.id}-${sub.id}`} className="border-t border-white/5 bg-white/[0.02]">
                      <td className="px-4 py-2 pl-10 text-text-muted">
                        <span className="text-text-muted/50 mr-1.5">└</span>{sub.nome}
                      </td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={sub.statusIsDone ? 'text-success' : 'text-text-muted'}>{sub.status ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2 text-text-muted whitespace-nowrap">{sub.owner ?? '—'}</td>
                      <td className="px-4 py-2 text-text-muted whitespace-nowrap">{sub.data ?? '—'}</td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {itens.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Nenhum item encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
