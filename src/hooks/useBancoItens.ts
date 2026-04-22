import { useState, useEffect, useCallback } from 'react'
import type { ItemCatalogo } from '../types'
import { ITENS_PADRAO } from '../data/itensPadrao'
import { v4 as uuid } from '../utils/uuid'
import { supabase } from '../lib/supabase'

function rowToItem(row: { id: string; data: unknown }): ItemCatalogo {
  return { ...(row.data as ItemCatalogo), id: row.id }
}

export function useBancoItens() {
  const [itens, setItens] = useState<ItemCatalogo[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('banco_itens').select('*').order('id')
    if (error) { setLoading(false); return }

    if (!data || data.length === 0) {
      // Primeira vez: popular com itens padrão
      const rows = ITENS_PADRAO.map((item) => ({ id: uuid(), data: { ...item } }))
      await supabase.from('banco_itens').insert(rows)
      setItens(rows.map(rowToItem))
    } else {
      setItens(data.map(rowToItem))
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const adicionarItem = useCallback(async (item: Omit<ItemCatalogo, 'id'>) => {
    const id = uuid()
    const { error } = await supabase.from('banco_itens').insert({ id, data: { ...item, id } })
    if (error) throw new Error(error.message)
    setItens((prev) => [...prev, { ...item, id }])
  }, [])

  const atualizarItem = useCallback(async (id: string, changes: Partial<ItemCatalogo>) => {
    setItens((prev) => {
      const updated = prev.map((i) => i.id === id ? { ...i, ...changes } : i)
      const item = updated.find((i) => i.id === id)
      if (item) supabase.from('banco_itens').update({ data: item }).eq('id', id)
      return updated
    })
  }, [])

  const desativarItem = useCallback(async (id: string) => {
    setItens((prev) => {
      const updated = prev.map((i) => i.id === id ? { ...i, ativo: false } : i)
      const item = updated.find((i) => i.id === id)
      if (item) supabase.from('banco_itens').update({ data: item }).eq('id', id)
      return updated
    })
  }, [])

  const reativarItem = useCallback(async (id: string) => {
    setItens((prev) => {
      const updated = prev.map((i) => i.id === id ? { ...i, ativo: true } : i)
      const item = updated.find((i) => i.id === id)
      if (item) supabase.from('banco_itens').update({ data: item }).eq('id', id)
      return updated
    })
  }, [])

  return { itens, loading, adicionarItem, atualizarItem, desativarItem, reativarItem }
}
