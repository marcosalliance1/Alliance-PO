import type { TipoEscola } from '../types'

export interface FaixaFee {
  min: number
  max: number
}

export type StatusMetaFee = 'abaixo' | 'dentro' | 'acima'

// Faixas alvo de FEE Total — constantes de negócio, ajustar aqui sem mexer nos componentes.
const FAIXA_MEDIO: FaixaFee = { min: 18, max: 20 }
const FAIXA_FUNDAMENTAL: FaixaFee = { min: 10, max: 12 }

// Envelope [13.5, 18] usado no gráfico (cobre as 3 faixas por faturamento abaixo).
export const FAIXA_SUPERIOR_ENVELOPE: FaixaFee = { min: 13.5, max: 18 }

function faixaSuperiorPorFaturamento(faturamento: number): FaixaFee {
  if (faturamento > 4_500_000) return { min: 13.5, max: 15 }
  if (faturamento >= 3_500_000) return { min: 15, max: 16 }
  return { min: 16, max: 18 }
}

export function getMetaFee(segmento: TipoEscola, faturamento = 0): FaixaFee {
  if (segmento === 'MEDIO') return FAIXA_MEDIO
  if (segmento === 'FUNDAMENTAL') return FAIXA_FUNDAMENTAL
  return faixaSuperiorPorFaturamento(faturamento)
}

export function statusMetaFee(feePercentual: number, faixa: FaixaFee): StatusMetaFee {
  if (feePercentual < faixa.min) return 'abaixo'
  if (feePercentual > faixa.max) return 'acima'
  return 'dentro'
}
