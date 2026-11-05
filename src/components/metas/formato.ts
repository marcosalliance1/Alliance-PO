import type { Aviso, ResultadoProjeto } from '../../lib/economiaFechados'

// Vermelho = falta / estouro · Verde = economia / meta coberta (decisão do briefing).
export const COR_FALTA = '#d93f44'
export const COR_ECONOMIA = '#0e9060'
export const COR_NEUTRA = '#8892a4'
export const COR_META = '#c2680a'
export const COR_POTENCIAL = '#3b82c4' // azul: ainda não é economia, é onde pode haver

export const num2 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const reais = (n: number) => `${n < 0 ? '-' : ''}R$ ${num2(Math.abs(n))}`
export const pct1 = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`)
export const pct0 = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100).toLocaleString('pt-BR')}%`)
export const mil = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (a >= 1000) return `${Math.round(v / 1000).toLocaleString('pt-BR')} mil`
  return String(Math.round(v))
}

/** Em tabela: zero vira traço (menos ruído visual). */
export const num2OuTraco = (n: number) => (Math.abs(n) < 0.005 ? '—' : num2(n))

export function corCobertura(cobertura: number | null): string {
  if (cobertura === null) return COR_NEUTRA
  if (cobertura >= 1) return COR_ECONOMIA
  if (cobertura > 0) return COR_META
  return COR_FALTA
}

export const TEXTO_AVISO: Record<Aviso, string> = {
  'sem-receita': 'Sem receita orçada — não entra no cálculo da FALTA.',
  'sem-ensino': 'Sem tipo de ensino no cadastro — sem meta, não entra no cálculo da FALTA.',
  'sem-fechados': 'Nenhum item fechado ainda.',
  'fonte-itens': 'Receita e custo vieram da soma dos itens (o Resumo Geral desta P.O. ainda não foi lido pelo sync); podem diferir da planilha.',
  'local-corrigido': 'Local ajustado no dashboard (o cadastro diz outro local). O cadastro não foi alterado.',
}

/** Nome para exibir: o cadastro guarda tudo em caixa alta. */
export function ensinoCurto(r: ResultadoProjeto): string {
  return r.ensino === 'MEDIO' ? 'Médio' : r.ensino === 'SUPERIOR' ? 'Superior' : r.ensino === 'FUNDAMENTAL' ? 'Fundamental' : '—'
}
