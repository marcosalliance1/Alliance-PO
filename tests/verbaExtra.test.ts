// Rodar: node --import ./tests/ts-resolver.mjs --test tests/*.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerVerbasExtra, mesclarVerbasExtra, custosIguais } from '../src/utils/sheetsSync.ts'
import type { CustoAdicional } from '../src/types/index.ts'

// Monta uma grade parecida com o 1. RESUMO GERAL (rótulos na col B, ORÇADO na col I, contratado M, conciliação P)
function grade(linhasVerba: (string | number)[][], opts: { colOrc?: number; semCusto?: boolean } = {}): unknown[][] {
  const colOrc = opts.colOrc ?? 8
  const g: unknown[][] = []
  const cab = new Array(20).fill(''); cab[colOrc] = 'ORÇADO'; g[12] = cab
  g[25] = ['', 'RECEITA BAILE', 1_000_000, '', '', '', '', '', 1_797_494.11]
  g[27] = ['', 'Locação Espaço', 65000]
  let i = 47
  for (const l of linhasVerba) { const r = new Array(20).fill(''); r[1] = l[0]; r[2] = l[1]; r[colOrc] = l[2]; r[colOrc + 4] = l[3]; r[colOrc + 7] = l[4]; g[i++] = r }
  if (!opts.semCusto) g[i + 1] = ['', 'CUSTO TOTAL', 933_380, '', '', '', '', '', 1_927_534.16]
  return g
}
const ca = (id: string, descricao: string, orcado = 0, extra: Partial<CustoAdicional> = {}): CustoAdicional => ({ id, descricao, vendido: 0, orcado, contratado: 0, pago: 0, ...extra })
let seq = 0
const novoId = () => `novo-${++seq}`

test('lê as linhas Verba extra entre a receita e o CUSTO TOTAL (inclusive várias e com "-" como zero)', () => {
  const v = lerVerbasExtra(grade([['Verba extra - Adesões', 0, 3912.83, 0, 0], ['Verba extra - Convites', '', '', '-', '-']]))
  assert.deepEqual(v, [
    { descricao: 'Verba extra - Adesões', vendido: 0, orcado: 3912.83, contratado: 0, pago: 0 },
    { descricao: 'Verba extra - Convites', vendido: 0, orcado: 0, contratado: 0, pago: 0 },
  ])
})

test('valores formatados do navegador ("R$ 1.234,56", "(1.234,56)", "-") viram número', () => {
  const v = lerVerbasExtra(grade([['Verba Extra', ' R$  -   ', ' R$  43.108,46 ', ' R$ 1.000,00 ', '(500,00)']]))
  assert.deepEqual(v, [{ descricao: 'Verba Extra', vendido: 0, orcado: 43108.46, contratado: 1000, pago: -500 }])
})

test('valor negativo na P.O. (ex.: Loyola 2026) é mantido', () => {
  const v = lerVerbasExtra(grade([['Verba extra', '', -13768.28, '', 0]]))
  assert.equal(v![0].orcado, -13768.28)
})

test('falha — célula com erro (#REF!) vira 0 e não quebra', () => {
  const v = lerVerbasExtra(grade([['Verba Extra Comissão', '#REF!', 29477.23, '', '']]))
  assert.deepEqual(v, [{ descricao: 'Verba Extra Comissão', vendido: 0, orcado: 29477.23, contratado: 0, pago: 0 }])
})

test('falha — layout não reconhecido devolve null (app não é tocado): sem CUSTO TOTAL, ORÇADO fora da coluna I, grade vazia', () => {
  assert.equal(lerVerbasExtra(grade([['Verba Extra', 0, 10, 0, 0]], { semCusto: true })), null)
  assert.equal(lerVerbasExtra(grade([['Verba Extra', 0, 10, 0, 0]], { colOrc: 6 })), null)
  assert.equal(lerVerbasExtra([]), null)
  assert.equal(lerVerbasExtra([[], ['x']]), null)
})

test('sem nenhuma Verba extra na P.O.: devolve lista vazia (reconhecido), não null', () => {
  assert.deepEqual(lerVerbasExtra(grade([])), [])
})

test('P.O. manda: MED PUC T18 — app tinha 43.108,46 e a P.O. está vazia → zera mantendo a linha e o id', () => {
  const atual = [ca('a1', 'VERBA EXTRA', 43108.46)]
  const r = mesclarVerbasExtra(atual, [{ descricao: 'Verba Extra', vendido: 0, orcado: 0, contratado: 0, pago: 0 }], novoId)
  assert.equal(r.length, 1)
  assert.equal(r[0].id, 'a1')
  assert.equal(r[0].descricao, 'VERBA EXTRA') // mantém o nome que já estava no app
  assert.equal(r[0].orcado, 0)
})

test('P.O. manda: atualiza valores, cria o que falta, remove o que a P.O. não tem mais; não cria linha toda zerada', () => {
  const atual = [ca('x', 'FEE ALLIANCE', 332089.96), ca('v1', 'VERBA EXTRA - CONVITES', 92303.69), ca('vazio', '', 0)]
  const r = mesclarVerbasExtra(atual, [
    { descricao: 'Verba extra', vendido: 0, orcado: -13768.28, contratado: 0, pago: 0 },
    { descricao: 'Verba extra - Adesões', vendido: 0, orcado: 0, contratado: 0, pago: 0 },
  ], novoId)
  assert.deepEqual(r.map((c) => [c.descricao, c.orcado]), [['FEE ALLIANCE', 332089.96], ['', 0], ['Verba extra', -13768.28]])
  assert.ok(!r.some((c) => c.id === 'v1')) // a "VERBA EXTRA - CONVITES" antiga saiu: não pode somar duas vezes
})

test('mantém a posição das linhas existentes (EABH: Verba Extra e uma linha vazia) e acrescenta as novas no fim', () => {
  const atual = [ca('v', 'VERBA EXTRA ADESOES', 41882), ca('vazio', '', 0), ca('f', 'FEE ALLIANCE', 9)]
  const r = mesclarVerbasExtra(atual, [
    { descricao: 'Verba extra - Adesões', vendido: 0, orcado: 41882, contratado: 0, pago: 0 },
    { descricao: 'Verba extra - Convites', vendido: 0, orcado: 7, contratado: 0, pago: 0 },
  ], novoId)
  assert.deepEqual(r.map((c) => c.descricao), ['VERBA EXTRA ADESOES', '', 'FEE ALLIANCE', 'Verba extra - Convites'])
  assert.ok(custosIguais(mesclarVerbasExtra(atual, [{ descricao: 'Verba extra - Adesões', vendido: 0, orcado: 41882, contratado: 0, pago: 0 }], novoId), atual)) // sem mudança real = sem gravação
})

test('nome com variação de caixa/acento/hífen casa com a linha existente (id preservado)', () => {
  const atual = [ca('e1', 'VERBA EXTRA ADESOES', 41882)]
  const r = mesclarVerbasExtra(atual, [{ descricao: 'Verba extra - Adesões', vendido: 0, orcado: 41882, contratado: 0, pago: 0 }], novoId)
  assert.deepEqual(r.map((c) => [c.id, c.orcado]), [['e1', 41882]])
})

test('duas linhas com o mesmo nome na P.O. não reusam o mesmo id', () => {
  const r = mesclarVerbasExtra([ca('d1', 'Verba Extra', 5)], [
    { descricao: 'Verba Extra', vendido: 0, orcado: 1, contratado: 0, pago: 0 },
    { descricao: 'Verba Extra', vendido: 0, orcado: 2, contratado: 0, pago: 0 },
  ], novoId)
  assert.equal(new Set(r.map((c) => c.id)).size, 2)
})

test('falha — layout não reconhecido (null): custos adicionais ficam EXATAMENTE como estavam', () => {
  const atual = [ca('a1', 'VERBA EXTRA', 43108.46)]
  assert.equal(mesclarVerbasExtra(atual, null, novoId), atual) // mesma referência
})

test('P.O. sem Verba Extra (lista vazia, layout reconhecido): verbas antigas saem, o resto fica', () => {
  const r = mesclarVerbasExtra([ca('a1', 'VERBA EXTRA', 10), ca('f', 'FEE ALLIANCE', 99)], [], novoId)
  assert.deepEqual(r.map((c) => c.descricao), ['FEE ALLIANCE'])
})

test('custosIguais ignora a ordem das chaves e trata ausente como 0', () => {
  const a = [{ id: 'a', descricao: 'X', vendido: 0, orcado: 5, contratado: 0, pago: 0 }]
  const b = [{ pago: 0, orcado: 5, id: 'a', descricao: 'X', contratado: 0, vendido: 0 }] as CustoAdicional[]
  assert.equal(custosIguais(a, b), true)
  assert.equal(custosIguais(a, [{ ...a[0], orcado: 6 }]), false)
  assert.equal(custosIguais(a, []), false)
})

test('idempotente: aplicar duas vezes dá o mesmo resultado', () => {
  const v = [{ descricao: 'Verba extra - Convites', vendido: 0, orcado: 100, contratado: 50, pago: 20 }]
  const a = mesclarVerbasExtra([ca('c', 'Verba Extra - Convites', 1)], v, novoId)
  const b = mesclarVerbasExtra(a, v, novoId)
  assert.deepEqual(a, b)
})
