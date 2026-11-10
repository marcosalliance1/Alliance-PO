// Rodar: node --import ./tests/ts-resolver.mjs --test tests/*.test.ts
// Leitura da OS em PDF: usa o build "legacy" do pdf.js em Node. Os PDFs reais ficam em Downloads (têm telefones de
// fornecedores, por isso não vão para o repositório): sem eles, os testes que dependem deles são pulados.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { interpretarOs, paginasDoDoc, OsInvalidaErro, type ItemTexto, type OsLida } from '../src/lib/lerOsPdf.ts'
import { propostaCampos, mesclarFornecedores, mesclarLineup, divergencias } from '../src/lib/aplicarOsInfoEvento.ts'
import type { InfoEvento } from '../src/types/index.ts'

const pdfjs = await import(pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href)
const DL = path.join(os.homedir(), 'Downloads')
const LOYOLA = path.join(DL, 'OS_Loyola9Ano_Alliance_v4.pdf')
const BERNOULLI = path.join(DL, 'OS Bernoulli CJ 9º Ano 2026.pdf')

async function paginas(arq: string): Promise<ItemTexto[][]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(arq)), useSystemFonts: true }).promise
  return paginasDoDoc(doc)
}
const infoVazia = (p: Partial<InfoEvento> = {}): InfoEvento => ({
  nomeEvento: '', tipo: '', data: '', diaSemana: '', local: '', horario: '', tematica: '', totalConvidados: '', formandos: '',
  pagantes: '', bolsaFolia: '', dataAdimplencia: '', vendaDeConvite: '', fornecedores: [], lineup: [], linkVenda: null, ...p,
})

// ── caminho feliz: PDFs reais ──
const temLoyola = fs.existsSync(LOYOLA)
const temBernoulli = fs.existsSync(BERNOULLI)

test('OS Loyola 9º ano: cabeçalho, fornecedores e lineup lidos corretamente', { skip: !temLoyola }, async () => {
  const r = interpretarOs(await paginas(LOYOLA))
  assert.equal(r.numeroOs, '20261121-LOY9')
  assert.equal(r.versao, 4)
  assert.equal(r.nomeEvento, 'BAILE DE FORMATURA 9º ANO LOYOLA 2026')
  assert.equal(r.tematica, 'Futurista')
  assert.equal(r.data, '21/11/2026')
  assert.equal(r.diaSemana, 'Sábado')
  assert.equal(r.horario, '21h às 03h')
  assert.equal(r.local, 'Mix Garden')
  assert.equal(r.formandos, 190)
  assert.equal(r.convidados, 876)
  assert.equal(r.mesas, 67)
  assert.equal(r.fornecedores.length, 25)
  assert.deepEqual(r.avisos, [])
  const bravo = r.fornecedores.find((f) => f.nome === 'Bravo')!
  assert.equal(bravo.servico, 'Buffet, cerveja e soft drinks')
  assert.equal(bravo.contato, 'Stela')
  const silvania = r.fornecedores.find((f) => f.nome.startsWith('Silvânia'))!
  assert.equal(silvania.nome, 'Silvânia (brigada)') // nome em dois pedaços no PDF
  assert.equal(r.fornecedores.find((f) => f.nome === 'Zoom Vip')!.telefone, '') // "—" vira vazio
  assert.deepEqual(r.lineup.map((l) => `${l.inicio}-${l.fim} ${l.atracao}`), [
    '21:00-21:40 DJ Alliance', '21:40-22:20 Cerimônia ou discurso', '22:20-22:45 DJ Alliance',
    '22:45-00:15 Mary Popping', '00:15-01:30 Brandão', '01:30-03:00 Dubflow',
  ])
})

test('OS Bernoulli CJ: 26 fornecedores, 5 atrações, quinta-feira', { skip: !temBernoulli }, async () => {
  const r = interpretarOs(await paginas(BERNOULLI))
  assert.equal(r.numeroOs, '20261119-BERCJ')
  assert.equal(r.diaSemana, 'Quinta-feira')
  assert.equal(r.tematica, 'Avatar')
  assert.equal(r.formandos, 227)
  assert.equal(r.convidados, 988)
  assert.equal(r.mesas, 78)
  assert.equal(r.fornecedores.length, 26)
  assert.equal(r.lineup.length, 5)
  assert.deepEqual(r.avisos, [])
})

// ── falhas ──
test('falha — PDF que não é OS é recusado com mensagem clara', async () => {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF(); pdf.text('Relatorio qualquer - nada de OS aqui', 10, 10)
  const arq = path.join(os.tmpdir(), 'nao_os_teste.pdf')
  fs.writeFileSync(arq, Buffer.from(pdf.output('arraybuffer')))
  try {
    await assert.rejects(async () => interpretarOs(await paginas(arq)), (e: unknown) => e instanceof OsInvalidaErro && /não parece uma Ordem de Serviço/.test((e as Error).message))
  } finally { fs.rmSync(arq, { force: true }) }
})

test('falha — sem nenhuma página/texto é recusado', () => {
  assert.throws(() => interpretarOs([]), OsInvalidaErro)
  assert.throws(() => interpretarOs([[]]), OsInvalidaErro)
})

test('falha — OS sem a página de operação: lê o que dá e AVISA o que faltou (sem inventar lineup)', { skip: !temLoyola }, async () => {
  const r = interpretarOs((await paginas(LOYOLA)).slice(0, 1))
  assert.equal(r.fornecedores.length, 25)
  assert.deepEqual(r.lineup, [])
  assert.equal(r.mesas, null)
  assert.ok(r.avisos.some((a) => /Operação do evento/.test(a)))
})

test('falha — tabela de fornecedores truncada: avisa que a contagem não bate com a declarada', { skip: !temLoyola }, async () => {
  const pg = await paginas(LOYOLA)
  // remove as 3 últimas linhas da tabela (y menor que 180 na página 1, acima do rodapé)
  pg[0] = pg[0].filter((i) => !(i.y < 190 && i.y > 100))
  const r = interpretarOs(pg)
  assert.equal(r.fornecedores.length, 22)
  assert.ok(r.avisos.some((a) => /declara 25 fornecedores, mas li 22/.test(a)))
})

// ── mesclagem com o que já existe ──
const OS_FAKE = (p: Partial<OsLida> = {}): OsLida => ({
  numeroOs: 'X', versao: 1, nomeEvento: 'BAILE X', tematica: 'Avatar', data: '19/11/2026', diaSemana: 'Quinta-feira', horario: '21h às 03h',
  local: 'Mix Garden', formandos: 227, convidados: 988, mesas: 78, fornecedores: [], lineup: [], avisos: [], ...p,
})

test('campos: só sugere marcar os vazios; nunca sobrescreve sem escolha; iguais não aparecem', () => {
  const prop = propostaCampos(infoVazia({ local: 'Expominas', tematica: 'Avatar' }), OS_FAKE())
  const por = Object.fromEntries(prop.map((p) => [p.campo, p]))
  assert.equal(por.local.aplicarPadrao, false) // já tinha valor diferente
  assert.equal(por.local.atual, 'Expominas')
  assert.equal(por.horario.aplicarPadrao, true) // estava vazio
  assert.equal(por.tematica, undefined) // igual
})

test('fornecedores (caso Bernoulli CJ): nome digitado em "categoria" é movido; 4º vazio é preservado; novos entram como fechado', () => {
  const atuais = [
    { categoria: 'Maria Celia Feitosa', fornecedor: '', status: 'aberto' as const },
    { categoria: 'Up Drinks', fornecedor: '', status: 'aberto' as const },
    { categoria: '', fornecedor: '', status: 'aberto' as const },
  ]
  const { lista, resumo } = mesclarFornecedores(atuais, [
    { nome: 'Maria Célia Feitosa', servico: 'Buffet, cerveja e soft drinks', contato: '', telefone: '', chegada: '18h' },
    { nome: 'Up Drinks', servico: 'Bar de drinks', contato: '', telefone: '', chegada: '18h' },
    { nome: 'Rokkon', servico: 'Japonês', contato: '', telefone: '', chegada: '18h' },
  ], 'mesclar')
  assert.equal(lista.length, 4) // 3 existentes (incl. vazia) + Rokkon
  assert.deepEqual(lista[0], { categoria: 'Buffet, cerveja e soft drinks', fornecedor: 'Maria Célia Feitosa', status: 'aberto' }) // mantém status
  assert.equal(lista[1].fornecedor, 'Up Drinks')
  assert.equal(lista[2].categoria, '') // a linha em branco não foi tocada nem casou com nada
  assert.deepEqual(lista[3], { categoria: 'Japonês', fornecedor: 'Rokkon', status: 'fechado' })
  assert.deepEqual(resumo, { novos: 1, atualizados: 2 })
})

test('fornecedores: modo substituir troca tudo pela OS', () => {
  const { lista } = mesclarFornecedores([{ categoria: 'x', fornecedor: 'y' }], [{ nome: 'A', servico: 'S', contato: '', telefone: '', chegada: '' }], 'substituir')
  assert.deepEqual(lista, [{ categoria: 'S', fornecedor: 'A', status: 'fechado' }])
})

test('lineup (caso Bernoulli CJ): "DJ Mayrink" casa com "Mayrink"; igual não muda nada; rider/status preservados', () => {
  const atuais = [
    { atracao: 'DJ Alliance', horarioInicio: '21:00', horarioTermino: '21:30', status: 'fechado' as const },
    { atracao: 'DJ Mayrink', horarioInicio: '00:00', horarioTermino: '01:00', status: 'aguardando' as const },
  ]
  const { lista, resumo } = mesclarLineup(atuais, [
    { atracao: 'DJ Alliance', inicio: '21:00', fim: '21:30' },
    { atracao: 'Mayrink', inicio: '00:00', fim: '01:30' },
    { atracao: 'Dubflow', inicio: '01:30', fim: '03:00' },
  ], 'mesclar')
  assert.equal(lista.length, 3)
  assert.equal(lista[1].atracao, 'DJ Mayrink') // nome do usuário preservado
  assert.equal(lista[1].horarioTermino, '01:30') // horário ajustado pela OS
  assert.equal(lista[1].status, 'aguardando') // situação preservada
  assert.deepEqual(resumo, { novos: 1, atualizados: 1 })
})

test('lineup: mesma atração duas vezes (DJ Alliance 21h e 22h20) não colapsa em uma', () => {
  const { lista } = mesclarLineup([], [
    { atracao: 'DJ Alliance', inicio: '21:00', fim: '21:40' }, { atracao: 'DJ Alliance', inicio: '22:20', fim: '22:45' }, { atracao: 'Dubflow', inicio: '01:30', fim: '03:00' },
  ], 'mesclar')
  assert.equal(lista.length, 3)
  assert.deepEqual(lista.map((l) => l.horarioInicio), ['21:00', '22:20', '01:30']) // madrugada depois da noite
})

test('divergências: convidados e data da OS vs. sistema viram aviso (não alteram nada)', () => {
  const d = divergencias(OS_FAKE({ convidados: 876, data: '21/11/2026' }), { convidadosSistema: 866, dataEventoIso: '2026-11-22' })
  assert.equal(d.length, 2)
  assert.ok(/876.*866/.test(d[0]))
  assert.deepEqual(divergencias(OS_FAKE({ convidados: 866, data: '21/11/2026' }), { convidadosSistema: 866, dataEventoIso: '2026-11-21T00:00:00' }), [])
})
