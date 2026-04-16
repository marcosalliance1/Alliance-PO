import * as XLSX from 'xlsx'
import { calcularProjetado } from './calculadora'
import { uuidv4 } from './uuid'

// Mapeamento de abas para seções
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

function encontrarAba(nomeAba) {
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
  // Se vier como data do Excel, extrair o valor numérico
  if (typeof val === 'number') {
    // Pode ser serial date do Excel ou número normal
    if (val > 40000 && val < 50000) {
      // É uma data serial do Excel, converter para string do ano
      const data = new Date((val - 25569) * 86400 * 1000)
      return String(data.getFullYear())
    }
    return String(Math.round(val))
  }
  return String(val).trim()
}

function lerCelula(sheet, coluna, linha) {
  const ref = `${coluna}${linha}`
  const cell = sheet[ref]
  if (!cell) return ''
  return limparTexto(cell.v !== undefined ? cell.v : cell.w || '')
}

function lerCelulaNum(sheet, coluna, linha) {
  const ref = `${coluna}${linha}`
  const cell = sheet[ref]
  if (!cell) return 0
  return limparValor(cell.v !== undefined ? cell.v : 0)
}

// Ler TAP
function lerTAP(workbook) {
  const abaNames = workbook.SheetNames
  const tapName = abaNames.find(n => n.toLowerCase().includes('tap') || n.toLowerCase().includes('termo abertura') || n.toLowerCase().includes('termo de abertura'))
  if (!tapName) return {}

  const sheet = workbook.Sheets[tapName]

  return {
    tipoEnsino: lerCelula(sheet, 'B', 7),
    totalAlunos: lerCelulaNum(sheet, 'F', 7) || lerCelulaNum(sheet, 'D', 7),
    instituicao: lerCelula(sheet, 'B', 9),
    curso: lerCelula(sheet, 'B', 8),
    turma: lerCelula(sheet, 'B', 10),
    anoOrcamento: lerCelula(sheet, 'B', 11),
    anoRealizacao: lerCelula(sheet, 'B', 12),
    semestre: lerCelula(sheet, 'B', 13),
    modeloContrato: lerCelula(sheet, 'B', 14),
    ipcaAm: lerCelulaNum(sheet, 'B', 15) || lerCelulaNum(sheet, 'F', 20),
    tempoContrato: lerCelulaNum(sheet, 'F', 9),
    tempoFesta: lerCelulaNum(sheet, 'F', 10),
    tempoPósBaile: lerCelulaNum(sheet, 'F', 11),
  }
}

// Ler itens de uma aba de seção
function lerItensSecao(sheet, secao, ipcaAm, tempoContrato) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100')
  const itens = []

  // Cabeçalho na linha 8 (índice 7), itens a partir da linha 9 (índice 8)
  const LINHA_INICIO = 8 // índice 0-based

  for (let r = LINHA_INICIO; r <= range.e.r; r++) {
    const getCel = (c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      if (!cell) return null
      return cell.v !== undefined ? cell.v : null
    }

    const subCat = limparTexto(getCel(4)) // Col E
    const itemDesc = limparTexto(getCel(5)) // Col F

    // Pular se ambos vazios
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

    const valorProjetado = calcularProjetado(valorUnitarioAtual, ipcaAm, tempoContrato)

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
      totalProjetado: qtde * valorProjetado,
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

// Função principal de importação
export async function importarXLSX(arquivo, onProgress) {
  const buffer = await arquivo.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  onProgress?.('Lendo Termo de Abertura...')
  const tap = lerTAP(workbook)

  const secoes = {}
  const erros = []
  const resumo = {}

  const ordemSecoes = ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8']
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

  for (const nomeAba of workbook.SheetNames) {
    const secao = encontrarAba(nomeAba)
    if (!secao) continue

    onProgress?.(`Importando ${nomesSecoes[secao] || secao} (${secao})...`)

    try {
      const sheet = workbook.Sheets[nomeAba]
      const itens = lerItensSecao(sheet, secao, tap.ipcaAm || 0.0055, tap.tempoContrato || 24)
      secoes[secao] = itens
      resumo[secao] = itens.length
    } catch (e) {
      erros.push(`Erro ao ler aba "${nomeAba}": ${e.message}`)
    }
  }

  // Garantir que todas as seções existam
  for (const s of ordemSecoes) {
    if (!secoes[s]) secoes[s] = []
  }

  onProgress?.('Finalizando...')

  return {
    tap,
    secoes,
    resumo,
    erros,
    totalItens: Object.values(secoes).reduce((acc, arr) => acc + arr.length, 0),
  }
}
