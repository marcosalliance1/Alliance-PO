// Metas de margem × Economia dos fechados — cálculo PURO (sem React, sem rede, sem localStorage).
// Entra o que vem de `projetos` (somente leitura); sai o resultado por projeto e os totais.
//
// Regras (definidas pelo Marcos em 04/11/2026):
//   margem          = receita_orçada − custo_orçado                (RESUMO GERAL da planilha; senão soma dos itens)
//   margem%         = margem ÷ receita_orçada
//   margem na meta  = meta% × receita_orçada
//   FALTA           = max(0, margem na meta − margem)
//   EXCEDENTE       = max(0, margem − margem na meta)
//   Fechados (status = 'fechado', abas 2.1–2.9): d = orçado − contratado
//     Economias = Σ d (d>0) · Estouros = Σ −d (d<0) · Líquida = Economias − Estouros
//     Fechados a zero = Σ orçado dos fechados com contratado = 0 e orçado > 0
//   Cobertura = Líquida ÷ FALTA · AINDA FALTA = FALTA − Líquida
//   AINDA FALTA conservador = FALTA − (Líquida − Fechados a zero)

export type Ensino = 'MEDIO' | 'SUPERIOR' | 'FUNDAMENTAL'
export interface MetasPct { MEDIO: number; SUPERIOR: number; FUNDAMENTAL: number }
export const METAS_PADRAO: MetasPct = { MEDIO: 25, SUPERIOR: 15, FUNDAMENTAL: 15 }

/** Lê o que o usuário digitou como meta: aceita "25", "25,5", "25.5" e "25%". Devolve null se não for um número de 0 a 100. */
export function lerPercentual(t: string): number | null {
  const s = t.trim().replace('%', '').replace(',', '.')
  if (s === '' || !/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return n >= 0 && n <= 100 ? n : null
}

export const ROTULO_ENSINO: Record<Ensino, string> = { MEDIO: 'Médio', SUPERIOR: 'Superior', FUNDAMENTAL: 'Fundamental' }

// ── Locais ───────────────────────────────────────────────────────────────────
export const LOCAL_MIX = 'Mix Garden'
export const LOCAL_AVA = 'Espaço AVA'
export const LOCAL_PAV3 = 'Expominas Pav. 3'
export const LOCAL_ARENA = 'Expominas Arena'
export const LOCAL_OUTROS = 'Outros / sem local'
export const LOCAIS_ORDEM = [LOCAL_MIX, LOCAL_AVA, LOCAL_PAV3, LOCAL_ARENA, LOCAL_OUTROS] as const

export const COR_LOCAL: Record<string, string> = {
  [LOCAL_MIX]: '#0F766E',
  [LOCAL_AVA]: '#C2410C',
  [LOCAL_PAV3]: '#1D4ED8',
  [LOCAL_ARENA]: '#7E22CE',
  [LOCAL_OUTROS]: '#1F2A44',
}

/**
 * Exceções: projetos CADASTRADOS num local mas que acontecem em outro. O dado NÃO é alterado no banco —
 * a correção vive aqui, visível, e o dashboard avisa quando ela é aplicada.
 * (Bernoulli CJ e Loyola 9º ano estão como "Espaço Ava" no cadastro, mas a festa é no Mix Garden.)
 */
export const LOCAL_EXCECOES: Record<string, string> = {
  'BERNOULLI CJ 2026': LOCAL_MIX,
  'LOYOLA 9º ANO 2026': LOCAL_MIX,
}

const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

export function normalizarTurma(turma?: string | null): string {
  return String(turma ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
}

export function localDoProjeto(turma?: string | null, localCadastrado?: string | null): { local: string; corrigido: boolean } {
  const t = normalizarTurma(turma)
  const cad = semAcento(localCadastrado ?? '')
  const cadastrado = cad.includes('mix garden') ? LOCAL_MIX
    : /\bava\b/.test(cad) ? LOCAL_AVA
    : cad.includes('arena') ? LOCAL_ARENA
    : cad.includes('expominas') ? (t === 'MED PUC T18' ? LOCAL_ARENA : LOCAL_PAV3)
    : LOCAL_OUTROS
  const forcado = LOCAL_EXCECOES[t]
  if (forcado && forcado !== cadastrado) return { local: forcado, corrigido: true }
  return { local: cadastrado, corrigido: false }
}

// ── Entrada (formato de `projetos`) ──────────────────────────────────────────
export interface ItemBruto {
  id?: string
  codigo?: string
  area?: string
  subcategoria?: string
  item?: string
  status?: string
  valorOrcado?: number | null
  valorContratado?: number | null
}
export interface SecaoBruta { numero?: string; nome?: string; itens?: ItemBruto[] | null }
export interface ResumoGeralOrcado { receita?: number | null; custo?: number | null; margem?: number | null; celulas?: string; lidoEm?: string }
export interface ProjetoBruto {
  id: string
  status?: string | null
  tap?: { turma?: string; local?: string; tipoEscola?: string; anoRealizacao?: number | string; dataEvento?: string } | null
  secoes?: SecaoBruta[] | null
  receitas?: Record<string, { orcado?: number | null } | undefined> | null
  custos_adicionais?: { orcado?: number | null }[] | null
  resumo_geral_orcado?: ResumoGeralOrcado | null
  atualizado_em?: string | null
}

// ── Saída ────────────────────────────────────────────────────────────────────
export interface DetalheItem {
  aba: string // "2.1 Custo Produção"
  bloco: string // subcategoria
  item: string
  orcado: number
  contratado: number
  dif: number // orçado − contratado (positivo = economia)
}

export type FonteValores = 'planilha' | 'itens' | 'sem-dado'
export type Aviso = 'sem-receita' | 'sem-ensino' | 'sem-fechados' | 'fonte-itens' | 'local-corrigido'

export interface ResultadoProjeto {
  id: string
  turma: string
  local: string
  localCorrigido: boolean
  ensino: Ensino | null
  ano: number | null
  status: string
  fonte: FonteValores
  receita: number | null
  custo: number | null
  margem: number | null
  margemPct: number | null
  metaPct: number | null
  margemNaMeta: number | null
  falta: number
  excedente: number
  nFechados: number
  orcadoFechados: number
  contratadoFechados: number
  economias: number
  estouros: number
  liquida: number
  fechadosZero: number
  cobertura: number | null // liquida ÷ falta (null quando não há falta)
  aindaFalta: number
  aindaFaltaConservador: number
  abertoOrcado: number // Σ orçado dos itens ainda NÃO fechados (potencial de economia)
  detalhe: DetalheItem[]
  avisos: Aviso[]
  atualizadoEm: string | null
}

const n0 = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Mesma regra de src/utils/calculos.ts → filtrarItensCalculo (sem importar: este módulo é puro). */
function itensDeCalculo(itens: ItemBruto[]): ItemBruto[] {
  return itens.filter((i) => {
    if (i.status === 'N/A') return false
    if ((i.subcategoria ?? '').trim() === '') return false
    const cod = (i.codigo ?? '').trim()
    if (cod && itens.some((o) => o !== i && (o.codigo ?? '').startsWith(cod + '.'))) return false
    return true
  })
}

export function calcularProjeto(p: ProjetoBruto, metas: MetasPct = METAS_PADRAO): ResultadoProjeto {
  const avisos: Aviso[] = []
  const turma = normalizarTurma(p.tap?.turma) || '(sem nome)'
  const { local, corrigido } = localDoProjeto(p.tap?.turma, p.tap?.local)
  if (corrigido) avisos.push('local-corrigido')

  const tipo = String(p.tap?.tipoEscola ?? '').toUpperCase()
  const ensino: Ensino | null = tipo === 'MEDIO' || tipo === 'SUPERIOR' || tipo === 'FUNDAMENTAL' ? tipo : null
  if (!ensino) avisos.push('sem-ensino')
  const anoNum = Number(p.tap?.anoRealizacao)
  const ano = Number.isFinite(anoNum) && anoNum > 0 ? anoNum : null

  // ── itens: soma dos orçados (fallback) + fechados ──
  let custoItens = 0
  let abertoOrcado = 0
  let orcadoFechados = 0
  let contratadoFechados = 0
  let economias = 0
  let estouros = 0
  let fechadosZero = 0
  const detalhe: DetalheItem[] = []

  for (const s of p.secoes ?? []) {
    const aba = `${s.numero ?? ''} ${s.nome ?? ''}`.trim()
    for (const it of itensDeCalculo(s.itens ?? [])) {
      const o = n0(it.valorOrcado)
      custoItens += o
      if (it.status !== 'fechado') { abertoOrcado += o; continue }
      const c = n0(it.valorContratado)
      const d = o - c
      orcadoFechados += o
      contratadoFechados += c
      if (d > 0) economias += d
      if (d < 0) estouros += -d
      if (c === 0 && o > 0) fechadosZero += o
      detalhe.push({ aba, bloco: (it.subcategoria ?? '').trim(), item: (it.item ?? '').trim() || (it.subcategoria ?? '').trim() || '(sem nome)', orcado: o, contratado: c, dif: d })
    }
  }
  if (detalhe.length === 0) avisos.push('sem-fechados')

  // ── receita / custo orçados: RESUMO GERAL da planilha; sem ele, soma dos itens ──
  const rg = p.resumo_geral_orcado
  let fonte: FonteValores
  let receita: number | null
  let custo: number | null
  if (rg && ehNumero(rg.receita) && ehNumero(rg.custo)) {
    fonte = 'planilha'
    receita = rg.receita
    custo = rg.custo
  } else {
    const recItens = Object.values(p.receitas ?? {}).reduce((s, l) => s + n0(l?.orcado), 0)
    const custoAdic = (p.custos_adicionais ?? []).reduce((s, c) => s + n0(c?.orcado), 0)
    if (recItens > 0 || custoItens > 0) {
      fonte = 'itens'
      receita = recItens
      custo = custoItens + custoAdic
      avisos.push('fonte-itens')
    } else {
      fonte = 'sem-dado'
      receita = null
      custo = null
    }
  }

  const temReceita = receita !== null && receita > 0
  if (!temReceita) avisos.push('sem-receita')
  const margem = receita !== null && custo !== null ? receita - custo : null
  const margemPct = temReceita && margem !== null ? (margem / receita!) * 100 : null
  const metaPct = ensino ? metas[ensino] : null
  const calculavel = temReceita && margem !== null && metaPct !== null
  const margemNaMeta = calculavel ? (metaPct! / 100) * receita! : null
  const falta = calculavel ? Math.max(0, margemNaMeta! - margem!) : 0
  const excedente = calculavel ? Math.max(0, margem! - margemNaMeta!) : 0

  const liquida = economias - estouros
  return {
    id: p.id, turma, local, localCorrigido: corrigido, ensino, ano, status: p.status ?? '',
    fonte, receita, custo, margem, margemPct, metaPct, margemNaMeta, falta, excedente,
    nFechados: detalhe.length, orcadoFechados, contratadoFechados, economias, estouros, liquida, fechadosZero,
    cobertura: falta > 0 ? liquida / falta : null,
    aindaFalta: falta - liquida,
    aindaFaltaConservador: falta - (liquida - fechadosZero),
    abertoOrcado, detalhe, avisos, atualizadoEm: p.atualizado_em ?? null,
  }
}

/**
 * Visão conservadora ("Descontar fechados a zero"): tira da economia o orçado dos itens fechados com contratado R$ 0
 * (podem ser itens que se resolveram em outra linha, não economia real). Recalcula economias, líquida,
 * cobertura e AINDA FALTA; "fechadosZero" continua informado.
 */
export function descontarFechadosZero(r: ResultadoProjeto): ResultadoProjeto {
  if (r.fechadosZero === 0) return r
  const economias = r.economias - r.fechadosZero
  const liquida = r.liquida - r.fechadosZero
  return {
    ...r,
    economias,
    liquida,
    cobertura: r.falta > 0 ? liquida / r.falta : null,
    aindaFalta: r.falta - liquida,
    aindaFaltaConservador: r.falta - liquida,
  }
}

// ── Totais ───────────────────────────────────────────────────────────────────
export interface Totais {
  nProjetos: number
  nAbaixoMeta: number
  receita: number
  falta: number
  excedente: number
  economias: number
  estouros: number
  liquida: number
  fechadosZero: number
  cobertura: number | null
  aindaFalta: number
  aindaFaltaConservador: number
}

export function somarResultados(rs: ResultadoProjeto[]): Totais {
  const t: Totais = {
    nProjetos: rs.length, nAbaixoMeta: 0, receita: 0, falta: 0, excedente: 0, economias: 0, estouros: 0,
    liquida: 0, fechadosZero: 0, cobertura: null, aindaFalta: 0, aindaFaltaConservador: 0,
  }
  for (const r of rs) {
    t.receita += r.receita ?? 0
    t.falta += r.falta
    t.excedente += r.excedente
    t.economias += r.economias
    t.estouros += r.estouros
    t.liquida += r.liquida
    t.fechadosZero += r.fechadosZero
    t.aindaFalta += r.falta - r.liquida
    // soma o conservador de cada projeto (e não recalcula a partir dos totais): assim continua certo
    // quando a visão "descontar fechados a zero" já abateu o zero da líquida
    t.aindaFaltaConservador += r.aindaFaltaConservador
    if (r.falta > 0) t.nAbaixoMeta++
  }
  t.cobertura = t.falta > 0 ? t.liquida / t.falta : null
  return t
}

export function agruparPorLocal(rs: ResultadoProjeto[]): { local: string; projetos: ResultadoProjeto[]; totais: Totais }[] {
  const m = new Map<string, ResultadoProjeto[]>()
  for (const r of rs) {
    if (!m.has(r.local)) m.set(r.local, [])
    m.get(r.local)!.push(r)
  }
  return LOCAIS_ORDEM.filter((l) => m.has(l)).map((l) => ({ local: l, projetos: m.get(l)!, totais: somarResultados(m.get(l)!) }))
}

export function agruparPorEnsino(rs: ResultadoProjeto[]): { ensino: Ensino | null; totais: Totais }[] {
  const out: { ensino: Ensino | null; totais: Totais }[] = []
  for (const e of ['MEDIO', 'SUPERIOR', 'FUNDAMENTAL'] as Ensino[]) {
    const sub = rs.filter((r) => r.ensino === e)
    if (sub.length) out.push({ ensino: e, totais: somarResultados(sub) })
  }
  const sem = rs.filter((r) => r.ensino === null)
  if (sem.length) out.push({ ensino: null, totais: somarResultados(sem) })
  return out
}
