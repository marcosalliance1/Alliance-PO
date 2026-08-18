// Estimativa de orçamento por histórico. Read-only: lê os orçamentos passados e
// devolve, por item, um valor estimado + fornecedor sugerido. Não altera nada.
import type { Orcamento, ItemOrcamento, EventType } from '../types'
import { getEventCategory, ITENS_OPERACAO_ESTRUTURA, ITENS_EQUIPE_FIXOS, ITENS_AB, ITENS_EXTRAS } from '../data/defaults'
import { newItemId } from './formatters'
import { recalcularItem } from './automacoes'
import { SECOES, type SecaoKeyEverest } from './matchEverest'

// Itens que sempre aparecem em cada seção (o esqueleto do template), pra o
// gerado do histórico nascer com as mesmas linhas padrão do "em branco".
const ITENS_PADRAO: Record<SecaoKeyEverest, string[]> = {
  operacaoEstrutura: ITENS_OPERACAO_ESTRUTURA,
  equipe: ITENS_EQUIPE_FIXOS,
  atracao: [],
  abBebidas: ITENS_AB,
  extras: ITENS_EXTRAS,
}

export interface ItemEstimado {
  item: string
  custoUnitario: number
  qtde: number
  fornecedor: string
  amostras: number      // em quantos orçamentos base esse item apareceu com valor
  frequencia: number    // fração dos orçamentos base que tinham esse item (0..1)
  perCapita: boolean     // qtde escala com o nº de convidados
}

export type NivelFiltro = 'tipo' | 'categoria' | 'geral' | 'vazio'

export interface EstimativaOrcamento {
  nivelFiltro: NivelFiltro // 'tipo' = só do tipo exato; fallback avisa que ampliou
  orcamentosBase: number
  secoes: Record<SecaoKeyEverest, ItemEstimado[]>
}

const norm = (s: string) => (s || '').trim().toLowerCase()
// Nome canônico: junta variações tipo "Palco / Som / Luz" e "Palco/Som/Luz".
const canonico = (s: string) => norm(s).replace(/\s*([/\-|])\s*/g, '$1').replace(/\s+/g, ' ')

function maisFrequente(valores: string[]): string {
  const cont = new Map<string, number>()
  for (const v of valores) if (v) cont.set(v, (cont.get(v) || 0) + 1)
  let melhor = '', max = 0
  for (const [k, n] of cont) if (n > max) { max = n; melhor = k }
  return melhor
}

// Mediana — robusta a outliers (ex: um evento que lançou o item numa unidade
// diferente, tipo "1 chopp de R$1537" vs "150 litros de R$12").
function mediana(nums: number[]): number {
  if (nums.length === 0) return 0
  const ord = [...nums].sort((a, b) => a - b)
  const meio = Math.floor(ord.length / 2)
  return ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2
}

const SEP = '||'

// Seleciona a base: 1º só o tipo exato (respeita o pré-evento selecionado);
// se não houver nenhum, cai pra categoria (mesmo porte); por fim, a base toda.
function selecionarBase(orcamentos: Orcamento[], tipo: EventType, convidados: number): { base: Orcamento[]; nivel: NivelFiltro } {
  const doTipo = orcamentos.filter(o => o.tipo === tipo)
  if (doTipo.length > 0) return { base: doTipo, nivel: 'tipo' }
  const categoria = getEventCategory(tipo, convidados)
  const daCategoria = categoria ? orcamentos.filter(o => getEventCategory(o.tipo, o.quantidadeConvidados) === categoria) : []
  if (daCategoria.length > 0) return { base: daCategoria, nivel: 'categoria' }
  if (orcamentos.length > 0) return { base: orcamentos, nivel: 'geral' }
  return { base: [], nivel: 'vazio' }
}

// Sugere o nº de convidados pela mediana histórica — 1º da mesma instituição
// (mesmo tipo), senão de todos do tipo. Cada tipo tem porte bem diferente.
export function sugerirConvidados(
  orcamentos: Orcamento[],
  tipo: EventType,
  instituicao?: string,
): { convidados: number; amostras: number; escopo: 'instituicao' | 'tipo' | 'nenhum' } {
  const inst = norm(instituicao || '')
  if (inst) {
    const daInst = orcamentos.filter(o => o.tipo === tipo && norm(o.instituicao).includes(inst) && o.quantidadeConvidados > 0)
    if (daInst.length) return { convidados: Math.round(mediana(daInst.map(o => o.quantidadeConvidados))), amostras: daInst.length, escopo: 'instituicao' }
  }
  const doTipo = orcamentos.filter(o => o.tipo === tipo && o.quantidadeConvidados > 0)
  if (doTipo.length) return { convidados: Math.round(mediana(doTipo.map(o => o.quantidadeConvidados))), amostras: doTipo.length, escopo: 'tipo' }
  return { convidados: 0, amostras: 0, escopo: 'nenhum' }
}

export function estimarPorHistorico(
  orcamentos: Orcamento[],
  tipo: EventType,
  convidados: number,
): EstimativaOrcamento {
  const { base, nivel } = selecionarBase(orcamentos, tipo, convidados)
  const convidadosMedioBase = base.length
    ? base.reduce((s, o) => s + (o.quantidadeConvidados || 0), 0) / base.length
    : 0

  const secoes = {} as Record<SecaoKeyEverest, ItemEstimado[]>

  for (const s of SECOES) {
    const porNome = new Map<string, { custos: number[]; qtdes: number[]; forns: string[]; nomeOriginais: string[]; orcsComItem: Set<number> }>()
    base.forEach((orc, idx) => {
      for (const it of orc[s.key]) {
        const chave = canonico(it.item)
        if (!chave) continue
        const g = porNome.get(chave) ?? { custos: [], qtdes: [], forns: [], nomeOriginais: [], orcsComItem: new Set<number>() }
        const qtde = it.qtde > 0 ? it.qtde : 1
        const totalEfetivo = it.totalPagoReal > 0 ? it.totalPagoReal : it.totalOrcado
        const unit = totalEfetivo > 0 ? totalEfetivo / qtde : (it.custoUnitario || 0)
        if (unit > 0) { g.custos.push(unit); g.qtdes.push(qtde); g.orcsComItem.add(idx) }
        g.nomeOriginais.push(it.item)
        for (const f of (it.fornecedor || '').split(SEP).map(x => x.trim()).filter(Boolean)) g.forns.push(f)
        porNome.set(chave, g)
      }
    })

    const itens: ItemEstimado[] = []
    for (const [, g] of porNome) {
      if (g.custos.length === 0) continue // item sem nenhum valor no histórico — ignora
      // Mediana em vez de média: ignora outliers de unidade/lançamento.
      const custoMediano = mediana(g.custos)
      const qtdeMediana = mediana(g.qtdes)
      // Per capita: item "por pessoa" (buffet, bar...) — detectado quando a qtde
      // histórica acompanha o nº de convidados (ratio >= 0.4). Aí a qtde é o
      // próprio nº de convidados do orçamento (1 por pessoa), não uma média.
      const ratio = convidadosMedioBase > 0 ? qtdeMediana / convidadosMedioBase : 0
      const perCapita = ratio >= 0.4
      const qtde = perCapita ? Math.max(1, convidados) : Math.max(1, Math.round(qtdeMediana))
      itens.push({
        item: maisFrequente(g.nomeOriginais),
        custoUnitario: Math.round(custoMediano * 100) / 100,
        qtde,
        fornecedor: maisFrequente(g.forns),
        amostras: g.custos.length,
        frequencia: base.length ? g.orcsComItem.size / base.length : 0,
        perCapita,
      })
    }
    // Ordena por valor total desc (mais relevante primeiro)
    itens.sort((a, b) => b.custoUnitario * b.qtde - a.custoUnitario * a.qtde)
    secoes[s.key] = itens
  }

  return { nivelFiltro: nivel, orcamentosBase: base.length, secoes }
}

// ─── Geração do orçamento pré-preenchido ──────────────────────────────────────
// Item "core" (aparece em >= metade dos orçamentos base) entra no orçamento;
// item raro (de 1 evento específico) vira sugestão opcional pra a atendente
// adicionar se quiser. Tudo é editável depois — é só ponto de partida.
const THRESHOLD_CORE = 0.5

export interface OrcamentoGerado {
  itensPorSecao: Record<SecaoKeyEverest, ItemOrcamento[]>   // core, já como itens de orçamento
  sugestoesPorSecao: Record<SecaoKeyEverest, ItemEstimado[]> // raros, opcionais
  nivelFiltro: NivelFiltro
  orcamentosBase: number
}

function itemBase(nome: string, custoUnitario: number, qtde: number): ItemOrcamento {
  return recalcularItem({
    id: newItemId(),
    item: nome,
    fornecedor: '', // só valores — fornecedor é escolha da turma, não vem do histórico
    qtde,
    custoUnitario,
    totalOrcado: 0, totalPagoReal: 0, valorPassadoCliente: 0,
    bvAbsoluto: 0, bvPercentual: 0, status: 'PENDENTE',
    dataPagamento: null, notas: '', automatico: true, fixo: false,
  })
}

// Converte uma sugestão (item raro) num item de orçamento pronto pra adicionar.
export function criarItemDeSugestao(e: ItemEstimado): ItemOrcamento {
  return itemBase(e.item, e.custoUnitario, e.qtde)
}

export function gerarItensDoHistorico(
  orcamentos: Orcamento[],
  tipo: EventType,
  convidados: number,
): OrcamentoGerado {
  const est = estimarPorHistorico(orcamentos, tipo, convidados)
  const itensPorSecao = {} as Record<SecaoKeyEverest, ItemOrcamento[]>
  const sugestoesPorSecao = {} as Record<SecaoKeyEverest, ItemEstimado[]>

  for (const s of SECOES) {
    const estPorNome = new Map(est.secoes[s.key].map(e => [canonico(e.item), e]))
    const usados = new Set<string>()
    const itens: ItemOrcamento[] = []
    const sugestoes: ItemEstimado[] = []

    // 1. Esqueleto do template — as linhas padrão SEMPRE aparecem, com o valor
    //    do histórico quando existe, senão em branco (zeradas).
    for (const nome of ITENS_PADRAO[s.key]) {
      const chave = canonico(nome)
      if (!chave) continue
      usados.add(chave)
      const e = estPorNome.get(chave)
      if (e && e.frequencia >= THRESHOLD_CORE) itens.push(itemBase(nome, e.custoUnitario, e.qtde))
      else itens.push(itemBase(nome, 0, 1))
    }

    // 2. Itens do histórico fora do template: core entram, raros viram sugestão.
    for (const e of est.secoes[s.key]) {
      const chave = canonico(e.item)
      if (usados.has(chave)) continue
      usados.add(chave)
      if (e.frequencia >= THRESHOLD_CORE) itens.push(itemBase(e.item, e.custoUnitario, e.qtde))
      else sugestoes.push(e)
    }

    itensPorSecao[s.key] = itens
    sugestoesPorSecao[s.key] = sugestoes
  }

  return { itensPorSecao, sugestoesPorSecao, nivelFiltro: est.nivelFiltro, orcamentosBase: est.orcamentosBase }
}
