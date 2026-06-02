import * as XLSX from 'xlsx'
import type { Projeto, SecaoCusto, ItemCusto, TAP, TipoEscola, StatusItem, StatusPagamento, TipoCusto, DivergenciaDetalhe, Receitas } from '../types'
import { v4 as uuid } from './uuid'
import { getSecoesPorTipo } from '../data/secoesPorTipo'
import { emptyReceitas } from './calculos'

const MAPA_SECOES: Record<string, string> = {
  'custo producao': '2.1',
  'custo produção': '2.1',
  'custo artistico': '2.2',
  'custo artístico': '2.2',
  'custo equipe': '2.3',
  'custo bar': '2.4',
  'custo bar&food': '2.4',
  'custo bar food': '2.4',
  'custo bar & food': '2.4',
  'custo pré-eventos': '2.5',
  'custo pre-eventos': '2.5',
  'custo pre eventos': '2.5',
  'cerimonia religiosa': 'cerimonia',
  'cerimônia religiosa': 'cerimonia',
  'custo cerimonia': 'cerimonia',
  'custo cerimônia': 'cerimonia',
  'colacao de grau': 'colacao',
  'colação de grau': 'colacao',
  'custo colacao': 'colacao',
  'custo colação': 'colacao',
  'custos administrativos': 'admin',
  'custo administrativo': 'admin',
  'custos admin': 'admin',
  'meio medico': '2.9',
  'meio médico': '2.9',
}

function normalizarNomeAba(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectarTipoEscola(sheetNames: string[], tapData: Record<string, unknown>): TipoEscola {
  const temPreEventos = sheetNames.some((n) => {
    const norm = normalizarNomeAba(n)
    return norm.includes('pre-event') || norm.includes('pre event') || norm.includes('pre evento')
  })
  if (temPreEventos) return 'SUPERIOR'

  const tipoEnsino = String(tapData['Tipo de Ensino'] ?? tapData['tipoEscola'] ?? '').toLowerCase()
  if (tipoEnsino.includes('superior') || tipoEnsino.includes('faculdade')) return 'SUPERIOR'
  if (tipoEnsino.includes('fundamental') || tipoEnsino.includes('9')) return 'FUNDAMENTAL'
  return 'MEDIO'
}

function parseCodigo(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (raw instanceof Date) {
    const yr = raw.getFullYear()
    const mo = raw.getMonth() + 1
    const dy = raw.getDate()
    const s = yr - 2008
    return `2.${s}.${mo}.${dy}`
  }
  if (typeof raw === 'number') {
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000))
    const yr = date.getUTCFullYear()
    const mo = date.getUTCMonth() + 1
    const dy = date.getUTCDate()
    const s = yr - 2008
    return `2.${s}.${mo}.${dy}`
  }
  return fallback
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(',', '.').replace(/[^\d.-]/g, ''))
    return isNaN(n) ? 0 : n
  }
  return 0
}

function parseStatus(val: unknown): StatusItem {
  const s = String(val ?? '').toLowerCase().trim()
  if (s === 'orçar' || s === 'orcar') return 'orçar'
  if (s === 'orçando' || s === 'orcando') return 'orçando'
  if (s === 'estimado') return 'estimado'
  if (s === 'fechado') return 'fechado'
  if (s === 'n/a' || s === '') return 'N/A'
  return 'orçar'
}

function parsePgto(val: unknown): StatusPagamento {
  const s = String(val ?? '').toLowerCase().trim()
  if (s === 'pago') return 'pago'
  if (s === 'parcial') return 'parcial'
  if (s === 'em aberto') return 'em aberto'
  return 'N/A'
}

function parseTipoCusto(val: unknown): TipoCusto {
  const s = String(val ?? '').toLowerCase()
  if (s.includes('variável') || s.includes('variavel') || s.includes('var')) return 'Custo Variável'
  return 'Custo Fixo'
}

function detectDiv(qtde: number, unitario: number, totalCelula: number, presente: boolean): boolean {
  if (!presente) return false
  const calc = qtde * unitario
  if (calc === 0) return false
  return Math.abs(calc - totalCelula) > 0.01
}

function isLinhaIgnorar(row: unknown[]): boolean {
  const col1 = String(row[1] ?? '').toLowerCase()
  const col5 = String(row[5] ?? '').trim()
  const ignorarPalavras = ['vendido', 'orçado', 'contratado', 'desvio', 'custo por formando',
    'custo por convidado', 'total', 'subtotal']
  if (ignorarPalavras.some((p) => col1.startsWith(p))) return true
  if (!col5 && !String(row[6] ?? '').trim()) return true
  return false
}

function lerAba(ws: XLSX.WorkSheet, secaoId: string, secaoNome: string): SecaoCusto {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

  let headerRow = -1
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    const col0 = String(row[0] ?? '').toLowerCase()
    if (col0.includes('cód') || col0.includes('cod') || col0.includes('código')) {
      headerRow = i
      break
    }
  }

  const itens: ItemCusto[] = []
  const start = headerRow >= 0 ? headerRow + 1 : 1
  let itemIdx = 1

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => !c)) continue
    if (isLinhaIgnorar(row)) continue

    const item = String(row[5] ?? '').trim()
    if (!item) continue

    const codigo = parseCodigo(row[0], `${secaoId}.${itemIdx++}`)
    const qtdeVendida = parseNum(row[7])
    const valorUnitarioAtual = parseNum(row[8])
    const rawTotalAtual = row[9]
    const totalAtual = parseNum(rawTotalAtual)
    const valorProjetado = parseNum(row[10])  // K — $ Projetado no Tempo (espelho da PO)
    const totalProjetado = parseNum(row[11])  // L — Total Projetado (espelho da PO)
    const qtdeOrcada = parseNum(row[13])
    const valorUnitarioOrcado = parseNum(row[14])
    const rawValorOrcado = row[15]
    const valorOrcado = parseNum(rawValorOrcado)
    const qtdeContratada = parseNum(row[17])
    const valorUnitarioContratado = parseNum(row[18])
    const rawValorContratado = row[19]
    const valorContratado = parseNum(rawValorContratado)

    const divergenciaDetalhe: DivergenciaDetalhe[] = []
    if (detectDiv(qtdeVendida, valorUnitarioAtual, totalAtual, rawTotalAtual !== null && rawTotalAtual !== '')) {
      divergenciaDetalhe.push({ coluna: 'Vendido', qtde: qtdeVendida, unitario: valorUnitarioAtual, totalPlanilha: totalAtual, totalCalculado: qtdeVendida * valorUnitarioAtual })
    }
    if (detectDiv(qtdeOrcada, valorUnitarioOrcado, valorOrcado, rawValorOrcado !== null && rawValorOrcado !== '')) {
      divergenciaDetalhe.push({ coluna: 'Orçado', qtde: qtdeOrcada, unitario: valorUnitarioOrcado, totalPlanilha: valorOrcado, totalCalculado: qtdeOrcada * valorUnitarioOrcado })
    }
    if (detectDiv(qtdeContratada, valorUnitarioContratado, valorContratado, rawValorContratado !== null && rawValorContratado !== '')) {
      divergenciaDetalhe.push({ coluna: 'Contratado', qtde: qtdeContratada, unitario: valorUnitarioContratado, totalPlanilha: valorContratado, totalCalculado: qtdeContratada * valorUnitarioContratado })
    }
    const divergenciaTotais = divergenciaDetalhe.length > 0
    const valorFinal = parseNum(row[26])
    const valorPago = parseNum(row[27])
    const faltaPagar = valorFinal - valorPago

    const jotform: string[] = []
    for (let j = 33; j <= 42 && j < row.length; j++) {
      const jv = String(row[j] ?? '').trim()
      if (jv) jotform.push(jv)
    }

    itens.push({
      id: uuid(),
      codigo,
      area: String(row[1] ?? '').trim(),
      subcategoria: String(row[4] ?? '').trim(),
      item,
      fornecedor: String(row[6] ?? '').trim(),
      tipoCusto: parseTipoCusto(row[3]),
      moscow: String(row[2] ?? '').trim(),
      qtdeVendida,
      valorUnitarioAtual,
      totalAtual,
      valorProjetado,
      totalProjetado,
      qtdeOrcada,
      valorUnitarioOrcado,
      valorOrcado,
      qtdeContratada,
      valorUnitarioContratado,
      valorContratado,
      responsavel: String(row[20] ?? '').trim(),
      status: parseStatus(row[21]),
      statusPagamento: parsePgto(row[24]),
      valorFinal,
      valorPago,
      faltaPagar,
      totalProgramado: parseNum(row[30]),
      emAberto: parseNum(row[31]),
      jotform,
      divergenciaTotais,
      divergenciaDetalhe,
    })
  }

  return { id: uuid(), numero: secaoId, nome: secaoNome, itens }
}

// Normaliza label de célula para matching (remove acentos, lowercase, sem chars especiais)
function normLabel(val: unknown): string {
  return String(val ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Mapeia label de RECEITA (nunca "verba extra" — esses são custos)
function mapLabelReceita(label: string): string | null {
  if (/faturamento/.test(label)) return 'Faturamento Adesões'
  if (/arrecadac/.test(label)) return 'Arrecadação Extra'
  if (/convite.*extra/.test(label) || /venda.*convite/.test(label)) return 'Vendas Convites Extras'
  if (/mesa.*extra/.test(label) || /venda.*mesa/.test(label)) return 'Vendas Mesas Extras'
  if (/receita.*venda/.test(label) || /venda.*baile/.test(label)) return 'Receita Vendas Baile'
  if (/rescis/.test(label)) return 'Receita Rescisões'
  if (/\boutro/.test(label)) return 'Outros'
  return null
}

const SKIP_RESUMO = /^(receita baile|custo total|margem|total geral|resumo)/

// Lê a aba Resumo Geral e retorna receitas + itens de "Verba extra" (custos sem aba própria)
function lerResumoGeral(wb: XLSX.WorkBook): { receitas: Receitas; verbaExtras: ItemCusto[] } {
  const receitas = emptyReceitas()
  const verbaExtras: ItemCusto[] = []

  const sheetName = wb.SheetNames.find((n) => {
    const norm = normalizarNomeAba(n)
    return norm.includes('resumo geral') || norm === 'resumo'
  })
  if (!sheetName) return { receitas, verbaExtras }

  const ws = wb.Sheets[sheetName]
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:Z200')

  // ── "Verba extra": acesso direto por célula (evita problemas de índice de coluna) ──
  let extIdx = 1
  for (let r = range.s.r; r <= range.e.r; r++) {
    // Busca label "Verba extra" em qualquer célula de texto na linha
    let labelFound = ''
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell || cell.t !== 's') continue
      const norm = normLabel(String(cell.v))
      if (/^verba\s*extra/.test(norm)) { labelFound = String(cell.v).trim(); break }
    }
    if (!labelFound) continue

    // Coleta valores numéricos sem formato de percentual (cell.z sem '%')
    const numVals: number[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell || cell.t !== 'n') continue
      if (typeof cell.z === 'string' && cell.z.includes('%')) continue
      const v = cell.v as number
      if (v > 0) numVals.push(v)
    }
    if (numVals.length === 0) continue

    // Maior valor = orçado; segundo maior = vendido (se houver)
    const sorted = [...numVals].sort((a, b) => b - a)
    const orcado = sorted[0]
    const vendido = sorted[1] ?? 0

    verbaExtras.push({
      id: uuid(),
      codigo: `ext.${extIdx++}`,
      area: '',
      subcategoria: 'Verbas Extras',
      item: labelFound,
      fornecedor: '',
      tipoCusto: 'Custo Variável',
      moscow: '',
      qtdeVendida: vendido > 0 ? 1 : 0,
      valorUnitarioAtual: vendido,
      totalAtual: vendido,
      valorProjetado: vendido,
      totalProjetado: vendido,
      qtdeOrcada: orcado > 0 ? 1 : 0,
      valorUnitarioOrcado: orcado,
      valorOrcado: orcado,
      qtdeContratada: 0,
      valorUnitarioContratado: 0,
      valorContratado: 0,
      responsavel: '',
      status: 'orçar',
      statusPagamento: 'N/A',
      valorFinal: 0,
      valorPago: 0,
      faltaPagar: 0,
      totalProgramado: 0,
      emAberto: 0,
      jotform: [],
    })
  }

  // ── Receitas: sheet_to_json com detecção de colunas ──
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]
  let vendidoCol = 3
  let orcadoCol = 8
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i]
    for (let j = 0; j < row.length; j++) {
      const c = normLabel(row[j])
      if (c === 'vendido') vendidoCol = j
      if (c === 'orcado' || c === 'orcamento') orcadoCol = j
    }
  }
  for (const row of rows) {
    const label = (typeof row[1] === 'string' ? normLabel(row[1]) : '') ||
                  (typeof row[0] === 'string' ? normLabel(row[0]) : '')
    if (!label || SKIP_RESUMO.test(label) || /^verba\s*extra/.test(label)) continue
    const field = mapLabelReceita(label)
    if (!field) continue
    const vendido = parseNum(row[vendidoCol])
    const orcado = parseNum(row[orcadoCol])
    if (vendido === 0 && orcado === 0) continue
    receitas[field] ??= { vendido: 0, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 }
    receitas[field].vendido += vendido
    receitas[field].orcado += orcado
  }

  return { receitas, verbaExtras }
}

function lerTAP(ws: XLSX.WorkSheet): Partial<TAP> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  const map: Record<string, unknown> = {}
  for (const row of rows) {
    const key = String(row[0] ?? '').trim()
    const val = row[1]
    if (key) map[key] = val
  }

  return {
    instituicao: String(map['Instituição'] ?? map['Instituicao'] ?? map['Escola'] ?? ''),
    curso: String(map['Curso'] ?? map['curso'] ?? ''),
    turma: String(map['Turma'] ?? ''),
    anoOrcamento: parseNum(map['Ano Orçamento'] ?? map['Ano do Orçamento'] ?? new Date().getFullYear()),
    anoRealizacao: parseNum(map['Ano de Realização'] ?? map['Ano Realização'] ?? new Date().getFullYear() + 1),
    qtdFormandos: parseNum(map['Qtd. Formandos'] ?? map['Qtd Formandos'] ?? map['Formandos'] ?? 0),
    adesoesPrevistas: parseNum(map['Adesões Previstas'] ?? 0),
    qtdConvidadosBaile: parseNum(map['Qtd Convidados Baile'] ?? 0),
    qtdConvidadosPosBaile: parseNum(map['Qtd Convidados Pós-Baile'] ?? 0),
    ipca: parseNum(map['IPCA'] ?? 0.0594),
    parcelas: parseNum(map['Parcelas'] ?? 12),
    dataEvento: String(map['Data do Evento'] ?? map['Data Evento'] ?? ''),
    local: String(map['Local'] ?? ''),
    modeloContrato: String(map['Modelo de Contrato'] ?? ''),
    tempoContrato: String(map['Tempo de Contrato'] ?? ''),
    tempoDeFesta: String(map['Tempo de Festa'] ?? ''),
    pacoteBase: String(map['Pacote Base'] ?? ''),
  }
}

export interface DivergenciaItem {
  secaoNome: string
  item: string
  codigo: string
  divergenciaDetalhe: DivergenciaDetalhe[]
}

export interface ImportResult {
  projeto: Projeto
  avisos: string[]
  divergencias: DivergenciaItem[]
  totalDivergencias: number
}

export function importarXlsx(buffer: ArrayBuffer, nomeArquivo: string): ImportResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const avisos: string[] = []

  // Ler TAP
  const tapSheetName = wb.SheetNames.find((n) =>
    normalizarNomeAba(n).includes('tap') || normalizarNomeAba(n).includes('termo'),
  )
  let tapParcial: Partial<TAP> = {}
  if (tapSheetName) {
    tapParcial = lerTAP(wb.Sheets[tapSheetName])
  } else {
    avisos.push('Aba TAP não encontrada — usando valores padrão.')
  }

  const tipoEscola = detectarTipoEscola(wb.SheetNames, tapParcial as Record<string, unknown>)
  const definicoes = getSecoesPorTipo(tipoEscola)

  const ipca = tapParcial.ipca ?? 0.0594
  const parcelas = tapParcial.parcelas ?? 12

  // Mapear abas de custo
  const secoesMap: Map<string, SecaoCusto> = new Map()

  for (const sheetName of wb.SheetNames) {
    const norm = normalizarNomeAba(sheetName)
    let chaveSecao: string | undefined

    // Tentar match direto
    for (const [pattern, id] of Object.entries(MAPA_SECOES)) {
      const normPattern = normalizarNomeAba(pattern)
      if (norm.includes(normPattern) || normPattern.includes(norm)) {
        chaveSecao = id
        break
      }
    }

    if (!chaveSecao) continue

    // Resolver número real da seção pelo tipo escola
    let numeroReal = chaveSecao
    if (chaveSecao === 'cerimonia') {
      const def = definicoes.find((d) => d.nome.toLowerCase().includes('cerimônia') || d.nome.toLowerCase().includes('cerimonia'))
      numeroReal = def?.numero ?? chaveSecao
    } else if (chaveSecao === 'colacao') {
      const def = definicoes.find((d) => d.nome.toLowerCase().includes('colação') || d.nome.toLowerCase().includes('colacao'))
      numeroReal = def?.numero ?? chaveSecao
    } else if (chaveSecao === 'admin') {
      const def = definicoes.find((d) => d.nome.toLowerCase().includes('admin'))
      numeroReal = def?.numero ?? chaveSecao
    }

    const defSecao = definicoes.find((d) => d.numero === numeroReal)
    const nome = defSecao?.nome ?? sheetName

    const secao = lerAba(wb.Sheets[sheetName], numeroReal, nome)
    secoesMap.set(numeroReal, secao)
  }

  // Garantir todas as seções definidas existem
  const secoes: SecaoCusto[] = definicoes.map((def) => {
    return secoesMap.get(def.numero) ?? { id: uuid(), numero: def.numero, nome: def.nome, itens: [] }
  })

  // Ler Resumo Geral: receitas + verbas extras (custos sem aba própria)
  const { receitas: receitasImportadas, verbaExtras } = lerResumoGeral(wb)
  if (verbaExtras.length > 0) {
    secoes.push({ id: uuid(), numero: 'extras', nome: 'VERBAS EXTRAS', itens: verbaExtras })
  }

  const tap: TAP = {
    instituicao: tapParcial.instituicao ?? '',
    curso: tapParcial.curso ?? '',
    turma: tapParcial.turma ?? '',
    tipoEscola,
    anoOrcamento: tapParcial.anoOrcamento ?? new Date().getFullYear(),
    anoRealizacao: tapParcial.anoRealizacao ?? new Date().getFullYear() + 1,
    modeloContrato: tapParcial.modeloContrato ?? '',
    qtdFormandos: tapParcial.qtdFormandos ?? 0,
    pacoteBase: tapParcial.pacoteBase ?? '',
    adesoesPrevistas: tapParcial.adesoesPrevistas ?? 0,
    qtdConvidadosBaile: tapParcial.qtdConvidadosBaile ?? 0,
    qtdConvidadosPosBaile: tapParcial.qtdConvidadosPosBaile ?? 0,
    ipca,
    parcelas,
    tempoContrato: tapParcial.tempoContrato ?? '',
    tempoDeFesta: tapParcial.tempoDeFesta ?? '',
    pacotes: [],
    dataEvento: tapParcial.dataEvento ?? '',
    local: tapParcial.local ?? '',
  }

  const projeto: Projeto = {
    id: uuid(),
    tap,
    secoes,
    receitas: receitasImportadas,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    importadoDe: nomeArquivo,
    status: 'em_andamento',
  }

  const divergencias: DivergenciaItem[] = secoes.flatMap((sec) =>
    sec.itens
      .filter((i) => i.divergenciaTotais)
      .map((i) => ({
        secaoNome: sec.nome,
        item: i.item,
        codigo: i.codigo,
        divergenciaDetalhe: i.divergenciaDetalhe ?? [],
      })),
  )

  return { projeto, avisos, divergencias, totalDivergencias: divergencias.length }
}
