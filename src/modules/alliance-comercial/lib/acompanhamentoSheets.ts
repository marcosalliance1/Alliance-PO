import { fetchSheetNames, fetchAba } from '../../../utils/sheetsSync'
import type { TipoEscola } from '../../../types'
import {
  type AcompanhamentoComercial, type RCAInfo, type MetaSegmento, type MetaTotal,
  type ComissaoResumo, type LinhaCaptacao, metaSegmentoVazia, metaTotalVazia,
} from '../types/acompanhamento'

// Helpers duplicados de src/utils/sheetsSync.ts (não são exportados de lá, e essa
// planilha não é por-projeto — não faz sentido estender o parser existente).
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  const erros = ['#ref!', '#n/a', '#value!', '#div/0!']
  if (erros.some((e) => s.toLowerCase().includes(e))) return ''
  return s
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (typeof val === 'string') {
    const cleaned = val
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function getCell(values: unknown[][], row: number, col: number): unknown {
  if (col < 0) return null
  return (values[row] as unknown[] | undefined)?.[col] ?? null
}

// Busca em toda a planilha por um rótulo (célula cujo texto normalizado satisfaz
// `match`) e retorna a célula `offset` colunas à direita, na mesma linha.
function valorAposRotulo(values: unknown[][], match: (labelNorm: string) => boolean, offset = 1): unknown {
  for (const row of values as unknown[][]) {
    for (let c = 0; c < row.length; c++) {
      if (match(norm(parseStr(row[c])))) return row[c + offset] ?? null
    }
  }
  return null
}

function parseRCAInfo(values: unknown[][]): RCAInfo {
  return {
    nome: parseStr(valorAposRotulo(values, (l) => l.includes('rca') && l.includes('nome'))),
    nivel: parseStr(valorAposRotulo(values, (l) => l.includes('nivel') && l.includes('cca'))),
    comissaoPadraoPercentual: parseNum(valorAposRotulo(values, (l) =>
      l.includes('comissao') && l.includes('contrato') && l.includes('fechado') && !l.includes('coordenador'))),
    comissaoCoordenadorPercentual: parseNum(valorAposRotulo(values, (l) =>
      l.includes('comissao') && l.includes('contrato') && l.includes('fechado') && l.includes('coordenador'))),
    comissao01Percentual: parseNum(valorAposRotulo(values, (l) => l.startsWith('comissao 01'))),
    comissao02Percentual: parseNum(valorAposRotulo(values, (l) => l.startsWith('comissao 02'))),
  }
}

// "META E.M." → norm() remove os pontos → "meta e m". Cada rótulo de meta/captado/
// pendente termina com o sufixo do segmento — sem colisão com "META ANO"/"SUPER META
// ANO" do Bloco 3, que não terminam em "e m"/"e s"/"e f".
const SUFIXO_SEGMENTO: { sufixo: string; tipo: TipoEscola }[] = [
  { sufixo: 'e m', tipo: 'MEDIO' },
  { sufixo: 'e s', tipo: 'SUPERIOR' },
  { sufixo: 'e f', tipo: 'FUNDAMENTAL' },
]

function segmentoDoRotulo(labelNorm: string): TipoEscola | null {
  return SUFIXO_SEGMENTO.find(({ sufixo }) => labelNorm.endsWith(sufixo))?.tipo ?? null
}

function parseMetasPorSegmento(values: unknown[][]): Record<TipoEscola, MetaSegmento> {
  const resultado: Record<TipoEscola, MetaSegmento> = {
    SUPERIOR: metaSegmentoVazia(), MEDIO: metaSegmentoVazia(), FUNDAMENTAL: metaSegmentoVazia(),
  }
  for (const row of values as unknown[][]) {
    for (let c = 0; c < row.length; c++) {
      const label = norm(parseStr(row[c]))
      if (!label) continue
      const tipo = segmentoDoRotulo(label)
      if (!tipo) continue
      const valor = parseNum(row[c + 1])
      const percentual = parseNum(row[c + 2])
      if (label.startsWith('meta')) {
        resultado[tipo].meta = valor
        resultado[tipo].metaPercentual = percentual
      } else if (label.startsWith('captado')) {
        resultado[tipo].captado = valor
        resultado[tipo].captadoPercentual = percentual
      } else if (label.startsWith('pendente')) {
        resultado[tipo].pendente = valor
        resultado[tipo].pendentePercentual = percentual
      }
    }
  }
  return resultado
}

// "META ANO" e "SUPER META ANO" repetem os mesmos sub-rótulos ("TOTAL CAPTADO",
// "PENDENTE", "PORCENTAGEM %") empilhados um bloco depois do outro — varredura
// sequencial com "grupo atual" resolve a ambiguidade sem precisar de posição fixa.
function parseTotais(values: unknown[][]): { metaAno: MetaTotal; superMetaAno: MetaTotal } {
  const metaAno = metaTotalVazia()
  const superMetaAno = metaTotalVazia()
  let atual: MetaTotal | null = null
  for (const row of values as unknown[][]) {
    for (let c = 0; c < row.length; c++) {
      const label = norm(parseStr(row[c]))
      if (!label) continue
      if (label === 'super meta ano') {
        atual = superMetaAno
        atual.meta = parseNum(row[c + 1])
        continue
      }
      if (label === 'meta ano') {
        atual = metaAno
        atual.meta = parseNum(row[c + 1])
        continue
      }
      if (!atual) continue
      if (label === 'total captado') atual.captado = parseNum(row[c + 1])
      else if (label === 'pendente') atual.pendente = parseNum(row[c + 1])
      else if (label.startsWith('porcentagem')) atual.percentual = parseNum(row[c + 1])
    }
  }
  return { metaAno, superMetaAno }
}

function parseComissaoResumo(values: unknown[][]): ComissaoResumo {
  return {
    potencial100: parseNum(valorAposRotulo(values, (l) => l.includes('comissao') && l.includes('potencial'))),
    comMetaBatida: parseNum(valorAposRotulo(values, (l) => l.includes('comissao') && l.includes('meta') && l.includes('batida'))),
    totalNoAno: parseNum(valorAposRotulo(values, (l) => l.includes('comissao') && l.includes('total') && l.includes('ano'))),
    mediaMes: parseNum(valorAposRotulo(values, (l) => l.includes('media') && l.includes('comissao'))),
    ultimaAtualizacao: parseStr(valorAposRotulo(values, (l) => l.includes('ultima') && l.includes('atualizacao'))) || null,
  }
}

function segmentoDoTituloCaptacao(tituloNorm: string): TipoEscola | null {
  if (tituloNorm.includes('medio')) return 'MEDIO'
  if (tituloNorm.includes('superior')) return 'SUPERIOR'
  if (tituloNorm.includes('fundamental') || tituloNorm.includes('9')) return 'FUNDAMENTAL'
  return null
}

interface ColMapCaptacao {
  instituicao: number
  inicio: number
  metaAdesoes: number
  adesoesAtuais: number
  pacoteBase: number
  totalPacote: number
  comissao01: number
  comissao02: number
  totalComissao: number
  responsavel: number
  comissaoRecebida: number
}

// O cabeçalho da tabela pode estar em qualquer uma das linhas logo abaixo do título
// da seção — âncora em COLÉGIO/FACULDADE + Responsável (colunas bem distantes,
// improvável colidir com outro texto solto na planilha).
function detectarHeaderCaptacao(values: unknown[][], startRow: number): { headerRow: number; cols: ColMapCaptacao } | null {
  for (let r = startRow; r < Math.min(startRow + 6, values.length); r++) {
    const row = (values[r] as unknown[]) ?? []
    const norms = row.map((c) => norm(parseStr(c)))
    const instituicao = norms.findIndex((n) => n.includes('colegio') || n.includes('faculdade'))
    const responsavel = norms.findIndex((n) => n.includes('responsavel'))
    if (instituicao === -1 || responsavel === -1) continue

    const pacoteBase = norms.findIndex((n) => n.includes('pacote') && n.includes('base'))
    const comissao01 = norms.findIndex((n) => n.includes('comissao') && n.includes('01'))
    const comissao02 = norms.findIndex((n) => n.includes('comissao') && n.includes('02'))
    const totalIdxs: number[] = []
    norms.forEach((n, i) => { if (n === 'total') totalIdxs.push(i) })
    // Duas colunas "TOTAL": a primeira depois de Pacote Base (total do pacote), a
    // segunda depois de Comissão 02 (total das comissões).
    const totalPacote = totalIdxs.find((i) => i > pacoteBase) ?? totalIdxs[0] ?? -1
    const totalComissao = totalIdxs.find((i) => i > comissao02 && i !== totalPacote) ?? totalIdxs[totalIdxs.length - 1] ?? -1

    return {
      headerRow: r,
      cols: {
        instituicao,
        inicio: norms.findIndex((n) => n.includes('inicio') && n.includes('adesoes')),
        metaAdesoes: norms.findIndex((n) => n.includes('meta') && n.includes('adesoes')),
        adesoesAtuais: norms.findIndex((n) => n.includes('adesoes') && n.includes('atua')),
        pacoteBase,
        totalPacote,
        comissao01,
        comissao02,
        totalComissao,
        responsavel,
        comissaoRecebida: norms.findIndex((n) => n.includes('comissao') && n.includes('receb')),
      },
    }
  }
  return null
}

function parseLinhasCaptacao(values: unknown[][], headerRow: number, cols: ColMapCaptacao): LinhaCaptacao[] {
  const linhas: LinhaCaptacao[] = []
  for (let r = headerRow + 1; r < values.length; r++) {
    const instituicaoRaw = parseStr(getCell(values, r, cols.instituicao))
    if (!instituicaoRaw) break
    const instituicaoNorm = norm(instituicaoRaw)
    if (instituicaoNorm.startsWith('captacao')) break
    if (instituicaoNorm.includes('total') || instituicaoNorm.includes('subtotal')) continue
    linhas.push({
      instituicao: instituicaoRaw,
      inicioAdesoes: parseStr(getCell(values, r, cols.inicio)),
      metaAdesoes: parseNum(getCell(values, r, cols.metaAdesoes)),
      adesoesAtuais: parseNum(getCell(values, r, cols.adesoesAtuais)),
      pacoteBase: parseNum(getCell(values, r, cols.pacoteBase)),
      total: parseNum(getCell(values, r, cols.totalPacote)),
      comissao01: parseNum(getCell(values, r, cols.comissao01)),
      comissao02: parseNum(getCell(values, r, cols.comissao02)),
      totalComissao: parseNum(getCell(values, r, cols.totalComissao)),
      responsavel: parseStr(getCell(values, r, cols.responsavel)),
      comissaoRecebida: parseStr(getCell(values, r, cols.comissaoRecebida)),
    })
  }
  return linhas
}

function parseCaptacaoPorSegmento(values: unknown[][]): Record<TipoEscola, LinhaCaptacao[]> {
  const resultado: Record<TipoEscola, LinhaCaptacao[]> = { SUPERIOR: [], MEDIO: [], FUNDAMENTAL: [] }
  for (let r = 0; r < values.length; r++) {
    const row = (values[r] as unknown[]) ?? []
    for (let c = 0; c < row.length; c++) {
      const label = norm(parseStr(row[c]))
      if (!label.startsWith('captacao')) continue
      const tipo = segmentoDoTituloCaptacao(label)
      if (!tipo) continue
      const header = detectarHeaderCaptacao(values, r + 1)
      if (!header) continue
      resultado[tipo] = parseLinhasCaptacao(values, header.headerRow, header.cols)
      break
    }
  }
  return resultado
}

export function parseAcompanhamentoComercial(values: unknown[][]): Omit<AcompanhamentoComercial, 'spreadsheetId' | 'sincronizadoEm'> {
  const { metaAno, superMetaAno } = parseTotais(values)
  return {
    rca: parseRCAInfo(values),
    metasPorSegmento: parseMetasPorSegmento(values),
    metaAno,
    superMetaAno,
    comissao: parseComissaoResumo(values),
    captacaoPorSegmento: parseCaptacaoPorSegmento(values),
  }
}

function pareceAbaAcompanhamento(nomeAba: string): boolean {
  const n = norm(nomeAba)
  return n.includes('acompanhamento') || n.includes('resumo') || n.includes('comercial')
}

export async function sincronizarAcompanhamento(spreadsheetId: string, accessToken: string): Promise<AcompanhamentoComercial> {
  const sheetNames = await fetchSheetNames(spreadsheetId, accessToken)
  const nomeAba = sheetNames.find(pareceAbaAcompanhamento) ?? sheetNames[0]
  if (!nomeAba) throw new Error('A planilha não tem nenhuma aba.')
  const values = await fetchAba(spreadsheetId, nomeAba, accessToken)
  if (!values) throw new Error(`Não foi possível ler a aba "${nomeAba}".`)
  const parsed = parseAcompanhamentoComercial(values)
  return { ...parsed, spreadsheetId, sincronizadoEm: new Date().toISOString() }
}
