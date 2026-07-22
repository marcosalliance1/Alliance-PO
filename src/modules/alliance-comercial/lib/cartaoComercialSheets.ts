import { fetchSheetNames, fetchAba } from '../../../utils/sheetsSync'
import { ANO_CONCILIACAO } from './cartaoGeralSheets'

export interface GastoComercialImportado {
  planilhaAba: string
  segmento: 'Ensino Superior' | 'Ensino Médio'
  projeto: string
  categoria: string | null
  reuniao: string | null
  data: string
  valor: number
  fornecedor: string | null
  responsavel: string | null
  portadorRaw: string | null
  portador: string | null
  foraDoCartao: boolean
  chaveNatural: string
}

// "MORETZ" na anotação de cartão da planilha comercial = mesmo portador "Moretz-Golden"
// da planilha geral (aba "MORETZ-GOLDEN") — confirmado com o usuário.
const ALIAS_PORTADOR: Record<string, string> = {
  'MORETZ': 'Moretz-Golden',
  'MORETZGOLDEN': 'Moretz-Golden',
  'BIA': 'Bia',
}

function norm(s: unknown): string {
  return String(s ?? '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
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
function parseDataBR(raw: string, ano: number): string | null {
  const limpo = raw.replace(/\/{2,}/g, '/').trim()
  const m = limpo.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return null
  const [, d, mo] = m
  let anoFinal = m[3] ? parseInt(m[3], 10) : ano
  if (anoFinal < 100) anoFinal += 2000
  return `${anoFinal}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function hashChave(partes: unknown[]): string {
  const s = partes.map(v => String(v ?? '')).join('␟')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

function getCell(row: unknown[] | undefined, col: number): unknown {
  return row?.[col] ?? null
}

interface PortadorParseado {
  portadorRaw: string | null
  portador: string | null
  foraDoCartao: boolean
  aviso: string | null
}

// A célula de anotação de cartão traz "(cartão Alliance) MORETZ", "(cartão Alliance)"
// sozinho, "EVEREST" (pago via ERP, não é cartão) ou "Conta pessoal" (reembolso,
// também não é cartão) — confirmado com o usuário que os dois últimos viram uma
// categoria neutra "fora do cartão", fora do cruzamento.
function normalizarPortadorComercial(raw: unknown): PortadorParseado {
  const texto = parseStr(raw)
  if (!texto) return { portadorRaw: null, portador: 'Alliance', foraDoCartao: false, aviso: null }

  const normTexto = norm(texto).replace(/\s+/g, '')
  if (normTexto.includes('EVEREST')) return { portadorRaw: texto, portador: null, foraDoCartao: true, aviso: null }
  if (normTexto.includes('CONTAPESSOAL')) return { portadorRaw: texto, portador: null, foraDoCartao: true, aviso: null }

  const m = texto.match(/\(cart[ãa]o\s+alliance\)\s*(.*)/i)
  if (m) {
    const sufixo = m[1].trim()
    if (!sufixo) return { portadorRaw: texto, portador: 'Alliance', foraDoCartao: false, aviso: null }
    const alias = ALIAS_PORTADOR[norm(sufixo).replace(/\s+/g, '')]
    if (alias) return { portadorRaw: texto, portador: alias, foraDoCartao: false, aviso: null }
    return {
      portadorRaw: texto, portador: sufixo, foraDoCartao: false,
      aviso: `Portador "${sufixo}" (anotação "${texto}") não reconhecido — mantido como está, revisar mapeamento.`,
    }
  }

  return {
    portadorRaw: texto, portador: texto, foraDoCartao: false,
    aviso: `Anotação de cartão "${texto}" fora do padrão "(cartão Alliance) ..." — mantida como portador bruto.`,
  }
}

interface Segmento {
  nome: 'Ensino Superior' | 'Ensino Médio'
  colInicio: number
}

function encontrarSegmentos(values: unknown[][]): Segmento[] {
  let colSuperior = -1
  let colMedio = -1
  for (const row of values as unknown[][]) {
    for (let c = 0; c < row.length; c++) {
      const n = norm(row[c])
      if (colSuperior === -1 && n.includes('SUPERIOR')) colSuperior = c
      // "MEDIO" aparece tanto em "ENSINO MÉDIO" quanto no erro de digitação real "ENSIMO
      // MÉDIO" — busca só pelo sufixo, não pelo prefixo "ENSINO"/"ENSIMO".
      if (colMedio === -1 && n.includes('MEDIO')) colMedio = c
    }
    if (colSuperior !== -1 && colMedio !== -1) break
  }
  const segmentos: Segmento[] = []
  if (colSuperior !== -1) segmentos.push({ nome: 'Ensino Superior', colInicio: colSuperior })
  if (colMedio !== -1) segmentos.push({ nome: 'Ensino Médio', colInicio: colMedio })
  return segmentos
}

interface ColunasBloco {
  reuniao: number
  data: number
  valor: number
  fornecedor: number
  responsavel: number
  cartao: number
}

// Cabeçalho local do bloco: "CUSTO" na coluna inicial do segmento, e os demais por
// busca de rótulo dentro da mesma linha — Responsável e a anotação de cartão não têm
// rótulo, então assumem as duas colunas logo depois de Fornecedor (posição relativa
// fixa, confirmada nos dados reais).
function detectarColunasBloco(headerRow: unknown[], colInicio: number, colFim: number): ColunasBloco | null {
  let reuniao = -1, data = -1, valor = -1, fornecedor = -1
  // Limitado a [colInicio, colFim] — sem isso, o rótulo do OUTRO segmento (Superior
  // varrendo até o fim da linha acabaria achando "Data"/"Valor" do segmento Médio e
  // sobrescrevendo o próprio, já que a varredura não para no primeiro achado).
  for (let c = colInicio; c <= colFim && c < headerRow.length; c++) {
    const n = norm(headerRow[c])
    if (n === 'REUNIAO') reuniao = c
    else if (n === 'DATA') data = c
    else if (n === 'VALOR') valor = c
    else if (n === 'FORNECEDOR') fornecedor = c
  }
  if (data === -1 || valor === -1 || fornecedor === -1) return null
  return { reuniao, data, valor, fornecedor, responsavel: fornecedor + 1, cartao: fornecedor + 2 }
}

function linhaVaziaNoSegmento(row: unknown[], colInicio: number, colFim: number): boolean {
  for (let c = colInicio; c <= colFim; c++) {
    if (parseStr(row[c])) return false
  }
  return true
}

function parseSegmento(
  values: unknown[][], planilhaAba: string, segmento: Segmento, colFim: number, ano: number,
): { linhas: GastoComercialImportado[]; avisos: string[] } {
  const linhas: GastoComercialImportado[] = []
  const avisos: string[] = []
  const { colInicio } = segmento

  let projetoAtual: string | null = null
  let colunas: ColunasBloco | null = null

  for (let r = 0; r < values.length; r++) {
    const row = (values[r] as unknown[]) ?? []
    if (linhaVaziaNoSegmento(row, colInicio, colFim)) continue

    // Linha de título de projeto: só uma célula preenchida no intervalo do segmento
    // (célula "mesclada" na planilha real — só a primeira coluna da mescla tem valor).
    const preenchidas = []
    for (let c = colInicio; c <= colFim; c++) {
      const v = parseStr(row[c])
      if (v) preenchidas.push({ col: c, valor: v })
    }
    if (preenchidas.length === 1) {
      const { valor: texto } = preenchidas[0]
      const n = norm(texto)
      const pareceData = /^\d{1,2}\/\/?\d{1,2}(\/\d{2,4})?$/.test(texto.trim())
      if (n !== 'CUSTO' && !n.startsWith('TOTAL') && !pareceData) {
        projetoAtual = texto
        colunas = null
        continue
      }
    }

    if (norm(getCell(row, colInicio)) === 'CUSTO') {
      colunas = detectarColunasBloco(row, colInicio, colFim)
      if (!colunas) avisos.push(`Aba "${planilhaAba}" (${segmento.nome}), linha ${r + 1}: cabeçalho de bloco incompleto.`)
      continue
    }

    if (!projetoAtual || !colunas) continue

    const dataCell = parseStr(getCell(row, colunas.data))
    if (norm(dataCell).startsWith('TOTAL') || norm(getCell(row, colunas.valor)).startsWith('TOTAL')) {
      projetoAtual = null
      colunas = null
      continue
    }

    const dataIso = dataCell ? parseDataBR(dataCell, ano) : null
    const valor = parseNum(getCell(row, colunas.valor))
    const fornecedor = parseStr(getCell(row, colunas.fornecedor)) || null
    if (!dataIso || valor === null) continue // linha sem data ou sem valor não é um lançamento cruzável
    if (!dataIso.startsWith(`${ano}-`)) continue // fora do ano-alvo da conciliação

    const categoria = parseStr(getCell(row, colInicio)) || null
    const reuniao = colunas.reuniao >= 0 ? (parseStr(getCell(row, colunas.reuniao)) || null) : null
    const responsavel = parseStr(getCell(row, colunas.responsavel)) || null
    const { portadorRaw, portador, foraDoCartao, aviso } = normalizarPortadorComercial(getCell(row, colunas.cartao))
    if (aviso) avisos.push(`Aba "${planilhaAba}" (${segmento.nome}), projeto "${projetoAtual}", linha ${r + 1}: ${aviso}`)

    linhas.push({
      planilhaAba,
      segmento: segmento.nome,
      projeto: projetoAtual,
      categoria,
      reuniao,
      data: dataIso,
      valor,
      fornecedor,
      responsavel,
      portadorRaw,
      portador,
      foraDoCartao,
      chaveNatural: hashChave([planilhaAba, segmento.nome, projetoAtual, categoria, dataIso, valor, fornecedor, r]),
    })
  }

  return { linhas, avisos }
}

export function parseAbaComercial(
  nomeAba: string, values: unknown[][], ano: number,
): { linhas: GastoComercialImportado[]; avisos: string[] } | null {
  const segmentos = encontrarSegmentos(values)
  if (segmentos.length === 0) return null // aba sem marcador Ensino Superior/Médio (ex: "TOTAL ANO") — não é aba de dados

  const linhas: GastoComercialImportado[] = []
  const avisos: string[] = []
  for (let i = 0; i < segmentos.length; i++) {
    const proximo = segmentos[i + 1]
    // Fim do segmento: coluna antes do próximo segmento (deixando a coluna separadora
    // em branco de fora), ou +8 colunas (mesma largura observada) se for o último.
    const colFim = proximo ? proximo.colInicio - 2 : segmentos[i].colInicio + 8
    const resultado = parseSegmento(values, nomeAba, segmentos[i], colFim, ano)
    linhas.push(...resultado.linhas)
    avisos.push(...resultado.avisos)
  }
  return { linhas, avisos }
}

export async function sincronizarCartaoComercial(
  spreadsheetId: string,
  accessToken: string,
): Promise<{ linhas: GastoComercialImportado[]; avisos: string[] }> {
  const nomesAbas = await fetchSheetNames(spreadsheetId, accessToken)

  // Ano-alvo vem do título da planilha ("Despesas Comerciais 2026"); cai no mesmo
  // padrão de ANO_CONCILIACAO do parser da planilha geral se não achar.
  let ano = ANO_CONCILIACAO
  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (metaResp.ok) {
    const meta = await metaResp.json() as { properties?: { title?: string } }
    const m = meta.properties?.title?.match(/\d{4}/)
    if (m) ano = parseInt(m[0], 10)
  }

  const linhas: GastoComercialImportado[] = []
  const avisos: string[] = []
  for (const nomeAba of nomesAbas) {
    const values = await fetchAba(spreadsheetId, nomeAba, accessToken)
    if (!values || values.length === 0) continue
    const resultado = parseAbaComercial(nomeAba, values, ano)
    if (!resultado) continue
    linhas.push(...resultado.linhas)
    avisos.push(...resultado.avisos)
  }

  return { linhas, avisos }
}
