import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Retorna Map<desc_centro_custo, total_pago> para despesas LIQUIDADO no boletim.
// A chave é o desc_centro_custo original (lowercase normalizado).
export function useCapTotais(): Map<string, number> {
  const [totais, setTotais] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      const PAGE = 1000
      const all: Array<{ desc_centro_custo: string; v_lancamento: number }> = []
      let from = 0
      for (;;) {
        const { data, error } = await supabase
          .from('financeiro_boletim')
          .select('desc_centro_custo, v_lancamento')
          .eq('tipo', 'DESPESA')
          .eq('situacao', 'LIQUIDADO')
          .range(from, from + PAGE - 1)
        if (error || !data) break
        all.push(...(data as Array<{ desc_centro_custo: string; v_lancamento: number }>))
        if (data.length < PAGE) break
        from += PAGE
      }
      if (cancelled) return
      const map = new Map<string, number>()
      for (const row of all) {
        const key = (row.desc_centro_custo ?? '').trim().toLowerCase()
        if (!key) continue
        map.set(key, (map.get(key) ?? 0) + (row.v_lancamento ?? 0))
      }
      setTotais(map)
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  return totais
}

// Resolve o total pago do CAP para um projeto dado o seu turma.
// Tenta match exato, depois match por substring (turma contido no centro de custo).
export function resolverTotalPago(capTotais: Map<string, number>, turma: string): number {
  if (!turma) return 0
  const norm = turma.trim().toLowerCase()

  // match exato
  if (capTotais.has(norm)) return capTotais.get(norm)!

  // match por substring: desc_centro_custo contém a turma
  let soma = 0
  let found = false
  for (const [key, val] of capTotais) {
    if (key.includes(norm) || norm.includes(key)) {
      soma += val
      found = true
      break
    }
  }
  return found ? soma : 0
}
