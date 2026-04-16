import { useState, useEffect } from 'react'

// Prefixo único para não conflitar com outros projetos
const PREFIX = 'alliance_po_'

export function useStorage(chave, valorInicial) {
  const chaveCompleta = PREFIX + chave

  const [valor, setValor] = useState(() => {
    try {
      const item = localStorage.getItem(chaveCompleta)
      if (item) return JSON.parse(item)
      return typeof valorInicial === 'function' ? valorInicial() : valorInicial
    } catch {
      return typeof valorInicial === 'function' ? valorInicial() : valorInicial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(chaveCompleta, JSON.stringify(valor))
    } catch {
      console.error('Erro ao salvar no localStorage')
    }
  }, [valor, chaveCompleta])

  return [valor, setValor]
}

export function salvarStorage(chave, valor) {
  try {
    localStorage.setItem(PREFIX + chave, JSON.stringify(valor))
  } catch {
    console.error('Erro ao salvar')
  }
}

export function lerStorage(chave, padrao = null) {
  try {
    const item = localStorage.getItem(PREFIX + chave)
    return item ? JSON.parse(item) : padrao
  } catch {
    return padrao
  }
}

export function removerStorage(chave) {
  localStorage.removeItem(PREFIX + chave)
}
