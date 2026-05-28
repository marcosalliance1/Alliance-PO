import React from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<Props> = ({ open, message, onConfirm, onCancel }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-2 border border-bordercol rounded-card shadow-lg p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
          <h3 className="text-white font-semibold text-lg">Confirmar ação</h3>
        </div>
        <p className="text-gray-300 mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-muted border border-bordercol hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm bg-danger text-white hover:bg-red-600 transition-colors font-medium"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
