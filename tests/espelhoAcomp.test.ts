// Rodar: node --import ./tests/ts-resolver.mjs --test tests/*.test.ts
// Espelho da aba ACOMP. ATENDIMENTO: tabela com RÓTULOS COLORIDOS ("Atração Verba": 01 convite | 1 | 20) não pode virar
// uma faixa vazia por rótulo com os números caindo em "outras anotações".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarEspelho, type CelulaGrade, type GradeAcomp } from '../src/utils/espelhoAcomp.ts'

const barra = (v: string): CelulaGrade => ({ v, bg: '#ff5555', fg: '#ffffff', b: 1 })
const t = (v: string): CelulaGrade => ({ v })
const vaz = (): CelulaGrade => ({ v: '' })
const grade = (rows: CelulaGrade[][], merges: number[][] = []): GradeAcomp => ({ rows, merges, gid: 1, sheetId: 'x' })
const flat = (g: GradeAcomp) => montarEspelho(g).pilhas.flat()

test('tabela de rótulos coloridos com valores ao lado vira UM bloco com as linhas (não 1 faixa por rótulo)', () => {
  const g = grade([
    [barra('ATRAÇÃO VERBA'), vaz(), vaz()],
    [barra('01 convite'), t('1'), t('20')],
    [barra('02 convites'), t('2'), t('80')],
    [barra('TOTAL VERBA'), t('R$17.840,00'), t('17840')],
    [vaz(), vaz(), vaz()],
  ], [[0, 1, 0, 3]])
  const e = montarEspelho(g)
  const blocos = e.pilhas.flat()
  assert.equal(blocos.length, 1)
  assert.equal(blocos[0].banner, false)
  assert.equal(blocos[0].ncols, 3)
  assert.match(blocos[0].titulo, /atra[cç][aã]o verba/i)
  assert.deepEqual(blocos[0].linhas.map((l) => l.celulas.map((c) => c.texto)), [
    ['01 Convite', '1', '20'], ['02 Convites', '2', '80'], ['Total Verba', 'R$17.840,00', '17840'],
  ])
  assert.equal(blocos[0].linhas[2].total, true)
  assert.deepEqual(e.outros, []) // os números NÃO caem mais em "outras anotações"
})

test('falha — rótulo colorido SEM valor ao lado continua sendo barra nova (comportamento antigo preservado)', () => {
  const g = grade([
    [barra('PRIMEIRA'), vaz(), vaz()],
    [t('item'), t('1'), t('2')],
    [barra('SEGUNDA'), vaz(), vaz()], // barra sozinha, nada ao lado: abre bloco novo
    [t('outro'), t('3'), t('4')],
  ], [[0, 1, 0, 3], [2, 3, 0, 3]])
  const blocos = flat(g)
  assert.equal(blocos.length, 2)
  assert.deepEqual(blocos.map((b) => b.titulo), ['Primeira', 'Segunda'])
  assert.equal(blocos[0].linhas.length, 1)
})

test('falha — barra de título de largura total logo abaixo encerra o bloco de cima (não é rótulo de linha)', () => {
  const g = grade([
    [barra('TABELA 1'), barra('QTD'), barra('VALOR')], // cabeçalho com barra em todas as colunas
    [t('a'), t('1'), t('2')],
    [barra('TABELA 2'), barra('QTD'), barra('VALOR')], // outra barra de largura total, colada
    [t('b'), t('3'), t('4')],
  ])
  const blocos = flat(g)
  assert.equal(blocos.length, 2)
  assert.deepEqual(blocos.map((b) => b.linhas.length), [1, 1])
})

test('"Total Adesões" em R$ da tabela de verba NÃO vira cartão de destaque; o da contagem de adesões continua', () => {
  const g = grade([
    [barra('ATRAÇÃO VERBA'), vaz(), vaz(), vaz(), barra('CONVIDADOS'), vaz()],
    [barra('01 convite'), t('1'), t('20'), vaz(), t('Total Adesões'), t('101')],
    [barra('TOTAL ADESÕES'), t('R$3.140,00'), t('3140'), vaz(), vaz(), vaz()],
  ], [[0, 1, 0, 3], [0, 1, 4, 6]])
  const e = montarEspelho(g)
  assert.ok(e.pilhas.flat().some((b) => /atra[cç][aã]o verba/i.test(b.titulo)))
  assert.deepEqual(e.destaques.map((d) => d.valor), ['101']) // só a contagem, não "3140"
})
