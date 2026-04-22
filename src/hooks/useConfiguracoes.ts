import { useState, useEffect, useCallback } from 'react'
import type { ConfiguracaoGlobal } from '../types'
import { supabase } from '../lib/supabase'

const PADRAO: ConfiguracaoGlobal = {
  ipcaPadrao: 0.0594,
  fornecedoresFavoritos: [],
}

export function useConfiguracoes() {
  const [config, setConfig] = useState<ConfiguracaoGlobal>(PADRAO)

  useEffect(() => {
    supabase
      .from('configuracoes')
      .select('data')
      .eq('id', 'global')
      .single()
      .then(({ data }) => {
        if (data?.data) setConfig({ ...PADRAO, ...(data.data as Partial<ConfiguracaoGlobal>) })
      })
  }, [])

  const salvarConfig = useCallback(async (c: ConfiguracaoGlobal) => {
    setConfig(c)
    await supabase
      .from('configuracoes')
      .upsert({ id: 'global', data: c })
  }, [])

  const adicionarFornecedor = useCallback(async (nome: string) => {
    if (config.fornecedoresFavoritos.includes(nome)) return
    await salvarConfig({ ...config, fornecedoresFavoritos: [...config.fornecedoresFavoritos, nome] })
  }, [config, salvarConfig])

  const removerFornecedor = useCallback(async (nome: string) => {
    await salvarConfig({
      ...config,
      fornecedoresFavoritos: config.fornecedoresFavoritos.filter((f) => f !== nome),
    })
  }, [config, salvarConfig])

  return { config, salvarConfig, adicionarFornecedor, removerFornecedor }
}
