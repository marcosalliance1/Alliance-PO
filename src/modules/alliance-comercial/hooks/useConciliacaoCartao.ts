import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { extrairSpreadsheetId } from '../../../utils/sheetsSync'
import { sincronizarCartaoGeral } from '../lib/cartaoGeralSheets'
import { sincronizarCartaoComercial } from '../lib/cartaoComercialSheets'
import { conciliar, type ComercialParaConciliar, type GeralParaConciliar, type StatusConciliacao } from '../lib/conciliacaoCartao'

export interface CartaoGastoGeralRow {
  id: string
  portador: string
  aba_origem: string
  numero_cartao_mascarado: string | null
  banco: string | null
  fatura_data_inicio: string | null
  fatura_data_fim: string | null
  fatura_vencimento: string | null
  item_comprado: string | null
  valor: number
  data: string
  descricao: string | null
  natureza_qual_casa: string | null
  jotform: string | null
  eh_comercial: boolean
  chave_natural: string
}

export interface CartaoGastoComercialRow {
  id: string
  planilha_aba: string
  segmento: string
  projeto: string
  categoria: string | null
  reuniao: string | null
  data: string
  valor: number
  fornecedor: string | null
  responsavel: string | null
  portador_raw: string | null
  portador: string | null
  fora_do_cartao: boolean
  chave_natural: string
  status_conciliacao: StatusConciliacao | 'nao_processado'
  match_geral_id: string | null
  dif_dias: number | null
  revisado_manualmente: boolean
  observacao_revisao: string | null
}

const TABELA_GERAL = 'cartao_gastos_geral'
const TABELA_COMERCIAL = 'cartao_gastos_comercial'

export function useConciliacaoCartao() {
  const [linhasGeral, setLinhasGeral] = useState<CartaoGastoGeralRow[]>([])
  const [linhasComercial, setLinhasComercial] = useState<CartaoGastoComercialRow[]>([])
  const [geralSemCorrespondenciaIds, setGeralSemCorrespondenciaIds] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [recalculando, setRecalculando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    const [geralRes, comercialRes] = await Promise.all([
      supabase.from(TABELA_GERAL).select('*').order('data', { ascending: false }),
      supabase.from(TABELA_COMERCIAL).select('*').order('data', { ascending: false }),
    ])
    if (geralRes.error) { setErro(geralRes.error.message); setCarregando(false); return }
    if (comercialRes.error) { setErro(comercialRes.error.message); setCarregando(false); return }
    setLinhasGeral((geralRes.data ?? []) as CartaoGastoGeralRow[])
    setLinhasComercial((comercialRes.data ?? []) as CartaoGastoComercialRow[])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Recalcula o status de conciliação de TODAS as linhas comerciais contra o estado
  // atual da tabela geral — chamado ao final de cada sincronização, e também
  // disponível como ação manual (ex: depois de mudar a tolerância de dias).
  const recalcular = useCallback(async () => {
    setRecalculando(true)
    try {
      const [geralRes, comercialRes] = await Promise.all([
        supabase.from(TABELA_GERAL).select('id, valor, data, portador, eh_comercial'),
        supabase.from(TABELA_COMERCIAL).select('id, valor, data, portador, fora_do_cartao'),
      ])
      if (geralRes.error) throw new Error(geralRes.error.message)
      if (comercialRes.error) throw new Error(comercialRes.error.message)

      const geralParaConciliar: GeralParaConciliar[] = (geralRes.data ?? []).map(g => ({
        id: g.id as string, valor: Number(g.valor), data: g.data as string,
        portador: g.portador as string, ehComercial: g.eh_comercial as boolean,
      }))
      const comercialParaConciliar: ComercialParaConciliar[] = (comercialRes.data ?? []).map(c => ({
        id: c.id as string, valor: Number(c.valor), data: c.data as string,
        portador: c.portador as string | null, foraDoCartao: c.fora_do_cartao as boolean,
      }))

      const { resultados, geralSemCorrespondencia } = conciliar(comercialParaConciliar, geralParaConciliar)
      setGeralSemCorrespondenciaIds(geralSemCorrespondencia)

      const erros = (await Promise.all(resultados.map(r =>
        supabase.from(TABELA_COMERCIAL)
          .update({ status_conciliacao: r.status, match_geral_id: r.matchGeralId, dif_dias: r.difDias })
          .eq('id', r.id),
      ))).filter(res => res.error)
      if (erros.length > 0) throw new Error(erros[0].error!.message)

      await carregar()
    } finally {
      setRecalculando(false)
    }
  }, [carregar])

  const sincronizarGeral = useCallback(async (link: string, accessToken: string) => {
    setSincronizando(true); setErro(null)
    try {
      const spreadsheetId = extrairSpreadsheetId(link) ?? link.trim()
      if (!spreadsheetId) throw new Error('Link do Google Sheets inválido.')
      const { linhas, avisos: avisosImport, abasNaoReconhecidas } = await sincronizarCartaoGeral(spreadsheetId, accessToken)

      const avisosFinal = [...avisosImport]
      if (abasNaoReconhecidas.length > 0) {
        avisosFinal.push(`Abas não reconhecidas como portador específico (assumidas como cartão "Alliance"): ${abasNaoReconhecidas.join(', ')}.`)
      }

      if (linhas.length > 0) {
        const payload = linhas.map(l => ({
          portador: l.portador,
          aba_origem: l.abaOrigem,
          numero_cartao_mascarado: l.numeroCartaoMascarado,
          banco: l.banco,
          fatura_data_inicio: l.faturaDataInicio,
          fatura_data_fim: l.faturaDataFim,
          fatura_vencimento: l.faturaVencimento,
          item_comprado: l.itemComprado,
          valor: l.valor,
          data: l.data,
          descricao: l.descricao,
          natureza_qual_casa: l.naturezaQualCasa,
          jotform: l.jotform,
          eh_comercial: l.ehComercial,
          chave_natural: l.chaveNatural,
        }))
        const { error } = await supabase.from(TABELA_GERAL).upsert(payload, { onConflict: 'chave_natural' })
        if (error) throw new Error(error.message)
      }

      setAvisos(avisosFinal)
      await recalcular()
    } catch (e) {
      setErro((e as Error).message)
      throw e
    } finally {
      setSincronizando(false)
    }
  }, [recalcular])

  const sincronizarComercial = useCallback(async (link: string, accessToken: string) => {
    setSincronizando(true); setErro(null)
    try {
      const spreadsheetId = extrairSpreadsheetId(link) ?? link.trim()
      if (!spreadsheetId) throw new Error('Link do Google Sheets inválido.')
      const { linhas, avisos: avisosImport } = await sincronizarCartaoComercial(spreadsheetId, accessToken)

      if (linhas.length > 0) {
        // Só as colunas vindas da planilha — nunca inclui status_conciliacao,
        // match_geral_id, revisado_manualmente ou observacao_revisao aqui, pra um
        // reimport nunca apagar uma revisão manual já feita.
        const payload = linhas.map(l => ({
          planilha_aba: l.planilhaAba,
          segmento: l.segmento,
          projeto: l.projeto,
          categoria: l.categoria,
          reuniao: l.reuniao,
          data: l.data,
          valor: l.valor,
          fornecedor: l.fornecedor,
          responsavel: l.responsavel,
          portador_raw: l.portadorRaw,
          portador: l.portador,
          fora_do_cartao: l.foraDoCartao,
          chave_natural: l.chaveNatural,
        }))
        const { error } = await supabase.from(TABELA_COMERCIAL).upsert(payload, { onConflict: 'chave_natural' })
        if (error) throw new Error(error.message)
      }

      setAvisos(avisosImport)
      await recalcular()
    } catch (e) {
      setErro((e as Error).message)
      throw e
    } finally {
      setSincronizando(false)
    }
  }, [recalcular])

  const marcarRevisado = useCallback(async (id: string, revisado: boolean, observacao: string | null) => {
    const { error } = await supabase.from(TABELA_COMERCIAL)
      .update({ revisado_manualmente: revisado, observacao_revisao: observacao })
      .eq('id', id)
    if (error) throw new Error(error.message)
    await carregar()
  }, [carregar])

  const geralSemCorrespondencia = linhasGeral.filter(g => geralSemCorrespondenciaIds.includes(g.id))

  return {
    linhasGeral,
    linhasComercial,
    geralSemCorrespondencia,
    carregando,
    sincronizando,
    recalculando,
    erro,
    avisos,
    sincronizarGeral,
    sincronizarComercial,
    recalcular,
    marcarRevisado,
    recarregar: carregar,
  }
}
