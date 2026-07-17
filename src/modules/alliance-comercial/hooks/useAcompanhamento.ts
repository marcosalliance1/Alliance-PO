import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { extrairSpreadsheetId } from '../../../utils/sheetsSync'
import { sincronizarAcompanhamento } from '../lib/acompanhamentoSheets'
import { acompanhamentoVazio, type AcompanhamentoComercial } from '../types/acompanhamento'

const ID_REGISTRO = 'unico'

export function useAcompanhamento() {
  const [dados, setDados] = useState<AcompanhamentoComercial | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('acompanhamento_comercial')
      .select('data')
      .eq('id', ID_REGISTRO)
      .maybeSingle()
    if (error) setErro(error.message)
    setDados((data?.data as AcompanhamentoComercial | undefined) ?? null)
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const sincronizar = useCallback(async (linkOuId: string, accessToken: string) => {
    setSincronizando(true)
    setErro(null)
    try {
      const spreadsheetId = extrairSpreadsheetId(linkOuId) ?? linkOuId.trim()
      if (!spreadsheetId) throw new Error('Link do Google Sheets inválido.')
      const resultado = await sincronizarAcompanhamento(spreadsheetId, accessToken)
      const { error } = await supabase
        .from('acompanhamento_comercial')
        .upsert({ id: ID_REGISTRO, spreadsheet_id: spreadsheetId, data: resultado, sincronizado_em: resultado.sincronizadoEm })
      if (error) throw new Error(error.message)
      setDados(resultado)
    } catch (e) {
      setErro((e as Error).message)
      throw e
    } finally {
      setSincronizando(false)
    }
  }, [])

  return {
    dados: dados ?? acompanhamentoVazio(),
    temDados: dados !== null,
    carregando,
    sincronizando,
    erro,
    sincronizar,
    recarregar: carregar,
  }
}
