import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

async function fetchAll<T>(tabela: string): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase.from(tabela).select('*').range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return all
}

export interface MarketingGrupo {
  group_id: string
  nome: string
  is_arquivo: boolean
}

export interface MarketingDemanda {
  id: number
  group_id: string | null
  nome: string
  cliente_extraido: string | null
  status: string
  status_is_done: boolean
  prioridade: string | null
  data_inicio: string | null
  data_fim: string | null
  turma: string | null
  solicitante: string | null
  link_demandas_texto: string | null
  tem_arquivo: boolean
  created_at: string | null
  monday_updated_at: string | null
  synced_at: string
  dimensao_nome_projeto: string | null
  dimensao_ensino: string | null
  dimensao_instituicao: string | null
  match_dimensao: boolean
}

export interface MarketingResponsavel {
  item_id: number
  person_id: number
  person_name: string
}

export interface MarketingSubitem {
  id: number
  item_id: number
  nome: string
  owner_person_id: number | null
  owner_person_name: string | null
  status: string | null
  status_is_done: boolean
  data: string | null
}

export interface SyncResult {
  synced: number
  subitensSynced: number
  groups: number
  errors: string[]
}

export function useMarketing() {
  const [grupos, setGrupos] = useState<MarketingGrupo[]>([])
  const [demandas, setDemandas] = useState<MarketingDemanda[]>([])
  const [responsaveis, setResponsaveis] = useState<MarketingResponsavel[]>([])
  const [subitens, setSubitens] = useState<MarketingSubitem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [gruposData, demandasData, respData, subData] = await Promise.all([
      fetchAll<MarketingGrupo>('marketing_grupos').catch(() => [] as MarketingGrupo[]),
      fetchAll<MarketingDemanda>('marketing_demandas_com_dimensao').catch(() => [] as MarketingDemanda[]),
      fetchAll<MarketingResponsavel>('marketing_demandas_responsaveis').catch(() => [] as MarketingResponsavel[]),
      fetchAll<MarketingSubitem>('marketing_subitens').catch(() => [] as MarketingSubitem[]),
    ])
    setGrupos(gruposData)
    setDemandas(demandasData)
    setResponsaveis(respData)
    setSubitens(subData)
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const ultimoSync = demandas.reduce<string | null>((max, d) => {
    if (!d.synced_at) return max
    return !max || d.synced_at > max ? d.synced_at : max
  }, null)

  async function sincronizarAgora(): Promise<SyncResult> {
    setSincronizando(true)
    try {
      const { data, error } = await supabase.functions.invoke('sync-marketing-monday')
      if (error) {
        let msg = error.message
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = await (error as any).context?.json?.()
          if (body?.error) msg = body.error
        } catch { /* ignore */ }
        throw new Error(msg)
      }
      await carregar()
      return data as SyncResult
    } finally {
      setSincronizando(false)
    }
  }

  return {
    grupos, demandas, responsaveis, subitens,
    carregando, sincronizando, ultimoSync,
    sincronizarAgora, recarregar: carregar,
  }
}
