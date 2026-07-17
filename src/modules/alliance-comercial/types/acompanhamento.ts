import type { TipoEscola } from '../../../types'

export interface RCAInfo {
  nome: string
  nivel: string
  comissaoPadraoPercentual: number
  comissaoCoordenadorPercentual: number
  comissao01Percentual: number
  comissao02Percentual: number
}

export interface MetaSegmento {
  meta: number
  metaPercentual: number
  captado: number
  captadoPercentual: number
  pendente: number
  pendentePercentual: number
}

export interface MetaTotal {
  meta: number
  captado: number
  pendente: number
  percentual: number
}

export interface ComissaoResumo {
  potencial100: number
  comMetaBatida: number
  totalNoAno: number
  mediaMes: number
  ultimaAtualizacao: string | null
}

export interface LinhaCaptacao {
  instituicao: string
  inicioAdesoes: string
  metaAdesoes: number
  adesoesAtuais: number
  pacoteBase: number
  total: number
  comissao01: number
  comissao02: number
  totalComissao: number
  responsavel: string
  comissaoRecebida: string
}

export interface AcompanhamentoComercial {
  spreadsheetId: string | null
  rca: RCAInfo
  metasPorSegmento: Record<TipoEscola, MetaSegmento>
  metaAno: MetaTotal
  superMetaAno: MetaTotal
  comissao: ComissaoResumo
  captacaoPorSegmento: Record<TipoEscola, LinhaCaptacao[]>
  sincronizadoEm: string | null
}

export function metaSegmentoVazia(): MetaSegmento {
  return { meta: 0, metaPercentual: 0, captado: 0, captadoPercentual: 0, pendente: 0, pendentePercentual: 0 }
}

export function metaTotalVazia(): MetaTotal {
  return { meta: 0, captado: 0, pendente: 0, percentual: 0 }
}

export function acompanhamentoVazio(): AcompanhamentoComercial {
  return {
    spreadsheetId: null,
    rca: { nome: '', nivel: '', comissaoPadraoPercentual: 0, comissaoCoordenadorPercentual: 0, comissao01Percentual: 0, comissao02Percentual: 0 },
    metasPorSegmento: { SUPERIOR: metaSegmentoVazia(), MEDIO: metaSegmentoVazia(), FUNDAMENTAL: metaSegmentoVazia() },
    metaAno: metaTotalVazia(),
    superMetaAno: metaTotalVazia(),
    comissao: { potencial100: 0, comMetaBatida: 0, totalNoAno: 0, mediaMes: 0, ultimaAtualizacao: null },
    captacaoPorSegmento: { SUPERIOR: [], MEDIO: [], FUNDAMENTAL: [] },
    sincronizadoEm: null,
  }
}
