import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseCAPArquivo, parseCARArquivo } from '../utils/parseFinanceiro'

const BATCH = 500

export function useFinanceiro() {
  const [cap, setCap] = useState([])
  const [car, setCar] = useState([])
  const [uploads, setUploads] = useState({ CAP: null, CAR: null })
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [capRes, carRes, ulpRes] = await Promise.all([
      supabase.from('financeiro_cap').select('*'),
      supabase.from('financeiro_car').select('*'),
      supabase.from('financeiro_uploads').select('*').order('uploaded_at', { ascending: false }).limit(20),
    ])
    if (!capRes.error) setCap(capRes.data || [])
    if (!carRes.error) setCar(carRes.data || [])
    if (!ulpRes.error) {
      const lista = ulpRes.data || []
      setUploads({
        CAP: lista.find(u => u.tipo === 'CAP') || null,
        CAR: lista.find(u => u.tipo === 'CAR') || null,
      })
    }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Insere novos dados preservando os anteriores em caso de falha
  async function _substituir(tipo, tabela, arquivo, parseFn) {
    const { linhas, totalLinhas } = await parseFn(arquivo)

    // 1. Cria novo upload record
    const { data: rec, error: recErr } = await supabase
      .from('financeiro_uploads')
      .insert({ tipo, nome_arquivo: arquivo.name, total_linhas: totalLinhas })
      .select()
      .single()
    if (recErr) throw recErr

    try {
      // 2. Insere novos dados em batches
      const rows = linhas.map(l => ({ ...l, upload_id: rec.id }))
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from(tabela).insert(rows.slice(i, i + BATCH))
        if (error) throw error
      }

      // 3. Remove uploads anteriores (cascade apaga registros antigos)
      const { data: antigos } = await supabase
        .from('financeiro_uploads')
        .select('id')
        .eq('tipo', tipo)
        .neq('id', rec.id)
      if (antigos?.length) {
        await supabase.from('financeiro_uploads').delete().in('id', antigos.map(u => u.id))
      }
    } catch (err) {
      // Rollback: remove novo upload (cascade remove dados parciais)
      await supabase.from('financeiro_uploads').delete().eq('id', rec.id)
      throw err
    }

    await carregar()
    return { totalLinhas }
  }

  async function uploadCAP(arquivo) {
    return _substituir('CAP', 'financeiro_cap', arquivo, parseCAPArquivo)
  }

  async function uploadCAR(arquivo) {
    return _substituir('CAR', 'financeiro_car', arquivo, parseCARArquivo)
  }

  return { cap, car, uploads, carregando, uploadCAP, uploadCAR, recarregar: carregar }
}
