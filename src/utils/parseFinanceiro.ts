import * as XLSX from 'xlsx'

function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.\s]+/g, ' ')
    .trim()
}

function findCol(headers: string[], ...termos: string[]): number {
  const normed = headers.map(norm)
  for (const t of termos) {
    const nt = norm(t)
    const idx = normed.findIndex(h => h.includes(nt))
    if (idx >= 0) return idx
  }
  return -1
}

function parseDate(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number' && val > 1) {
    const d = new Date(Date.UTC(1899, 11, 30) + val * 86400000)
    return d.toISOString().slice(0, 10)
  }
  if (typeof val === 'string') {
    const m = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10)
  }
  return null
}

function limparNumero(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[R$\s.]/g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  return 0
}

// Regra de negócio: vencimentos antes de 2026-01-01 → LIQUIDADO
const CORTE_ATIVO = '2026-01-01'
function corrigirSituacao(situacao: string, vencimento: string | null): string {
  if (vencimento && vencimento < CORTE_ATIVO) return 'LIQUIDADO'
  return situacao.toUpperCase() === 'LIQUIDADO' ? 'LIQUIDADO' : 'ATIVO'
}

function encontrarHeaderIdx(rows: unknown[][], termo: string): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] ?? []
    const textos = (row as unknown[]).filter(c => c != null && typeof c === 'string' && (c as string).trim().length > 0)
    if (textos.length >= 3 && (row as unknown[]).some(c => c && norm(String(c)).includes(norm(termo)))) return i
  }
  return 0
}

// ─── Tipos públicos ───────────────────────────────────────────────

export interface CAPRow {
  fantasia_fornecedor: string
  desc_conta_gerencial: string
  desc_centro_custo: string
  d_vencimento: string | null
  d_competencia: string | null
  v_titulo: number
  situacao: string
  portador: string
  dias_atraso: number
}

export interface CARRow {
  desc_centro_custo: string
  desc_conta_gerencial: string
  categoria: string
  v_lancamento: number
  competencia: string | null
  liquidacao: string | null
}

// ─── Parsers ──────────────────────────────────────────────────────

export async function parseCAPArquivo(arquivo: File): Promise<{ linhas: CAPRow[]; totalLinhas: number }> {
  const buffer = await arquivo.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const abaNome = wb.SheetNames.find(n => n.toLowerCase().replace(/\s+/g, ' ').trim().includes('banco dados'))
  if (!abaNome) throw Object.assign(new Error("Arquivo inválido — aba 'Banco Dados' não encontrada"), { tipo: 'ABA_NAO_ENCONTRADA' })

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaNome], { header: 1, defval: null, raw: true }) as unknown[][]
  const headerIdx = encontrarHeaderIdx(rows, 'vencimento')
  const headers = ((rows[headerIdx] ?? []) as unknown[]).map(c => c != null ? String(c) : '')

  console.log("CAP aba:", abaNome, "| headerIdx:", headerIdx)
  console.log("CAP headers:", headers)
  console.log("CAP total linhas:", rows.length)
  console.log("CAP primeira linha dados:", rows[headerIdx + 1])

  const col = {
    fantasia:    findCol(headers, 'fantasia fornecedor', 'fantasia', 'nome fantasia', 'nome fornecedor', 'nome'),
    gerencial:   findCol(headers, 'desc c gerencial', 'descricao c gerencial', 'desc conta gerencial', 'c gerencial', 'gerencial'),
    centroCusto: findCol(headers, 'desc c custo', 'descricao c custo', 'desc centro custo', 'centro custo', 'c custo'),
    vencimento:  findCol(headers, 'd vencimento', 'vencimento'),
    competencia: findCol(headers, 'd competencia', 'competencia'),
    vTitulo:     findCol(headers, 'v titulo', 'valor titulo'),
    situacao:    findCol(headers, 'situacao'),
    portador:    findCol(headers, 'desc portador', 'descricao portador', 'nome portador', 'portador'),
    diasAtraso:  findCol(headers, 'dias atraso', 'atraso'),
  }

  const linhas: CAPRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[]
    if (!r || r.every(c => c == null)) continue
    const get = (c: number) => (c >= 0 ? r[c] : null)
    const venc = parseDate(get(col.vencimento))
    linhas.push({
      fantasia_fornecedor:  String(get(col.fantasia) ?? '').trim(),
      desc_conta_gerencial: String(get(col.gerencial) ?? '').trim(),
      desc_centro_custo:    String(get(col.centroCusto) ?? '').trim(),
      d_vencimento:         venc,
      d_competencia:        parseDate(get(col.competencia)),
      v_titulo:             limparNumero(get(col.vTitulo)),
      situacao:             corrigirSituacao(String(get(col.situacao) ?? ''), venc),
      portador:             String(get(col.portador) ?? '').trim(),
      dias_atraso:          parseInt(String(get(col.diasAtraso) ?? '0')) || 0,
    })
  }
  return { linhas, totalLinhas: linhas.length }
}

export async function parseCARArquivo(arquivo: File): Promise<{ linhas: CARRow[]; totalLinhas: number }> {
  const buffer = await arquivo.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const abaNome = wb.SheetNames.find(n => n.toLowerCase().trim().includes('consolidado'))
  if (!abaNome) throw Object.assign(new Error("Arquivo inválido — aba 'CONSOLIDADO' não encontrada"), { tipo: 'ABA_NAO_ENCONTRADA' })

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaNome], { header: 1, defval: null, raw: true }) as unknown[][]
  const headerIdx = encontrarHeaderIdx(rows, 'lancamento')
  const headers = ((rows[headerIdx] ?? []) as unknown[]).map(c => c != null ? String(c) : '')

  console.log("CAR aba:", abaNome, "| headerIdx:", headerIdx)
  console.log("CAR headers:", headers)
  console.log("CAR total linhas:", rows.length)
  console.log("CAR primeira linha dados:", rows[headerIdx + 1])

  const col = {
    centroCusto: findCol(headers, 'desc c custo', 'descricao c custo', 'desc centro custo', 'centro custo', 'c custo'),
    gerencial:   findCol(headers, 'desc c gerencial', 'descricao c gerencial', 'desc conta gerencial', 'c gerencial', 'gerencial'),
    categoria:   findCol(headers, 'categoria'),
    vLancamento: findCol(headers, 'v lancamento', 'valor lancamento', 'lancamento'),
    vOriginal:   findCol(headers, 'v original', 'original'),
    competencia: findCol(headers, 'competencia'),
    liquidacao:  findCol(headers, 'liquidacao'),
  }

  const linhas: CARRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[]
    if (!r || r.every(c => c == null)) continue
    const get = (c: number) => (c >= 0 ? r[c] : null)
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

export function fmtCompact(value: number): string {
  const abs = Math.abs(value)
  const neg = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${neg}R$ ${(abs / 1_000_000).toFixed(2).replace('.', ',')} Mi`
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function tempoDesde(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const horas = Math.floor(diff / 3_600_000)
  const dias = Math.floor(diff / 86_400_000)
  if (horas < 1) return 'há poucos minutos'
  if (horas < 24) return `há ${horas}h`
  if (dias === 1) return 'há 1 dia'
  return `há ${dias} dias`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function mesAno(isoDate: string | null): string | null {
  if (!isoDate) return null
  const [ano, mes] = isoDate.split('-')
  return `${MESES[parseInt(mes, 10) - 1]}/${ano}`
}

const ESCOLAS_MEDIO = ['BERNOULLI', 'LOYOLA', 'MARISTA', 'CSAG', 'EABH', 'ESTA', 'MAGNUM']
export function nivelEnsino(nome: string): string {
  if (!nome) return 'Superior'
  const n = nome.toUpperCase()
  if (n.includes('FUNDAMENTAL') || n.includes('NONA SERIE') || n.includes('NONA SÉRIE')) return 'Fundamental'
  if (ESCOLAS_MEDIO.some(e => n.includes(e))) return 'Médio'
  return 'Superior'
}
