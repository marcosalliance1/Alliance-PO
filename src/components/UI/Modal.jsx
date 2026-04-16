import { X } from 'lucide-react'

export default function Modal({ titulo, onClose, children, largura = 600 }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, width: '100%', maxWidth: largura, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2E3150' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#F1F5F9' }}>{titulo}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
