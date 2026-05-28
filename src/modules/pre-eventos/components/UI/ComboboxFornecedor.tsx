import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  fornecedores: string[]
  className?: string
  placeholder?: string
}

/**
 * Combobox para seleção de fornecedor.
 * - Filtra a lista conforme o usuário digita
 * - Permite digitar um nome que não está na lista
 * - Fecha ao clicar fora ou pressionar Escape
 */
const ComboboxFornecedor: React.FC<Props> = ({
  value,
  onChange,
  fornecedores,
  className = '',
  placeholder = 'Fornecedor',
}) => {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState(value)
  const containerRef        = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLInputElement>(null)

  // Sync query when value changes externally
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(value) // revert to saved value if user didn't confirm
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [value])

  const filtered = query.trim()
    ? fornecedores.filter(f => f.toLowerCase().includes(query.toLowerCase()))
    : fornecedores

  function select(name: string) {
    onChange(name)
    setQuery(name)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setQuery(value); return }
    if (e.key === 'Enter') {
      // Accept whatever is typed even if not in the list
      onChange(query)
      setOpen(false)
    }
  }

  function handleBlur() {
    // Delay to allow click on dropdown items to fire first
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        onChange(query) // commit the typed value on blur
        setOpen(false)
      }
    }, 150)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            onMouseDown={handleClear}
            className="absolute right-5 text-muted hover:text-white transition-colors"
            tabIndex={-1}
          >
            <X className="w-3 h-3" />
          </button>
        ) : null}
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus() }}
          className="absolute right-1 text-muted hover:text-white transition-colors"
          tabIndex={-1}
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

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
            filtered.map(f => (
              <button
                key={f}
                type="button"
                onMouseDown={() => select(f)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-accent/10 hover:text-white ${
                  f === value ? 'text-accent bg-accent/5' : 'text-gray-300'
                }`}
              >
                {f}
              </button>
            ))
          )}
          {query.trim() && !fornecedores.includes(query.trim()) && (
            <button
              type="button"
              onMouseDown={() => select(query.trim())}
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

export default ComboboxFornecedor
