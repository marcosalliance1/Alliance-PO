// Rodar: node --import ./tests/ts-resolver.mjs --test tests/*.test.ts   (Node ≥ 22.6)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { metaMargemPct, lerMetas, salvarMetas, restaurarMetasPadrao, corMargem, COR_MARGEM } from '../src/utils/metasMargem.ts'

function stubLocalStorage(inicial: Record<string, string> = {}, falhaAoGravar = false) {
  const mem = { ...inicial }
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => { if (falhaAoGravar) throw new Error('QuotaExceeded'); mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
  return mem
}
beforeEach(() => stubLocalStorage())

test('padrão idêntico ao comportamento anterior: Médio 25, Superior 15, Fundamental 15, desconhecido 15', () => {
  assert.equal(metaMargemPct('MEDIO'), 25)
  assert.equal(metaMargemPct('SUPERIOR'), 15)
  assert.equal(metaMargemPct('FUNDAMENTAL'), 15)
  assert.equal(metaMargemPct(undefined), 15)
  assert.equal(metaMargemPct(null), 15)
  assert.equal(metaMargemPct('xyz'), 15)
})

test('metas editadas valem para a lista/dashboards (metaMargemPct)', () => {
  assert.equal(salvarMetas({ MEDIO: 22.5, SUPERIOR: 18, FUNDAMENTAL: 12 }), true)
  assert.equal(metaMargemPct('MEDIO'), 22.5)
  assert.equal(metaMargemPct('SUPERIOR'), 18)
  assert.equal(metaMargemPct('FUNDAMENTAL'), 12)
  restaurarMetasPadrao()
  assert.equal(metaMargemPct('MEDIO'), 25)
})

test('falha — JSON corrompido ou valores fora de 0–100 voltam ao padrão (sem quebrar)', () => {
  stubLocalStorage({ alliance_metas_margem: '{nao e json' })
  assert.deepEqual(lerMetas(), { MEDIO: 25, SUPERIOR: 15, FUNDAMENTAL: 15 })
  stubLocalStorage({ alliance_metas_margem: JSON.stringify({ MEDIO: 250, SUPERIOR: -3, FUNDAMENTAL: 'x' }) })
  assert.deepEqual(lerMetas(), { MEDIO: 25, SUPERIOR: 15, FUNDAMENTAL: 15 })
  stubLocalStorage({ alliance_metas_margem: JSON.stringify({ MEDIO: 30 }) })
  assert.deepEqual(lerMetas(), { MEDIO: 30, SUPERIOR: 15, FUNDAMENTAL: 15 }) // campo ausente usa o padrão dele
})

test('falha — sem localStorage (modo privado/bloqueado): lê o padrão e salvarMetas devolve false', () => {
  ;(globalThis as Record<string, unknown>).localStorage = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') }, removeItem() { throw new Error('bloqueado') } }
  assert.equal(metaMargemPct('MEDIO'), 25)
  assert.equal(salvarMetas({ MEDIO: 20, SUPERIOR: 15, FUNDAMENTAL: 15 }), false)
  assert.doesNotThrow(() => restaurarMetasPadrao())
  stubLocalStorage({}, true)
  assert.equal(salvarMetas({ MEDIO: 20, SUPERIOR: 15, FUNDAMENTAL: 15 }), false) // cota cheia
})

test('cores da margem (regra pedida em 03/11): verde só na meta ou acima, laranja abaixo, vermelho negativa', () => {
  assert.equal(corMargem(25, 25), COR_MARGEM.acima)
  assert.equal(corMargem(24.9, 25), COR_MARGEM.abaixo)
  assert.equal(corMargem(0, 15), COR_MARGEM.abaixo)
  assert.equal(corMargem(-0.1, 15), COR_MARGEM.negativa)
  assert.equal(corMargem(null, 15), COR_MARGEM.semDado)
})
