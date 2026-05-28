import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

const SEP = '||'

interface Props {
  value: string
  onChange: (value: string) => void
  fornecedores: string[]
  className?: string
  placeholder?: string
}

/**
 * Combobox multi-seleção de fornecedor.
 * - Seleção múltipla via checkbox na lista
 * - Cada fornecedor selecionado aparece como tag com botão de remoção
 * - Permite digitar para filtrar ou adicionar fornecedor personalizado (Enter)
 * - Armazena múltiplos valores separados por "||" no campo fornecedor
 */
const MultiComboboxFornecedor: React.FC<Props> = ({
  value,
  onChange,
  fornecedores,
  placeholder = 'Fornecedor',
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value
    ? value.split(SEP).map(s => s.trim()).filter(Boolean)
    : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = query.trim()
    ? fornecedores.filter(f => f.toLowerCase().includes(query.toLowerCase()))
    : fornecedores

  function toggle(name: string) {
    const isSelected = selected.includes(name)
    const next = isSelected
      ? selected.filter(s => s !== name)
      : [...selected, name]
    onChange(next.join(SEP))
  }

  function removeTag(name: string) {
    onChange(selected.filter(s => s !== name).join(SEP))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); return }
    if (e.key === 'Enter' && query.trim()) {
      const name = query.trim()
      if (!selected.includes(name)) {
        onChange([...selected, name].join(SEP))
      }
      setQuery('')
      e.preventDefault()
    }
  }

  const inputCls = 'w-full bg-transparent text-xs text-white outline-none border border-transparent hover:border-bordercol focus:border-accent rounded px-1 py-0.5 transition-colors'

  return (
    <div ref={containerRef} className="relative min-w-0">
      {/* Tags + input area */}
      <div
        className={`flex flex-wrap gap-1 items-center min-h-[26px] ${inputCls} cursor-text`}
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
      >
        {selected.map(s => (
          <span
            key={s}
            className="inline-flex items-center gap-0.5 bg-accent/20 text-accent text-[10px] rounded px-1 py-0.5 shrink-0 max-w-[100px]"
          >
            <span className="truncate">{s}</span>
            <button
              type="button"
              onMouseDown={e => { e.stopPropagation(); removeTag(s) }}
              className="text-accent/70 hover:text-accent ml-0.5 shrink-0"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[50px] bg-transparent text-xs text-white outline-none placeholder:text-muted"
          autoComplete="off"
        />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus() }}
          className="text-muted hover:text-white transition-colors shrink-0"
          tabIndex={-1}
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-0.5 z-50 bg-surface-2 border border-bordercol rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">
              {query.trim() ? (
                <span>
                  Pressione <kbd className="bg-surface2 px-1 rounded">Enter</kbd> para usar "{query}"
                </span>
              ) : 'Nenhum fornecedor cadastrado'}
            </div>
          ) : (
            filtered.map(f => {
              const isSelected = selected.includes(f)
              return (
                <button
                  key={f}
                  type="button"
                  onMouseDown={() => toggle(f)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-accent/10 ${
                    isSelected ? 'text-accent bg-accent/5' : 'text-gray-300'
                  }`}
                >
                  <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-accent border-accent' : 'border-gray-500'
                  }`}>
                    {isSelected && (
                      <span className="text-white text-[8px] leading-none font-bold">✓</span>
                    )}
                  </span>
                  <span className="truncate">{f}</span>
                </button>
              )
            })
          )}
          {query.trim() && !fornecedores.includes(query.trim()) && (
            <button
              type="button"
              onMouseDown={() => { toggle(query.trim()); setQuery('') }}
              className="w-full text-left px-3 py-1.5 text-xs text-accent hover:bg-accent/10 border-t border-bordercol/50 transition-colors"
            >
              + Usar "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default MultiComboboxFornecedor
