import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { ToastMessage } from '../../types'

interface ToastProps {
  toasts: ToastMessage[]
  remove: (id: string) => void
}

const icons = {
  success: <CheckCircle className="w-5 h-5 text-success shrink-0" />,
  error:   <XCircle    className="w-5 h-5 text-danger  shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning shrink-0" />,
  info:    <Info       className="w-5 h-5 text-blue-400 shrink-0" />,
}

const borders = {
  success: 'border-success',
  error:   'border-danger',
  warning: 'border-warning',
  info:    'border-blue-400',
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, remove }) => (
  <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80">
    {toasts.map(t => (
      <div
        key={t.id}
        className={`flex items-start gap-3 bg-surface-2 border-l-4 ${borders[t.type]} rounded-card shadow-lg p-4 text-white text-sm animate-fade-in`}
      >
        {icons[t.type]}
        <span className="flex-1">{t.message}</span>
        <button onClick={() => remove(t.id)} className="text-muted hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
)
