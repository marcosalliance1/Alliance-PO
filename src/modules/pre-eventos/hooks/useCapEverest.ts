import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type { EventType } from '../types'
import { CONTA_GERENCIAL_POR_TIPO, type CapTitulo } from '../utils/matchEverest'

export interface CapEverestState {
  titulos: CapTitulo[]
  loading: boolean
  erro: string | null
  contaAlvo: string | null
  semConta: boolean // tipo de evento sem conta gerencial mapeada (ex: Festa de Integração)
}

const INICIAL: CapEverestState = { titulos: [], loading: false, erro: null, contaAlvo: null, semConta: false }

/**
 * Lê os títulos do CAP (Everest) via Edge Function `cap-conciliacao`, que roda
 * server-side com service_role e devolve só o recorte da turma + conta gerencial.
 * Assim funciona mesmo pro viewer (anon), sem abrir a view financeira.
 * Read-only. Só busca quando `ativo` é true (ex: modal aberto).
 */
export function useCapEverest(turma: string, tipo: EventType, ativo: boolean): CapEverestState {
  const [state, setState] = useState<CapEverestState>(INICIAL)

  useEffect(() => {
    if (!ativo) { setState(INICIAL); return }

    const contaAlvo = CONTA_GERENCIAL_POR_TIPO[tipo]
    if (!contaAlvo) { setState({ ...INICIAL, semConta: true }); return }
    if (!turma.trim()) { setState({ ...INICIAL, contaAlvo, erro: 'Preencha a turma do orçamento para buscar no Everest.' }); return }

    let cancelado = false
    setState({ ...INICIAL, loading: true, contaAlvo })

    ;(async () => {
      const { data, error } = await supabase.functions.invoke('cap-conciliacao', {
        body: { turma, contaGerencial: contaAlvo },
      })

      if (cancelado) return
      if (error) { setState({ ...INICIAL, contaAlvo, erro: `Erro ao consultar o Everest: ${error.message}` }); return }
      if (data?.error) { setState({ ...INICIAL, contaAlvo, erro: data.error }); return }

      const titulos = (data?.titulos ?? []) as CapTitulo[]
      setState({ titulos, loading: false, erro: null, contaAlvo, semConta: false })
    })()

    return () => { cancelado = true }
  }, [turma, tipo, ativo])

  return state
}
