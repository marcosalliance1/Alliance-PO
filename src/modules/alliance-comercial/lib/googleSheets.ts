// ─── Tipos públicos ────────────────────────────────────────────────────────

export interface DadosTAP {
  instituicao: string | null
  curso: string | null
  turma: string | null
  semestre: string | null
  tipo_contrato: string | null
  fee_percentual: string | null       // vem de '1.1 RESUMO CUSTOS'!F29, não da TAP
  fee_parcelas: string | null         // = "Parcelas de Adesão" do aluno
  fee_valor_parcela: string | null    // = "Valor de Cada Adesão"
  formandos_minimo: string | null     // = "ADESÕES PREVISTAS"
  verba_cerimonia: string | null      // vem de 'RESUMO COMISSÃO', custo por formando
  verba_colacao: string | null        // vem de 'RESUMO COMISSÃO', custo por formando
  camposNaoEncontrados: string[]
}

export interface PreEventoImportado {
  nome: string
  verba_pa: string | null
  verba_meta: string | null
}

export interface PacoteImportado {
  nome: string
  valor: string | null
  arrecadacao_paralela: string | null
  valor_total_sem_ap: string | null
  mensalidade: string | null
  valor_total_estendido: string | null
  valor_total_estendido_12x_sem_ap: string | null
  mensalidade_estendida_12x: string | null
  valor_total_estendido_18x: string | null
  valor_total_estendido_18x_sem_ap: string | null
  mensalidade_estendida_18x: string | null
  temErro: boolean
}

export interface ResultadoImportacao {
  dados: DadosTAP
  pacotes: PacoteImportado[]
  preeventos: PreEventoImportado[]
}

// ─── Utilitários internos ──────────────────────────────────────────────────

function normalizarMoeda(raw: string): string {
  let s = raw.replace(/[R$\s%]/g, '').trim()
  const nCommas = (s.match(/,/g) ?? []).length
  if (nCommas >= 1) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  return s
}

function normalizarTipoContrato(raw: string): string {
  const v = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (v.includes('producao') || v.includes('producão')) return 'producao'
  if (v.includes('assessoria')) return 'assessoria'
  return raw.toLowerCase()
}

function normalizarTexto(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Procura, na aba RESUMO COMISSÃO, a linha "Custo por formando" logo abaixo
// da categoria de evento indicada (ex: "CERIMÔNIA", "COLAÇÃO") e retorna o
// valor mais à direita da linha (coluna com FEE/impostos já embutidos). Para
// depois de MAX_LINHAS linhas sem achar, evitando pegar a de outra categoria.
function buscarCustoPorFormando(rows: string[][], categoria: string): string | null {
  const catNorm = normalizarTexto(categoria)
  const MAX_LINHAS = 40
  let dentroCategoria = false
  let linhasLidas = 0
  for (const row of rows) {
    const linhaNorm = normalizarTexto(row.filter(c => c?.trim()).join(' '))
    if (!dentroCategoria) {
      if (linhaNorm.includes(catNorm)) dentroCategoria = true
      continue
    }
    linhasLidas++
    if (linhaNorm.includes('CUSTO POR FORMANDO')) {
      for (let c = row.length - 1; c >= 0; c--) {
        const v = row[c]?.trim()
        if (v) return normalizarMoeda(v)
      }
      return null
    }
    if (linhasLidas > MAX_LINHAS) break
  }
  return null
}

// Procura, na aba REALIZAÇÃO ALLIANCE, a seção "PRÉ EVENTOS" e extrai até 5
// itens (nome + $ unitário atual + Total Projetado) para a Bolsa Folia.
function encontrarPreEventos(rows: string[][]): PreEventoImportado[] {
  let headerIdx = -1
  let colArea = -1, colUnitario = -1, colTotalProjetado = -1

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].map(c => normalizarTexto(c ?? ''))
    const iArea = cells.findIndex(c => c === 'AREA')
    const iUnit = cells.findIndex(c => c.includes('UNITARIO') && c.includes('ATUAL'))
    const iTotalProj = cells.findIndex(c => c.includes('TOTAL PROJETADO'))
    if (iArea !== -1 && iUnit !== -1 && iTotalProj !== -1) {
      headerIdx = r; colArea = iArea; colUnitario = iUnit; colTotalProjetado = iTotalProj
      break
    }
  }
  if (headerIdx === -1) return []

  let inicioSecao = -1
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const primeira = normalizarTexto(rows[r].find(c => c?.trim()) ?? '')
    if (primeira.includes('PRE EVENTO')) { inicioSecao = r; break }
  }
  if (inicioSecao === -1) return []

  const result: PreEventoImportado[] = []
  for (let r = inicioSecao + 1; r < rows.length && result.length < 5; r++) {
    const row = rows[r]
    const nome = row[colArea]?.trim()
    if (!nome) break
    const unitario = row[colUnitario]?.trim()
    const totalProjetado = row[colTotalProjetado]?.trim()
    result.push({
      nome,
      verba_pa:   unitario && !unitario.startsWith('#') ? normalizarMoeda(unitario) : null,
      verba_meta: totalProjetado && !totalProjetado.startsWith('#') ? normalizarMoeda(totalProjetado) : null,
    })
  }
  return result
}

function buscarValorPorRotulo(
  rows: string[][],
  predicado: (cell: string) => boolean,
): string | null {
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      if (predicado(row[c]?.trim() ?? '')) {
        for (let c2 = c + 1; c2 < row.length; c2++) {
          const v = row[c2]?.trim()
          if (v) return v
        }
      }
    }
  }
  return null
}

// Mapeia um cabeçalho de coluna para o campo de PacoteImportado correspondente.
// A ordem importa — checks mais específicos primeiro.
type CampoPacote = keyof Omit<PacoteImportado, 'temErro'>

function mapearColunaPacote(header: string): CampoPacote | null {
  const h = header.toUpperCase().trim()
  if (h === 'PACOTE') return 'nome'
  if (h.includes('18') && h.includes('MENSALIDADE')) return 'mensalidade_estendida_18x'
  if (h.includes('12') && h.includes('MENSALIDADE')) return 'mensalidade_estendida_12x'
  if (h.includes('MENSALIDADE')) return 'mensalidade'
  if (h.includes('ARRECADAÇÃO')) return 'arrecadacao_paralela'
  if (h.includes('18') && (h.includes('A.P') || h.includes('-A'))) return 'valor_total_estendido_18x_sem_ap'
  if (h.includes('18')) return 'valor_total_estendido_18x'
  if (h.includes('12') && (h.includes('A.P') || h.includes('-A'))) return 'valor_total_estendido_12x_sem_ap'
  if (h.includes('ESTENDIDO')) return 'valor_total_estendido'
  if (h.includes('VALOR') && (h.includes('A.P') || h.includes('-A'))) return 'valor_total_sem_ap'
  if (h.includes('VALOR')) return 'valor'
  return null
}

function encontrarPacotes(rows: string[][]): PacoteImportado[] {
  let headerIdx = -1
  const colMap = new Map<number, CampoPacote>()

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].map(c => c?.trim() ?? '')
    if (!cells.some(c => c.toUpperCase() === 'PACOTE')) continue

    const tmpMap = new Map<number, CampoPacote>()
    for (let c = 0; c < cells.length; c++) {
      const campo = mapearColunaPacote(cells[c])
      if (campo) tmpMap.set(c, campo)
    }

    const vals = Array.from(tmpMap.values())
    if (vals.includes('nome') && vals.some(v => v !== 'nome')) {
      headerIdx = r
      for (const [k, v] of tmpMap) colMap.set(k, v)
      break
    }
  }

  if (headerIdx === -1) return []

  let nomeCol = -1
  for (const [col, campo] of colMap) {
    if (campo === 'nome') { nomeCol = col; break }
  }

  const result: PacoteImportado[] = []

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    const nomePacote = nomeCol !== -1 ? row[nomeCol]?.trim() : ''
    if (!nomePacote) break

    let temErro = false
    const vals: Record<string, string | null> = {}

    for (const [col, campo] of colMap) {
      if (campo === 'nome') continue
      const raw = row[col]?.trim()
      if (!raw) { vals[campo] = null; continue }
      if (raw.startsWith('#')) { temErro = true; vals[campo] = null; continue }
      vals[campo] = normalizarMoeda(raw)
    }

    result.push({
      nome: nomePacote,
      valor:                          vals['valor']                          ?? null,
      arrecadacao_paralela:           vals['arrecadacao_paralela']           ?? null,
      valor_total_sem_ap:             vals['valor_total_sem_ap']             ?? null,
      mensalidade:                    vals['mensalidade']                    ?? null,
      valor_total_estendido:          vals['valor_total_estendido']          ?? null,
      valor_total_estendido_12x_sem_ap: vals['valor_total_estendido_12x_sem_ap'] ?? null,
      mensalidade_estendida_12x:      vals['mensalidade_estendida_12x']      ?? null,
      valor_total_estendido_18x:      vals['valor_total_estendido_18x']      ?? null,
      valor_total_estendido_18x_sem_ap: vals['valor_total_estendido_18x_sem_ap'] ?? null,
      mensalidade_estendida_18x:      vals['mensalidade_estendida_18x']      ?? null,
      temErro,
    })
  }

  return result
}

function parsearTAP(rows: string[][]): Omit<ResultadoImportacao, never> {
  const exato = (label: string) => (c: string) => c === label

  const dados: DadosTAP = {
    instituicao: null, curso: null, turma: null, semestre: null,
    tipo_contrato: null, fee_percentual: null,
    fee_parcelas: null, fee_valor_parcela: null,
    formandos_minimo: null,
    verba_cerimonia: null, verba_colacao: null,
    camposNaoEncontrados: [],
  }

  dados.instituicao = buscarValorPorRotulo(rows, exato('INSTITUIÇÃO DE ENSINO'))
  dados.curso       = buscarValorPorRotulo(rows, exato('CURSO'))
  dados.turma       = buscarValorPorRotulo(rows, exato('OBS'))
  dados.fee_parcelas = buscarValorPorRotulo(rows, exato('QUANTIDADE DE PARCELAS'))

  const rawAdesoes = buscarValorPorRotulo(rows, exato('ADESÕES PREVISTAS'))
  dados.formandos_minimo = rawAdesoes ?? null

  const rawFeeValorParcela = buscarValorPorRotulo(rows, exato('VALOR DE CADA ARRECADAÇÃO'))
  dados.fee_valor_parcela = rawFeeValorParcela ? normalizarMoeda(rawFeeValorParcela) : null

  const rawContrato = buscarValorPorRotulo(rows, exato('MODELO DE CONTRATO'))
  dados.tipo_contrato = rawContrato ? normalizarTipoContrato(rawContrato) : null

  const anoOrcamento = buscarValorPorRotulo(rows, exato('ANO DO ORÇAMENTO'))
  const semestrePrev = buscarValorPorRotulo(rows, exato('SEMESTRE (PREVISTO)'))
  if (semestrePrev) {
    const s = semestrePrev.replace(/[º°ª]/g, '').trim()
    dados.semestre = anoOrcamento ? `${anoOrcamento}/${s}` : s
  } else if (anoOrcamento) {
    dados.semestre = anoOrcamento
  }

  return { dados, pacotes: encontrarPacotes(rows), preeventos: [] }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────

async function fetchSheetRange(
  sheetId: string,
  accessToken: string,
  range: string,
): Promise<{ rows: string[][] | null; status: number }> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.status === 200) {
      const data = await res.json() as { values?: string[][] }
      return { rows: data.values ?? [], status: 200 }
    }
    return { rows: null, status: res.status }
  } catch {
    return { rows: null, status: 0 }
  }
}

// ─── API pública ───────────────────────────────────────────────────────────

export function extrairSheetId(link: string): string | null {
  const match = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

// Alliance-PO usa @react-oauth/google (useGoogleLogin) para o token OAuth,
// implementado localmente em NovoContrato.tsx — não usa window.google direto
// como o repo standalone, então não há obterAccessToken() aqui.

export async function importarDadosTAP(
  sheetId: string,
  accessToken: string,
): Promise<ResultadoImportacao> {
  // ── 1. Lê a aba TAP ────────────────────────────────────────────────────
  let tapRows: string[][] | null = null

  for (const sheetName of ['0. TAP - TERMO ABERTURA', 'TAP - TERMO ABERTURA']) {
    const { rows, status } = await fetchSheetRange(
      sheetId, accessToken, `'${sheetName}'!A1:Z80`
    )
    if (status === 401) throw new Error('TOKEN_EXPIRADO')
    if (status === 403) throw new Error(
      'Sem permissão de acesso à planilha. Verifique se sua conta Google tem acesso a este arquivo.'
    )
    if (status === 404) throw new Error('Planilha não encontrada. Verifique o link.')
    if (status === 0) throw new Error('Erro de rede ao contatar o Google Sheets. Verifique sua conexão.')
    if (rows !== null) { tapRows = rows; break }
    // status 400 = aba não existe, tenta o próximo nome
  }

  if (!tapRows) {
    throw new Error(
      "Aba '0. TAP - TERMO ABERTURA' não encontrada. Verifique se o arquivo é um P.O. válido."
    )
  }

  const resultado = parsearTAP(tapRows)

  // ── 2. Lê fee_percentual de '1.1 RESUMO CUSTOS'!F29 (posição fixa) ────
  // F29 contém o decimal do FEE (ex: 0.1524). Multiplicar por 100 → "15.24"
  const { rows: resumoRows } = await fetchSheetRange(
    sheetId, accessToken, "'1.1 RESUMO CUSTOS'!F29:F29"
  )
  const rawF29 = resumoRows?.[0]?.[0]?.trim()
  if (rawF29 && !rawF29.startsWith('#')) {
    const num = parseFloat(rawF29.replace(',', '.').replace('%', ''))
    if (!isNaN(num) && num > 0) {
      resultado.dados.fee_percentual = num < 1
        ? (num * 100).toFixed(2)   // decimal → percentual
        : num.toFixed(2)           // já em percentual
    }
  }

  // ── 3. Lê verba.cerimonia / verba.colacao de 'RESUMO COMISSÃO' ─────────
  // ("Custo por formando" logo abaixo de cada categoria de evento)
  const { rows: comissaoRows, status: comissaoStatus } = await fetchSheetRange(
    sheetId, accessToken, "'RESUMO COMISSÃO'!A1:L400"
  )
  if (comissaoStatus === 401) throw new Error('TOKEN_EXPIRADO')
  if (comissaoRows) {
    resultado.dados.verba_cerimonia = buscarCustoPorFormando(comissaoRows, 'CERIMÔNIA')
    resultado.dados.verba_colacao   = buscarCustoPorFormando(comissaoRows, 'COLAÇÃO')
  }

  // ── 4. Lê Bolsa Folia/Pré-Eventos de 'REALIZAÇÃO ALLIANCE' ─────────────
  const { rows: realizacaoRows, status: realizacaoStatus } = await fetchSheetRange(
    sheetId, accessToken, "'REALIZAÇÃO ALLIANCE'!A1:P400"
  )
  if (realizacaoStatus === 401) throw new Error('TOKEN_EXPIRADO')
  if (realizacaoRows) {
    resultado.preeventos = encontrarPreEventos(realizacaoRows)
  }

  // ── 5. Calcula campos não encontrados ──────────────────────────────────
  const d = resultado.dados
  const ausentes: Array<[string | null, string]> = [
    [d.instituicao,       'Instituição de Ensino'],
    [d.curso,             'Curso'],
    [d.semestre,          'Semestre'],
    [d.tipo_contrato,     'Modelo de Contrato'],
    [d.fee_percentual,    'FEE % (RESUMO CUSTOS F29)'],
    [d.fee_parcelas,      'Quantidade de Parcelas'],
    [d.fee_valor_parcela, 'Valor de Cada Adesão'],
    [d.verba_cerimonia,   'Verba Cerimônia Religiosa (RESUMO COMISSÃO)'],
    [d.verba_colacao,     'Verba Colação de Grau (RESUMO COMISSÃO)'],
  ]
  d.camposNaoEncontrados = ausentes.filter(([v]) => !v).map(([, label]) => label)
  if (resultado.preeventos.length === 0) {
    d.camposNaoEncontrados.push('Pré-Eventos / Bolsa Folia (REALIZAÇÃO ALLIANCE)')
  }

  return resultado
}
