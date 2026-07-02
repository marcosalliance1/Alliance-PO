import type { Orcamento, EventType, TipoEvento, CategoriaCusto, SimulacaoCategoriaBaseline } from '../types'
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

// ─── Cenários de venda de ingresso ─────────────────────────────────────────────

export interface FaixaIngressos {
  id: string
  label: string
  min: number
  max: number | null // null = faixa aberta ("acima de")
}

export const FAIXAS_INGRESSOS: FaixaIngressos[] = [
  { id: 'sem_venda', label: 'Sem venda de ingressos', min: 0, max: 0 },
  { id: 'baixo', label: 'R$ 0 – R$ 5.000', min: 0, max: 5000 },
  { id: 'medio', label: 'R$ 5.000 – R$ 10.000', min: 5000, max: 10000 },
  { id: 'alto', label: 'Acima de R$ 10.000', min: 10000, max: null },
]

export interface ResultadoCenario {
  faixa: FaixaIngressos
  custoTotal: number
  receitaMin: number
  receitaMax: number | null
  saldoMin: number
  saldoMax: number | null
}

export function calcularCenarios(baseline: SimulacaoCategoriaBaseline, bolsaFolia: number): ResultadoCenario[] {
  const custoTotal = CATEGORIAS_CUSTO.reduce((s, cat) => s + baseline[cat], 0)

  return FAIXAS_INGRESSOS.map((faixa) => {
    const receitaMin = bolsaFolia + faixa.min
    const receitaMax = faixa.max === null ? null : bolsaFolia + faixa.max
    return {
      faixa,
      custoTotal,
      receitaMin,
      receitaMax,
      saldoMin: receitaMin - custoTotal,
      saldoMax: receitaMax === null ? null : receitaMax - custoTotal,
    }
  })
}
