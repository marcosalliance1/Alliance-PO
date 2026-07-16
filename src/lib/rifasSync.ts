// Sincronização bidirecional Rifas ↔ Google Sheets ("SORTEIO de Rifas e Vouchers 2026").
//
// Nota sobre `sheet_row_hash`: a API do Sheets não expõe um "última edição" por linha
// (só a revisão do arquivo inteiro, via Drive). Por isso, em vez do `sheet_updated_at`
// do prompt original, guardamos um hash do conteúdo bruto da linha na última sync —
// se o hash mudou, a planilha mudou desde então. Comparado ao `updated_at` do Supabase
// (via last sync log), isso detecta os mesmos 3 casos (só sheet mudou / só Alliance
// mudou / os dois mudaram → conflito) sem precisar da API de revisões do Drive.

const ABA_INFORMACOES = 'INFORMAÇÕES'
const ABA_GANHADORES = 'GANHADORES'
const ABA_COMPRAS = 'ACOMPANHAMENTO DE COMPRA'
const ABA_VISAO_UNICA = 'VISÃO ÚNICA'

const SITUACOES_VALIDAS = ['EM ANDAMENTO', 'SORTEADA', 'FECHADA', 'NÃO VAI TER']
const STATUS_COMPRA_VALIDOS = ['Comprado', 'Não comprado']

// ── Utilidades de texto/valor ────────────────────────────────────────────────

function normalizarCabecalho(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

export function normalizarChave(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '').trim()
}

function celula(row: unknown[] | undefined, idx: number): string {
  if (idx < 0 || !row) return ''
  const v = row[idx]
  return v === null || v === undefined ? '' : String(v).trim()
}

function parseValorMonetario(raw: string): number | null {
  if (!raw) return null
  const limpo = raw.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = parseFloat(limpo)
  return isNaN(n) ? null : n
}

function parseDataBR(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseSimNao(raw: string): boolean {
  return raw.trim().toUpperCase() === 'SIM'
}

// PREENCHIDO NA PLANILHA? usa texto livre na prática ("Preenchido", não só "SIM") —
// trata qualquer palavra de confirmação como verdadeiro, mas rejeita explicitamente
// negações (senão "NÃO PREENCHIDO" bateria em "PREENCHIDO" e viraria falso positivo).
const PREENCHIDO_PALAVRAS = ['SIM', 'PREENCHIDO', 'OK', 'FEITO', 'CONCLUIDO', 'CONCLUÍDO', 'X']
function parsePreenchidoPlanilha(raw: string): boolean {
  const t = raw.trim().toUpperCase()
  if (!t) return false
  if (t.includes('NAO') || t.includes('NÃO')) return false
  return PREENCHIDO_PALAVRAS.some(p => t.includes(p))
}

// CONTATO costuma vir com telefone e e-mail na mesma célula, às vezes sem separador
// visível (quebra de linha da planilha vira espaço no FORMATTED_VALUE). Extrai o
// e-mail por regex (funciona mesmo colado no telefone) e trata o resto como telefone.
export interface ContatoParseado { telefone: string | null; email: string | null; formatado: string }
export function parseContato(raw: string): ContatoParseado {
  const texto = raw.trim()
  if (!texto) return { telefone: null, email: null, formatado: '' }
  const emailMatch = texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  const email = emailMatch ? emailMatch[0] : null
  let resto = email ? texto.replace(email, '') : texto
  resto = resto.replace(/[,;/|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim()
  const telefone = resto || null
  return { telefone, email, formatado: [telefone, email].filter(Boolean).join(' · ') }
}

function parseInt10(raw: string): number | null {
  const n = parseInt(raw, 10)
  return isNaN(n) ? null : n
}

// Hash simples (FNV-1a 32 bits) só para detectar se a linha da planilha mudou desde a
// última sync — não precisa ser criptográfico, só estável e barato.
export function hashLinha(valores: unknown[]): string {
  const s = valores.map(v => String(v ?? '')).join('␟')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function formatarDataBR(iso: string | null): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}`
}

// Mesma construção de array usada em escreverLinha/anexarLinha — exposta para o chamador
// poder recalcular o hash da linha localmente após escrever, sem precisar reler da planilha.
export function construirLinhaArray(colunas: Record<string, number>, valoresPorCampo: Record<string, unknown>): unknown[] {
  const indices = Object.values(colunas)
  const ultimaCol = indices.length > 0 ? Math.max(...indices) : 0
  const linhaValores: unknown[] = new Array(ultimaCol + 1).fill(null)
  for (const [campo, idx] of Object.entries(colunas)) {
    if (campo in valoresPorCampo) linhaValores[idx] = valoresPorCampo[campo] ?? ''
  }
  return linhaValores
}

function colIndexToLetter(idx: number): string {
  let n = idx + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// ── Mapeamento de colunas por nome de cabeçalho ──────────────────────────────

// Casa por igualdade exata primeiro (evita falso-positivo tipo "OBS" achar "OBSERVAÇÕES
// GERAIS"); se nada bater exato, tenta por "contém" nos dois sentidos — cobre cabeçalhos
// reais com qualificador extra (ex: "NOME DO GANHADOR(A)", "GANHADOR DA RIFA").
function mapearColunas(headerRow: unknown[], candidatos: Record<string, string[]>): Record<string, number> {
  const headers = headerRow.map(normalizarCabecalho)
  const mapa: Record<string, number> = {}
  for (const [campo, opcoes] of Object.entries(candidatos)) {
    const opcoesNorm = opcoes.map(normalizarCabecalho)
    let idx = headers.findIndex(h => h !== '' && opcoesNorm.some(o => h === o))
    if (idx < 0) idx = headers.findIndex(h => h !== '' && opcoesNorm.some(o => h.includes(o) || o.includes(h)))
    if (idx >= 0) mapa[campo] = idx
  }
  return mapa
}

function colunasFaltando(mapa: Record<string, number>, obrigatorias: string[]): string[] {
  return obrigatorias.filter(c => mapa[c] === undefined)
}

// A linha de cabeçalho real pode não ser a primeira (linha de título/resumo acima, como
// acontece em INFORMAÇÕES com "Aderentes: 247") — procura, nas primeiras linhas, a que
// tem uma célula reconhecível como "TURMA" (âncora comum às 3 abas).
function encontrarLinhaCabecalho(values: unknown[][], maxLinhas = 5): number {
  for (let i = 0; i < Math.min(values.length, maxLinhas); i++) {
    const row = (values[i] as unknown[]) ?? []
    if (row.some(c => normalizarCabecalho(c) === 'TURMA')) return i
  }
  return 0
}

// ── INFORMAÇÕES → rifas ──────────────────────────────────────────────────────

export interface RifaSheetRow {
  linha: number
  turma: string
  edicao: string | null
  formacao: string | null
  ano_formatura: number | null
  atribuido_raw: string | null
  dia_vencimento: string | null
  premio_descricao: string | null
  valor_boleto: number | null
  situacao: string | null
  hash: string
}

export { mapearColunas }

export const COLS_INFORMACOES = {
  turma: ['TURMA'],
  formacao: ['FORMAÇÃO', 'FORMACAO'],
  ano_formatura: ['ANO DE FORMATURA', 'ANO FORMATURA'],
  atribuido_raw: ['ATRIBUÍDO?', 'ATRIBUIDO?', 'ATRIBUIDO'],
  dia_vencimento: ['DIA DO VENCIMENTO', 'VENCIMENTO'],
  premio_descricao: ['PRÊMIO', 'PREMIO'],
  valor_boleto: ['VALOR DO BOLETO', 'VALOR BOLETO'],
  situacao: ['SITUAÇÃO', 'SITUACAO'],
}

export function parseAbaInformacoes(values: unknown[][]): { linhas: RifaSheetRow[]; colunas: Record<string, number>; avisos: string[] } {
  const avisos: string[] = []
  if (values.length === 0) return { linhas: [], colunas: {}, avisos: [`Aba "${ABA_INFORMACOES}" vazia ou não encontrada.`] }

  const headerRow = encontrarLinhaCabecalho(values)
  const header = values[headerRow] as unknown[]
  const colunas = mapearColunas(header, COLS_INFORMACOES)

  // A coluna "Nº EDIÇÃO" não tem cabeçalho na planilha real (célula em branco entre
  // TURMA e FORMAÇÃO) — se não achamos por nome, assumimos a posição logo após TURMA.
  if (colunas.turma !== undefined && colunas.formacao !== undefined && colunas.formacao === colunas.turma + 2) {
    colunas.edicao = colunas.turma + 1
  }

  const faltando = colunasFaltando(colunas, ['turma', 'situacao'])
  if (faltando.length > 0) {
    avisos.push(`Aba "${ABA_INFORMACOES}": colunas obrigatórias não encontradas: ${faltando.join(', ')}. Cabeçalho lido (linha ${headerRow + 1}): ${header.map(c => String(c ?? '')).filter(Boolean).join(' | ')}`)
    return { linhas: [], colunas, avisos }
  }

  const linhas: RifaSheetRow[] = []
  for (let i = headerRow + 1; i < values.length; i++) {
    const row = (values[i] as unknown[]) ?? []
    const turma = celula(row, colunas.turma)
    if (!turma) continue // linha vazia/ruído (ex: resumo "Aderentes: 247")

    const situacaoRaw = celula(row, colunas.situacao).toUpperCase()
    const situacao = SITUACOES_VALIDAS.includes(situacaoRaw) ? situacaoRaw : null
    if (!situacao) avisos.push(`${ABA_INFORMACOES} linha ${i + 1}: SITUAÇÃO "${celula(row, colunas.situacao)}" não reconhecida, ignorada.`)

    const vencimentoRaw = celula(row, colunas.dia_vencimento)
    const vencimento = vencimentoRaw ? parseDataBR(vencimentoRaw) : null
    if (vencimentoRaw && !vencimento) avisos.push(`${ABA_INFORMACOES} linha ${i + 1}: DIA DO VENCIMENTO "${vencimentoRaw}" não é uma data válida, ignorada.`)

    linhas.push({
      linha: i + 1,
      turma,
      edicao: colunas.edicao !== undefined ? (celula(row, colunas.edicao) || null) : null,
      formacao: celula(row, colunas.formacao) || null,
      ano_formatura: parseInt10(celula(row, colunas.ano_formatura)),
      atribuido_raw: celula(row, colunas.atribuido_raw) || null,
      dia_vencimento: vencimento,
      premio_descricao: celula(row, colunas.premio_descricao) || null,
      valor_boleto: parseValorMonetario(celula(row, colunas.valor_boleto)),
      situacao,
      hash: hashLinha(row),
    })
  }
  return { linhas, colunas, avisos }
}

// ── GANHADORES → rifas_ganhadores ────────────────────────────────────────────

export interface GanhadorSheetRow {
  linha: number
  turma: string
  responsavel: string | null
  tipo: string | null
  premio_descricao: string | null
  data_sorteio: string | null
  sorteado: boolean
  nome_ganhador: string | null
  contato: string | null
  contato_feito: boolean
  premio_entregue: string | null
  financeiro: string | null
  obs: string | null
  hash: string
}

export const COLS_GANHADORES = {
  turma: ['TURMA'],
  responsavel: ['RESPONSÁVEL', 'RESPONSAVEL'],
  tipo: ['TIPO'],
  premio_descricao: ['PRÊMIO', 'PREMIO'],
  data_sorteio: ['DATA DO SORTEIO', 'DATA SORTEIO'],
  sorteado: ['SORTEADO?', 'SORTEADO'],
  nome_ganhador: ['NOME DO GANHADOR', 'GANHADOR'],
  contato: ['CONTATO'],
  contato_feito: ['CONTATO FEITO', 'CONTATO FEITO?'],
  premio_entregue: ['PRÊMIO ENTREGUE', 'PREMIO ENTREGUE'],
  financeiro: ['FINANCEIRO'],
  obs: ['OBS', 'OBSERVAÇÕES', 'OBSERVACOES'],
}

export function parseAbaGanhadores(values: unknown[][]): { linhas: GanhadorSheetRow[]; colunas: Record<string, number>; avisos: string[] } {
  const avisos: string[] = []
  if (values.length === 0) return { linhas: [], colunas: {}, avisos: [`Aba "${ABA_GANHADORES}" vazia ou não encontrada.`] }

  const headerRow = encontrarLinhaCabecalho(values)
  const header = values[headerRow] as unknown[]
  const colunas = mapearColunas(header, COLS_GANHADORES)
  const faltando = colunasFaltando(colunas, ['turma', 'nome_ganhador'])
  if (faltando.length > 0) {
    avisos.push(`Aba "${ABA_GANHADORES}": colunas obrigatórias não encontradas: ${faltando.join(', ')}. Cabeçalho lido (linha ${headerRow + 1}): ${header.map(c => String(c ?? '')).filter(Boolean).join(' | ')}`)
    return { linhas: [], colunas, avisos }
  }

  const linhas: GanhadorSheetRow[] = []
  for (let i = headerRow + 1; i < values.length; i++) {
    const row = (values[i] as unknown[]) ?? []
    const turma = celula(row, colunas.turma)
    const nomeGanhador = celula(row, colunas.nome_ganhador)
    if (!turma && !nomeGanhador) continue

    const dataRaw = celula(row, colunas.data_sorteio)
    const data = dataRaw ? parseDataBR(dataRaw) : null
    if (dataRaw && !data) avisos.push(`${ABA_GANHADORES} linha ${i + 1}: DATA DO SORTEIO "${dataRaw}" não é uma data válida, ignorada.`)

    linhas.push({
      linha: i + 1,
      turma,
      responsavel: celula(row, colunas.responsavel) || null,
      tipo: celula(row, colunas.tipo) || null,
      premio_descricao: celula(row, colunas.premio_descricao) || null,
      data_sorteio: data,
      sorteado: parseSimNao(celula(row, colunas.sorteado)),
      nome_ganhador: nomeGanhador || null,
      contato: parseContato(celula(row, colunas.contato)).formatado || null,
      contato_feito: parseSimNao(celula(row, colunas.contato_feito)),
      premio_entregue: celula(row, colunas.premio_entregue) || null,
      financeiro: celula(row, colunas.financeiro) || null,
      obs: celula(row, colunas.obs) || null,
      hash: hashLinha(row),
    })
  }
  return { linhas, colunas, avisos }
}

// ── ACOMPANHAMENTO DE COMPRA → rifas_compras ─────────────────────────────────

export interface CompraSheetRow {
  linha: number
  turma: string
  premio_descricao: string | null
  nome_ganhador: string | null
  endereco: string | null
  informacoes: string | null
  site: string | null
  valor: number | null
  status: string | null
  data_compra: string | null
  data_entrega_raw: string | null
  nome_cartao: string | null
  preenchido_planilha: boolean
  hash: string
}

export const COLS_COMPRAS = {
  turma: ['TURMA'],
  premio_descricao: ['PRÊMIO', 'PREMIO'],
  nome_ganhador: ['NOME DO GANHADOR', 'GANHADOR'],
  endereco: ['ENDEREÇO', 'ENDERECO'],
  informacoes: ['INFORMAÇÕES', 'INFORMACOES'],
  site: ['SITE'],
  valor: ['VALOR'],
  status: ['STATUS'],
  data_compra: ['DATA DA COMPRA', 'DATA COMPRA'],
  data_entrega_raw: ['DATA ENTREGA', 'DATA DE ENTREGA'],
  nome_cartao: ['NOME DO CARTÃO', 'NOME DO CARTAO'],
  preenchido_planilha: ['PREENCHIDO NA PLANILHA?', 'PREENCHIDO NA PLANILHA'],
}

export function parseAbaCompras(values: unknown[][]): { linhas: CompraSheetRow[]; colunas: Record<string, number>; avisos: string[] } {
  const avisos: string[] = []
  if (values.length === 0) return { linhas: [], colunas: {}, avisos: [`Aba "${ABA_COMPRAS}" vazia ou não encontrada.`] }

  const headerRow = encontrarLinhaCabecalho(values)
  const header = values[headerRow] as unknown[]
  const colunas = mapearColunas(header, COLS_COMPRAS)
  const faltando = colunasFaltando(colunas, ['turma', 'nome_ganhador'])
  if (faltando.length > 0) {
    avisos.push(`Aba "${ABA_COMPRAS}": colunas obrigatórias não encontradas: ${faltando.join(', ')}. Cabeçalho lido (linha ${headerRow + 1}): ${header.map(c => String(c ?? '')).filter(Boolean).join(' | ')}`)
    return { linhas: [], colunas, avisos }
  }

  const linhas: CompraSheetRow[] = []
  for (let i = headerRow + 1; i < values.length; i++) {
    const row = (values[i] as unknown[]) ?? []
    const turma = celula(row, colunas.turma)
    const nomeGanhador = celula(row, colunas.nome_ganhador)
    if (!turma && !nomeGanhador) continue

    const statusRaw = celula(row, colunas.status)
    const status = STATUS_COMPRA_VALIDOS.find(s => s.toLowerCase() === statusRaw.toLowerCase()) ?? null
    if (statusRaw && !status) avisos.push(`${ABA_COMPRAS} linha ${i + 1}: STATUS "${statusRaw}" não reconhecido, ignorado.`)

    const dataCompraRaw = celula(row, colunas.data_compra)
    const dataCompra = dataCompraRaw ? parseDataBR(dataCompraRaw) : null
    if (dataCompraRaw && !dataCompra) avisos.push(`${ABA_COMPRAS} linha ${i + 1}: DATA DA COMPRA "${dataCompraRaw}" não é uma data válida, ignorada.`)

    linhas.push({
      linha: i + 1,
      turma,
      premio_descricao: celula(row, colunas.premio_descricao) || null,
      nome_ganhador: nomeGanhador || null,
      endereco: celula(row, colunas.endereco) || null,
      informacoes: celula(row, colunas.informacoes) || null,
      site: celula(row, colunas.site) || null,
      valor: parseValorMonetario(celula(row, colunas.valor)),
      status,
      data_compra: dataCompra,
      data_entrega_raw: celula(row, colunas.data_entrega_raw) || null,
      nome_cartao: celula(row, colunas.nome_cartao) || null,
      preenchido_planilha: parsePreenchidoPlanilha(celula(row, colunas.preenchido_planilha)),
      hash: hashLinha(row),
    })
  }
  return { linhas, colunas, avisos }
}

// ── Leitura/escrita via Google Sheets REST API ───────────────────────────────

function erroToken(): Error {
  const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
  ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
  return err
}

// Lista os nomes reais das abas da planilha — usado para casar os nomes esperados
// (ABA_INFORMACOES etc) com o título de verdade, já que acentuação/espaços podem não
// bater byte a byte com o que foi hardcoded no código.
export async function listarAbas(spreadsheetId: string, accessToken: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (resp.status === 401) throw erroToken()
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao listar abas da planilha (HTTP ${resp.status})`)
  }
  const meta = await resp.json() as { sheets?: { properties: { title: string } }[] }
  return (meta.sheets ?? []).map(s => s.properties.title)
}

// Acha, entre os títulos reais da planilha, o que corresponde ao nome esperado
// (comparação tolerante a acento/maiúscula/espaço) — evita "Unable to parse range"
// por causa de uma diferença sutil de grafia entre o que foi hardcoded e a aba real.
export function encontrarAbaReal(nomeEsperado: string, abasReais: string[]): string | null {
  const alvo = normalizarCabecalho(nomeEsperado)
  return abasReais.find(a => normalizarCabecalho(a) === alvo) ?? null
}

export async function lerAba(spreadsheetId: string, aba: string, accessToken: string): Promise<unknown[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(aba)}?valueRenderOption=FORMATTED_VALUE`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (resp.status === 401) throw erroToken()
  if (resp.status === 403) throw new Error('Sem permissão para acessar esta planilha. Verifique se ela está compartilhada com sua conta.')
  if (resp.status === 404) return []
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao ler aba "${aba}" (HTTP ${resp.status})`)
  }
  const data = await resp.json() as { values?: unknown[][] }
  return data.values ?? []
}

// Escreve uma linha inteira (colunas mapeadas) de volta na planilha, na linha `linha` (1-based).
export async function escreverLinha(
  spreadsheetId: string,
  aba: string,
  linha: number,
  colunas: Record<string, number>,
  valoresPorCampo: Record<string, unknown>,
  accessToken: string,
): Promise<void> {
  const indices = Object.values(colunas)
  if (indices.length === 0) return
  const ultimaCol = Math.max(...indices)
  const linhaValores: unknown[] = new Array(ultimaCol + 1).fill(null)
  for (const [campo, idx] of Object.entries(colunas)) {
    if (campo in valoresPorCampo) linhaValores[idx] = valoresPorCampo[campo] ?? ''
  }
  const range = `'${aba}'!A${linha}:${colIndexToLetter(ultimaCol)}${linha}`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, values: [linhaValores] }),
  })
  if (resp.status === 401) throw erroToken()
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao escrever na aba "${aba}" (HTTP ${resp.status})`)
  }
}

// Escreve o valor de UM campo (uma célula) — usado pela resolução de conflito "manter Alliance".
export async function escreverCelula(
  spreadsheetId: string,
  aba: string,
  linha: number,
  colIdx: number,
  valor: unknown,
  accessToken: string,
): Promise<void> {
  const range = `'${aba}'!${colIndexToLetter(colIdx)}${linha}`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, values: [[valor ?? '']] }),
  })
  if (resp.status === 401) throw erroToken()
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao escrever célula na aba "${aba}" (HTTP ${resp.status})`)
  }
}

// Adiciona uma linha nova ao final da aba (registro criado no Alliance, ainda sem linha na planilha).
export async function anexarLinha(
  spreadsheetId: string,
  aba: string,
  colunas: Record<string, number>,
  valoresPorCampo: Record<string, unknown>,
  accessToken: string,
): Promise<number> {
  const indices = Object.values(colunas)
  const ultimaCol = indices.length > 0 ? Math.max(...indices) : 0
  const linhaValores: unknown[] = new Array(ultimaCol + 1).fill(null)
  for (const [campo, idx] of Object.entries(colunas)) {
    if (campo in valoresPorCampo) linhaValores[idx] = valoresPorCampo[campo] ?? ''
  }
  const range = `'${aba}'!A1`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [linhaValores] }),
  })
  if (resp.status === 401) throw erroToken()
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao adicionar linha na aba "${aba}" (HTTP ${resp.status})`)
  }
  const data = await resp.json() as { updates?: { updatedRange?: string } }
  const range2 = data.updates?.updatedRange ?? ''
  const m = range2.match(/![A-Z]+(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

// ── Aba "VISÃO ÚNICA" — somente escrita, sobrescrita inteira a cada sync ────────
// Nunca é lida de volta pelo motor de sincronização das 3 abas originais; é só uma
// leitura consolidada (join de rifas+ganhadores+compras) pra quem só quer consultar.

async function batchUpdate(spreadsheetId: string, accessToken: string, requests: unknown[]): Promise<Record<string, unknown>> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
  if (resp.status === 401) throw erroToken()
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao atualizar planilha (HTTP ${resp.status})`)
  }
  return resp.json()
}

// Retorna o sheetId numérico da aba (precisa pra formatação/congelamento via batchUpdate)
// — cria a aba na planilha se ela ainda não existir.
export async function obterOuCriarAba(spreadsheetId: string, aba: string, accessToken: string): Promise<number> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (resp.status === 401) throw erroToken()
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao consultar abas da planilha (HTTP ${resp.status})`)
  }
  const meta = await resp.json() as { sheets?: { properties: { sheetId: number; title: string } }[] }
  const existente = meta.sheets?.find(s => s.properties.title === aba)
  if (existente) return existente.properties.sheetId

  const data = await batchUpdate(spreadsheetId, accessToken, [{ addSheet: { properties: { title: aba } } }])
  const replies = data.replies as { addSheet: { properties: { sheetId: number } } }[]
  return replies[0].addSheet.properties.sheetId
}

// Apaga todo o conteúdo atual da aba antes de escrever a versão nova (o número de
// linhas muda a cada sync, então só sobrescrever não seria suficiente pra remover
// linhas antigas que sobraram do fim).
export async function limparAba(spreadsheetId: string, aba: string, accessToken: string): Promise<void> {
  const range = `'${aba}'!A1:Z20000`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (resp.status === 401) throw erroToken()
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao limpar aba "${aba}" (HTTP ${resp.status})`)
  }
}

// Escreve a grade inteira (cabeçalho + linhas) a partir de A1.
export async function escreverGradeCompleta(spreadsheetId: string, aba: string, valores: unknown[][], accessToken: string): Promise<void> {
  const range = `'${aba}'!A1`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, values: valores }),
  })
  if (resp.status === 401) throw erroToken()
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao escrever aba "${aba}" (HTTP ${resp.status})`)
  }
}

const COR_BLOCO_RIFA = { red: 0.85, green: 0.92, blue: 1 } // azul claro
const COR_BLOCO_GANHADOR = { red: 0.85, green: 0.95, blue: 0.85 } // verde claro
const COR_BLOCO_COMPRA = { red: 1, green: 0.97, blue: 0.8 } // amarelo claro

// Cor do cabeçalho por bloco + congelamento das 2 primeiras colunas (Status do Pipeline
// + Turma) e da primeira linha + nota de aviso na célula A1 — tudo num só batchUpdate.
export async function formatarAbaVisaoUnica(
  spreadsheetId: string,
  sheetId: number,
  totalColunasRifa: number,
  totalColunasGanhador: number,
  totalColunasCompra: number,
  accessToken: string,
): Promise<void> {
  const inicioRifa = 1 // coluna 0 = Status do Pipeline
  const inicioGanhador = inicioRifa + totalColunasRifa
  const inicioCompra = inicioGanhador + totalColunasGanhador
  const fimCompra = inicioCompra + totalColunasCompra

  const bandaCor = (startCol: number, endCol: number, cor: { red: number; green: number; blue: number }) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: startCol, endColumnIndex: endCol },
      cell: { userEnteredFormat: { backgroundColor: cor, textFormat: { bold: true } } },
      fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold',
    },
  })

  await batchUpdate(spreadsheetId, accessToken, [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 } },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
      },
    },
    bandaCor(inicioRifa, inicioGanhador, COR_BLOCO_RIFA),
    bandaCor(inicioGanhador, inicioCompra, COR_BLOCO_GANHADOR),
    bandaCor(inicioCompra, fimCompra, COR_BLOCO_COMPRA),
    {
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        rows: [{ values: [{ note: 'Esta aba é gerada automaticamente e sobrescrita a cada sincronização — não editar aqui. Para editar, use as abas Informações, Ganhadores ou Acompanhamento de Compra.' }] }],
        fields: 'note',
      },
    },
  ])
}

export { ABA_INFORMACOES, ABA_GANHADORES, ABA_COMPRAS, ABA_VISAO_UNICA }
