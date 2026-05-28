import type { Projeto, SecaoCusto, ItemCusto, StatusItem, StatusPagamento, TipoCusto, TAP, TipoEscola, Receitas } from '../types'
import { v4 as uuid } from './uuid'


export interface SyncResult {
  secoes: SecaoCusto[]
  tap: Partial<TAP>
  receitas: Receitas
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
    // Remove R$, espaços, pontos de milhar, converte vírgula decimal
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
  const TOLERANCIA = 1.0

  // Detect header row dynamically: col 0 has a code label AND col 4 or 5 has an item label
  let inicioLeitura = 8
  for (let i = 0; i < Math.min(values.length, 20); i++) {
    const c0 = norm(parseStr(getCell(values, i, 0)))
    const c4 = norm(parseStr(getCell(values, i, 4)))
    const c5 = norm(parseStr(getCell(values, i, 5)))
    const isCodeCol  = c0 === 'cod' || c0 === 'codigo' || c0.startsWith('cod') || c0 === 'n' || c0 === 'no'
    const isItemCol4 = c4.includes('sub') || c4.includes('cat') || c4 === 'item'
    const isItemCol5 = c5 === 'item' || c5.includes('descr') || c5.includes('servic') || c5 === 'produto'
    if (isCodeCol && (isItemCol4 || isItemCol5)) {
      inicioLeitura = i + 1
      break
    }
  }

  for (let r = inicioLeitura; r < values.length; r++) {
    const get = (c: number) => getCell(values, r, c)

    const subcategoria = parseStr(get(4))
    const item = parseStr(get(5))
    if (!subcategoria && !item) continue
    const codigo = parseCodigo(get(0))
    const area = parseStr(get(1))
    const moscow = parseStr(get(2))
    const tipoCusto = parseTipoCusto(get(3))
    const fornecedor = parseStr(get(6))

    // VENDIDO PELO COMERCIAL — espelho direto da planilha
    const qtdeVendida = parseNum(get(7))
    const valorUnitarioAtual = parseNum(get(8))
    const totalAtual = parseNum(get(9))           // ← lê direto da col J, não recalcula

    const valorProjetado = parseNum(get(10))       // K
    const totalProjetado = parseNum(get(11))       // L — lê direto

    // ORÇADO — espelho direto da planilha
    const qtdeOrcada = parseNum(get(13))
    const valorUnitarioOrcado = parseNum(get(14))
    const valorOrcado = parseNum(get(15))          // ← lê direto da col P, não recalcula

    // Aviso de inconsistência: Qtde × VU ≠ Valor Orçado na planilha
    if (valorOrcado > 0 && qtdeOrcada > 0 && valorUnitarioOrcado > 0) {
      const calculado = qtdeOrcada * valorUnitarioOrcado
      if (Math.abs(valorOrcado - calculado) > TOLERANCIA) {
        const nome = item || subcategoria
        avisos.push(`⚠️ ${secaoNome} › ${nome} — Orçado: planilha R$${valorOrcado.toFixed(2).replace('.', ',')} ≠ Qtde×VU R$${calculado.toFixed(2).replace('.', ',')}`)
      }
    }

    // CONTRATADO — espelho direto da planilha
    const qtdeContratada = parseNum(get(17))
    const valorUnitarioContratado = parseNum(get(18))
    const valorContratado = parseNum(get(19))      // ← lê direto da col T, não recalcula

    // Aviso de inconsistência: Qtde × VU ≠ Valor Contratado na planilha
    if (valorContratado > 0 && qtdeContratada > 0 && valorUnitarioContratado > 0) {
      const calculado = qtdeContratada * valorUnitarioContratado
      if (Math.abs(valorContratado - calculado) > TOLERANCIA) {
        const nome = item || subcategoria
        avisos.push(`⚠️ ${secaoNome} › ${nome} — Contratado: planilha R$${valorContratado.toFixed(2).replace('.', ',')} ≠ Qtde×VU R$${calculado.toFixed(2).replace('.', ',')}`)
      }
    }

    const responsavel = parseStr(get(20))
    const status = parseStatus(get(21))
    const statusPagamento = parsePgto(get(24))
    const valorFinal = parseNum(get(26))
    const valorPago = parseNum(get(27))
    const faltaPagar = parseNum(get(28))           // ← lê direto da col AC

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

function parseReceitasFromResumo(values: unknown[][]): Receitas {
  // Detect column layout header (rows with "vendido", "orcado", etc.)
  let headerRow0 = -1
  for (let r = 0; r < Math.min(values.length, 15); r++) {
    const joined = ((values[r] as unknown[]) ?? []).map(c => norm(parseStr(c))).join(' ')
    if (joined.includes('vendido') || joined.includes('orcado')) {
      headerRow0 = r
      break
    }
  }

  let colVendido = 2
  let colOrcado = 4
  let colContratado = 6
  let colPago = 8
  let colFaltaPagar = 9

  if (headerRow0 >= 0 && headerRow0 + 1 < values.length) {
    const row0 = (values[headerRow0] as unknown[]) ?? []
    const row1 = (values[headerRow0 + 1] as unknown[]) ?? []

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

  // Find "RECEITAS" section label in col A or B — data starts from the very next row.
  // This ensures the aggregate "RECEITAS" subtotal row itself is never read as an individual receipt line.
  let dataStart = headerRow0 >= 0 ? headerRow0 + 2 : 0
  for (let r = 0; r < values.length; r++) {
    const colA = norm(parseStr(getCell(values, r, 0)))
    const colB = norm(parseStr(getCell(values, r, 1)))
    if (colA === 'receitas' || colB === 'receitas') {
      dataStart = r + 1
      break
    }
  }

  const parseCell = (r: number, col: number): number => {
    const v = getCell(values, r, col)
    const s = String(v ?? '').trim()
    if (!s || s === '-' || s === '—') return 0
    return parseNum(v)
  }

  const result: Receitas = {}

  for (let r = dataStart; r < values.length; r++) {
    const rawLabel = parseStr(getCell(values, r, 1))  // somente coluna B — nunca coluna A (evita duplicar rótulos de grupo)
    if (!rawLabel) continue

    if (norm(rawLabel).includes('receita baile')) break  // total row — stop

    const vendido    = parseCell(r, colVendido)
    const orcado     = parseCell(r, colOrcado)
    const contratado = parseCell(r, colContratado)
    const pago       = parseCell(r, colPago)
    const faltaPagar = parseCell(r, colFaltaPagar)

    if (!vendido && !orcado && !contratado && !pago && !faltaPagar) continue

    const existing = result[rawLabel]
    if (existing) {
      result[rawLabel] = {
        vendido:    existing.vendido    + vendido,
        orcado:     existing.orcado     + orcado,
        contratado: existing.contratado + contratado,
        pago:       existing.pago       + pago,
        faltaPagar: existing.faltaPagar + faltaPagar,
      }
    } else {
      result[rawLabel] = { vendido, orcado, contratado, pago, faltaPagar }
    }
  }

  return result
}

export async function fetchSheetNames(spreadsheetId: string, accessToken: string): Promise<string[]> {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (resp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
    ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao acessar planilha (HTTP ${resp.status})`)
  }
  const meta = await resp.json() as { sheets: { properties: { title: string } }[] }
  return meta.sheets.map(s => s.properties.title)
}

export async function fetchAba(spreadsheetId: string, nomeAba: string, accessToken: string, rangeSpec?: string): Promise<unknown[][] | null> {
  const rangeParam = rangeSpec ?? nomeAba
  // FORMATTED_VALUE: espelha exatamente o que aparece na planilha (já calculado e formatado)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeParam)}?valueRenderOption=FORMATTED_VALUE`
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

  const secoesAtualizadas = projeto.secoes.map(secao => {
    const novosItens = novasSecoes.get(secao.numero)
    if (!novosItens) return secao

    // Usa codigo como chave primária; fallback para subcategoria|item se código vazio
    const existingMap = new Map<string, ItemCusto>()
    for (const item of secao.itens) {
      const chave = item.codigo?.trim() ? item.codigo.trim() : `|${item.subcategoria}|${item.item}`
      existingMap.set(chave, item)  // último vence — elimina duplicatas de mesmo código
    }

    // Sync sobrescreve — apenas itens lidos do sheet ficam. IDs existentes são preservados
    // para estabilidade de chaves React, mas itens que não existem mais no sheet são removidos.
    const itensFinais = novosItens.map(novoItem => {
      const chave = novoItem.codigo?.trim() ? novoItem.codigo.trim() : `|${novoItem.subcategoria}|${novoItem.item}`
      const existente = existingMap.get(chave)
      if (existente) {
        return { ...novoItem, id: existente.id, jotform: existente.jotform }
      }
      return novoItem
    })

    return { ...secao, itens: itensFinais }
  })

  // Quando o Resumo Geral foi lido com sucesso, substitui as receitas inteiras pelo dado
  // parseado — garante que entradas obsoletas (ex: linhas de somatório de syncs antigos) sejam removidas.
  // Fallback: mantém as receitas do projeto quando a aba não foi encontrada.
  const parsedEntries = Object.entries(receitasParsed).filter(([, v]) =>
    v && (v.vendido || v.orcado || v.contratado || v.pago || v.faltaPagar)
  )
  const receitasMerged: Receitas = resumoEncontrado && parsedEntries.length > 0
    ? Object.fromEntries(parsedEntries) as Receitas
    : { ...projeto.receitas }

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