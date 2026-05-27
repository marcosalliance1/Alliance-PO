import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseCAPArquivo, parseCARArquivo, parseTarifasBuffer, type CAPRow, type CARRow, type TarifasRow } from '../utils/parseFinanceiro'

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

export interface TarifasRecord extends TarifasRow {
  id: string
  upload_id: string
}

export function useFinanceiro() {
  const [cap, setCap] = useState<CAPRecord[]>([])
  const [car, setCar] = useState<CARRecord[]>([])
  const [tarifas, setTarifas] = useState<TarifasRecord[]>([])
  const [uploads, setUploads] = useState<{ CAP: UploadMeta | null; CAR: UploadMeta | null; TARIFAS: UploadMeta | null }>({ CAP: null, CAR: null, TARIFAS: null })
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [capData, carData, tarifasData, ulpRes] = await Promise.all([
      fetchAll<CAPRecord>('financeiro_cap').catch(() => [] as CAPRecord[]),
      fetchAll<CARRecord>('financeiro_car').catch(() => [] as CARRecord[]),
      fetchAll<TarifasRecord>('financeiro_tarifas').catch(() => [] as TarifasRecord[]),
      supabase.from('financeiro_uploads').select('*').order('uploaded_at', { ascending: false }).limit(20),
    ])
    setCap(capData)
    setCar(carData)
    setTarifas(tarifasData)
    if (!ulpRes.error) {
      const lista = (ulpRes.data ?? []) as UploadMeta[]
      setUploads({
        CAP: lista.find(u => u.tipo === 'CAP') ?? null,
        CAR: lista.find(u => u.tipo === 'CAR') ?? null,
        TARIFAS: lista.find(u => u.tipo === 'TARIFAS') ?? null,
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

  async function atualizarTarifas(accessToken: string): Promise<{ totalLinhas: number; totalValor: number }> {
    // Busca o arquivo no Google Drive
    const searchResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D'Tarifas_bancarias.xlsx'&fields=files(id%2Cname)`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (searchResp.status === 401) {
      const err = new Error('Token do Google expirado. Reconecte e tente novamente.')
      ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
      throw err
    }
    if (!searchResp.ok) throw new Error(`Erro ao buscar arquivo no Google Drive (HTTP ${searchResp.status})`)
    const searchData = await searchResp.json() as { files: { id: string; name: string }[] }
    if (!searchData.files?.length) {
      throw new Error("Arquivo 'Tarifas_bancarias.xlsx' não encontrado no Google Drive. Verifique o nome e a localização.")
    }

    const fileId = searchData.files[0].id

    // Baixa o arquivo
    const dlResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (dlResp.status === 401) {
      const err = new Error('Token do Google expirado. Reconecte e tente novamente.')
      ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
      throw err
    }
    if (!dlResp.ok) throw new Error(`Erro ao baixar arquivo do Google Drive (HTTP ${dlResp.status})`)
    const buffer = await dlResp.arrayBuffer()

    const { linhas, totalLinhas, totalValor } = parseTarifasBuffer(buffer)

    const { data: rec, error: recErr } = await supabase
      .from('financeiro_uploads')
      .insert({ tipo: 'TARIFAS', nome_arquivo: 'Tarifas_bancarias.xlsx', total_linhas: totalLinhas })
      .select()
      .single()
    if (recErr) throw recErr

    try {
      const rows = (linhas as TarifasRow[]).map(l => ({ ...l, upload_id: (rec as UploadMeta).id }))
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('financeiro_tarifas').insert(rows.slice(i, i + BATCH))
        if (error) throw error
      }
      const { data: antigos } = await supabase
        .from('financeiro_uploads')
        .select('id')
        .eq('tipo', 'TARIFAS')
        .neq('id', (rec as UploadMeta).id)
      if (antigos?.length) {
        await supabase.from('financeiro_uploads').delete().in('id', antigos.map((u: { id: string }) => u.id))
      }
    } catch (err) {
      await supabase.from('financeiro_uploads').delete().eq('id', (rec as UploadMeta).id)
      throw err
    }

    await carregar()
    return { totalLinhas, totalValor }
  }

  return { cap, car, tarifas, uploads, carregando, uploadCAP, uploadCAR, atualizarTarifas, recarregar: carregar }
}
