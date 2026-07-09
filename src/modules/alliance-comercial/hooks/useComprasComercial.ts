import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const CENTRO_CUSTO_COMERCIAL = 'COMERCIAL'

export interface CompraComercial {
  id: string
  data: string
  desc_conta_gerencial: string
  desc_centro_custo: string
  projeto: string | null
  fornecedor: string | null
  valor: number
  descricao: string
  criado_em: string
}

export interface NovaCompra {
  data: string
  desc_conta_gerencial: string
  projeto: string | null
  fornecedor: string | null
  valor: number
  descricao: string
}

export function useComprasComercial() {
  const [compras, setCompras]           = useState<CompraComercial[]>([])
  const [contasGerenciais, setContas]   = useState<string[]>([])
  const [projetos, setProjetos]         = useState<string[]>([])
  const [carregando, setCarregando]     = useState(true)
  const [erro, setErro]                 = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    const [comprasRes, contasRes, projetosRes] = await Promise.all([
      supabase.from('compras_comercial').select('*').order('data', { ascending: false }),
      supabase.from('v_everest_contas_gerenciais').select('valor'),
      supabase.from('dimensao_projetos').select('nome_projeto').order('nome_projeto'),
    ])
    if (comprasRes.error) { setErro(comprasRes.error.message); setCarregando(false); return }
    setCompras((comprasRes.data ?? []) as CompraComercial[])
    setContas(((contasRes.data ?? []) as { valor: string }[]).map(r => r.valor))
    setProjetos(((projetosRes.data ?? []) as { nome_projeto: string }[]).map(r => r.nome_projeto))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function criar(nova: NovaCompra): Promise<void> {
    const { error } = await supabase.from('compras_comercial').insert({ ...nova, desc_centro_custo: CENTRO_CUSTO_COMERCIAL })
    if (error) throw new Error(error.message)
    await carregar()
  }

  async function remover(id: string): Promise<void> {
    const { error } = await supabase.from('compras_comercial').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await carregar()
  }

  return { compras, contasGerenciais, projetos, carregando, erro, criar, remover, recarregar: carregar }
}
