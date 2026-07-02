import type { Orcamento, EventType, TipoEvento, CategoriaCusto, SimulacaoCategoriaBaseline, SymplaLote } from '../types'
import { getEventCategory } from '../data/defaults'

const CATEGORIAS_CUSTO: CategoriaCusto[] = ['operacaoEstrutura', 'equipe', 'atracao', 'abBebidas', 'extras']

function totalOrcadoSecao(orc: Orcamento, categoria: CategoriaCusto): number {
  return orc[categoria].reduce((s, i) => s + i.totalOrcado, 0)
}

function mediaSecao(orcamentos: Orcamento[], categoria: CategoriaCusto): { media: number; amostras: number } {
  if (orcamentos.length === 0) return { media: 0, amostras: 0 }
  const total = orcamentos.reduce((s, o) => s + totalOrcadoSecao(o, categoria), 0)
  return { media: total / orcamentos.length, amostras: orcamentos.length }
}

export function calcularMediaHistorica(
  orcamentos: Orcamento[],
  tipoEvento: EventType | '',
  quantidadeConvidados: number,
): { baseline: SimulacaoCategoriaBaseline; amostras: Record<CategoriaCusto, number>; categoria: TipoEvento | null } {
  const categoria = tipoEvento ? getEventCategory(tipoEvento, quantidadeConvidados) : null
  const doGrupo = categoria
    ? orcamentos.filter((o) => getEventCategory(o.tipo, o.quantidadeConvidados) === categoria)
    : orcamentos

  const baseline = {} as SimulacaoCategoriaBaseline
  const amostras = {} as Record<CategoriaCusto, number>

  for (const cat of CATEGORIAS_CUSTO) {
    const doGrupoResult = mediaSecao(doGrupo, cat)
    if (doGrupoResult.amostras > 0) {
      baseline[cat] = doGrupoResult.media
      amostras[cat] = doGrupoResult.amostras
    } else {
      const geral = mediaSecao(orcamentos, cat)
      baseline[cat] = geral.media
      amostras[cat] = geral.amostras
    }
  }

  return { baseline, amostras, categoria }
}

export function recalcularBaselineDaMedia(
  orcamentos: Orcamento[],
  tipoEvento: EventType | '',
  quantidadeConvidados: number,
): SimulacaoCategoriaBaseline {
  return calcularMediaHistorica(orcamentos, tipoEvento, quantidadeConvidados).baseline
}

// ─── Resultado da simulação ─────────────────────────────────────────────────────

export interface ResultadoSimulacao {
  custoTotal: number
  totalIngressos: number
  receitaTotal: number
  saldo: number
  necessarioIngressos: number // custoTotal - bolsaFolia: quanto falta vender em ingresso pra empatar (0 a 0)
}

export function calcularResultado(
  baseline: SimulacaoCategoriaBaseline,
  bolsaFolia: number,
  loteIngressos: SymplaLote[],
): ResultadoSimulacao {
  const custoTotal = CATEGORIAS_CUSTO.reduce((s, cat) => s + baseline[cat], 0)
  const totalIngressos = loteIngressos.reduce((s, l) => s + l.total, 0)
  const receitaTotal = bolsaFolia + totalIngressos
  return {
    custoTotal,
    totalIngressos,
    receitaTotal,
    saldo: receitaTotal - custoTotal,
    necessarioIngressos: custoTotal - bolsaFolia,
  }
}

// Quantos ingressos de CADA lote seriam necessários (isoladamente, ao preço daquele
// lote) pra cobrir o valor que falta vender até bater o ponto de equilíbrio.
export interface CombinacaoLote {
  lote: SymplaLote
  qtdeNecessaria: number
}

export function calcularCombinacaoIngressos(
  necessarioIngressos: number,
  loteIngressos: SymplaLote[],
): CombinacaoLote[] {
  if (necessarioIngressos <= 0) return []
  return loteIngressos
    .filter((l) => l.valorUnitario > 0)
    .map((lote) => ({ lote, qtdeNecessaria: Math.ceil(necessarioIngressos / lote.valorUnitario) }))
}
