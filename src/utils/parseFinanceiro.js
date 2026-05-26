import * as XLSX from 'xlsx'

// Normaliza string para comparação de colunas (remove acentos, pontuação, espaços extras)
function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.\s]+/g, ' ')
    .trim()
}

// Encontra índice da coluna por termos parciais
function findCol(headers, ...termos) {
  const normed = headers.map(norm)
  for (const t of termos) {
    const nt = norm(t)
    const idx = normed.findIndex(h => h.includes(nt) || nt.includes(h))
    if (idx >= 0) return idx
  }
  return -1
}

// Converte serial Excel ou string para YYYY-MM-DD
function parseDate(val) {
  if (!val) return null
  if (typeof val === 'number' && val > 1) {
    const d = new Date(Date.UTC(1899, 11, 30) + val * 86400000)
    return d.toISOString().slice(0, 10)
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    // DD/MM/YYYY
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  }
  return null
}

function limparNumero(val) {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[R$\s.]/g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  return 0
}

// Regra de negócio: vencimentos antes de 2026-01-01 → sempre LIQUIDADO
const CORTE_ATIVO = '2026-01-01'
function corrigirSituacao(situacao, vencimento) {
  if (vencimento && vencimento < CORTE_ATIVO) return 'LIQUIDADO'
  const s = String(situacao ?? '').toUpperCase().trim()
  return s === 'LIQUIDADO' ? 'LIQUIDADO' : 'ATIVO'
}

// Encontra linha de header: primeira linha que contenha pelo menos 3 células com texto
function encontrarHeaderIdx(rows, termoObrigatorio) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || []
    const textos = row.filter(c => c != null && typeof c === 'string' && c.trim().length > 0)
    if (textos.length >= 3 && row.some(c => c && norm(String(c)).includes(norm(termoObrigatorio)))) {
      return i
    }
  }
  return 0
}

/**
 * Faz parse do arquivo CAP (Contas a Pagar).
 * Lê a aba "Banco Dados".
 * @param {File} arquivo
 * @returns {Promise<{ linhas: object[], totalLinhas: number }>}
 */
export async function parseCAPArquivo(arquivo) {
  const buffer = await arquivo.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const abaNome = wb.SheetNames.find(n => {
    const nl = n.toLowerCase().replace(/\s+/g, ' ').trim()
    return nl === 'banco dados' || nl === 'banco_dados' || nl.includes('banco dados')
  })
  if (!abaNome) {
    const err = new Error("Arquivo inválido — aba 'Banco Dados' não encontrada")
    err.tipo = 'ABA_NAO_ENCONTRADA'
    err.abaNome = 'Banco Dados'
    throw err
  }

  const sheet = wb.Sheets[abaNome]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })

  const headerIdx = encontrarHeaderIdx(rows, 'vencimento')
  const headers = (rows[headerIdx] || []).map(c => c != null ? String(c) : '')

  const col = {
    fantasia:    findCol(headers, 'fantasia fornecedor', 'fantasia'),
    gerencial:   findCol(headers, 'descricao c gerencial', 'c gerencial', 'gerencial'),
    centroCusto: findCol(headers, 'descricao c custo', 'c custo', 'centro custo'),
    vencimento:  findCol(headers, 'd vencimento', 'vencimento'),
    competencia: findCol(headers, 'd competencia', 'competencia'),
    vTitulo:     findCol(headers, 'v titulo', 'v. titulo', 'valor titulo'),
    situacao:    findCol(headers, 'situacao'),
    portador:    findCol(headers, 'descricao portador', 'portador'),
    diasAtraso:  findCol(headers, 'dias atraso', 'atraso'),
  }

  const linhas = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.every(c => c == null)) continue

    const get = (c) => (c >= 0 ? r[c] : null)
    const venc = parseDate(get(col.vencimento))
    const rawSit = String(get(col.situacao) ?? '').toUpperCase().trim()

    linhas.push({
      fantasia_fornecedor:  String(get(col.fantasia) ?? '').trim(),
      desc_conta_gerencial: String(get(col.gerencial) ?? '').trim(),
      desc_centro_custo:    String(get(col.centroCusto) ?? '').trim(),
      d_vencimento:         venc,
      d_competencia:        parseDate(get(col.competencia)),
      v_titulo:             limparNumero(get(col.vTitulo)),
      situacao:             corrigirSituacao(rawSit, venc),
      portador:             String(get(col.portador) ?? '').trim(),
      dias_atraso:          parseInt(get(col.diasAtraso)) || 0,
    })
  }

  return { linhas, totalLinhas: linhas.length }
}

/**
 * Faz parse do arquivo CAR (Contas a Receber).
 * Lê a aba "CONSOLIDADO".
 * @param {File} arquivo
 * @returns {Promise<{ linhas: object[], totalLinhas: number }>}
 */
export async function parseCARArquivo(arquivo) {
  const buffer = await arquivo.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const abaNome = wb.SheetNames.find(n => {
    const nl = n.toLowerCase().trim()
    return nl === 'consolidado' || nl.includes('consolidado')
  })
  if (!abaNome) {
    const err = new Error("Arquivo inválido — aba 'CONSOLIDADO' não encontrada")
    err.tipo = 'ABA_NAO_ENCONTRADA'
    err.abaNome = 'CONSOLIDADO'
    throw err
  }

  const sheet = wb.Sheets[abaNome]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })

  const headerIdx = encontrarHeaderIdx(rows, 'lancamento')
  const headers = (rows[headerIdx] || []).map(c => c != null ? String(c) : '')

  const col = {
    centroCusto:  findCol(headers, 'descricao c custo', 'c custo', 'centro custo'),
    gerencial:    findCol(headers, 'descricao c gerencial', 'c gerencial', 'gerencial'),
    categoria:    findCol(headers, 'categoria'),
    vLancamento:  findCol(headers, 'v lancamento', 'v. lancamento', 'lancamento'),
    vOriginal:    findCol(headers, 'v original', 'original'),
    competencia:  findCol(headers, 'competencia'),
    liquidacao:   findCol(headers, 'liquidacao'),
  }

  const linhas = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.every(c => c == null)) continue

    const get = (c) => (c >= 0 ? r[c] : null)
    const vLanc = get(col.vLancamento)
    const vOrig = get(col.vOriginal)

    linhas.push({
      desc_centro_custo:    String(get(col.centroCusto) ?? '').trim(),
      desc_conta_gerencial: String(get(col.gerencial) ?? '').trim(),
      categoria:            String(get(col.categoria) ?? '').trim(),
      v_lancamento:         limparNumero(vLanc != null ? vLanc : vOrig),
      competencia:          parseDate(get(col.competencia)),
      liquidacao:           parseDate(get(col.liquidacao)),
    })
  }

  return { linhas, totalLinhas: linhas.length }
}

// ─── Utilitários de apresentação ──────────────────────────────────

export function fmtBRL(value) {
  if (value == null || isNaN(value)) return 'R$ 0'
  const abs = Math.abs(value)
  const neg = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${neg}R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')} Mi`
  if (abs >= 1_000) return `${neg}R$ ${Math.round(abs / 1_000)} Mil`
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function tempoDesde(isoDate) {
  if (!isoDate) return null
  const diff = Date.now() - new Date(isoDate).getTime()
  const horas = Math.floor(diff / 3_600_000)
  const dias = Math.floor(diff / 86_400_000)
  if (horas < 1) return 'há poucos minutos'
  if (horas < 24) return `há ${horas}h`
  if (dias === 1) return 'há 1 dia'
  return `há ${dias} dias`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function mesAno(isoDate) {
  if (!isoDate) return null
  const [ano, mes] = isoDate.split('-')
  return `${MESES[parseInt(mes, 10) - 1]}/${ano}`
}

const ESCOLAS_MEDIO = ['BERNOULLI', 'LOYOLA', 'MARISTA', 'CSAG', 'EABH', 'ESTA', 'MAGNUM']
export function nivelEnsino(nome) {
  if (!nome) return 'Superior'
  const n = nome.toUpperCase()
  if (n.includes('FUNDAMENTAL')) return 'Fundamental'
  if (ESCOLAS_MEDIO.some(e => n.includes(e))) return 'Médio'
  return 'Superior'
}
