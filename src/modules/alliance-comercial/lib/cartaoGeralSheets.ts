import { fetchSheetNames, fetchAba } from '../../../utils/sheetsSync'

// Ano-alvo da conciliação — só entram linhas de 2026 no cruzamento, mesmo que uma aba
// (ex: "MORETZ-GOLDEN"/"BIA", que acumulam vários meses) tenha linhas de outros anos.
export const ANO_CONCILIACAO = 2026

export interface GastoGeralImportado {
  portador: string
  abaOrigem: string
  numeroCartaoMascarado: string | null
  banco: string | null
  faturaDataInicio: string | null
  faturaDataFim: string | null
  faturaVencimento: string | null
  itemComprado: string
  valor: number
  data: string
  descricao: string | null
  naturezaQualCasa: string | null
  jotform: string | null
  ehComercial: boolean
  chaveNatural: string
}

// Nome de aba normalizado → portador. Qualquer aba fora desse mapa cai no padrão
// "Alliance" (cartão principal da empresa, sem aba dedicada) — mas gera aviso pra
// abas com nome estranho aparecerem pra revisão em vez de cair em silêncio no padrão.
const PORTADOR_POR_ABA: Record<string, string> = {
  'MORETZGOLDEN': 'Moretz-Golden',
  'MORETZ GOLDEN': 'Moretz-Golden',
  'BIA': 'Bia',
}

function norm(s: unknown): string {
  return String(s ?? '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '')
    .trim()
}

function parseStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  const erros = ['#ref!', '#n/a', '#value!', '#div/0!']
  if (erros.some(e => s.toLowerCase().includes(e))) return ''
  return s
}

function parseNum(val: unknown): number | null {
  const s = parseStr(val)
  if (!s) return null
  const cleaned = s.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// Tolerante a "26//02" (barra dupla, erro de digitação visto nos dados reais).
function parseDataBR(raw: string, anoPadrao: number): string | null {
  const limpo = raw.replace(/\/{2,}/g, '/').trim()
  const m = limpo.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return null
  const [, d, mo] = m
  let ano = m[3] ? parseInt(m[3], 10) : anoPadrao
  if (ano < 100) ano += 2000
  return `${ano}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function getCell(row: unknown[] | undefined, col: number): unknown {
  return row?.[col] ?? null
}

// Hash simples (FNV-1a 32 bits), só pra deduplicar/idempotência de reimport — não
// precisa ser criptográfico. Mesmo padrão de src/lib/rifasSync.ts:hashLinha, duplicado
// aqui (função pura pequena) em vez de importado de um módulo de feature não relacionada.
function hashChave(partes: unknown[]): string {
  const s = partes.map(v => String(v ?? '')).join('␟')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

function portadorDaAba(nomeAba: string): { portador: string; reconhecida: boolean } {
  const chave = norm(nomeAba)
  const portador = PORTADOR_POR_ABA[chave]
  if (portador) return { portador, reconhecida: true }
  return { portador: 'Alliance', reconhecida: false }
}

// Acha a linha cuja coluna A bate com `rotulo` (ex: "Numero", "Banco") e retorna a
// linha inteira — nunca por índice fixo, sempre por texto.
function acharLinhaPorRotulo(values: unknown[][], rotulo: string): unknown[] | null {
  const alvo = norm(rotulo)
  for (const row of values) {
    if (norm(getCell(row as unknown[], 0)) === alvo) return row as unknown[]
  }
  return null
}

function primeiroValorNaoVazio(row: unknown[] | null, apartirDe: number): string | null {
  if (!row) return null
  for (let c = apartirDe; c < row.length; c++) {
    const v = parseStr(row[c])
    if (v) return v
  }
  return null
}

interface AbaGeralResultado {
  linhas: GastoGeralImportado[]
  avisos: string[]
}

export function parseAbaGeral(nomeAba: string, values: unknown[][]): AbaGeralResultado {
  const avisos: string[] = []
  // Aba não reconhecida (nem "MORETZ-GOLDEN" nem "BIA") cai no portador padrão
  // "Alliance" — o aviso correspondente é agregado em sincronizarCartaoGeral, que já
  // sabe o nome de todas as abas da planilha.
  const { portador } = portadorDaAba(nomeAba)

  const linhaNumero = acharLinhaPorRotulo(values, 'Numero')
  const linhaBanco = acharLinhaPorRotulo(values, 'Banco')
  const linhaDataCompras = acharLinhaPorRotulo(values, 'Data das compras')
  const linhaVencimento = acharLinhaPorRotulo(values, 'Vencimento')

  const numeroCartaoMascarado = primeiroValorNaoVazio(linhaNumero, 1)
  const banco = primeiroValorNaoVazio(linhaBanco, 1)

  // "Data das compras" tem o padrão "... | a | DD/MM/AAAA" (início opcional, "a", fim).
  let faturaDataInicio: string | null = null
  let faturaDataFim: string | null = null
  if (linhaDataCompras) {
    const idxA = linhaDataCompras.findIndex(c => norm(c) === 'A')
    if (idxA >= 0) {
      const antes = primeiroValorNaoVazio(linhaDataCompras.slice(0, idxA), 0)
      const depois = parseStr(linhaDataCompras[idxA + 1])
      faturaDataInicio = antes ? parseDataBR(antes, ANO_CONCILIACAO) : null
      faturaDataFim = depois ? parseDataBR(depois, ANO_CONCILIACAO) : null
    }
  }
  const faturaVencimentoRaw = primeiroValorNaoVazio(linhaVencimento, 1)
  const faturaVencimento = faturaVencimentoRaw ? parseDataBR(faturaVencimentoRaw, ANO_CONCILIACAO) : null

  // Cabeçalho da tabela de compras: "Item comprado" na coluna A. A partir daqui os
  // deslocamentos de coluna são: Item(0) Valor(1) Data(2) Descrição-sem-rótulo(3)
  // Natureza QUAL CASA(4) Jotform(5) — confirmado nos dados reais (não 5 colunas).
  const headerIdx = values.findIndex(row => norm(getCell(row as unknown[], 0)) === norm('Item comprado'))
  if (headerIdx < 0) {
    return { linhas: [], avisos: [`Aba "${nomeAba}": cabeçalho "Item comprado" não encontrado.`] }
  }

  const linhas: GastoGeralImportado[] = []
  for (let r = headerIdx + 1; r < values.length; r++) {
    const row = (values[r] as unknown[]) ?? []
    const item = parseStr(getCell(row, 0))
    const valor = parseNum(getCell(row, 1))
    const dataRaw = parseStr(getCell(row, 2))

    // Linha de TOTAL (ou linha vazia de transição): valor sem item comprado → fim do bloco.
    if (!item && valor !== null) break
    if (!item && !dataRaw) continue // linha em branco entre o cabeçalho e o fim
    if (!item) continue

    const data = dataRaw ? parseDataBR(dataRaw, ANO_CONCILIACAO) : null
    if (!data) {
      avisos.push(`Aba "${nomeAba}", linha ${r + 1}: data "${dataRaw}" inválida, item "${item}" ignorado.`)
      continue
    }
    // Fora do ano-alvo — mantém só 2026, mesmo em aba que acumula vários anos.
    if (!data.startsWith(`${ANO_CONCILIACAO}-`)) continue
    if (valor === null) continue

    const descricao = parseStr(getCell(row, 3)) || null
    const naturezaQualCasa = parseStr(getCell(row, 4)) || null
    const jotform = parseStr(getCell(row, 5)) || null
    const ehComercial = norm(descricao).includes(norm('COMERCIAL'))

    linhas.push({
      portador,
      abaOrigem: nomeAba,
      numeroCartaoMascarado,
      banco,
      faturaDataInicio,
      faturaDataFim,
      faturaVencimento,
      itemComprado: item,
      valor,
      data,
      descricao,
      naturezaQualCasa,
      jotform,
      ehComercial,
      chaveNatural: hashChave([nomeAba, item, valor, data, descricao]),
    })
  }

  return { linhas, avisos }
}

export async function sincronizarCartaoGeral(
  spreadsheetId: string,
  accessToken: string,
): Promise<{ linhas: GastoGeralImportado[]; avisos: string[]; abasNaoReconhecidas: string[] }> {
  const nomesAbas = await fetchSheetNames(spreadsheetId, accessToken)
  const linhas: GastoGeralImportado[] = []
  const avisos: string[] = []
  const abasNaoReconhecidas: string[] = []

  for (const nomeAba of nomesAbas) {
    const { reconhecida } = portadorDaAba(nomeAba)
    if (!reconhecida) abasNaoReconhecidas.push(nomeAba)
    const values = await fetchAba(spreadsheetId, nomeAba, accessToken)
    if (!values || values.length === 0) continue
    const resultado = parseAbaGeral(nomeAba, values)
    linhas.push(...resultado.linhas)
    avisos.push(...resultado.avisos)
  }

  return { linhas, avisos, abasNaoReconhecidas }
}
