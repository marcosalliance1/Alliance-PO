// Leitura/parsing da planilha "Operacional" de eventos (Drive). Cada ABA = um
// evento/turma. Extraído do src/pages/Operacional.tsx pra reuso no Pré-Eventos.
import { matchCentroCusto } from './matchEverest'
import type { InfoEvento, InfoEventoFornecedor, InfoEventoLineup, FornecedorStatus } from '../types'

export const SHEET_EVENTOS_ID = '1VpA4_lRcZlJ75Qc93VZZZvwW748Xnw-UsmQVCB-tRjc'

// O formato lido da planilha é o MESMO que o salvo no orçamento (InfoEvento).
export type FornecedorEvento = InfoEventoFornecedor
export type LineupItem = InfoEventoLineup
export type EventoDetalhes = InfoEvento

// Abas genéricas a ignorar ao listar eventos.
export const TABS_IGNORAR = new Set([
  'sheet1', 'índice', 'indice', 'index', 'resumo geral', 'resumo',
  'tap', 'simulador', 'simulador de eventos', 'config',
  'configuracoes', 'configurações',
])

const SECOES_CONHECIDAS = new Set([
  'dados do evento', 'dados gerais', 'informacoes gerais', 'informações gerais',
  'fornecedores', 'lineup artistico', 'lineup artístico', 'lineup', 'artistico',
  'numeros da turma', 'números da turma', 'numeros', 'números',
  'links uteis', 'links úteis', 'links', 'cenografia',
])

function nm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}
function cel(row: unknown[], i: number): string { return String(row[i] ?? '').trim() }

function findExact(rows: unknown[][], field: string): string {
  const fieldNorm = nm(field)
  for (const row of rows) if (nm(cel(row, 0)) === fieldNorm) return cel(row, 1) || cel(row, 2) || ''
  return ''
}

function isSecaoConhecida(row: unknown[]): boolean { return SECOES_CONHECIDAS.has(nm(cel(row, 0))) }

function secaoRows(rows: unknown[][], headerLabel: string): unknown[][] {
  let start = -1
  for (let i = 0; i < rows.length; i++)
    if (nm(cel(rows[i], 0)) === nm(headerLabel) && isSecaoConhecida(rows[i])) { start = i + 1; break }
  if (start === -1) return []
  const result: unknown[][] = []
  for (let i = start; i < rows.length; i++) {
    if (isSecaoConhecida(rows[i])) break
    if (cel(rows[i], 0) || cel(rows[i], 1)) result.push(rows[i])
  }
  return result
}

type CanonicalCat = 'Buffet' | 'Bar' | 'Cerveja' | 'Destilados' | 'Japa' | 'Hamburgueria'
// Mapeia o texto de status da planilha ("Contrato ok" / "Contrato a assinar" / …)
// para os 3 estados. Sem texto, cai no status pela presença do fornecedor.
function mapearStatusPlanilha(texto: string, temForn: boolean): FornecedorStatus {
  const n = nm(texto)
  if (n.includes('assinar') || n.includes('aguard') || n.includes('assinatura')) return 'aguardando'
  if (n.includes('ok') || n.includes('fechado') || n.includes('assinado') || n.includes('pago') || n.includes('confirmado')) return 'fechado'
  return temForn ? 'fechado' : 'aberto'
}

function canonicalCat(cat: string): CanonicalCat | null {
  const n = nm(cat)
  if (n.includes('buffet')) return 'Buffet'
  if (n === 'bar' || n.startsWith('bar ')) return 'Bar'
  if (n.includes('cerveja') || n.includes('chopp')) return 'Cerveja'
  if (n.includes('destilados')) return 'Destilados'
  if (n.includes('japa') || n.includes('japonesa')) return 'Japa'
  if (n.includes('hamburguer') || n.includes('burger') || n.includes('hamburgueria')) return 'Hamburgueria'
  return null
}

export function parseEventoDetalhes(rows: unknown[][], tabName: string): EventoDetalhes {
  const nomeEvento = cel(rows[0] ?? [], 0) || cel(rows[0] ?? [], 1) || tabName.split('|')[0].trim()

  const tipo = findExact(rows, 'Pré Evento')
  const linkVendaRaw = findExact(rows, 'Link de venda')

  const isBaile = nm(tipo).includes('baile') || nm(tabName).includes('baile')
  const BASE_CATS: CanonicalCat[] = ['Buffet', 'Bar', 'Cerveja', 'Destilados', 'Japa']
  const CATS: CanonicalCat[] = isBaile ? [...BASE_CATS, 'Hamburgueria'] : BASE_CATS

  const fornMap: Partial<Record<CanonicalCat, FornecedorEvento>> = {}
  for (const row of secaoRows(rows, 'Fornecedores')) {
    const canon = canonicalCat(cel(row, 0))
    if (!canon || fornMap[canon]) continue
    const fornecedor = cel(row, 1)
    const nForn = nm(fornecedor)
    const temForn = !!fornecedor && fornecedor !== '-' && fornecedor !== '—'
      && nForn !== 'nao tem' && nForn !== 'nao' && nForn !== 'nao ha' && fornecedor.length > 1
    const statusTexto = cel(row, 2) || cel(row, 3)
    fornMap[canon] = {
      categoria: canon,
      fornecedor: temForn ? fornecedor : '',
      status: mapearStatusPlanilha(statusTexto, temForn),
    }
  }
  const fornecedores = CATS.map(cat => fornMap[cat] ?? { categoria: cat, fornecedor: '', status: 'aberto' as const })

  let lineupSection = secaoRows(rows, 'Lineup Artístico')
  if (lineupSection.length === 0) lineupSection = secaoRows(rows, 'Artístico')
  if (lineupSection.length === 0) lineupSection = secaoRows(rows, 'Lineup')

  const lineup: LineupItem[] = []
  let passedHeader = false
  for (const row of lineupSection) {
    const a = nm(cel(row, 0)), b = nm(cel(row, 1))
    if ((a.includes('horario') || a.includes('hora')) && (b.includes('artista') || b.includes('atracao'))) { passedHeader = true; continue }
    const artista = cel(row, 1) || cel(row, 0)
    if (!artista || (!passedHeader && !cel(row, 0))) continue
    passedHeader = true
    const obsL = cel(row, 2) || cel(row, 3) || ''
    lineup.push({ horario: cel(row, 0), artista, obs: obsL, status: mapearStatusPlanilha(obsL, false) })
  }

  return {
    nomeEvento, tipo,
    data:            findExact(rows, 'Data'),
    diaSemana:       findExact(rows, 'Dia da semana'),
    local:           findExact(rows, 'Local'),
    horario:         findExact(rows, 'Horário'),
    tematica:        findExact(rows, 'Temática'),
    totalConvidados: findExact(rows, 'Total de convidados'),
    formandos:       findExact(rows, 'N° de formandos'),
    pagantes:        findExact(rows, 'N° de formandos pagantes'),
    bolsaFolia:      findExact(rows, 'Bolsa Folia individual'),
    dataAdimplencia: findExact(rows, 'Data para adimplencia'),
    vendaDeConvite:  findExact(rows, 'Venda de Convite'),
    fornecedores, lineup,
    linkVenda: linkVendaRaw.startsWith('http') ? linkVendaRaw : null,
  }
}

// Auto-casa: acha a aba cujo nome contém todos os tokens da turma (ex "CMMG 82"
// casa "CMMG 82 | 18/10"). Reusa o match tolerante do Everest.
export function casarAbaComTurma(tabNames: string[], turma: string): string | null {
  if (!turma.trim()) return null
  return tabNames.find(t => matchCentroCusto(t, turma)) ?? null
}
