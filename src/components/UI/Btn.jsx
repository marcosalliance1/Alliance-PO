export default function Btn({ children, onClick, variante = 'primario', pequeno = false, disabled = false, tipo = 'button', style = {} }) {
  const base = {
    border: 'none',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
    fontFamily: 'Inter, sans-serif',
    fontSize: pequeno ? 12 : 13,
    padding: pequeno ? '5px 10px' : '8px 14px',
  }

  const variantes = {
    primario: { background: '#2563EB', color: '#fff' },
    secundario: { background: '#F1F5F9', color: '#1E293B', border: '1px solid #E2E8F0' },
    perigo: { background: '#FEE2E2', color: '#991B1B' },
    ghost: { background: 'transparent', color: '#94A3B8', border: '1px solid #2E3150' },
    sucesso: { background: '#BBF7D0', color: '#14532D' },
  }

  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...(variantes[variante] || variantes.primario), ...style }}
    >
      {children}
    </button>
  )
}
