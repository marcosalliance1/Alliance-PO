// Metas de margem da Alliance (definidas pelo Marcos em 03/11/2026):
// Ensino Superior e Fundamental = 15%; Ensino Médio = 25%.
import type { TipoEscola } from '../types'

export function metaMargemPct(tipo?: TipoEscola | string | null): number {
  return String(tipo ?? '').toUpperCase() === 'MEDIO' ? 25 : 15
}

export const COR_MARGEM = { acima: '#137333', abaixo: '#c2680a', negativa: '#c0392b', semDado: '#9aa3b0' } as const

/**
 * Cor da margem frente à meta: verde só a partir da meta; laranja abaixo da meta (mas ainda positiva);
 * vermelho se for negativa (prejuízo); cinza se não há dado.
 */
export function corMargem(margemPct: number | null, meta: number): string {
  if (margemPct === null) return COR_MARGEM.semDado
  if (margemPct < 0) return COR_MARGEM.negativa
  return margemPct >= meta ? COR_MARGEM.acima : COR_MARGEM.abaixo
}
