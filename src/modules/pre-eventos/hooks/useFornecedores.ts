import { useState, useCallback } from 'react'
import { FORNECEDORES_PADRAO } from '../data/fornecedores'

const LS_KEY = 'alliance_fornecedores'

function load(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch {
    localStorage.removeItem(LS_KEY)
  }
  return [...FORNECEDORES_PADRAO]
}

function persist(list: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<string[]>(load)

  const adicionarFornecedor = useCallback((nome: string) => {
    const trimmed = nome.trim()
    if (!trimmed) return
    setFornecedores(prev => {
      if (prev.includes(trimmed)) return prev
      const next = [...prev, trimmed].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      persist(next)
      return next
    })
  }, [])

  const removerFornecedor = useCallback((nome: string) => {
    setFornecedores(prev => {
      const next = prev.filter(f => f !== nome)
      persist(next)
      return next
    })
  }, [])

  const salvarFornecedores = useCallback((lista: string[]) => {
    const next = lista.map(s => s.trim()).filter(Boolean)
    persist(next)
    setFornecedores(next)
  }, [])

  return { fornecedores, adicionarFornecedor, removerFornecedor, salvarFornecedores }
}
