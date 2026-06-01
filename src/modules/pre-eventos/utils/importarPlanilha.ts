import * as XLSX from 'xlsx'
import type { Orcamento, ItemOrcamento } from '../types'

export type SecaoKey = 'operacaoEstrutura' | 'equipe' | 'atracao' | 'abBebidas' | 'extras'

export const SECAO_LABELS: Record<SecaoKey, string> = {
  operacaoEstrutura: 'Operação / Estrutura',
  equipe: 'Equipe',
  atracao: 'Atração',
  abBebidas: 'A&B',
  extras: 'Extras',
}

export interface ItemImportado {
  secao: SecaoKey
  nome: string
  qtde: number
  custoUnitario: number
  status: 'PENDENTE' | 'CONTRATADO' | 'PAGO'
  notas: string
  matchId?: string
}

export interface ResultadoImportacao {
  reconhecidos: ItemImportado[]
  naoReconhecidos: ItemImportado[]
}

const SECAO_KEYWORDS: [string, SecaoKey][] = [
  ['OPERAÇ', 'operacaoEstrutura'],
  ['OPERAC', 'operacaoEstrutura'],
  ['ESTRUTURA', 'operacaoEstrutura'],
  ['EQUIPE', 'equipe'],
  ['ATRAÇ', 'atracao'],
  ['ATRAC', 'atracao'],
  ['A&B', 'abBebidas'],
  ['ALIMENTOS', 'abBebidas'],
  ['BEBIDAS', 'abBebidas'],
  ['EXTRAS', 'extras'],
]

function detectSecao(text: string): SecaoKey | null {
  const upper = text.toUpperCase().trim()
  for (const [kw, sec] of SECAO_KEYWORDS) {
    if (upper.includes(kw)) return sec
  }
  return null
}

function parseStatus(s: string): 'PENDENTE' | 'CONTRATADO' | 'PAGO' {
  const u = (s ?? '').toUpperCase().trim()
  if (u.includes('PAGO') || u === 'P') return 'PAGO'
  if (u.includes('CONTRAT') || u === 'C') return 'CONTRATADO'
  return 'PENDENTE'
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function parsearPlanilha(buffer: ArrayBuffer, orc: Orcamento): ResultadoImportacao {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })

  let headerRowIdx = -1
  let colItem = 0, colQtde = -1, colCusto = -1, colStatus = -1, colNotes = -1

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i].map(c => String(c).toUpperCase().trim())
    const iIdx = row.findIndex(c => c === 'ITEM' || c.startsWith('ITEM'))
    const qIdx = row.findIndex(c => c.includes('QTDE') || c.startsWith('QTD'))
    const cIdx = row.findIndex(c => c.includes('CUSTO') && c.includes('UNIT'))
    if (iIdx >= 0 && qIdx >= 0 && cIdx >= 0) {
      headerRowIdx = i
      colItem = iIdx
      colQtde = qIdx
      colCusto = cIdx
      colStatus = row.findIndex(c => c.includes('STATUS'))
      colNotes = row.findIndex(c => c.includes('ESPEC') || c.includes('NOTA') || c.includes('OBS'))
      break
    }
  }

  if (headerRowIdx === -1) return { reconhecidos: [], naoReconhecidos: [] }

  let currentSecao: SecaoKey = 'operacaoEstrutura'
  const reconhecidos: ItemImportado[] = []
  const naoReconhecidos: ItemImportado[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const itemText = String(row[colItem] ?? '').trim()
    if (!itemText) continue

    const sec = detectSecao(itemText)
    if (sec) { currentSecao = sec; continue }

    const qtde = Number(row[colQtde]) || 0
    const custo = Number(row[colCusto]) || 0
    if (qtde === 0 && custo === 0) continue

    const status = colStatus >= 0 ? parseStatus(String(row[colStatus] ?? '')) : 'PENDENTE'
    const notas = colNotes >= 0 ? String(row[colNotes] ?? '') : ''

    const sectionItems = orc[currentSecao] as ItemOrcamento[]
    const match = sectionItems.find(it => normalize(it.item) === normalize(itemText))

    const entry: ItemImportado = {
      secao: currentSecao,
      nome: itemText,
      qtde,
      custoUnitario: custo,
      status,
      notas,
      matchId: match?.id,
    }

    if (match) {
      reconhecidos.push(entry)
    } else {
      naoReconhecidos.push(entry)
    }
  }

  return { reconhecidos, naoReconhecidos }
}
