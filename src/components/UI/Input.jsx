export function Input({ label, value, onChange, type = 'text', placeholder = '', required = false, disabled = false, min, max, step }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8' }}>
          {label}{required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        style={{
          background: '#0F1117',
          border: '1px solid #2E3150',
          borderRadius: 6,
          padding: '8px 10px',
          color: '#F1F5F9',
          fontSize: 13,
          outline: 'none',
          fontFamily: 'Inter, sans-serif',
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  )
}

export function Select({ label, value, onChange, options = [], required = false, disabled = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8' }}>
          {label}{required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <select
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        disabled={disabled}
        style={{
          background: '#0F1117',
          border: '1px solid #2E3150',
          borderRadius: 6,
          padding: '8px 10px',
          color: value ? '#F1F5F9' : '#64748B',
          fontSize: 13,
          outline: 'none',
          fontFamily: 'Inter, sans-serif',
          opacity: disabled ? 0.5 : 1,
          cursor: 'pointer',
        }}
      >
        <option value="">Selecione...</option>
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </div>
  )
}
