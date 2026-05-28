import { useState, useCallback } from 'react'
import type { ConfiguracaoAutomacoes } from '../types'
import { CONFIG_PADRAO } from '../data/defaults'

const LS_KEY = 'alliance_config'

function load(): ConfiguracaoAutomacoes {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as ConfiguracaoAutomacoes
  } catch { /* ignore */ }
  return CONFIG_PADRAO
}

export function useConfiguracoes() {
  const [config, setConfig] = useState<ConfiguracaoAutomacoes>(load)

  const salvarConfig = useCallback((nova: ConfiguracaoAutomacoes) => {
    localStorage.setItem(LS_KEY, JSON.stringify(nova))
    setConfig(nova)
  }, [])

  const resetarConfig = useCallback(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(CONFIG_PADRAO))
    setConfig(CONFIG_PADRAO)
  }, [])

  return { config, salvarConfig, resetarConfig }
}
