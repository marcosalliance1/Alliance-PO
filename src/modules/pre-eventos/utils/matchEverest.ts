import type { EventType, Orcamento, ItemOrcamento } from '../types'
import { newItemId } from './formatters'
import { recalcularItem } from './automacoes'

// ─── Mapa: tipo de evento (sistema) → conta gerencial (Everest) ────────────────
// Confirmado com Marcos + consulta ao Everest em 2026-08-06. Dentro de um centro
// de custo (turma), cada evento é UMA conta gerencial — é ela que isola os títulos
// daquele evento dos demais. FESTA_INTEGRACAO é legado descontinuado (os antigos
// eram lançados como Festa Start ou Festa 1/6), por isso não tem conta própria.
export const CONTA_GERENCIAL_POR_TIPO: Record<EventType, string | null> = {
  FESTA_INTEGRACAO:       null, // legado — sem conta gerencial no Everest
  TROTE_ALLIANCE:         'TROTE ALLIANCE',
  FESTA_START:            'FESTA START',
  FESTA_1_6:              'FESTA 1/6',
  FESTA_FIM_CICLO_BASICO: 'FESTA FIM DO CICLO BASICO',
  FESTA_MEIO_CURSO:       'FESTA MEIO DO CURSO',
  VIAGEM_MEIO_CURSO:      'VIAGEM MEIO CURSO',
  FESTA_PRE_INTERNATO:    'FESTA PRE INTERNATO',
  FESTA_X_DIAS:           'FESTA X DIAS',
}

const SEP = '||'

// ─── Normalização ──────────────────────────────────────────────────────────────

export function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
    .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c') // tira acento
    .replace(/[.\s]+/g, ' ')
    .trim()
}

// Igual à do P.O. principal (parseFinanceiro.ts): cada token do termo precisa
// aparecer no centro de custo. Tolera o ano que o Everest anexa
// ("UNIFENAS 42" casa "UNIFENAS 42 2029").
export function matchCentroCusto(centroCusto: string | null | undefined, termo: string): boolean {
  const c = norm(centroCusto).replace(/[^a-z0-9]+/g, ' ').trim()
  const termos = norm(termo).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  if (termos.length === 0 || !c) return false
  return termos.every(t => c.includes(t))
}

// Sufixos societários/genéricos que só atrapalham o match de fornecedor.
const SUFIXOS = /\b(ltda|me|epp|eireli|sa|s a|produtora|producoes|eventos|servicos|iluminao|cenica)\b/g

export function normFornecedor(s: string): string {
  return norm(s).replace(SUFIXOS, ' ').replace(/\s+/g, ' ').trim()
}

// Fuzzy: verdadeiro quando um nome contém o outro após normalização. Cobre os
// casos reais vistos na UNIFENAS 42 ("Black Sheep" ⊂ "BLACK SHEEP PRODUTORA",
// "I9 Med Ambula" ⊂ "I9 MED AMBULANCIAS"). Nomes com <3 chars nunca casam por
// inclusão (evita falso positivo em apelidos muito curtos).
export function fornecedorBate(a: string, b: string): boolean {
  const na = normFornecedor(a), nb = normFornecedor(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length < 3 || nb.length < 3) return false
  return na.includes(nb) || nb.includes(na)
}

// Quantas palavras significativas (≥3 letras, sem sufixos de razão social) dois
// nomes compartilham. Usado (com trava de valor) pra detectar o mesmo fornecedor
// escrito de forma diferente — ex.: "RENATO PENA - FENIX 360 CORPORATE" vs
// "FENIX 360 CORPORATE INTELLIGENCE LTDA" compartilham 3 (fenix, 360, corporate).
export function nucleoCompartilhado(a: string, b: string): number {
  const toks = (s: string) => normFornecedor(s).split(/\s+/).filter(t => t.length >= 3)
  const ta = new Set(toks(a))
  let n = 0
  for (const t of toks(b)) if (ta.has(t)) n++
  return n
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CapTitulo {
  fornecedor: string
  contaGerencial: string
  centroCusto: string
  valor: number
  vencimento: string | null
  situacao: string
}

export type MatchStatus = 'forte' | 'revisar' | 'sem-everest' | 'sem-fornecedor'

export interface ItemConciliado {
  id: string
  secaoLabel: string
  nome: string
  fornecedores: string[]
  totalOrcado: number
  totalPagoAtual: number
  totalEverest: number
  titulos: CapTitulo[]
  status: MatchStatus
}

export interface ResultadoConciliacao {
  itens: ItemConciliado[]
  orfaos: CapTitulo[]
  totalEverest: number
  totalOrfaos: number
  totalPagoAtual: number
}

export type SecaoKeyEverest = 'operacaoEstrutura' | 'equipe' | 'atracao' | 'abBebidas' | 'extras'

export const SECOES: { key: SecaoKeyEverest; label: string }[] = [
  { key: 'operacaoEstrutura', label: 'Operação / Estrutura' },
  { key: 'equipe',            label: 'Equipe' },
  { key: 'atracao',           label: 'Atração' },
  { key: 'abBebidas',         label: 'A&B / Bebidas' },
  { key: 'extras',            label: 'Extras' },
]

// ─── Conciliação (read-only, Fase 1) ──────────────────────────────────────────
// Casa cada item da P.O. com os títulos do Everest por fornecedor (fuzzy). Não
// escreve nada — só classifica pra visualização.
export function conciliar(orc: Orcamento, titulos: CapTitulo[]): ResultadoConciliacao {
  // Rastreia quantos itens reivindicaram cada título → detecta ambiguidade
  // (mesmo fornecedor em vários itens) e órfãos (título que ninguém reivindicou).
  const reivindicadoPor = new Map<CapTitulo, string[]>()

  const linhas = SECOES.flatMap(secao =>
    orc[secao.key].map(item => {
      const fornecedores = (item.fornecedor || '').split(SEP).map(s => s.trim()).filter(Boolean)
      const casados = fornecedores.length
        ? titulos.filter(t => fornecedores.some(f => fornecedorBate(f, t.fornecedor)))
        : []
      for (const t of casados) {
        const arr = reivindicadoPor.get(t) ?? []
        arr.push(item.id)
        reivindicadoPor.set(t, arr)
      }
      return { item, secaoLabel: secao.label, fornecedores, casados }
    }),
  )

  const itens: ItemConciliado[] = linhas.map(({ item, secaoLabel, fornecedores, casados }) => {
    const totalEverest = casados.reduce((s, t) => s + t.valor, 0)
    // Confiança do match = unicidade do fornecedor, NÃO igualdade de valor.
    // Orçado ≠ pago é o normal (a diferença é o BV/margem) — divergência de valor
    // é informação a exibir, não motivo pra rebaixar um match inequívoco.
    let status: MatchStatus
    if (fornecedores.length === 0) status = 'sem-fornecedor'
    else if (casados.length === 0) status = 'sem-everest'
    else {
      const compartilhado = casados.some(t => (reivindicadoPor.get(t)?.length ?? 0) > 1)
      status = compartilhado ? 'revisar' : 'forte'
    }
    return {
      id: item.id,
      secaoLabel,
      nome: item.item || '(sem nome)',
      fornecedores,
      totalOrcado: item.totalOrcado,
      totalPagoAtual: item.totalPagoReal,
      totalEverest,
      titulos: casados,
      status,
    }
  })

  const orfaos = titulos.filter(t => !reivindicadoPor.has(t))

  return {
    itens,
    orfaos,
    totalEverest: titulos.reduce((s, t) => s + t.valor, 0),
    totalOrfaos: orfaos.reduce((s, t) => s + t.valor, 0),
    totalPagoAtual: itens.reduce((s, i) => s + i.totalPagoAtual, 0),
  }
}

// ─── Associação (Fase 2) ──────────────────────────────────────────────────────
// Agrupa os títulos do Everest por fornecedor; cada fornecedor vira uma linha que
// o usuário associa a um item da P.O. (estilo "importar do Drive").

export interface FornecedorEverest {
  fornecedor: string
  total: number
  titulos: CapTitulo[]
  ultimoVencimento: string | null
  situacao: 'PAGO' | 'CONTRATADO' // PAGO se todos os títulos liquidados
}

export function agruparPorFornecedor(titulos: CapTitulo[]): FornecedorEverest[] {
  const map = new Map<string, CapTitulo[]>()
  for (const t of titulos) {
    const k = t.fornecedor || '(sem fornecedor)'
    const arr = map.get(k) ?? []
    arr.push(t)
    map.set(k, arr)
  }
  return [...map.entries()]
    .map(([fornecedor, ts]) => {
      const vencs = ts.map(t => t.vencimento).filter((v): v is string => !!v).sort()
      const todosLiquidados = ts.every(t => t.situacao.toUpperCase() === 'LIQUIDADO')
      return {
        fornecedor,
        total: ts.reduce((s, t) => s + t.valor, 0),
        titulos: ts,
        ultimoVencimento: vencs.length ? vencs[vencs.length - 1] : null,
        situacao: (todosLiquidados ? 'PAGO' : 'CONTRATADO') as 'PAGO' | 'CONTRATADO',
      }
    })
    .sort((a, b) => b.total - a.total)
}

// Sugere o item da P.O. cujo fornecedor casa (fuzzy) com o fornecedor do Everest.
export function sugerirItemPara(fornecedor: string, orc: Orcamento): string | null {
  for (const secao of SECOES) {
    for (const item of orc[secao.key]) {
      const forns = (item.fornecedor || '').split(SEP).map(s => s.trim()).filter(Boolean)
      if (forns.some(f => fornecedorBate(f, fornecedor))) return item.id
    }
  }
  return null
}

export type DestinoEverest =
  | { tipo: 'ignorar' }
  | { tipo: 'item'; itemId: string }
  | { tipo: 'novo'; nome: string; secao: SecaoKeyEverest }
  | { tipo: 'dividir'; partes: { itemId: string; valor: number }[] } // 1 fornecedor → vários itens

// Divide um total entre itens, proporcional ao peso (ex: valor orçado de cada).
// Peso zero em todos → divide igual. O último item absorve o arredondamento pra
// a soma fechar exatamente o total.
export function dividirProporcional(
  total: number,
  itens: { itemId: string; peso: number }[],
): { itemId: string; valor: number }[] {
  if (itens.length === 0) return []
  const somaPesos = itens.reduce((s, i) => s + Math.max(0, i.peso), 0)
  const round2 = (n: number) => Math.round(n * 100) / 100
  let acumulado = 0
  return itens.map((it, idx) => {
    if (idx === itens.length - 1) return { itemId: it.itemId, valor: round2(total - acumulado) }
    const v = somaPesos > 0 ? round2(total * (Math.max(0, it.peso) / somaPesos)) : round2(total / itens.length)
    acumulado += v
    return { itemId: it.itemId, valor: v }
  })
}

// Aplica as associações no orçamento (não muta o original — retorna uma cópia).
// Vários fornecedores no mesmo item somam; o item recebe Total Pago = soma,
// Data = último vencimento, Status derivado, e o(s) fornecedor(es) mesclados.
export function aplicarAssociacoes(
  orc: Orcamento,
  grupos: FornecedorEverest[],
  destinos: Record<string, DestinoEverest>,
): Orcamento {
  let novo: Orcamento = { ...orc }

  // 1) Cria os itens "novo" primeiro, guardando o id gerado por fornecedor.
  const novoIdPorFornecedor = new Map<string, string>()
  for (const g of grupos) {
    const d = destinos[g.fornecedor]
    if (d?.tipo === 'novo') {
      const id = newItemId()
      const novoItem: ItemOrcamento = {
        id, item: d.nome, fornecedor: '', qtde: 1, custoUnitario: 0,
        totalOrcado: 0, totalPagoReal: 0, valorPassadoCliente: 0,
        bvAbsoluto: 0, bvPercentual: 0, status: 'PENDENTE',
        dataPagamento: null, notas: '', automatico: false, fixo: false,
      }
      novo = { ...novo, [d.secao]: [...novo[d.secao], novoItem] }
      novoIdPorFornecedor.set(g.fornecedor, id)
    }
  }

  // 2) Acumula contribuições por item (item/novo = valor total; dividir = por parte).
  interface Acc { soma: number; forns: string[]; vencs: string[]; liquidado: boolean }
  const acc = new Map<string, Acc>()
  const contribuir = (itemId: string, valor: number, fornecedor: string, venc: string | null, liquidado: boolean) => {
    if (!itemId) return
    const a = acc.get(itemId) ?? { soma: 0, forns: [], vencs: [], liquidado: true }
    a.soma += valor
    if (!a.forns.includes(fornecedor)) a.forns.push(fornecedor)
    if (venc) a.vencs.push(venc)
    a.liquidado = a.liquidado && liquidado
    acc.set(itemId, a)
  }
  for (const g of grupos) {
    const d = destinos[g.fornecedor]
    if (!d || d.tipo === 'ignorar') continue
    const liquidado = g.situacao === 'PAGO'
    if (d.tipo === 'item') contribuir(d.itemId, g.total, g.fornecedor, g.ultimoVencimento, liquidado)
    else if (d.tipo === 'novo') contribuir(novoIdPorFornecedor.get(g.fornecedor) ?? '', g.total, g.fornecedor, g.ultimoVencimento, liquidado)
    else if (d.tipo === 'dividir') {
      for (const parte of d.partes) {
        if (parte.itemId && parte.valor) contribuir(parte.itemId, parte.valor, g.fornecedor, g.ultimoVencimento, liquidado)
      }
    }
  }

  // 3) Escreve nos itens.
  const aplicarNaSecao = (itens: ItemOrcamento[]) =>
    itens.map(item => {
      const a = acc.get(item.id)
      if (!a) return item
      const fornExistentes = (item.fornecedor || '').split(SEP).map(s => s.trim()).filter(Boolean)
      const fornMerge = [...new Set([...fornExistentes, ...a.forns])].join(SEP)
      const ultimoVenc = a.vencs.length ? a.vencs.sort()[a.vencs.length - 1] : item.dataPagamento ?? null
      return recalcularItem({
        ...item,
        fornecedor: fornMerge,
        totalPagoReal: a.soma,
        dataPagamento: ultimoVenc,
        status: a.liquidado ? 'PAGO' : 'CONTRATADO',
      })
    })

  for (const secao of SECOES) {
    novo = { ...novo, [secao.key]: aplicarNaSecao(novo[secao.key]) }
  }
  return novo
}
