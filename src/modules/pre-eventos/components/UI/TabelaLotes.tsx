import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { SymplaLote } from '../../types'
import { newItemId, formatBRL } from '../../utils/formatters'
import CampoMoeda from './CampoMoeda'

const ORDINALS = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º']
function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}º`
}

interface Props {
  lotes: SymplaLote[]
  onChange: (lotes: SymplaLote[]) => void
  labelTotal?: string
  nomeItem?: string
}

const TabelaLotes: React.FC<Props> = ({ lotes, onChange, labelTotal = 'TOTAL', nomeItem = 'Lote' }) => {
  function addLote() {
    const n = lotes.length + 1
    onChange([...lotes, { id: newItemId(), nome: `${ordinal(n)} ${nomeItem}`, qtde: 0, valorUnitario: 0, total: 0 }])
  }
  function removeLote(id: string) {
    onChange(lotes.filter(l => l.id !== id))
  }
  function updateLote(id: string, field: keyof SymplaLote, val: string | number) {
    onChange(lotes.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: val }
      updated.total = updated.qtde * updated.valorUnitario
      return updated
    }))
  }

  const total = lotes.reduce((s, l) => s + l.total, 0)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[460px]">
          <thead>
            <tr className="bg-surface2/50">
              <th className="text-left text-muted px-2 py-2 font-medium">Nome do {nomeItem}</th>
              <th className="text-right text-muted px-2 py-2 font-medium w-20">Qtde</th>
              <th className="text-right text-muted px-2 py-2 font-medium w-32">Valor Unit.</th>
              <th className="text-right text-muted px-2 py-2 font-medium w-28">Total</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lotes.map(l => (
              <tr key={l.id} className="border-b border-bordercol/50">
                <td className="px-2 py-1.5">
                  <input
                    className="w-full bg-transparent text-white text-xs outline-none border border-transparent hover:border-bordercol focus:border-accent rounded px-1 py-0.5 transition-colors"
                    value={l.nome}
                    onChange={e => updateLote(l.id, 'nome', e.target.value)}
                    placeholder={`Ex: 1º ${nomeItem}`}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number" min={0}
                    className="w-full bg-transparent text-white text-xs text-right outline-none border border-transparent hover:border-bordercol focus:border-accent rounded px-1 py-0.5 transition-colors"
                    value={l.qtde || ''}
                    onChange={e => updateLote(l.id, 'qtde', Number(e.target.value))}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <CampoMoeda
                    value={l.valorUnitario}
                    onChange={v => updateLote(l.id, 'valorUnitario', v)}
                    className="w-full bg-transparent text-white text-xs text-right outline-none border border-transparent hover:border-bordercol focus:border-accent rounded px-1 py-0.5 transition-colors"
                  />
                </td>
                <td className="px-2 py-1.5 text-right text-gray-300">{formatBRL(l.total)}</td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => removeLote(l.id)}
                    className="text-danger/60 hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface2/80">
              <td colSpan={3} className="px-2 py-2 text-xs text-right text-muted font-semibold">{labelTotal}</td>
              <td className="px-2 py-2 text-xs text-right text-white font-bold">{formatBRL(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button
        onClick={addLote}
        className="mt-3 flex items-center gap-2 text-accent text-xs hover:text-accent/80 transition-colors"
      >
        <Plus className="w-4 h-4" /> Adicionar {nomeItem.toLowerCase()}
      </button>
    </div>
  )
}

export default TabelaLotes
