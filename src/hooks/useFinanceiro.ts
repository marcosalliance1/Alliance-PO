import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseBoletimArquivo, parseCAPArquivo, type BoletimRow, type CAPRow } from '../utils/parseFinanceiro'

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
  upload_id?: string
}

export interface CAPRecord extends CAPRow {
  id: string
  upload_id?: string
}

export interface DimensaoProjetoRecord {
  nome_projeto: string
  ensino: string
  instituicao: string
}

export function useFinanceiro() {
  const [boletim, setBoletim] = useState<BoletimRecord[]>([])
  const [cap, setCap] = useState<CAPRecord[]>([])
  const [dimensaoProjetos, setDimensaoProjetos] = useState<DimensaoProjetoRecord[]>([])
  const [uploadMeta, setUploadMeta] = useState<{ BOLETIM: UploadMeta | null; CAP: UploadMeta | null }>({ BOLETIM: null, CAP: null })
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    // Lê das views _completo (tabela viva + histórico congelado pré-04/01/2023, ver
    // supabase/migrations/20260804000000_financeiro_historico.sql) — upload/substituição
    // continua mexendo só na tabela viva, mais abaixo em _substituir.
    const [boletimData, capData, dimData, ulpRes] = await Promise.all([
      fetchAll<BoletimRecord>('financeiro_boletim_completo').catch(() => [] as BoletimRecord[]),
      fetchAll<CAPRecord>('financeiro_cap_completo').catch(() => [] as CAPRecord[]),
      fetchAll<DimensaoProjetoRecord>('dimensao_projetos').catch(() => [] as DimensaoProjetoRecord[]),
      supabase.from('financeiro_uploads').select('*').in('tipo', ['BOLETIM', 'CAP']).order('uploaded_at', { ascending: false }).limit(10),
    ])
    setBoletim(boletimData)
    setCap(capData)
    setDimensaoProjetos(dimData)
    if (!ulpRes.error) {
      const lista = (ulpRes.data ?? []) as UploadMeta[]
      setUploadMeta({
        BOLETIM: lista.find(u => u.tipo === 'BOLETIM') ?? null,
        CAP:     lista.find(u => u.tipo === 'CAP')     ?? null,
      })
    }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function _substituir(
    tipo: 'BOLETIM' | 'CAP',
    tabela: string,
    nomeArquivo: string,
    linhas: unknown[],
    totalLinhas: number,
  ): Promise<void> {
    const { data: rec, error: recErr } = await supabase
      .from('financeiro_uploads')
      .insert({ tipo, nome_arquivo: nomeArquivo, total_linhas: totalLinhas })
      .select()
      .single()
    if (recErr) throw recErr

    try {
      const rows = (linhas as object[]).map(l => ({ ...l, upload_id: (rec as UploadMeta).id }))
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from(tabela).insert(rows.slice(i, i + BATCH))
        if (error) throw error
      }
      const { data: antigos } = await supabase
        .from('financeiro_uploads')
        .select('id')
        .eq('tipo', tipo)
        .neq('id', (rec as UploadMeta).id)
      if (antigos?.length) {
        await supabase.from('financeiro_uploads').delete().in('id', antigos.map((u: { id: string }) => u.id))
      }
    } catch (err) {
      await supabase.from('financeiro_uploads').delete().eq('id', (rec as UploadMeta).id)
      throw err
    }
  }

  async function uploadBoletim(arquivo: File): Promise<{ totalLinhas: number }> {
    const { linhas, totalLinhas } = await parseBoletimArquivo(arquivo)
    await _substituir('BOLETIM', 'financeiro_boletim', arquivo.name, linhas, totalLinhas)
    await carregar()
    return { totalLinhas }
  }

  async function uploadCAP(arquivo: File): Promise<{ totalLinhas: number }> {
    const { linhas, totalLinhas } = await parseCAPArquivo(arquivo)
    await _substituir('CAP', 'financeiro_cap', arquivo.name, linhas, totalLinhas)
    await carregar()
    return { totalLinhas }
  }

  return { boletim, cap, dimensaoProjetos, uploadMeta, carregando, uploadBoletim, uploadCAP, recarregar: carregar }
}
