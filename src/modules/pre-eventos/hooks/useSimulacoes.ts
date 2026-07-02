import { useState, useEffect, useCallback } from 'react'
import type { Simulacao } from '../types'
import { supabase, hasSupabase } from '../lib/supabase'

const LS_KEY = 'alliance_simulacoes'

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadFromLS(): Simulacao[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as Simulacao[]
  } catch {
    console.warn('[Alliance] localStorage parse error — resetting simulacoes')
    localStorage.removeItem(LS_KEY)
  }
  return []
}

function persistToLS(list: Simulacao[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {
    console.warn('[Alliance] localStorage write error (quota exceeded?)')
  }
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function loadFromSupabase(): Promise<Simulacao[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('simulacoes')
    .select('dados')
    .order('atualizado_em', { ascending: false })
  if (error) { console.error('[Supabase] load error:', error.message); return [] }
  return (data ?? []).map((row: { dados: Simulacao }) => row.dados)
}

async function upsertToSupabase(sim: Simulacao): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('simulacoes')
    .upsert({ id: sim.id, dados: sim, atualizado_em: sim.atualizadoEm }, { onConflict: 'id' })
  if (error) console.error('[Supabase] upsert error:', error.message)
}

async function deleteFromSupabase(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('simulacoes').delete().eq('id', id)
  if (error) console.error('[Supabase] delete error:', error.message)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSimulacoes() {
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>(loadFromLS)
  const [loading, setLoading] = useState(hasSupabase)

  useEffect(() => {
    if (!hasSupabase) return
    setLoading(true)
    loadFromSupabase().then((data) => {
      if (data.length > 0) {
        setSimulacoes(data)
        persistToLS(data)
      }
      setLoading(false)
    })
  }, [])

  const salvar = useCallback((sim: Simulacao) => {
    const updated = { ...sim, atualizadoEm: new Date().toISOString() }
    setSimulacoes((prev) => {
      const exists = prev.find((s) => s.id === sim.id)
      const next = exists
        ? prev.map((s) => (s.id === sim.id ? updated : s))
        : [...prev, updated]
      persistToLS(next)
      return next
    })
    upsertToSupabase(updated)
    return updated
  }, [])

  const excluir = useCallback((id: string) => {
    setSimulacoes((prev) => {
      const next = prev.filter((s) => s.id !== id)
      persistToLS(next)
      return next
    })
    deleteFromSupabase(id)
  }, [])

  const buscarPorId = useCallback(
    (id: string) => simulacoes.find((s) => s.id === id),
    [simulacoes],
  )

  return { simulacoes, loading, salvar, excluir, buscarPorId }
}
