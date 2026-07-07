import React, { createContext, useContext } from 'react'
import type { Projeto } from '../../../types'

interface ComercialContextValue {
  projetos: Projeto[]
}

const ComercialContext = createContext<ComercialContextValue | null>(null)

export const ComercialProvider: React.FC<{ projetos: Projeto[]; children: React.ReactNode }> = ({ projetos, children }) => (
  <ComercialContext.Provider value={{ projetos }}>{children}</ComercialContext.Provider>
)

export function useComercialContext(): ComercialContextValue {
  const ctx = useContext(ComercialContext)
  if (!ctx) throw new Error('useComercialContext must be used within ComercialProvider')
  return ctx
}
