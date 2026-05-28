import React, { useState } from 'react'

interface Props {
  value: number
  onChange: (v: number) => void
  className?: string
  placeholder?: string
}

/**
 * Input monetário: exibe "9.000,00" quando não focado,
 * permite digitar livremente quando focado e parseia ao sair.
 */
const CampoMoeda: React.FC<Props> = ({ value, onChange, className = '', placeholder = '0,00' }) => {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')

  function handleFocus() {
    setFocused(true)
    // Mostra número puro para facilitar edição
    setRaw(value === 0 ? '' : String(value).replace('.', ','))
  }

  function handleBlur() {
    setFocused(false)
    // Aceita tanto vírgula quanto ponto como separador decimal
    const cleaned = raw
      .replace(/\./g, '')   // remove pontos de milhar
      .replace(',', '.')    // converte vírgula decimal em ponto
      .replace(/[^\d.]/g, '') // remove qualquer outro char
    const parsed = parseFloat(cleaned)
    onChange(isNaN(parsed) ? 0 : parsed)
  }

  const display = focused
    ? raw
    : value === 0
      ? ''
      : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      onChange={e => setRaw(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  )
}

export default CampoMoeda
