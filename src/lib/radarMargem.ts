// Radar de margem — motor PURO (sem React, sem rede). Entra `projetos` + posição do SGE; sai o semáforo e as ações por projeto.
// Base: calcularProjeto() do dashboard Metas de margem (mesmas regras de 04/11/2026) + prazo, exposição, estresse, SGE e ações.
// Paridade com o relatório gerado pelo script local (radar_margem/radar_lib.mjs, Radar de 10/11/2026).
import { calcularProjeto, type ItemBruto, type MetasPct, type ProjetoBruto, type SecaoBruta } from './economiaFechados'

export const REGRAS = {
  toleranciaAmarelo: 3, // p.p. abaixo da meta ainda é amarelo; mais que isso é vermelho
  vencidoAlertaPct: 5, // % do previsto no SGE em atraso que vira alerta
  exposicaoAlertaPct: 35, // % do custo ainda não fechado
  diasUrgente: 45, // eventos a menos de N dias com exposição alta
  receitaSemSgePct: 5, // P.O. conta receita acima do previsto no SGE em mais de N%
}

export type CorRadar = 'vermelho' | 'amarelo' | 'verde' | 'cinza'
export type NivelAcao = 'alta' | 'media' | 'baixa'

/** Linha da view `sge_receita_portal` (posição do SGE por projeto). */
export interface SgeLinha {
  projeto_id: string
  previsto?: number | string | null
  recebido?: number | string | null
  vencido?: number | string | null
  a_vencer?: number | string | null
  sge_atualizado_em?: string | null
}

type ItemRadar = ItemBruto & { valorPago?: number | null; _aba?: string }

export interface LinhaRadar {
  id: string
  turma: string
  local: string
  ensino: string | null
  dataEvento: string | null
  dias: number | null
  cor: CorRadar
  motivo: string
  receita: number | null
  custo: number | null
  margem: number | null
  margemPct: number | null
  projetada: number | null
  projPct: number | null
  pessimista: number | null
  pessPct: number | null
  meta: number | null
  gap: number | null
  gapRs: number | null
  aindaFalta: number
  liquida: number
  economias: number
  estouros: number
  exposicao: number
  expPct: number | null
  potencial: number
  contratado: number
  pago: number
  nFechados: number
  nAbertos: number
  sge: { previsto: number; recebido: number; aVencer: number; vencido: number; recebidoPct: number | null; vencidoPct: number | null; atualizadoEm: string | null } | null
  receitaAConquistar: number | null
  caixa: number | null
  alertas: string[]
  acoes: { nivel: NivelAcao; texto: string }[]
  sincronizadoEm: string | null
  topEstimados: { item: string; aba: string; orcado: number }[]
  topEstouros: { item: string; aba: string; valor: number }[]
  topEconomias: { item: string; aba: string; valor: number }[]
}

const n0 = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}
const r2 = (v: unknown): number => Math.round(n0(v) * 100) / 100

const agrupadora = (it: ItemBruto, todos: ItemBruto[]): boolean => {
  const c = (it.codigo ?? '').trim()
  if (!c) return false
  return todos.some((o) => o !== it && (o.codigo ?? '').startsWith(c + '.'))
}

/** Itens que entram nas contas (mesmo critério do app): sem N/A, sem linha-mãe, com subcategoria. */
export function itensDeCalculo(secoes: SecaoBruta[] | null | undefined): ItemRadar[] {
  const out: ItemRadar[] = []
  for (const sc of secoes ?? []) {
    const todos = sc.itens ?? []
    for (const it of todos) {
      if (it.status !== 'N/A' && !agrupadora(it, todos) && (it.subcategoria ?? '').trim() !== '') {
        out.push({ ...(it as ItemRadar), _aba: `${sc.numero ?? ''} ${sc.nome ?? ''}`.trim() })
      }
    }
  }
  return out
}

/** Taxa de estouro da carteira = Σ estouros ÷ Σ orçado dos itens fechados (base do cenário pessimista). */
export function taxaEstouro(resultados: { estouros: number; orcadoFechados: number }[]): number {
  const e = resultados.reduce((s, r) => s + n0(r.estouros), 0)
  const o = resultados.reduce((s, r) => s + n0(r.orcadoFechados), 0)
  return o > 0 ? e / o : 0
}

const brl = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const top = <T,>(arr: T[], k: (x: T) => number, n: number): T[] => [...arr].sort((a, b) => k(b) - k(a)).slice(0, n)

export function montarRadar(p: ProjetoBruto, sge: SgeLinha | null, taxa: number, metas?: MetasPct, hoje: Date = new Date()): LinhaRadar {
  const r = metas ? calcularProjeto(p, metas) : calcularProjeto(p)
  const itens = itensDeCalculo(p.secoes)
  const fechados = itens.filter((i) => i.status === 'fechado')
  const abertos = itens.filter((i) => i.status !== 'fechado')
  const exposicao = r2(abertos.reduce((s, i) => s + n0(i.valorOrcado), 0))
  const pago = r2(itens.reduce((s, i) => s + n0(i.valorPago), 0))
  const contratado = r2(fechados.reduce((s, i) => s + n0(i.valorContratado), 0))
  const semOrcamento = fechados.filter((i) => n0(i.valorOrcado) === 0 && n0(i.valorContratado) > 0)
  const semOrcValor = r2(semOrcamento.reduce((s, i) => s + n0(i.valorContratado), 0))
  const dRaw = p.tap?.dataEvento ? Math.round((new Date(p.tap.dataEvento).getTime() - hoje.getTime()) / 864e5) : null
  const dias = dRaw !== null && Number.isFinite(dRaw) ? dRaw : null
  const receita = r.receita
  const custo = r.custo
  const temBase = receita != null && receita > 0 && custo != null
  const margem = temBase ? r2((receita as number) - (custo as number)) : null
  const projetada = temBase && margem !== null ? r2(margem + n0(r.liquida)) : null
  const pct = (v: number | null): number | null => (temBase && v != null ? (v / (receita as number)) * 100 : null)
  const margemPct = pct(margem)
  const projPct = pct(projetada)
  const pessimista = temBase && projetada !== null ? r2(projetada - exposicao * taxa) : null
  const pessPct = pct(pessimista)
  const meta = r.metaPct
  const gap = projPct != null && meta != null ? projPct - meta : null
  const gapRs = projetada != null && r.margemNaMeta != null ? r2(projetada - r.margemNaMeta) : null

  // ── SGE
  const sgeOk = !!sge
  const sgePrev = sgeOk ? n0(sge.previsto) : null
  const sgeRec = sgeOk ? n0(sge.recebido) : null
  const sgeVenc = sgeOk ? n0(sge.vencido) : null
  const sgeAv = sgeOk ? n0(sge.a_vencer) : null
  const recebidoPct = sgeOk && (sgePrev as number) > 0 ? ((sgeRec as number) / (sgePrev as number)) * 100 : null
  const vencidoPct = sgeOk && (sgePrev as number) > 0 ? ((sgeVenc as number) / (sgePrev as number)) * 100 : null
  const receitaAConquistar = sgeOk && temBase ? r2(Math.max(0, (receita as number) - (sgePrev as number))) : null
  const caixa = sgeOk ? r2((sgeRec as number) - pago) : null

  // ── semáforo
  let cor: CorRadar = 'cinza'
  let motivo = 'Sem receita/custo orçados no Resumo Geral'
  if (temBase && gap != null) {
    if (gap >= 0) { cor = 'verde'; motivo = 'Margem projetada na meta ou acima' }
    else if (gap >= -REGRAS.toleranciaAmarelo) { cor = 'amarelo'; motivo = `Margem projetada ${(-gap).toFixed(1)} p.p. abaixo da meta` }
    else { cor = 'vermelho'; motivo = `Margem projetada ${(-gap).toFixed(1)} p.p. abaixo da meta` }
    if (cor === 'verde' && pessPct != null && meta != null && pessPct < meta - REGRAS.toleranciaAmarelo) {
      cor = 'amarelo'
      motivo = 'Na meta, mas frágil: se o que falta fechar estourar como a média da carteira, cai abaixo da meta'
    }
  }

  // ── alertas e ações (regras explícitas)
  const alertas: string[] = []
  const acoes: { nivel: NivelAcao; texto: string }[] = []
  if (!temBase) alertas.push('Sem receita/custo orçados lidos do Resumo Geral — conferir a P.O.')
  if (r.avisos?.includes('fonte-itens')) alertas.push('Margem calculada pela soma dos itens (Resumo Geral não lido)')
  if (temBase && r.aindaFalta > 0) {
    const est = top(r.estimados ?? [], (x) => x.orcado, 3)
    acoes.push({ nivel: 'alta', texto: `Faltam ${brl(r.aindaFalta)} para a meta de ${meta}% (já descontada a economia dos fechados). Principal alavanca: ${brl(r.estimadosOrcado)} em itens ainda "estimado"${est.length ? ' — maiores: ' + est.map((x) => `${x.item} (${brl(x.orcado)})`).join('; ') : ''}. Fechar abaixo do orçado ou renegociar.` })
  }
  const estouros = top((r.detalhe ?? []).filter((d) => d.difAjustada < -1), (d) => -d.difAjustada, 3)
  if (estouros.length) acoes.push({ nivel: 'media', texto: `Maiores estouros já fechados: ${estouros.map((d) => `${d.item} (${brl(-d.difAjustada)} acima do orçado)`).join('; ')}. Ver se cabe compensar com outro item do mesmo bloco ou repassar.` })
  if (semOrcamento.length) {
    alertas.push(`${semOrcamento.length} item(ns) contratado(s) sem orçamento (${brl(semOrcValor)})`)
    acoes.push({ nivel: 'media', texto: `${semOrcamento.length} item(ns) contratado(s) sem orçado preenchido (${brl(semOrcValor)}): ${top(semOrcamento, (i) => n0(i.valorContratado), 3).map((i) => i.item || i.subcategoria).join('; ')}. Preencher o orçado para o estouro/economia ficar real.` })
  }
  const expPct = temBase && (custo as number) > 0 ? (exposicao / (custo as number)) * 100 : null
  if (expPct != null && expPct >= REGRAS.exposicaoAlertaPct && dias != null && dias <= REGRAS.diasUrgente) acoes.push({ nivel: 'alta', texto: `${brl(exposicao)} (${expPct.toFixed(0)}% do custo) ainda sem fechar, e o evento é em ${dias} dias. Priorizar fechamento: preço sobe perto da data.` })
  if (vencidoPct != null && vencidoPct >= REGRAS.vencidoAlertaPct) acoes.push({ nivel: 'media', texto: `${brl(sgeVenc as number)} em atraso no SGE (${vencidoPct.toFixed(1)}% do previsto). Acionar cobrança antes de comprometer mais caixa.` })
  if (receitaAConquistar != null && receitaAConquistar > 0 && (receitaAConquistar / (receita as number)) * 100 >= REGRAS.receitaSemSgePct) acoes.push({ nivel: 'media', texto: `A P.O. conta ${brl(receita as number)} de receita, mas o SGE só prevê ${brl(sgePrev as number)}. Faltam ${brl(receitaAConquistar)} para vir de convites/mesas extras, verbas ou ajuste da P.O.` })
  if (caixa != null && caixa < 0) acoes.push({ nivel: 'alta', texto: `Caixa do projeto negativo: recebido ${brl(sgeRec as number)} e pago ${brl(pago)}. Alliance está adiantando ${brl(-caixa)}.` })
  if (!acoes.length && cor === 'verde') acoes.push({ nivel: 'baixa', texto: 'Sem ação urgente. Manter acompanhamento do que ainda falta fechar.' })

  return {
    id: p.id, turma: r.turma, local: r.local, ensino: r.ensino, dataEvento: p.tap?.dataEvento || null, dias, cor, motivo,
    receita, custo, margem, margemPct, projetada, projPct, pessimista, pessPct, meta, gap, gapRs,
    aindaFalta: r.aindaFalta, liquida: r.liquida, economias: r.economias, estouros: r.estouros,
    exposicao, expPct, potencial: r.estimadosOrcado, contratado, pago, nFechados: fechados.length, nAbertos: abertos.length,
    sge: sgeOk ? { previsto: sgePrev as number, recebido: sgeRec as number, aVencer: sgeAv as number, vencido: sgeVenc as number, recebidoPct, vencidoPct, atualizadoEm: sge.sge_atualizado_em ?? null } : null,
    receitaAConquistar, caixa, alertas, acoes, sincronizadoEm: p.atualizado_em ?? null,
    topEstimados: (r.estimados ?? []).slice(0, 5),
    topEstouros: estouros.map((d) => ({ item: d.item, aba: d.aba, valor: -d.difAjustada })),
    topEconomias: top((r.detalhe ?? []).filter((d) => d.difAjustada > 1), (d) => d.difAjustada, 5).map((d) => ({ item: d.item, aba: d.aba, valor: d.difAjustada })),
  }
}

const ORDEM_COR: Record<CorRadar, number> = { vermelho: 0, amarelo: 1, cinza: 2, verde: 3 }

/** Carteira inteira: a taxa de estouro é da carteira recebida (os projetos filtrados), ordenada do pior para o melhor. */
export function montarCarteira(projetos: ProjetoBruto[], sgeLista: SgeLinha[], metas?: MetasPct, hoje: Date = new Date()): { taxa: number; linhas: LinhaRadar[] } {
  const base = projetos.map((p) => (metas ? calcularProjeto(p, metas) : calcularProjeto(p)))
  const taxa = taxaEstouro(base)
  const linhas = projetos.map((p) => montarRadar(p, sgeLista.find((x) => x.projeto_id === p.id) ?? null, taxa, metas, hoje))
  linhas.sort((a, b) => ORDEM_COR[a.cor] - ORDEM_COR[b.cor] || n0(b.aindaFalta) - n0(a.aindaFalta))
  return { taxa, linhas }
}
