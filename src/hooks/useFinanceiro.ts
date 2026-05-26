import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseCAPArquivo, parseCARArquivo, type CAPRow, type CARRow } from '../utils/parseFinanceiro'

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

export interface CAPRecord extends CAPRow {
  id: string
  upload_id: string
}

export interface CARRecord extends CARRow {
  id: string
  upload_id: string
}

export function useFinanceiro() {
  const [cap, setCap] = useState<CAPRecord[]>([])
  const [car, setCar] = useState<CARRecord[]>([])
  const [uploads, setUploads] = useState<{ CAP: UploadMeta | null; CAR: UploadMeta | null }>({ CAP: null, CAR: null })
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [capData, carData, ulpRes] = await Promise.all([
      fetchAll<CAPRecord>('financeiro_cap').catch(() => [] as CAPRecord[]),
      fetchAll<CARRecord>('financeiro_car').catch(() => [] as CARRecord[]),
      supabase.from('financeiro_uploads').select('*').order('uploaded_at', { ascending: false }).limit(20),
    ])
    setCap(capData)
    setCar(carData)
    if (!ulpRes.error) {
      const lista = (ulpRes.data ?? []) as UploadMeta[]
      setUploads({
        CAP: lista.find(u => u.tipo === 'CAP') ?? null,
        CAR: lista.find(u => u.tipo === 'CAR') ?? null,
      })
    }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function _substituir(
    tipo: 'CAP' | 'CAR',
    tabela: string,
    arquivo: File,
    parseFn: (f: File) => Promise<{ linhas: CAPRow[] | CARRow[]; totalLinhas: number }>,
  ): Promise<{ totalLinhas: number }> {
    const { linhas, totalLinhas } = await parseFn(arquivo)

    const { data: rec, error: recErr } = await supabase
      .from('financeiro_uploads')
      .insert({ tipo, nome_arquivo: arquivo.name, total_linhas: totalLinhas })
      .select()
      .single()
    if (recErr) throw recErr

    try {
      const rows = linhas.map(l => ({ ...l, upload_id: (rec as UploadMeta).id }))
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

    await carregar()
    return { totalLinhas }
  }

  async function uploadCAP(arquivo: File) {
    return _substituir('CAP', 'financeiro_cap', arquivo, parseCAPArquivo)
  }

  async function uploadCAR(arquivo: File) {
    return _substituir('CAR', 'financeiro_car', arquivo, parseCARArquivo)
  }

  return { cap, car, uploads, carregando, uploadCAP, uploadCAR, recarregar: carregar }
}
