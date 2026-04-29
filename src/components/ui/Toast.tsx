import { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface ToastProps {
  mensagem: string
  tipo?: 'sucesso' | 'erro'
  onFechar: () => void
}

export function Toast({ mensagem, tipo = 'sucesso', onFechar }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onFechar, 6000)
    return () => clearTimeout(t)
  }, [onFechar])

  const cor = tipo === 'erro' ? '#ef4444' : '#22c55e'
  const Icon = tipo === 'erro' ? XCircle : CheckCircle

  return (
    <div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        background: '#1e2235', border: `1px solid ${cor}40`,
        borderLeft: `3px solid ${cor}`, borderRadius: 10,
        padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: 420,
      }}
    >
      <Icon size={16} style={{ color: cor, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 13, color: '#f1f5f9', flex: 1, lineHeight: 1.5 }}>{mensagem}</span>
      <button
        onClick={onFechar}
        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
