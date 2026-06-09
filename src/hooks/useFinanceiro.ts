import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseBoletimArquivo, type BoletimRow } from '../utils/parseFinanceiro'

const BATCH = 500

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

export interface UploadMeta {
  id: string
  tipo: string
  nome_arquivo: string
  total_linhas: number
  uploaded_at: string
}

export interface BoletimRecord extends BoletimRow {
  id: string
  upload_id: string
}

export interface DimensaoProjetoRecord {
  nome_projeto: string
  ensino: string
  instituicao: string
}

export function useFinanceiro() {
  const [boletim, setBoletim] = useState<BoletimRecord[]>([])
  const [dimensaoProjetos, setDimensaoProjetos] = useState<DimensaoProjetoRecord[]>([])
  const [uploadMeta, setUploadMeta] = useState<UploadMeta | null>(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [boletimData, dimData, ulpRes] = await Promise.all([
      fetchAll<BoletimRecord>('financeiro_boletim').catch(() => [] as BoletimRecord[]),
      fetchAll<DimensaoProjetoRecord>('dimensao_projetos').catch(() => [] as DimensaoProjetoRecord[]),
      supabase.from('financeiro_uploads').select('*').eq('tipo', 'BOLETIM').order('uploaded_at', { ascending: false }).limit(1),
    ])
    setBoletim(boletimData)
    setDimensaoProjetos(dimData)
    if (!ulpRes.error) {
      const lista = (ulpRes.data ?? []) as UploadMeta[]
      setUploadMeta(lista[0] ?? null)
    }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function uploadBoletim(arquivo: File): Promise<{ totalLinhas: number }> {
    const { linhas, totalLinhas } = await parseBoletimArquivo(arquivo)

    const { data: rec, error: recErr } = await supabase
      .from('financeiro_uploads')
      .insert({ tipo: 'BOLETIM', nome_arquivo: arquivo.name, total_linhas: totalLinhas })
      .select()
      .single()
    if (recErr) throw recErr

    try {
      const rows = linhas.map(l => ({ ...l, upload_id: (rec as UploadMeta).id }))
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('financeiro_boletim').insert(rows.slice(i, i + BATCH))
        if (error) throw error
      }
      const { data: antigos } = await supabase
        .from('financeiro_uploads')
        .select('id')
        .eq('tipo', 'BOLETIM')
        .neq('id', (rec as UploadMeta).id)
      if (antigos?.length) {
        await supabase.from('financeiro_uploads').delete().in('id', antigos.map((u: { id: string }) => u.id))
      }
    } catch (err) {
      await supabase.from('financeiro_uploads').delete().eq('id', (rec as UploadMeta).id)
      throw err
    }

    await carregar()
    return { totalLinhas }
  }

  return { boletim, dimensaoProjetos, uploadMeta, carregando, uploadBoletim, recarregar: carregar }
}
