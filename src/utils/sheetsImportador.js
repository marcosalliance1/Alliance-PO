import { uuidv4 } from './uuid'

// Mesmo mapeamento do importador xlsx
const MAPEAMENTO_ABAS = {
  '2.1': ['2.1 custo produção', '2.1 custo producao', '2.1 producao', '2.1 produção'],
  '2.2': ['2.2 custo artístico', '2.2 custo artistico', '2.2 artistico', '2.2 artístico'],
  '2.3': ['2.3 custo equipe', '2.3 equipe'],
  '2.4': ['2.4 custo bar', '2.4 custo bar&food', '2.4 bar', '2.4 bar&food'],
  '2.5': ['2.5 custo pré-eventos', '2.5 custo pre-eventos', '2.5 custo cerimônia', '2.5 custo cerimonia', '2.5 pré-eventos', '2.5 pre-eventos', '2.5 cerimônia', '2.5 cerimonia', '2.5 custos administrativos'],
  '2.6': ['2.6 custo cerimônia', '2.6 custo cerimonia', '2.6 custo colação', '2.6 custo colacao', '2.6 cerimônia', '2.6 colação'],
  '2.7': ['2.7 custo colação', '2.7 custo colacao', '2.7 colação'],
  '2.8': ['2.8 custos administrativos', '2.8 custo administrativo', '2.8 administrativo'],
}

function encontrarSecaoAba(nomeAba) {
  const nome = nomeAba.toLowerCase().trim()
  for (const [secao, nomes] of Object.entries(MAPEAMENTO_ABAS)) {
    for (const n of nomes) {
      if (nome.includes(n)) return secao
    }
  }
  return null
}

function limparValor(val) {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const erros = ['#ref!', '#n/a', '#value!', '#div/0!', '#nome?', '#name?']
    if (erros.some(e => val.toLowerCase().includes(e))) return 0
    const num = parseFloat(val.replace(/[R$\s.]/g, '').replace(',', '.'))
    return isNaN(num) ? 0 : num
  }
  return 0
}

function limparTexto(val) {
  if (val === null || val === undefined) return ''
  const str = String(val).trim()
  const erros = ['#ref!', '#n/a', '#value!', '#div/0!']
  if (erros.some(e => str.toLowerCase().includes(e))) return ''
  return str
}

function tratarCodigo(val) {
  if (!val && val !== 0) return ''
  if (typeof val === 'number') {
    if (val > 40000 && val < 50000) {
      const data = new Date((val - 25569) * 86400 * 1000)
      return String(data.getFullYear())
    }
    return String(Math.round(val))
  }
  return String(val).trim()
}

function getCell(values, row, col) {
  return values[row]?.[col] ?? null
}

function parseTAP(values) {
  return {
    tipoEnsino:     limparTexto(getCell(values, 6, 1)),
    totalAlunos:    limparValor(getCell(values, 6, 5)) || limparValor(getCell(values, 6, 3)),
    curso:          limparTexto(getCell(values, 7, 1)),
    instituicao:    limparTexto(getCell(values, 8, 1)),
    turma:          limparTexto(getCell(values, 9, 1)),
    anoOrcamento:   limparTexto(getCell(values, 10, 1)),
    anoRealizacao:  limparTexto(getCell(values, 11, 1)),
    semestre:       limparTexto(getCell(values, 12, 1)),
    modeloContrato: limparTexto(getCell(values, 13, 1)),
    ipcaAm:         limparValor(getCell(values, 14, 1)) || limparValor(getCell(values, 19, 5)),
    tempoContrato:  limparValor(getCell(values, 8, 5)),
    tempoFesta:     limparValor(getCell(values, 9, 5)),
    tempoPósBaile:  limparValor(getCell(values, 10, 5)),
  }
}

function parseItensSecao(values, secao, ipcaAm, tempoContrato) {
  const itens = []
  const LINHA_INICIO = 8 // 0-based, mesma lógica do importador xlsx

  for (let r = LINHA_INICIO; r < values.length; r++) {
    const getCel = (c) => getCell(values, r, c)

    const subCat = limparTexto(getCel(4))   // col E
    const itemDesc = limparTexto(getCel(5)) // col F
    if (!subCat && !itemDesc) continue

    const codigo = tratarCodigo(getCel(0))
    const area = limparTexto(getCel(1))
    const moscow = limparTexto(getCel(2))
    const defCusto = limparTexto(getCel(3))
    const fornecedor = limparTexto(getCel(6))
    const qtde = limparValor(getCel(7))
    const valorUnitarioAtual = limparValor(getCel(8))
    const qtdeOrcada = limparValor(getCel(13))
    const valorUnitarioOrcado = limparValor(getCel(14))
    const qtdeContratada = limparValor(getCel(17))
    const valorUnitarioContratado = limparValor(getCel(18))
    const responsavel = limparTexto(getCel(20))
    const status = limparTexto(getCel(21))
    const pgtoStr = limparTexto(getCel(24))
    const valorPago = limparValor(getCel(27))
    const faltaPagar = limparValor(getCel(28))

    // Projetado — lidos direto da PO (espelho)
    const valorProjetado = limparValor(getCel(10))         // K — $ Projetado
    const totalProjetado = limparValor(getCel(11))         // L — Total Projetado

    itens.push({
      id: uuidv4(),
      secao,
      codigo,
      area,
      moscow,
      defCusto,
      subCategoria: subCat,
      item: itemDesc,
      fornecedor,
      qtde,
      valorUnitarioAtual,
      totalAtual: qtde * valorUnitarioAtual,
      valorProjetado,
      totalProjetado,
      qtdeOrcada,
      valorUnitarioOrcado,
      valorOrcado: qtdeOrcada * valorUnitarioOrcado,
      qtdeContratada,
      valorUnitarioContratado,
      valorContratado: qtdeContratada * valorUnitarioContratado,
      responsavel,
      status: status || 'Em aberto',
      pgto: pgtoStr,
      valorPago,
      faltaPagar,
    })
  }

  return itens
}

async function fetchAba(spreadsheetId, nomeAba, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(nomeAba)}?valueRenderOption=UNFORMATTED_VALUE`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (resp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
    err.tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (resp.status === 403) {
    throw new Error('Sem permissão para acessar esta planilha. Verifique se ela está compartilhada com sua conta Google.')
  }
  if (resp.status === 404) return null // aba não existe, ignorar silenciosamente

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.error?.message || `Erro ao ler planilha (HTTP ${resp.status})`)
  }

  const data = await resp.json()
  return data.values || []
}

export async function sincronizarSheets(spreadsheetId, accessToken, onProgress) {
  onProgress?.('Lendo estrutura da planilha...')

  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`
  const metaResp = await fetch(metaUrl, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (metaResp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
    err.tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (!metaResp.ok) {
    const body = await metaResp.json().catch(() => ({}))
    throw new Error(body.error?.message || 'Não foi possível acessar a planilha. Verifique a URL e as permissões.')
  }

  const meta = await metaResp.json()
  const sheetNames = (meta.sheets || []).map(s => s.properties.title)

  // Ler TAP
  const tapName = sheetNames.find(n => {
    const nl = n.toLowerCase()
    return nl.includes('tap') || nl.includes('termo abertura') || nl.includes('termo de abertura')
  })

  let tap = {}
  if (tapName) {
    onProgress?.('Lendo TAP — Termo de Abertura...')
    const values = await fetchAba(spreadsheetId, tapName, accessToken)
    if (values) tap = parseTAP(values)
  }

  const nomesSecoes = {
    '2.1': 'Custo Produção',
    '2.2': 'Custo Artístico',
    '2.3': 'Custo Equipe',
    '2.4': 'Custo Bar & Food',
    '2.5': 'Pré-Eventos / Cerimônia',
    '2.6': 'Cerimônia Religiosa',
    '2.7': 'Colação de Grau',
    '2.8': 'Custos Administrativos',
  }

  const secoes = {}
  for (const nomeAba of sheetNames) {
    const secao = encontrarSecaoAba(nomeAba)
    if (!secao) continue

    onProgress?.(`Lendo ${nomesSecoes[secao] || secao} (${secao})...`)
    try {
      const values = await fetchAba(spreadsheetId, nomeAba, accessToken)
      if (values) {
        secoes[secao] = parseItensSecao(values, secao, tap.ipcaAm || 0.0055, tap.tempoContrato || 24)
      }
    } catch (e) {
      if (e.tipo === 'TOKEN_EXPIRADO') throw e
      console.warn(`Erro ao ler aba "${nomeAba}":`, e)
    }
  }

  // Garantir que todas as seções existam no resultado
  for (const s of ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8']) {
    if (!secoes[s]) secoes[s] = []
  }

  return { tap, secoes }
}

export function extrairSpreadsheetId(url) {
  const match = url?.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] || null
}
