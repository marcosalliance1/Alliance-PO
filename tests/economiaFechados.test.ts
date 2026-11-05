// Rodar: node --import ./tests/ts-resolver.mjs --test tests/*.test.ts   (Node >= 22.6, TypeScript nativo)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularProjeto, descontarFechadosZero, lerPercentual, somarResultados, agruparPorLocal, agruparPorEnsino, localDoProjeto, METAS_PADRAO,
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
  assert.equal(r.economias, 60)
  assert.equal(r.estouros, 30)
  assert.equal(r.liquida, 30)
  assert.equal(r.fechadosZero, 20)
  assert.equal(r.abertoOrcado, 500)
  assert.equal(r.cobertura, 30 / 150_000)
  assert.equal(r.aindaFalta, 150_000 - 30)
  assert.equal(r.aindaFaltaConservador, 150_000 - (30 - 20))
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
  assert.equal(r.abertoOrcado, 300) // N/A fica de fora do potencial
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

test('descontar fechados a zero: líquida e AINDA FALTA recalculadas, sem mexer no que não tem zero', () => {
  const r = calcularProjeto(base()) // economias 60 (inclui 20 de fechado a zero), estouros 30, líquida 30
  const d = descontarFechadosZero(r)
  assert.equal(d.economias, 40)
  assert.equal(d.liquida, 10)
  assert.equal(d.aindaFalta, 150_000 - 10)
  assert.equal(d.aindaFalta, r.aindaFaltaConservador) // modo conservador = a coluna "sem os fechados a zero"
  assert.equal(d.fechadosZero, 20)
  const sem = calcularProjeto(base({ secoes: [{ numero: '2.1', itens: [item({ valorOrcado: 100, valorContratado: 60 })] }] }))
  assert.equal(descontarFechadosZero(sem), sem)
})

test('totais com "descontar fechados a zero": conservador não desconta duas vezes', () => {
  const a = calcularProjeto(base({ id: 'a' }))
  const b = calcularProjeto(base({ id: 'b' }))
  const normal = somarResultados([a, b])
  assert.equal(normal.aindaFaltaConservador, normal.falta - (normal.liquida - normal.fechadosZero))
  const desc = somarResultados([a, b].map(descontarFechadosZero))
  assert.equal(desc.liquida, normal.liquida - normal.fechadosZero)
  assert.equal(desc.aindaFalta, normal.aindaFaltaConservador) // a visão conservadora vira a visão principal
  assert.equal(desc.aindaFaltaConservador, normal.aindaFaltaConservador) // e não muda de novo
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
