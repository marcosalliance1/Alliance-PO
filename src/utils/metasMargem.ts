// Metas de margem da Alliance (definidas pelo Marcos em 03/11/2026):
// Ensino Superior e Fundamental = 15%; Ensino Médio = 25%.
// Editáveis na tela "Metas de margem" (ficam no navegador de quem editou — localStorage).
import type { TipoEscola } from '../types'
import { METAS_PADRAO, type MetasPct } from '../lib/economiaFechados'

export { METAS_PADRAO }
export type { MetasPct }

const CHAVE_METAS = 'alliance_metas_margem'

const metaValida = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100

/** Metas atuais (padrão ou as editadas). Nunca lança: sem localStorage ou com valor inválido, volta ao padrão. */
export function lerMetas(): MetasPct {
  try {
    const bruto = localStorage.getItem(CHAVE_METAS)
    if (!bruto) return { ...METAS_PADRAO }
    const o = JSON.parse(bruto) as Partial<MetasPct>
    return {
      MEDIO: metaValida(o.MEDIO) ? o.MEDIO : METAS_PADRAO.MEDIO,
      SUPERIOR: metaValida(o.SUPERIOR) ? o.SUPERIOR : METAS_PADRAO.SUPERIOR,
      FUNDAMENTAL: metaValida(o.FUNDAMENTAL) ? o.FUNDAMENTAL : METAS_PADRAO.FUNDAMENTAL,
    }
  } catch {
    return { ...METAS_PADRAO }
  }
}

/** Grava as metas. Devolve false se o navegador não permitiu gravar (a tela segue funcionando em memória). */
export function salvarMetas(m: MetasPct): boolean {
  try {
    localStorage.setItem(CHAVE_METAS, JSON.stringify(m))
    return true
  } catch {
    return false
  }
}

export function restaurarMetasPadrao(): void {
  try { localStorage.removeItem(CHAVE_METAS) } catch { /* sem localStorage: nada a restaurar */ }
}

export function metaMargemPct(tipo?: TipoEscola | string | null): number {
  const t = String(tipo ?? '').toUpperCase()
  const metas = lerMetas()
  return t === 'MEDIO' ? metas.MEDIO : t === 'SUPERIOR' ? metas.SUPERIOR : t === 'FUNDAMENTAL' ? metas.FUNDAMENTAL : METAS_PADRAO.SUPERIOR
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
