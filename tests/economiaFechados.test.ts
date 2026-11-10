// Rodar: node --import ./tests/ts-resolver.mjs --test tests/*.test.ts   (Node >= 22.6, TypeScript nativo)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularProjeto, lerPercentual, somarResultados, agruparPorLocal, agruparPorEnsino, localDoProjeto, METAS_PADRAO,
  LOCAL_MIX, LOCAL_AVA, LOCAL_PAV3, LOCAL_ARENA, LOCAL_OUTROS,
  type ProjetoBruto, type ItemBruto,
} from '../src/lib/economiaFechados.ts'

const item = (o: Partial<ItemBruto>): ItemBruto => ({ subcategoria: 'Geral', status: 'fechado', ...o })
const base = (o: Partial<ProjetoBruto> = {}): ProjetoBruto => ({
  id: 'p1',
  tap: { turma: 'TESTE 2026', local: 'Mix Garden', tipoEscola: 'MEDIO', anoRealizacao: 2026 },
  resumo_geral_orcado: { receita: 1_000_000, custo: 900_000 },
  secoes: [{ numero: '2.1', nome: 'Custo Produção', itens: [
    item({ id: 'a', item: 'A', valorOrcado: 100, valorContratado: 60 }), // economia 40
    item({ id: 'b', item: 'B', valorOrcado: 50, valorContratado: 80 }), // estouro 30
    item({ id: 'c', item: 'C', valorOrcado: 20, valorContratado: 0 }), // fechado a zero (economia 20)
    item({ id: 'd', item: 'D', status: 'estimado', valorOrcado: 500, valorContratado: 0 }), // aberto
  ] }],
  ...o,
})

test('caminho feliz: margem, FALTA, economias, estouros, líquida, fechados a zero, cobertura', () => {
  const r = calcularProjeto(base())
  assert.equal(r.fonte, 'planilha')
  assert.equal(r.margem, 100_000)
  assert.equal(r.margemPct, 10)
  assert.equal(r.metaPct, 25)
  assert.equal(r.margemNaMeta, 250_000)
  assert.equal(r.falta, 150_000)
  assert.equal(r.excedente, 0)
  assert.equal(r.nFechados, 3)
  // C (20 a zero) é consumido pelo estouro de B (30) no mesmo bloco: economias 60−20, estouros 30−20, líquida igual
  assert.equal(r.economias, 40)
  assert.equal(r.estouros, 10)
  assert.equal(r.liquida, 30)
  assert.equal(r.fechadosZero, 0)
  assert.equal(r.verbaConsumida, 20)
  assert.equal(r.estimadosOrcado, 500)
  assert.equal(r.nEstimados, 1)
  assert.equal(r.cobertura, 30 / 150_000)
  assert.equal(r.aindaFalta, 150_000 - 30)
})

test('itens não fechados (estimado, orçar, orçando, N/A) não entram nas economias', () => {
  const r = calcularProjeto(base({ secoes: [{ numero: '2.1', itens: [
    item({ status: 'estimado', valorOrcado: 100, valorContratado: 0 }),
    item({ status: 'orçar', valorOrcado: 100 }),
    item({ status: 'orçando', valorOrcado: 100 }),
    item({ status: 'N/A', valorOrcado: 100 }),
  ] }] }))
  assert.equal(r.nFechados, 0)
  assert.equal(r.economias, 0)
  assert.equal(r.liquida, 0)
  assert.equal(r.estimadosOrcado, 100) // só o 'estimado' conta como potencial; orçar/orçando/N/A ficam de fora
})

test('falha 1 — projeto sem receita: não calcula FALTA e avisa', () => {
  const r = calcularProjeto(base({ resumo_geral_orcado: null, receitas: {}, secoes: [] }))
  assert.equal(r.fonte, 'sem-dado')
  assert.equal(r.receita, null)
  assert.equal(r.margemPct, null)
  assert.equal(r.falta, 0)
  assert.ok(r.avisos.includes('sem-receita'))
})

test('falha 1b — receita zero na planilha (ex.: CMMG 85) não gera FALTA nem divisão por zero', () => {
  const r = calcularProjeto(base({ resumo_geral_orcado: { receita: 0, custo: 61_788.36 } }))
  assert.equal(r.margemPct, null)
  assert.equal(r.falta, 0)
  assert.ok(r.avisos.includes('sem-receita'))
})

test('falha 2 — sem tipoEscola: sem meta, FALTA 0, aviso', () => {
  const r = calcularProjeto(base({ tap: { turma: 'X', local: 'Mix Garden' } }))
  assert.equal(r.ensino, null)
  assert.equal(r.metaPct, null)
  assert.equal(r.falta, 0)
  assert.ok(r.avisos.includes('sem-ensino'))
})

test('falha 3 — item fechado sem orçado: vira estouro, não NaN', () => {
  const r = calcularProjeto(base({ secoes: [{ numero: '2.1', itens: [item({ valorOrcado: null, valorContratado: 50 })] }] }))
  assert.equal(r.estouros, 50)
  assert.equal(r.economias, 0)
  assert.equal(r.fechadosZero, 0)
  assert.ok(Number.isFinite(r.liquida))
})

test('falha 4 — projeto sem fechados: zeros, cobertura 0% (há FALTA) e aviso', () => {
  const r = calcularProjeto(base({ secoes: [{ numero: '2.1', itens: [item({ status: 'estimado', valorOrcado: 10 })] }] }))
  assert.equal(r.liquida, 0)
  assert.equal(r.cobertura, 0)
  assert.equal(r.aindaFalta, r.falta)
  assert.ok(r.avisos.includes('sem-fechados'))
})

test('falha 5 — dados nulos em tudo: não quebra', () => {
  const r = calcularProjeto({ id: 'x', tap: null, secoes: null, receitas: null, custos_adicionais: null, resumo_geral_orcado: null })
  assert.equal(r.turma, '(sem nome)')
  assert.equal(r.falta, 0)
  assert.equal(r.nFechados, 0)
  const r2 = calcularProjeto({ id: 'y', secoes: [{ itens: null }, {}] })
  assert.equal(r2.nFechados, 0)
})

test('margem acima da meta: EXCEDENTE em vez de FALTA', () => {
  const r = calcularProjeto(base({ resumo_geral_orcado: { receita: 1_000_000, custo: 600_000 } })) // 40% > 25%
  assert.equal(r.falta, 0)
  assert.equal(r.excedente, 150_000)
  assert.equal(r.cobertura, null)
})

test('margem negativa: FALTA = meta + prejuízo', () => {
  const r = calcularProjeto(base({ resumo_geral_orcado: { receita: 100_000, custo: 120_000 } }))
  assert.equal(r.margem, -20_000)
  assert.equal(r.falta, 25_000 + 20_000)
})

test('linha agrupadora, N/A e subcategoria vazia ficam fora do cálculo', () => {
  const r = calcularProjeto(base({ resumo_geral_orcado: null, receitas: { r1: { orcado: 1000 } }, secoes: [{ numero: '2.1', itens: [
    item({ id: 'mae', codigo: '2.1.1', valorOrcado: 999, valorContratado: 0 }), // agrupadora (tem filho 2.1.1.1)
    item({ id: 'filho', codigo: '2.1.1.1', valorOrcado: 100, valorContratado: 90 }),
    item({ id: 'na', status: 'N/A', valorOrcado: 777 }),
    item({ id: 'vazia', subcategoria: '', valorOrcado: 555, valorContratado: 0 }),
  ] }] }))
  assert.equal(r.fonte, 'itens')
  assert.equal(r.custo, 100)
  assert.equal(r.nFechados, 1)
  assert.equal(r.economias, 10)
  assert.ok(r.avisos.includes('fonte-itens'))
})

test('potencial a economizar: soma o orçado dos itens estimados (maiores primeiro), ignora estimado sem orçado, N/A e agrupadora', () => {
  const r = calcularProjeto(base({ secoes: [{ numero: '2.4', nome: 'Custo Bar', itens: [
    item({ id: 'e1', item: 'Buffet', status: 'estimado', valorOrcado: 1000 }),
    item({ id: 'e2', item: 'Som', status: 'estimado', valorOrcado: 5000 }),
    item({ id: 'e3', item: 'Sem valor', status: 'estimado', valorOrcado: 0 }),
    item({ id: 'e4', item: 'Cancelado', status: 'N/A', valorOrcado: 777 }),
    item({ id: 'mae', codigo: '2.4.1', status: 'estimado', valorOrcado: 9999 }), // agrupadora (tem filha)
    item({ id: 'filha', codigo: '2.4.1.1', status: 'estimado', valorOrcado: 300 }),
    item({ id: 'f', item: 'Fechado', status: 'fechado', valorOrcado: 40, valorContratado: 30 }),
  ] }] }))
  assert.equal(r.nEstimados, 3)
  assert.equal(r.estimadosOrcado, 6300)
  assert.deepEqual(r.estimados.map((e) => e.item), ['Som', 'Buffet', 'Geral']) // a filha não tem nome: usa o nome do bloco
  assert.equal(r.economias, 10) // o potencial não vira economia
})

test('totais somam o potencial dos projetos', () => {
  const mk = (id: string, o: number) => calcularProjeto(base({ id, secoes: [{ numero: '2.1', itens: [item({ status: 'estimado', valorOrcado: o })] }] }))
  assert.equal(somarResultados([mk('a', 100), mk('b', 250)]).estimadosOrcado, 350)
})

test('falha — projeto sem itens estimados: potencial zero e lista vazia', () => {
  const r = calcularProjeto(base({ secoes: [{ numero: '2.1', itens: [item({ valorOrcado: 10, valorContratado: 10 })] }] }))
  assert.equal(r.estimadosOrcado, 0)
  assert.deepEqual(r.estimados, [])
})

const dec = (o: Partial<ItemBruto>): ItemBruto => item({ subcategoria: 'Decoração', ...o })
const proj = (itens: ItemBruto[]) => calcularProjeto(base({ secoes: [{ numero: '2.1', nome: 'Custo Produção', itens }] }))
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.005, `${a} ≠ ${b}`)

test('verba Geral destrinchada (Loyola 2026): o Geral só conta a sobra e os estouros das linhas somem; líquida igual', () => {
  const r = proj([
    dec({ id: 'g', item: 'Mobiliário - Geral', valorOrcado: 26000, valorContratado: 0 }),
    dec({ id: 'b', item: 'Mobiliario - Buffet', valorOrcado: 0, valorContratado: 6803.22 }),
    dec({ id: 'c', item: 'Mobiliario - Convidados', valorOrcado: 0, valorContratado: 12472.58 }),
    dec({ id: 'e', item: 'Mobiliario - Extras', valorOrcado: 0, valorContratado: 4535.48 }),
    dec({ id: 'bar', item: 'Mobiliario - Bar', valorOrcado: 4750, valorContratado: 4750 }),
  ])
  near(r.verbaConsumida, 23811.28)
  near(r.economias, 2188.72)
  near(r.estouros, 0)
  near(r.liquida, 2188.72) // = orçado do grupo (30.750) − contratado (28.561,28)
  near(r.fechadosZero, 2188.72)
  const geral = r.detalhe.find((d) => d.item === 'Mobiliário - Geral')!
  near(geral.consumido, 23811.28)
  near(geral.difAjustada, 2188.72)
  near(r.detalhe.find((d) => d.item === 'Mobiliario - Buffet')!.difAjustada, 0)
})

test('pacote fechado numa linha (MED PUC T18): o estouro do pacote consome os itens a zero, rateado', () => {
  const r = proj([
    dec({ id: 'p', item: 'Cenografia Geral', valorOrcado: 60000, valorContratado: 140000 }), // estouro 80.000
    dec({ id: 'a', item: 'Floral - Convidados', valorOrcado: 62426.21, valorContratado: 0 }),
    dec({ id: 'b', item: 'Projeto - Arquitetura', valorOrcado: 10000, valorContratado: 0 }),
    dec({ id: 'c', item: 'Cenica', valorOrcado: 8000, valorContratado: 0 }),
    dec({ id: 'd', item: 'Mobiliario - Extras', valorOrcado: 12000, valorContratado: 0 }),
    dec({ id: 'e', item: 'Hall', valorOrcado: 8000, valorContratado: 0 }),
    dec({ id: 'f', item: 'Floral - Complemento', valorOrcado: 15000, valorContratado: 0 }),
    dec({ id: 'g', item: 'Floral - Buffet', valorOrcado: 3600, valorContratado: 0 }),
    dec({ id: 'h', item: 'Mobiliario - Convidados', valorOrcado: 13300, valorContratado: 0 }),
    dec({ id: 'i', item: 'Mobiliario - Buffet + Bar', valorOrcado: 4500, valorContratado: 0 }),
  ])
  near(r.verbaConsumida, 80000)
  near(r.fechadosZero, 136826.21 - 80000)
  near(r.economias, 56826.21)
  near(r.estouros, 0)
  near(r.liquida, 196826.21 - 140000) // orçado do grupo − contratado do pacote
  const soma = r.detalhe.reduce((s, d) => s + d.consumido, 0)
  near(soma, 80000) // o rateio fecha
})

test('sem estouro no bloco (Japonês da CSAG): nada é consumido e o item continua a zero', () => {
  const r = proj([dec({ item: 'Japonês', valorOrcado: 64515, valorContratado: 0 }), dec({ item: 'Outro', valorOrcado: 100, valorContratado: 100 })])
  assert.equal(r.verbaConsumida, 0)
  assert.equal(r.fechadosZero, 64515)
  assert.equal(r.economias, 64515)
})

test('blocos diferentes não se consomem: o estouro de um bloco não apaga o item a zero de outro', () => {
  const r = proj([
    dec({ item: 'Zero', valorOrcado: 1000, valorContratado: 0 }),
    item({ subcategoria: 'Infraestrutura', item: 'Estourou', valorOrcado: 100, valorContratado: 900 }),
  ])
  assert.equal(r.verbaConsumida, 0)
  assert.equal(r.fechadosZero, 1000)
  assert.equal(r.estouros, 800)
})

test('verba consumida nunca passa do orçado a zero nem do estouro e a líquida nunca muda', () => {
  const itens = [
    dec({ item: 'Z1', valorOrcado: 500, valorContratado: 0 }),
    dec({ item: 'Z2', valorOrcado: 1500, valorContratado: 0 }),
    dec({ item: 'E1', valorOrcado: 100, valorContratado: 700 }), // estouro 600 < zeros 2000
    dec({ item: 'Ok', valorOrcado: 900, valorContratado: 400 }),
  ]
  const r = proj(itens)
  near(r.verbaConsumida, 600)
  near(r.fechadosZero, 1400)
  const liquidaBruta = itens.reduce((s, i) => s + (i.valorOrcado ?? 0) - (i.valorContratado ?? 0), 0)
  near(r.liquida, liquidaBruta)
  near(r.economias - r.estouros, liquidaBruta)
})

test('falha — meta digitada inválida é recusada (vazio, texto, negativo, >100); válidas aceitam vírgula e %', () => {
  for (const ruim of ['', '   ', 'abc', '-5', '101', '12,3,4', '1e2', '25 %%']) assert.equal(lerPercentual(ruim), null, `"${ruim}"`)
  assert.equal(lerPercentual('25'), 25)
  assert.equal(lerPercentual('17,5'), 17.5)
  assert.equal(lerPercentual('17.5'), 17.5)
  assert.equal(lerPercentual(' 15% '), 15)
  assert.equal(lerPercentual('0'), 0)
  assert.equal(lerPercentual('100'), 100)
})

test('metas editáveis mudam a FALTA', () => {
  const r = calcularProjeto(base(), { ...METAS_PADRAO, MEDIO: 20 })
  assert.equal(r.margemNaMeta, 200_000)
  assert.equal(r.falta, 100_000)
})

test('locais: cadastro, exceções (Bernoulli CJ/Loyola 9º ano), Arena e sem local', () => {
  assert.deepEqual(localDoProjeto('BERNOULLI CJ 2026', 'Espaço Ava'), { local: LOCAL_MIX, corrigido: true })
  assert.deepEqual(localDoProjeto('LOYOLA 9º ANO 2026', 'Espaço Ava'), { local: LOCAL_MIX, corrigido: true })
  assert.deepEqual(localDoProjeto('BERNOULLI VS 2026', 'Espaço Ava'), { local: LOCAL_AVA, corrigido: false })
  assert.deepEqual(localDoProjeto('BALÃO VERMELHO 2026', 'ESPAÇO AVA'), { local: LOCAL_AVA, corrigido: false })
  assert.deepEqual(localDoProjeto('DOM HELDER 2026', 'MIX GARDEN'), { local: LOCAL_MIX, corrigido: false })
  assert.deepEqual(localDoProjeto('MED PUC T18', 'Arena'), { local: LOCAL_ARENA, corrigido: false })
  assert.deepEqual(localDoProjeto('MED PUC T18', 'Expominas'), { local: LOCAL_ARENA, corrigido: false })
  assert.deepEqual(localDoProjeto('CSAG 2026', 'Expominas'), { local: LOCAL_PAV3, corrigido: false })
  assert.deepEqual(localDoProjeto('EABH 2026', 'Clube Chalezinho'), { local: LOCAL_OUTROS, corrigido: false })
  assert.deepEqual(localDoProjeto('BQ 78', ''), { local: LOCAL_OUTROS, corrigido: false })
  assert.deepEqual(localDoProjeto(undefined, undefined), { local: LOCAL_OUTROS, corrigido: false })
})

test('totais e agrupamentos somam como a soma dos projetos', () => {
  const a = calcularProjeto(base({ id: 'a' }))
  const b = calcularProjeto(base({ id: 'b', tap: { turma: 'OUTRO', local: 'Expominas', tipoEscola: 'SUPERIOR', anoRealizacao: 2026 }, resumo_geral_orcado: { receita: 2_000_000, custo: 1_800_000 } }))
  const t = somarResultados([a, b])
  assert.equal(t.falta, a.falta + b.falta) // b: meta 15% = 300k, margem 200k → 100k
  assert.equal(b.falta, 100_000)
  assert.equal(t.nAbaixoMeta, 2)
  assert.equal(t.aindaFalta, t.falta - t.liquida)
  const locais = agruparPorLocal([a, b])
  assert.deepEqual(locais.map((l) => l.local), [LOCAL_MIX, LOCAL_PAV3])
  assert.equal(locais.reduce((s, l) => s + l.totais.falta, 0), t.falta)
  const ens = agruparPorEnsino([a, b])
  assert.deepEqual(ens.map((e) => e.ensino), ['MEDIO', 'SUPERIOR'])
})
