import type { Projeto, SecaoCusto, ItemCusto, StatusItem, StatusPagamento, TipoCusto, TAP, TipoEscola, Receitas } from '../types'
import { v4 as uuid } from './uuid'
import { emptyReceitas } from './calculos'

export interface SyncResult {
  secoes: SecaoCusto[]
  tap: Partial<TAP>
  receitas: Partial<Receitas>
  avisos: string[]
}

const MAPA_SECOES: Record<string, string> = {
  'custo producao': '2.1', 'custo produção': '2.1',
  'custo artistico': '2.2', 'custo artístico': '2.2',
  'custo equipe': '2.3',
  'custo bar': '2.4', 'custo bar&food': '2.4', 'custo bar food': '2.4', 'custo bar & food': '2.4',
  'custo pré-eventos': '2.5', 'custo pre-eventos': '2.5', 'custo pre eventos': '2.5',
  'cerimonia religiosa': 'cerimonia', 'cerimônia religiosa': 'cerimonia',
  'custo cerimonia': 'cerimonia', 'custo cerimônia': 'cerimonia',
  'colacao de grau': 'colacao', 'colação de grau': 'colacao',
  'custo colacao': 'colacao', 'custo colação': 'colacao',
  'custos administrativos': 'admin', 'custo administrativo': 'admin',
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function encontrarSecao(nomeAba: string): string | null {
  const n = norm(nomeAba)
  for (const [pattern, id] of Object.entries(MAPA_SECOES)) {
    if (n.includes(norm(pattern))) return id
  }
  return null
}

function encontrarAbaEspecial(nomeAba: string): 'tap' | 'resumo' | null {
  const n = norm(nomeAba)
  if (
    n === 'simulador' || n.includes('simulador de eventos') ||
    n.includes('informacoes gerais') || n.includes('informações gerais') ||
    n.includes('termo de abertura') || n.includes('termo abertura') ||
    (n === 'tap') || (n.startsWith('tap '))
  ) return 'tap'
  if (n === 'resumo geral' || n === 'resumo' || n.includes('resumo geral')) return 'resumo'
  return null
}

function getCell(values: unknown[][], row: number, col: number): unknown {
  return (values[row] as unknown[] | undefined)?.[col] ?? null
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(',', '.').replace(/[^\d.-]/g, ''))
    return isNaN(n) ? 0 : n
  }
  return 0
}

function parseStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  const erros = ['#ref!', '#n/a', '#value!', '#div/0!']
  if (erros.some(e => s.toLowerCase().includes(e))) return ''
  return s
}

function parseCodigo(val: unknown): string {
  if (!val && val !== 0) return ''
  if (typeof val === 'number') {
    if (val > 40000 && val < 50000) {
      const d = new Date((val - 25569) * 86400 * 1000)
      const s = d.getUTCFullYear() - 2008
      return `2.${s}.${d.getUTCMonth() + 1}.${d.getUTCDate()}`
    }
    return String(Math.round(val))
  }
  return String(val).trim()
}

function parseStatus(val: unknown): StatusItem {
  const s = String(val ?? '').toLowerCase().trim()
  if (s === 'orçar' || s === 'orcar') return 'orçar'
  if (s === 'orçando' || s === 'orcando') return 'orçando'
  if (s === 'estimado') return 'estimado'
  if (s === 'fechado') return 'fechado'
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

function parseItens(
  values: unknown[][], _secaoNumero: string, secaoNome: string,
): { itens: ItemCusto[], avisos: string[] } {
  const itens: ItemCusto[] = []
  const avisos: string[] = []
  const INICIO = 8
  const TOLERANCIA = 1.0 // R$ 1,00

  for (let r = INICIO; r < values.length; r++) {
    const get = (c: number) => getCell(values, r, c)

    const subcategoria = parseStr(get(4))
    const item = parseStr(get(5))
    if (!subcategoria && !item) continue

    const codigo = parseCodigo(get(0))
    const area = parseStr(get(1))
    const moscow = parseStr(get(2))
    const tipoCusto = parseTipoCusto(get(3))
    const fornecedor = parseStr(get(6))

    const qtdeVendida = parseNum(get(7))
    const valorUnitarioAtual = parseNum(get(8))
    const totalAtual = qtdeVendida * valorUnitarioAtual
    const valorProjetado = parseNum(get(10))  // K — $ Projetado no Tempo (espelho da PO)
    const totalProjetado = parseNum(get(11))  // L — Total Projetado (espelho da PO)

    const qtdeOrcada = parseNum(get(13))
    const valorUnitarioOrcado = parseNum(get(14))
    const valorOrcado = qtdeOrcada * valorUnitarioOrcado
    // Col 15 = "Valor Orçado" direto na planilha (pode ter fórmula com literais em vez de Qtde × VU)
    const valorOrcadoPlanilha = parseNum(get(15))
    if (valorOrcadoPlanilha > 0 && Math.abs(valorOrcadoPlanilha - valorOrcado) > TOLERANCIA) {
      const nome = item || subcategoria
      avisos.push(`${secaoNome} › ${nome} — Orçado: planilha R$${valorOrcadoPlanilha.toFixed(2).replace('.', ',')} ≠ Qtde×VU R$${valorOrcado.toFixed(2).replace('.', ',')}`)
    }

    const qtdeContratada = parseNum(get(17))
    const valorUnitarioContratado = parseNum(get(18))
    const valorContratado = qtdeContratada * valorUnitarioContratado
    // Col 19 = "Valor Contratado" direto na planilha
    const valorContratadoPlanilha = parseNum(get(19))
    if (valorContratadoPlanilha > 0 && Math.abs(valorContratadoPlanilha - valorContratado) > TOLERANCIA) {
      const nome = item || subcategoria
      avisos.push(`${secaoNome} › ${nome} — Contratado: planilha R$${valorContratadoPlanilha.toFixed(2).replace('.', ',')} ≠ Qtde×VU R$${valorContratado.toFixed(2).replace('.', ',')}`)
    }

    const responsavel = parseStr(get(20))
    const status = parseStatus(get(21))
    const statusPagamento = parsePgto(get(24))
    const valorFinal = parseNum(get(26))
    const valorPago = parseNum(get(27))
    const faltaPagar = valorFinal > 0 ? valorFinal - valorPago : parseNum(get(28))

    itens.push({
      id: uuid(), codigo, area, subcategoria, item, fornecedor, tipoCusto, moscow,
      qtdeVendida, valorUnitarioAtual, totalAtual, valorProjetado, totalProjetado,
      qtdeOrcada, valorUnitarioOrcado, valorOrcado,
      qtdeContratada, valorUnitarioContratado, valorContratado,
      responsavel, status, statusPagamento,
      valorFinal, valorPago, faltaPagar,
      totalProgramado: 0, emAberto: 0, jotform: [],
    })
  }

  return { itens, avisos }
}

// ── TAP from Simulador / Informações Gerais tab ──────────────────────────────
// Scans all cells dynamically — for each label cell, takes the next non-empty
// value to the right (up to 5 columns). Handles any column layout.
export function parseTAPFromSheet(values: unknown[][]): Partial<TAP> {
  const map = new Map<string, unknown>()

  for (let r = 0; r < values.length; r++) {
    const row = (values[r] as unknown[] | undefined) ?? []
    for (let c = 0; c < row.length; c++) {
      const label = parseStr(row[c])
      if (!label || label.length < 3) continue
      for (let d = 1; d <= 5; d++) {
        if (c + d >= row.length) break
        const val = row[c + d]
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          if (!map.has(norm(label))) map.set(norm(label), val)
          break
        }
      }
    }
  }

  function get(labels: string[]): unknown {
    for (const l of labels) {
      const v = map.get(l)
      if (v !== undefined && v !== null && v !== '') return v
    }
    return undefined
  }

  // IPCA: sheet stores as percentage (8.0 = 8%), TAP stores as decimal (0.08)
  let ipca = parseNum(get(['ipca a a', 'ipca aa', 'ipca a.a', 'ipca anual', 'ipca']))
  if (ipca >= 1) ipca = ipca / 100

  const parcelasNum = parseNum(get([
    'tempo de contrato meses', 'tempo de contrato (meses)', 'parcelas', 'tempo contrato meses',
  ]))

  const tempoDeFestaN = parseNum(get(['tempo de festa horas', 'tempo de festa (horas)', 'tempo de festa']))

  const tipoStr = parseStr(get(['tipo de orcamento', 'tipo orcamento', 'tipo de ensino'])).toLowerCase()
  let tipoEscola: TipoEscola = 'MEDIO'
  if (tipoStr.includes('fundamental')) tipoEscola = 'FUNDAMENTAL'
  else if (tipoStr.includes('superior') || tipoStr.includes('faculdade') || tipoStr.includes('universidade')) tipoEscola = 'SUPERIOR'

  // Only include fields that were actually found (non-zero, non-empty)
  // so merging in the caller doesn't overwrite defaults with zeros/empty
  const found: Partial<TAP> = {}

  const instituicao = parseStr(get(['instituicao de ensino', 'instituicao', 'escola']))
  if (instituicao) found.instituicao = instituicao

  const curso = parseStr(get(['curso']))
  if (curso) found.curso = curso

  const anoOrcamento = parseNum(get(['ano do orcamento', 'ano orcamento']))
  if (anoOrcamento) found.anoOrcamento = anoOrcamento

  const anoRealizacao = parseNum(get(['ano realizacao previsto', 'ano realizacao (previsto)', 'ano realizacao']))
  if (anoRealizacao) found.anoRealizacao = anoRealizacao

  if (tipoStr) found.tipoEscola = tipoEscola

  const qtdFormandos = parseNum(get(['total de alunos na turma', 'total alunos na turma', 'qtd formandos', 'formandos']))
  if (qtdFormandos) found.qtdFormandos = qtdFormandos

  const adesoesPrevistas = parseNum(get(['adesoes previstas', 'adesoes']))
  if (adesoesPrevistas) found.adesoesPrevistas = adesoesPrevistas

  const qtdConvidadosBaile = parseNum(get(['qtde de convidados previstos', 'qtde convidados previstos', 'qtd convidados baile']))
  if (qtdConvidadosBaile) found.qtdConvidadosBaile = qtdConvidadosBaile

  const modeloContrato = parseStr(get(['modelo de contrato']))
  if (modeloContrato) found.modeloContrato = modeloContrato

  const pacoteBase = String(get(['pacote base p calculo', 'pacote base para calculo', 'pacote base']) ?? '')
  if (pacoteBase) found.pacoteBase = pacoteBase

  if (tempoDeFestaN) found.tempoDeFesta = `${tempoDeFestaN}h`
  if (parcelasNum) found.parcelas = parcelasNum
  if (ipca) found.ipca = ipca

  return found
}

// ── Receitas from Resumo Geral tab ───────────────────────────────────────────
// Double header: row0=group ("Vendido pelo Comercial", "Orçado", etc.)
//                row1=subcolumn ("Valor", "Qtde", "Falta Pagar", etc.)
// Merged key: norm(group) + ' / ' + norm(subcolumn)
// Stops at "RECEITA BAILE" row (calculated dynamically — not imported).
function parseReceitasFromResumo(values: unknown[][]): Partial<Receitas> {
  type ReceitaKey = keyof Receitas

  // More specific patterns must come before broader ones
  const MAPA: Array<[string, ReceitaKey]> = [
    ['faturamento adesoes', 'faturamentoAdesoes'],
    ['vendas convites extras', 'vendasConvitesExtras'],
    ['vendas mesas extras', 'vendasMesasExtras'],
    ['juros e multas sge', 'arrecadacaoExtra'],
    ['arrecadacao extra', 'arrecadacaoExtra'],
    ['receita vendas baile', 'receitaVendasBaile'],
    ['receita rescisoes', 'receitaRescisoes'],
    ['rescisao', 'receitaRescisoes'],
    ['receita - outros', 'outros'],
    ['outros', 'outros'],
  ]

  // Step 1: find header rows — scan first 15 rows for group-header row
  let headerRow0 = -1
  for (let r = 0; r < Math.min(values.length, 15); r++) {
    const joined = ((values[r] as unknown[]) ?? []).map(c => norm(parseStr(c))).join(' ')
    if (joined.includes('vendido') || joined.includes('orcado')) {
      headerRow0 = r
      break
    }
  }

  // Step 2: build column map from merged (group / subcolumn) headers
  let colVendido = 2
  let colOrcado = 4
  let colContratado = 6
  let colPago = 8
  let colFaltaPagar = 9
  let dataStart = 0

  if (headerRow0 >= 0 && headerRow0 + 1 < values.length) {
    const row0 = (values[headerRow0] as unknown[]) ?? []
    const row1 = (values[headerRow0 + 1] as unknown[]) ?? []
    dataStart = headerRow0 + 2

    let currentGroup = ''
    for (let c = 0; c < Math.max(row0.length, row1.length); c++) {
      const g = parseStr(row0[c] ?? null)
      const s = parseStr(row1[c] ?? null)
      if (g) currentGroup = g
      if (!currentGroup && !s) continue
      const key = s ? `${norm(currentGroup)} / ${norm(s)}` : norm(currentGroup)

      if (key.includes('vendido') && key.includes('valor') && !key.includes('conciliacao')) colVendido = c
      else if (key.includes('orcado') && key.includes('valor') && !key.includes('contratado') && !key.includes('conciliacao')) colOrcado = c
      else if (key.includes('contratado') && key.includes('valor') && !key.includes('conciliacao')) colContratado = c
      else if (key.includes('conciliacao') && key.includes('valor') && !key.includes('falta')) colPago = c
      else if (key.includes('conciliacao') && (key.includes('falta pagar') || key.includes('falta'))) colFaltaPagar = c
    }
  }

  // Step 3: parse data rows
  const parseCell = (r: number, col: number): number => {
    const v = getCell(values, r, col)
    const s = String(v ?? '').trim()
    if (!s || s === '-' || s === '—') return 0
    return parseNum(v)
  }

  const result: Partial<Receitas> = {}

  for (let r = dataStart; r < values.length; r++) {
    let label = norm(parseStr(getCell(values, r, 1)))
    if (!label) label = norm(parseStr(getCell(values, r, 0)))
    if (!label) continue

    // RECEITA BAILE marks the end of the receitas block — computed dynamically, not imported
    if (label.includes('receita baile')) break

    let chave: ReceitaKey | undefined
    for (const [pattern, key] of MAPA) {
      if (label.includes(norm(pattern))) { chave = key; break }
    }
    if (!chave) continue

    const vendido = parseCell(r, colVendido)
    const orcado = parseCell(r, colOrcado)
    const contratado = parseCell(r, colContratado)
    const pago = parseCell(r, colPago)
    const faltaPagar = parseCell(r, colFaltaPagar)

    if (!vendido && !orcado && !contratado && !pago && !faltaPagar) continue

    const existing = result[chave]
    if (existing) {
      result[chave] = {
        vendido: existing.vendido + vendido,
        orcado: existing.orcado + orcado,
        contratado: existing.contratado + contratado,
        pago: existing.pago + pago,
        faltaPagar: existing.faltaPagar + faltaPagar,
      }
    } else {
      result[chave] = { vendido, orcado, contratado, pago, faltaPagar }
    }
  }

  return result
}

async function fetchAba(spreadsheetId: string, nomeAba: string, accessToken: string, rangeSpec?: string): Promise<unknown[][] | null> {
  const rangeParam = rangeSpec ?? nomeAba
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeParam)}?valueRenderOption=UNFORMATTED_VALUE`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (resp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
    ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (resp.status === 403) throw new Error('Sem permissão para acessar esta planilha. Verifique se ela está compartilhada com sua conta.')
  if (resp.status === 404) return null

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao ler planilha (HTTP ${resp.status})`)
  }

  const data = await resp.json() as { values?: unknown[][] }
  return data.values ?? []
}

// ── Ler apenas o TAP de uma planilha (usado no Novo Projeto) ─────────────────
export async function lerTAPDeSheets(
  spreadsheetId: string,
  accessToken: string,
): Promise<Partial<TAP>> {
  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (metaResp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
    ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (metaResp.status === 403) {
    const body = await metaResp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? 'Acesso negado. Verifique se a planilha está compartilhada e se a Google Sheets API está ativada no Google Cloud Console.')
  }
  if (!metaResp.ok) {
    const body = await metaResp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao acessar planilha (HTTP ${metaResp.status})`)
  }

  const meta = await metaResp.json() as { sheets: { properties: { title: string } }[] }
  const sheetNames = meta.sheets.map(s => s.properties.title)

  for (const nome of sheetNames) {
    if (encontrarAbaEspecial(nome) === 'tap') {
      const values = await fetchAba(spreadsheetId, nome, accessToken)
      if (values) return parseTAPFromSheet(values)
    }
  }
  return {}
}

export async function sincronizarComSheets(
  spreadsheetId: string,
  accessToken: string,
  projeto: Projeto,
  onProgress: (msg: string) => void,
): Promise<SyncResult> {
  onProgress('Lendo estrutura da planilha...')

  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (metaResp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
    ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (!metaResp.ok) {
    const body = await metaResp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? 'Não foi possível acessar a planilha. Verifique a URL e as permissões.')
  }

  const meta = await metaResp.json() as { sheets: { properties: { title: string } }[] }
  const sheetNames = meta.sheets.map(s => s.properties.title)

  const novasSecoes = new Map<string, ItemCusto[]>()
  let tapParsed: Partial<TAP> = {}
  let receitasParsed: Partial<Receitas> = {}
  let resumoEncontrado = false
  const avisosItens: string[] = []

  for (const nomeAba of sheetNames) {
    const especial = encontrarAbaEspecial(nomeAba)

    if (especial === 'tap') {
      onProgress(`Lendo TAP (${nomeAba})...`)
      try {
        const values = await fetchAba(spreadsheetId, nomeAba, accessToken)
        if (values) tapParsed = parseTAPFromSheet(values)
      } catch (e) {
        if ((e as Error & { tipo?: string }).tipo === 'TOKEN_EXPIRADO') throw e
        console.warn(`Erro ao ler aba TAP "${nomeAba}":`, e)
      }
      continue
    }

    if (especial === 'resumo') {
      resumoEncontrado = true
      onProgress(`Lendo Resumo Geral (${nomeAba})...`)
      try {
        const values = await fetchAba(spreadsheetId, nomeAba, accessToken, `'${nomeAba}'!A1:Q50`)
        if (values) receitasParsed = parseReceitasFromResumo(values)
      } catch (e) {
        if ((e as Error & { tipo?: string }).tipo === 'TOKEN_EXPIRADO') throw e
        console.warn(`Erro ao ler aba Resumo "${nomeAba}":`, e)
      }
      continue
    }

    const secaoId = encontrarSecao(nomeAba)
    if (!secaoId) continue

    const secaoProjeto = projeto.secoes.find(s =>
      s.numero === secaoId ||
      (secaoId === 'cerimonia' && (s.nome.toLowerCase().includes('cerimônia') || s.nome.toLowerCase().includes('cerimonia'))) ||
      (secaoId === 'colacao' && (s.nome.toLowerCase().includes('colação') || s.nome.toLowerCase().includes('colacao'))) ||
      (secaoId === 'admin' && s.nome.toLowerCase().includes('admin'))
    )
    if (!secaoProjeto) continue

    onProgress(`Lendo ${secaoProjeto.nome} (${secaoProjeto.numero})...`)
    try {
      const values = await fetchAba(spreadsheetId, nomeAba, accessToken)
      if (values) {
        const { itens, avisos: avisosAba } = parseItens(values, secaoProjeto.numero, secaoProjeto.nome)
        novasSecoes.set(secaoProjeto.numero, itens)
        avisosItens.push(...avisosAba)
      }
    } catch (e) {
      if ((e as Error & { tipo?: string }).tipo === 'TOKEN_EXPIRADO') throw e
      console.warn(`Erro ao ler aba "${nomeAba}":`, e)
    }
  }

  // Merge sections: preserve valorPago and items not found in sheet
  const secoesAtualizadas = projeto.secoes.map(secao => {
    const novosItens = novasSecoes.get(secao.numero)
    if (!novosItens) return secao

    const existingMap = new Map<string, ItemCusto>()
    for (const item of secao.itens) {
      existingMap.set(`${item.subcategoria}|${item.item}`, item)
    }

    const vistos = new Set<string>()
    const itensFinais: ItemCusto[] = []

    for (const novoItem of novosItens) {
      const chave = `${novoItem.subcategoria}|${novoItem.item}`
      vistos.add(chave)
      const existente = existingMap.get(chave)

      if (existente) {
        itensFinais.push({
          ...novoItem,
          id: existente.id,
          valorPago: existente.valorPago > 0 ? existente.valorPago : novoItem.valorPago,
          jotform: existente.jotform,
        })
      } else {
        itensFinais.push(novoItem)
      }
    }

    for (const [chave, item] of existingMap) {
      if (!vistos.has(chave)) itensFinais.push(item)
    }

    return { ...secao, itens: itensFinais }
  })

  // Merge receitas: only overwrite non-zero values from sheet
  const receitasBase = emptyReceitas()
  const receitasMerged = { ...receitasBase }
  for (const k of Object.keys(receitasMerged) as (keyof Receitas)[]) {
    const parsed = receitasParsed[k]
    if (parsed && (parsed.vendido || parsed.orcado || parsed.contratado || parsed.pago || parsed.faltaPagar)) {
      receitasMerged[k] = parsed
    } else {
      receitasMerged[k] = projeto.receitas[k] ?? receitasBase[k]
    }
  }

  const avisos: string[] = []
  if (!resumoEncontrado) {
    avisos.push("Receitas não importadas — aba 'Resumo Geral' não localizada")
  }
  avisos.push(...avisosItens)

  return {
    secoes: secoesAtualizadas,
    tap: tapParsed,
    receitas: receitasMerged,
    avisos,
  }
}

export function extrairSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? null
}
