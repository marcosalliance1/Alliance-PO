import React, { useMemo, useState } from 'react'
import { X, Wallet, Check } from 'lucide-react'
import type { Orcamento } from '../../types'
import { formatBRL } from '../../utils/formatters'
import { itensComPago, preencherVCliente } from '../../utils/acoesItens'

interface Props {
  orc: Orcamento
  onConfirmar: (orc: Orcamento) => void
  onFechar: () => void
}

export const ModalPreencherVCliente: React.FC<Props> = ({ orc, onConfirmar, onFechar }) => {
  const elegiveis = useMemo(() => itensComPago(orc), [orc])
  const [comBV, setComBV] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setComBV(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  const nPreencher = elegiveis.length - comBV.size

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-surface border border-bordercol rounded-xl shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-bordercol shrink-0">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-white font-semibold">Preencher V. Cliente</h2>
              <p className="text-[11px] text-muted">Marque os itens que têm BV — o resto fica com V. Cliente = Pago.</p>
            </div>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {elegiveis.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Nenhum item com Total Pago preenchido ainda. Concilie com o Everest primeiro.</p>
          ) : (
            <div className="rounded-lg border border-bordercol/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface2/50 text-muted">
                    <th className="text-center px-2 py-1.5 font-medium w-16">Tem BV?</th>
                    <th className="text-left px-2 py-1.5 font-medium">Item</th>
                    <th className="text-right px-2 py-1.5 font-medium w-28">Pago</th>
                    <th className="text-right px-2 py-1.5 font-medium w-32">V. Cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {elegiveis.map(({ secaoLabel, item }) => {
                    const marcado = comBV.has(item.id)
                    return (
                      <tr key={item.id} className="border-t border-bordercol/40">
                        <td className="text-center px-2 py-1.5">
                          <input type="checkbox" checked={marcado} onChange={() => toggle(item.id)}
                            className="accent-accent w-4 h-4 cursor-pointer" />
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-white">{item.item || '(sem nome)'}</span>
                          <span className="block text-[10px] text-muted">{secaoLabel}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-300">{formatBRL(item.totalPagoReal)}</td>
                        <td className="px-2 py-1.5 text-right">
                          {marcado
                            ? <span className="text-warning">você preenche</span>
                            : <span className="text-success">{formatBRL(item.totalPagoReal)}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-bordercol shrink-0">
          <p className="text-[11px] text-muted">{comBV.size} com BV · {nPreencher} vão receber V. Cliente = Pago</p>
          <div className="flex items-center gap-3">
            <button onClick={onFechar} className="text-sm text-muted hover:text-white transition-colors">Cancelar</button>
            <button
              onClick={() => onConfirmar(preencherVCliente(orc, comBV).orcamento)}
              disabled={nPreencher === 0}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" /> Preencher ({nPreencher})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
