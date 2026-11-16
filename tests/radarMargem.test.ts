// Rodar: node --import ./tests/ts-resolver.mjs --test tests/*.test.ts   (Node >= 22.6, TypeScript nativo)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarCarteira, montarRadar, taxaEstouro, REGRAS, type SgeLinha } from '../src/lib/radarMargem.ts'
import type { ProjetoBruto, ItemBruto } from '../src/lib/economiaFechados.ts'

const HOJE = new Date('2026-11-16T12:00:00Z')
const item = (o: Partial<ItemBruto> & { valorPago?: number }): ItemBruto => ({ subcategoria: 'Geral', status: 'fechado', ...o })
const proj = (o: Partial<ProjetoBruto> = {}): ProjetoBruto => ({
  id: 'p1',
  tap: { turma: 'TESTE 2026', local: 'Mix Garden', tipoEscola: 'MEDIO', anoRealizacao: 2026, dataEvento: '2026-12-01' },
  resumo_geral_orcado: { receita: 1_000_000, custo: 700_000 }, // margem 30% (meta Médio 25%)
  secoes: [{ numero: '2.1', nome: 'Custo Produção', itens: [
    item({ id: 'a', item: 'A', valorOrcado: 100, valorContratado: 60, valorPago: 60 } as ItemBruto), // economia 40
    item({ id: 'b', item: 'B', status: 'estimado', valorOrcado: 300_000, valorContratado: 0 }), // aberto (exposição)
  ] }],
  ...o,
})

test('caminho feliz: margem acima da meta e pessimista ainda na meta → verde, sem ação urgente', () => {
  const longe = proj({ tap: { turma: 'TESTE 2026', local: 'Mix Garden', tipoEscola: 'MEDIO', anoRealizacao: 2026, dataEvento: '2027-03-01' } })
  const l = montarRadar(longe, null, 0, undefined, HOJE)
  assert.equal(l.cor, 'verde')
  assert.equal(l.margem, 300_000)
  assert.equal(l.projetada, 300_040) // margem + economia líquida (40)
  assert.equal(l.exposicao, 300_000)
  assert.equal(l.contratado, 60)
  assert.equal(l.pago, 60)
  assert.equal(l.dias, 105)
  assert.equal(l.sge, null)
  assert.equal(l.caixa, null)
  assert.equal(l.acoes.length, 1)
  assert.equal(l.acoes[0].nivel, 'baixa')
})

test('evento próximo com muito custo ainda em aberto gera ação de prioridade alta', () => {
  const l = montarRadar(proj(), null, 0, undefined, HOJE) // evento em 15 dias; 300 mil em aberto = 43% do custo
  assert.equal(l.dias, 15)
  assert.ok(l.expPct! >= REGRAS.exposicaoAlertaPct)
  assert.ok(l.acoes.some((a) => a.nivel === 'alta' && /Priorizar fechamento/.test(a.texto)))
})

test('semáforo: amarelo dentro da tolerância, vermelho além dela, verde frágil vira amarelo no cenário pessimista', () => {
  // receita 1.000.000, meta 25%: custo 760.000 → margem 24% (1 p.p. abaixo) = amarelo; custo 800.000 → 20% = vermelho
  assert.equal(montarRadar(proj({ resumo_geral_orcado: { receita: 1_000_000, custo: 760_000 }, secoes: [] }), null, 0, undefined, HOJE).cor, 'amarelo')
  assert.equal(montarRadar(proj({ resumo_geral_orcado: { receita: 1_000_000, custo: 800_000 }, secoes: [] }), null, 0, undefined, HOJE).cor, 'vermelho')
  // verde (26%) mas com 300 mil em aberto e taxa de estouro de 10% → pessimista 26% − 3% = 23% < 25% − 3% ? não: 23 ≥ 22 → segue verde; com taxa 20% → 20% < 22% → amarelo
  const verde = proj({ resumo_geral_orcado: { receita: 1_000_000, custo: 740_000 } })
  assert.equal(montarRadar(verde, null, 0.1, undefined, HOJE).cor, 'verde')
  const fragil = montarRadar(verde, null, 0.2, undefined, HOJE)
  assert.equal(fragil.cor, 'amarelo')
  assert.match(fragil.motivo, /frágil/)
})

test('SGE: atraso acima do limite, receita da P.O. acima do previsto e caixa negativo geram ações', () => {
  const sge: SgeLinha = { projeto_id: 'p1', previsto: '800000', recebido: '10', vencido: '100000', a_vencer: '0', sge_atualizado_em: '2026-11-16T10:00:00Z' }
  const l = montarRadar(proj(), sge, 0, undefined, HOJE)
  assert.equal(l.sge?.previsto, 800_000)
  assert.equal(l.sge?.vencidoPct, 12.5)
  assert.equal(l.receitaAConquistar, 200_000)
  assert.equal(l.caixa, -50) // recebido 10 − pago 60
  const textos = l.acoes.map((a) => a.texto).join(' | ')
  assert.match(textos, /em atraso no SGE/)
  assert.match(textos, /o SGE só prevê/)
  assert.match(textos, /Caixa do projeto negativo/)
  assert.ok(12.5 >= REGRAS.vencidoAlertaPct)
})

test('falha — projeto sem receita/custo no Resumo Geral e sem itens: cinza com alerta, sem quebrar', () => {
  const l = montarRadar({ id: 'x', tap: { turma: 'VAZIO', anoRealizacao: 2026 }, secoes: [], resumo_geral_orcado: null }, null, 0.05, undefined, HOJE)
  assert.equal(l.cor, 'cinza')
  assert.equal(l.projetada, null)
  assert.equal(l.pessimista, null)
  assert.equal(l.dias, null)
  assert.ok(l.alertas.some((a) => /Sem receita\/custo/.test(a)))
})

test('falha — valores nulos/texto em itens e SGE não viram NaN', () => {
  const sujo = proj({ secoes: [{ numero: '2.1', itens: [
    item({ id: 'a', item: 'A', valorOrcado: null, valorContratado: 'abc' as unknown as number }),
    item({ id: 'b', status: 'estimado', valorOrcado: undefined }),
  ] }] })
  const l = montarRadar(sujo, { projeto_id: 'p1', previsto: null, recebido: 'x', vencido: undefined }, 0, undefined, HOJE)
  for (const v of [l.exposicao, l.contratado, l.pago, l.liquida, l.aindaFalta]) assert.ok(Number.isFinite(v))
  assert.equal(l.sge?.recebidoPct, null) // previsto 0 → sem percentual
})

test('carteira: ordena vermelho → amarelo → verde e calcula a taxa de estouro só sobre os projetos recebidos', () => {
  const ruim = proj({ id: 'ruim', resumo_geral_orcado: { receita: 1_000_000, custo: 800_000 }, secoes: [] })
  const bom = proj({ id: 'bom' })
  const meio = proj({ id: 'meio', resumo_geral_orcado: { receita: 1_000_000, custo: 760_000 }, secoes: [] })
  const { linhas, taxa } = montarCarteira([bom, meio, ruim], [], undefined, HOJE)
  assert.deepEqual(linhas.map((x) => x.id), ['ruim', 'meio', 'bom'])
  assert.equal(taxa, 0) // nenhum estouro nos fechados
  assert.equal(taxaEstouro([{ estouros: 10, orcadoFechados: 100 }, { estouros: 0, orcadoFechados: 100 }]), 0.05)
  assert.equal(taxaEstouro([]), 0)
})
