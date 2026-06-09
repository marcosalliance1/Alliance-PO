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

export interface BoletimRow {
  desc_conta_gerencial: string
  fantasia_cliente_fornecedor: string
  d_vencimento: string | null
  d_liquidacao: string | null
  d_competencia: string | null
  desc_centro_custo: string
  v_original: number
  v_lancamento: number
  tipo: 'RECEITA' | 'DESPESA' | 'RENDIMENTO'
  situacao: 'ATIVO' | 'LIQUIDADO'
}

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

const EXCLUIR_BOLETIM = new Set([
  'transferencia entre contas',
  'mutuo debito',
  'mutuo receita',
  'saldo inicial de bancos',
  'aplicacao financeira',
  'resgate aplicacao',
  'emprestimo bancarios',
])
const RENDIMENTO_BOLETIM = new Set([
  'rendimentos de aplicacoes financeiras',
  'demais receitas financeiras',
])

export async function parseBoletimArquivo(arquivo: File): Promise<{ linhas: BoletimRow[]; totalLinhas: number }> {
  const buffer = await arquivo.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  const abaNome = wb.SheetNames.find(n => n.toUpperCase().trim() === 'CONSOLIDADO')
    ?? wb.SheetNames.find(n => n.toLowerCase().includes('consolidado'))
  if (!abaNome) throw Object.assign(new Error("Arquivo inválido — aba 'CONSOLIDADO' não encontrada"), { tipo: 'ABA_NAO_ENCONTRADA' })

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaNome], { header: 1, defval: null, raw: true }) as unknown[][]
  if (rows.length < 2) throw new Error('Arquivo inválido — dados insuficientes')

  // Header na linha 1 (índice 0)
  const headers = (rows[0] as unknown[]).map(c => c != null ? String(c) : '')

  const col = {
    gerencial:   findCol(headers, 'descricao c gerencial', 'desc c gerencial', 'desc conta gerencial', 'c gerencial', 'gerencial'),
    fantasia:    findCol(headers, 'fantasia cliente fornecedor', 'fantasia cliente', 'fantasia fornecedor', 'fantasia'),
    vencimento:  findCol(headers, 'd vencimento', 'vencimento'),
    liquidacao:  findCol(headers, 'd liquidacao', 'liquidacao'),
    competencia: findCol(headers, 'd competencia', 'competencia'),
    centroCusto: findCol(headers, 'descricao c centro custo', 'desc c centro custo', 'desc centro custo', 'centro custo', 'c custo'),
    vOriginal:   findCol(headers, 'v original', 'original'),
    vLancamento: findCol(headers, 'v lancamento', 'lancamento'),
  }

  const linhas: BoletimRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[]
    if (!r || r.every(c => c == null)) continue
    const get = (c: number) => (c >= 0 ? r[c] : null)

    const gerencial = String(get(col.gerencial) ?? '').trim()
    const normedGer = norm(gerencial)

    if (EXCLUIR_BOLETIM.has(normedGer)) continue

    const vLanc = limparNumero(get(col.vLancamento))
    if (vLanc === 0) continue

    const liquidacao = parseDate(get(col.liquidacao))
    const situacao: 'ATIVO' | 'LIQUIDADO' = liquidacao ? 'LIQUIDADO' : 'ATIVO'

    let tipo: 'RECEITA' | 'DESPESA' | 'RENDIMENTO'
    if (RENDIMENTO_BOLETIM.has(normedGer)) {
      tipo = 'RENDIMENTO'
    } else if (vLanc > 0) {
      tipo = 'RECEITA'
    } else {
      tipo = 'DESPESA'
    }

    linhas.push({
      desc_conta_gerencial: gerencial,
      fantasia_cliente_fornecedor: String(get(col.fantasia) ?? '').trim(),
      d_vencimento:         parseDate(get(col.vencimento)),
      d_liquidacao:         liquidacao,
      d_competencia:        parseDate(get(col.competencia)),
      desc_centro_custo:    String(get(col.centroCusto) ?? '').trim(),
      v_original:           limparNumero(get(col.vOriginal)),
      v_lancamento:         tipo === 'DESPESA' ? Math.abs(vLanc) : vLanc,
      tipo,
      situacao,
    })
  }
  return { linhas, totalLinhas: linhas.length }
}

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
    const gerencial = String(get(col.gerencial) ?? '').trim()
    // Tarifas bancárias têm fonte própria — ignorar no CAP
    if (gerencial.toUpperCase() === 'TARIFAS BANCARIAS') continue
    linhas.push({
      fantasia_fornecedor:  String(get(col.fantasia) ?? '').trim(),
      desc_conta_gerencial: gerencial,
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

export interface TarifasRow {
  fantasia_empresa: string
  desc_conta_gerencial: string
  desc_centro_custo: string
  d_movimento: string | null
  d_vencimento: string | null
  d_competencia: string | null
  v_lancamento: number
  origem: string
  razao_social: string
  situacao: 'LIQUIDADO'
}

export function parseTarifasBuffer(buffer: ArrayBuffer): { linhas: TarifasRow[]; totalLinhas: number; totalValor: number } {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const abaNome = wb.SheetNames[0]
  if (!abaNome) throw new Error('Arquivo inválido — nenhuma aba encontrada')

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaNome], { header: 1, defval: null, raw: true }) as unknown[][]
  if (rows.length < 2) throw new Error('Arquivo inválido — dados insuficientes')

  // Linha 0 = cabeçalho de seção (ignorar); Linha 1 = headers reais
  const headers = (rows[1] as unknown[]).map(c => c != null ? String(c) : '')
  const normedH = headers.map(norm)

  const col = {
    // Match exato para evitar confundir "Empresa" com "Fantasia Empresa"
    empresa:      normedH.findIndex(h => h === 'empresa'),
    fantasia:     findCol(headers, 'fantasia empresa', 'fantasia'),
    dMovimento:   findCol(headers, 'd movimento', 'movimento'),
    vencimento:   findCol(headers, 'vencimento'),
    competencia:  findCol(headers, 'competencia'),
    vLancamento:  findCol(headers, 'v lancamento', 'lancamento'),
    origem:       findCol(headers, 'origem'),
    razaoSocial:  findCol(headers, 'razao social', 'descricao'),
    gerencial:    findCol(headers, 'desc c gerencial', 'descricao c gerencial', 'desc conta gerencial', 'c gerencial', 'gerencial'),
    centroCusto:  findCol(headers, 'desc c custo', 'descricao c custo', 'desc centro custo', 'centro custo', 'c custo'),
  }

  // Localiza o índice da última linha com dados (somatório geral — sempre a última)
  let idxUltima = -1
  for (let i = rows.length - 1; i >= 2; i--) {
    const r = rows[i] as unknown[]
    if (r && r.some(c => c != null)) { idxUltima = i; break }
  }

  const linhas: TarifasRow[] = []
  for (let i = 2; i < rows.length; i++) {
    if (i === idxUltima) continue  // somatório geral — ignorar sempre
    const r = rows[i] as unknown[]
    if (!r || r.every(c => c == null)) continue
    const get = (c: number) => (c >= 0 ? r[c] : null)
    // Segurança extra: pula também se Empresa for nulo/vazio
    const empresa = get(col.empresa)
    if (empresa == null || String(empresa).trim() === '') continue
    linhas.push({
      fantasia_empresa:     String(get(col.fantasia) ?? '').trim(),
      desc_conta_gerencial: String(get(col.gerencial) ?? '').trim(),
      desc_centro_custo:    String(get(col.centroCusto) ?? '').trim(),
      d_movimento:          parseDate(get(col.dMovimento)),
      d_vencimento:         parseDate(get(col.vencimento)),
      d_competencia:        parseDate(get(col.competencia)),
      v_lancamento:         Math.abs(limparNumero(get(col.vLancamento))),
      origem:               String(get(col.origem) ?? '').trim(),
      razao_social:         String(get(col.razaoSocial) ?? '').trim(),
      situacao:             'LIQUIDADO',
    })
  }

  const totalValor = linhas.reduce((s, l) => s + l.v_lancamento, 0)
  return { linhas, totalLinhas: linhas.length, totalValor }
}

// ─── Utilitários de apresentação ──────────────────────────────────

export function fmtCompact(value: number): string {
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
