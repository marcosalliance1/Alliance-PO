import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export interface CompraComercial {
  id: string
  data: string
  desc_conta_gerencial: string
  desc_centro_custo: string
  valor: number
  descricao: string
  criado_em: string
}

export interface NovaCompra {
  data: string
  desc_conta_gerencial: string
  desc_centro_custo: string
  valor: number
  descricao: string
}

export function useComprasComercial() {
  const [compras, setCompras]           = useState<CompraComercial[]>([])
  const [contasGerenciais, setContas]   = useState<string[]>([])
  const [centrosCusto, setCentros]      = useState<string[]>([])
  const [carregando, setCarregando]     = useState(true)
  const [erro, setErro]                 = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    const [comprasRes, contasRes, centrosRes] = await Promise.all([
      supabase.from('compras_comercial').select('*').order('data', { ascending: false }),
      supabase.from('v_everest_contas_gerenciais').select('valor'),
      supabase.from('v_everest_centros_custo').select('valor'),
    ])
    if (comprasRes.error) { setErro(comprasRes.error.message); setCarregando(false); return }
    setCompras((comprasRes.data ?? []) as CompraComercial[])
    setContas(((contasRes.data ?? []) as { valor: string }[]).map(r => r.valor))
    setCentros(((centrosRes.data ?? []) as { valor: string }[]).map(r => r.valor))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function criar(nova: NovaCompra): Promise<void> {
    const { error } = await supabase.from('compras_comercial').insert(nova)
    if (error) throw new Error(error.message)
    await carregar()
  }

  async function remover(id: string): Promise<void> {
    const { error } = await supabase.from('compras_comercial').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await carregar()
  }

  return { compras, contasGerenciais, centrosCusto, carregando, erro, criar, remover, recarregar: carregar }
}
