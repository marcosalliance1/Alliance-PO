import React, { useMemo } from 'react'
import { X, Trash2, AlertTriangle, Check } from 'lucide-react'
import type { Orcamento } from '../../types'
import { listarVazias, apagarVazias } from '../../utils/acoesItens'

interface Props {
  orc: Orcamento
  onConfirmar: (orc: Orcamento, removidos: number) => void
  onFechar: () => void
}

export const ModalApagarVazias: React.FC<Props> = ({ orc, onConfirmar, onFechar }) => {
  const vazias = useMemo(() => listarVazias(orc), [orc])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-surface border border-bordercol rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-bordercol shrink-0">
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 text-danger" />
            <h2 className="text-white font-semibold">Apagar linhas vazias</h2>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {vazias.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted py-8">
              <Check className="w-6 h-6 text-success" />
              <p className="text-sm">Nenhuma linha vazia — o orçamento está limpo.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted mb-3">
                Estas <b className="text-white">{vazias.length}</b> linhas estão sem fornecedor e sem nenhum valor (orçado, pago ou cliente). Vão ser removidas:
              </p>
              <div className="rounded-lg border border-bordercol/50 divide-y divide-bordercol/40">
                {vazias.map(v => (
                  <div key={v.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="text-gray-300">{v.nome}</span>
                    <span className="text-muted">{v.secaoLabel}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-warning flex items-center gap-1.5 mt-3">
                <AlertTriangle className="w-3.5 h-3.5" /> Ação irreversível — mas o orçamento só salva quando você clicar em Salvar.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-bordercol shrink-0">
          <button onClick={onFechar} className="text-sm text-muted hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={() => onConfirmar(apagarVazias(orc).orcamento, vazias.length)}
            disabled={vazias.length === 0}
            className="flex items-center gap-2 bg-danger hover:bg-danger/90 disabled:opacity-40 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Apagar ({vazias.length})
          </button>
        </div>
      </div>
    </div>
  )
}
