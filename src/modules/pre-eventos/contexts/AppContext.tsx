import React, { createContext, useContext } from 'react'
import { useToast } from '../hooks/useToast'
import { useConfirm } from '../hooks/useConfirm'
import { useOrcamentos } from '../hooks/useOrcamentos'
import { useConfiguracoes } from '../hooks/useConfiguracoes'
import { useFornecedores } from '../hooks/useFornecedores'
import type { ToastMessage, ToastType } from '../types'

interface AppContextValue {
  // Toast
  toasts: ToastMessage[]
  addToast: (msg: string, type?: ToastType) => void
  removeToast: (id: string) => void
  // Confirm
  confirmState: { open: boolean; message: string; onConfirm: () => void }
  confirm: (msg: string, cb: () => void) => void
  acceptConfirm: () => void
  cancelConfirm: () => void
  // Orçamentos
  orcamentos: ReturnType<typeof useOrcamentos>['orcamentos']
  loadingOrcamentos: boolean
  salvarOrcamento: ReturnType<typeof useOrcamentos>['salvar']
  excluirOrcamento: ReturnType<typeof useOrcamentos>['excluir']
  buscarOrcamento: ReturnType<typeof useOrcamentos>['buscarPorId']
  atualizarEquipe: ReturnType<typeof useOrcamentos>['atualizarEquipe']
  recalcularSecao: ReturnType<typeof useOrcamentos>['recalcularSecao']
  // Config
  config: ReturnType<typeof useConfiguracoes>['config']
  salvarConfig: ReturnType<typeof useConfiguracoes>['salvarConfig']
  resetarConfig: ReturnType<typeof useConfiguracoes>['resetarConfig']
  // Fornecedores
  fornecedores: ReturnType<typeof useFornecedores>['fornecedores']
  adicionarFornecedor: ReturnType<typeof useFornecedores>['adicionarFornecedor']
  removerFornecedor: ReturnType<typeof useFornecedores>['removerFornecedor']
  salvarFornecedores: ReturnType<typeof useFornecedores>['salvarFornecedores']
}

const AppContext = createContext<AppContextValue | null>(null)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toasts, addToast, removeToast } = useToast()
  const { confirmState, confirm, accept, cancel } = useConfirm()
  const { orcamentos, loading: loadingOrcamentos, salvar, excluir, buscarPorId, atualizarEquipe, recalcularSecao } = useOrcamentos()
  const { config, salvarConfig, resetarConfig } = useConfiguracoes()
  const { fornecedores, adicionarFornecedor, removerFornecedor, salvarFornecedores } = useFornecedores()

  return (
    <AppContext.Provider value={{
      toasts, addToast, removeToast,
      confirmState, confirm, acceptConfirm: accept, cancelConfirm: cancel,
      orcamentos,
      loadingOrcamentos,
      salvarOrcamento: salvar,
      excluirOrcamento: excluir,
      buscarOrcamento: buscarPorId,
      atualizarEquipe,
      recalcularSecao,
      config, salvarConfig, resetarConfig,
      fornecedores, adicionarFornecedor, removerFornecedor, salvarFornecedores,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
