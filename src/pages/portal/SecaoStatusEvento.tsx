import { useState, useEffect, useCallback } from 'react'
import { LogIn, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Clock, Ticket } from 'lucide-react'
import { useGoogleAuth } from '../../contexts/GoogleAuthContext'
import { fetchAba } from '../../utils/sheetsSync'
import type { TAP } from '../../types'

const SHEET_ID = '1VpA4_lRcZlJ75Qc93VZZZvwW748Xnw-UsmQVCB-tRjc'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DadosEvento {
  tipo: string
  data: string
  diaSemana: string
  local: string
  endereco: string
  horario: string
  tematica: string
}

interface NumerosTurma {
  totalConvidados: string
  formandos: string
  pagantes: string
  lotes: { nome: string; qtde: string }[]
  totalLotes: number
  bolsaFolia: string
}

interface Fornecedor {
  categoria: string
  fornecedor: string
  obs: string
  fechado: boolean
}

interface LineupItem {
  horario: string
  artista: string
  obs: string
  isAlliance: boolean
}

interface Cenografia {
  tema: string
  instagram: string
  compras: { item: string; valor: string }[]
}

interface EventoStatus {
  dados: DadosEvento
  numeros: NumerosTurma
  fornecedores: Fornecedor[]
  lineup: LineupItem[]
  cenografia: Cenografia | null
  links: { label: string; url: string }[]
  tabName: string
}

// ── Parser helpers ────────────────────────────────────────────────────────────

function nm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function c(row: unknown[], i: number): string {
  return String(row[i] ?? '').trim()
}

function findVal(rows: unknown[][], ...labels: string[]): string {
  for (const row of rows) {
    const a = nm(c(row, 0))
    const b = nm(c(row, 1))
    for (const label of labels) {
      if (a === label || a.startsWith(label + ' ') || a.endsWith(' ' + label)) {
        return c(row, 1) || c(row, 2) || ''
      }
      if (b === label || b.startsWith(label + ' ') || b.endsWith(' ' + label)) {
        return c(row, 2) || c(row, 3) || ''
      }
    }
  }
  return ''
}

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
function diaSemana(s: string): string {
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (!m) return ''
  const y = m[3].length === 2 ? '20' + m[3] : m[3]
  const d = new Date(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`)
  return isNaN(d.getTime()) ? '' : DIAS[d.getDay()] ?? ''
}

function extrairTipo(tabName: string): string {
  const n = nm(tabName)
  // Tab name format: "Pre Internato CMMG 78 | 26/06"
  // Remove the " | date" suffix and institution code to get the type
  const semData = tabName.split('|')[0].trim()
  // Try known types
  if (n.includes('pre internato') || n.includes('pre-internato')) return 'Pré-Internato'
  if (n.includes('baile')) return 'Baile'
  if (n.includes('fim') && n.includes('ciclo')) return 'Fim do Ciclo Básico'
  if (n.includes('meio') && n.includes('curso')) return 'Meio de Curso'
  if (n.includes('integracao')) return 'Integração'
  if (n.includes('start')) return 'Start'
  if (n.includes('x dias') || n.includes('xdias')) return 'Festa X Dias'
  // Fallback: take everything before the institution code (2-5 capital letters)
  const match = semData.match(/^(.*?)\s+[A-Z]{2,5}\s*\d/)
  return (match?.[1] ?? semData).trim()
}

// Detect section header rows (mostly-empty row with a label in col 0)
function isSectionHeader(row: unknown[], keywords: string[]): boolean {
  const a = nm(c(row, 0))
  if (!a) return false
  const nonEmpty = row.filter(v => String(v ?? '').trim().length > 0)
  if (nonEmpty.length > 3) return false
  return keywords.some(k => a.includes(k))
}

const FORNECEDOR_CATS = ['Buffet', 'Bar', 'Chopp', 'Cerveja', 'Hamburgueria', 'Soft Drinks', 'Destilados', 'Japa']
const EXCLUIR_LINKS = ['planilha', 'briefing', 'interno', 'contrato alliance', 'drive alliance']

function parsearAba(rows: unknown[][], tabName: string): EventoStatus {
  const tipo = extrairTipo(tabName)
  const isBaile = nm(tabName).includes('baile')

  // ── Find section boundaries ───────────────────────────────────────────────
  const secs: Record<string, number> = {}
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (isSectionHeader(row, ['dados do evento', 'dados gerais', 'informacoes gerais'])) secs.dados = i
    else if (isSectionHeader(row, ['numeros da turma', 'numeros', 'turma'])) secs.numeros = i
    else if (isSectionHeader(row, ['fornecedores', 'fornecedor'])) secs.fornecedores = i
    else if (isSectionHeader(row, ['lineup', 'artistico', 'atracoes', 'shows'])) secs.lineup = i
    else if (isSectionHeader(row, ['cenografia', 'decoracao', 'tema'])) secs.cenografia = i
    else if (isSectionHeader(row, ['links', 'link uteis', 'links uteis'])) secs.links = i
  }

  function secRows(nome: string): unknown[][] {
    const start = secs[nome]
    if (start === undefined) return []
    const nexts = Object.values(secs).filter(v => v > start).sort((a, b) => a - b)
    const end = nexts[0] ?? rows.length
    return rows.slice(start + 1, end)
  }

  // Fall back to scanning all rows when section not explicitly found
  const dadosRows = secRows('dados').length > 0 ? secRows('dados') : rows

  // ── Bloco 1: Dados do Evento ──────────────────────────────────────────────
  const dataStr = findVal(dadosRows, 'data do evento', 'data', 'DATA')
  const dados: DadosEvento = {
    tipo,
    data: dataStr,
    diaSemana: diaSemana(dataStr),
    local: findVal(dadosRows, 'local', 'espaco', 'local do evento'),
    endereco: findVal(dadosRows, 'endereco', 'endereço', 'rua', 'av'),
    horario: findVal(dadosRows, 'horario', 'hora', 'abertura'),
    tematica: findVal(dadosRows, 'tematica', 'tema', 'temática'),
  }

  // ── Bloco 2: Números da Turma ─────────────────────────────────────────────
  const numRows = secRows('numeros').length > 0 ? secRows('numeros') : rows
  const lotes: { nome: string; qtde: string }[] = []
  let totalLotes = 0
  for (const row of numRows) {
    const a = nm(c(row, 0))
    if (a.includes('lote') && !a.includes('total')) {
      const nome = c(row, 0)
      const qtde = c(row, 1) || c(row, 2) || '0'
      const n = parseInt(qtde.replace(/\D/g, '')) || 0
      lotes.push({ nome, qtde })
      totalLotes += n
    }
  }
  const numeros: NumerosTurma = {
    totalConvidados: findVal(numRows, 'total de convidados', 'convidados', 'total convidados'),
    formandos: findVal(numRows, 'formandos', 'n de formandos', 'numero de formandos'),
    pagantes: findVal(numRows, 'pagantes', 'formandos pagantes', 'pagando'),
    bolsaFolia: findVal(numRows, 'bolsa folia', 'bolsa fólia', 'bolsa individual'),
    lotes,
    totalLotes,
  }

  // ── Bloco 3: Fornecedores ─────────────────────────────────────────────────
  const fornRows = secRows('fornecedores')
  const fornecedores: Fornecedor[] = []
  for (const row of fornRows) {
    const cat = c(row, 0)
    if (!cat) continue
    const catN = nm(cat)
    if (FORNECEDOR_CATS.some(fc => catN.startsWith(nm(fc)))) {
      const fornecedor = c(row, 1)
      const obs = c(row, 2) || c(row, 3) || ''
      const fechado = !!fornecedor && fornecedor !== '-' && fornecedor !== '—' && fornecedor.length > 1
      fornecedores.push({ categoria: cat, fornecedor, obs, fechado })
    }
  }

  // ── Bloco 4: Lineup Artístico ─────────────────────────────────────────────
  const lineupRows = secRows('lineup')
  const lineup: LineupItem[] = []
  let passedHeader = false
  for (const row of lineupRows) {
    const a = nm(c(row, 0))
    const b = nm(c(row, 1))
    // Skip header row
    if ((a.includes('horario') || a.includes('hora')) && (b.includes('artista') || b.includes('atracao'))) {
      passedHeader = true
      continue
    }
    const artista = c(row, 1) || c(row, 0)
    if (!artista || (!passedHeader && !c(row, 0))) continue
    passedHeader = true
    const artistaN = nm(artista)
    lineup.push({
      horario: c(row, 0),
      artista,
      obs: c(row, 2) || c(row, 3) || '',
      isAlliance: artistaN.includes('alliance') || artistaN.includes('dj alliance'),
    })
  }

  // ── Bloco 5: Cenografia (apenas Baile) ────────────────────────────────────
  let cenografia: Cenografia | null = null
  if (isBaile) {
    const cenaRows = secRows('cenografia')
    if (cenaRows.length > 0) {
      const compras: { item: string; valor: string }[] = []
      for (const row of cenaRows) {
        const aN = nm(c(row, 0))
        if (!aN || aN.includes('tema') || aN.includes('instagram') || aN.includes('lista') || aN.includes('compras')) continue
        const v = c(row, 1)
        if (v) compras.push({ item: c(row, 0), valor: v })
      }
      cenografia = {
        tema: findVal(cenaRows, 'tema', 'tematica'),
        instagram: findVal(cenaRows, 'instagram', 'ig', 'insta'),
        compras,
      }
    }
  }

  // ── Bloco 6: Links úteis ──────────────────────────────────────────────────
  const linkRows = secRows('links').length > 0 ? secRows('links') : rows
  const links: { label: string; url: string }[] = []
  const seen = new Set<string>()
  for (const row of linkRows) {
    for (let ci = 0; ci < Math.min(row.length, 5); ci++) {
      const v = c(row, ci)
      if (!v.startsWith('http') || seen.has(v)) continue
      const label = ci === 0 ? (c(row, 1) || v) : (c(row, 0) || 'Link')
      const labelN = nm(label)
      if (EXCLUIR_LINKS.some(ex => labelN.includes(ex))) continue
      seen.add(v)
      links.push({ label, url: v })
      break
    }
  }

  return { dados, numeros, fornecedores, lineup, cenografia, links, tabName }
}

function encontrarAba(abas: string[], tap: TAP): string | null {
  // Project name is typically "INSTITUICAO TURMA" e.g. "CMMG 78"
  const candidates = [
    nm(tap.turma ?? ''),
    `${nm(tap.instituicao ?? '')} ${nm(tap.turma ?? '')}`.trim(),
    nm(tap.instituicao ?? ''),
  ].filter(s => s.length >= 2)

  for (const cand of candidates) {
    const found = abas.find(aba => nm(aba).includes(cand))
    if (found) return found
  }
  return null
}

// ── UI Components ─────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-white/8 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/8 bg-white/3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="bg-bg rounded-xl px-4 py-3">
      <div className="text-text-muted text-xs mb-1">{label}</div>
      <div className="text-text-main text-sm font-semibold leading-snug">{value}</div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  tap: TAP
}

export function SecaoStatusEvento({ tap }: Props) {
  const { accessToken, conectado, logando, conectar, invalidarToken } = useGoogleAuth()
  const [status, setStatus] = useState<EventoStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ultimaAt, setUltimaAt] = useState<Date | null>(null)

  const doFetch = useCallback(async (token: string) => {
    setLoading(true)
    setErro('')
    try {
      // 1. List all tabs
      const metaResp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (metaResp.status === 401) { invalidarToken(); return }
      if (!metaResp.ok) throw new Error(`Erro ao acessar planilha (HTTP ${metaResp.status})`)
      const meta = await metaResp.json() as { sheets: { properties: { title: string } }[] }
      const abas = meta.sheets.map(s => s.properties.title)

      // 2. Find matching tab
      const tabName = encontrarAba(abas, tap)
      if (!tabName) {
        setErro('not_found')
        setLoading(false)
        return
      }

      // 3. Read tab data
      const rows = await fetchAba(SHEET_ID, tabName, token)
      if (!rows || rows.length === 0) {
        setErro('not_found')
        setLoading(false)
        return
      }

      // 4. Parse
      setStatus(parsearAba(rows, tabName))
      setUltimaAt(new Date())
    } catch {
      setErro('error')
    } finally {
      setLoading(false)
    }
  }, [tap, invalidarToken])

  useEffect(() => {
    if (accessToken) void doFetch(accessToken)
  }, [accessToken, doFetch])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="text-sm">Carregando informações do evento…</span>
      </div>
    )
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!conectado && !status) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <ExternalLink className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-text-main font-semibold text-base mb-1">Status do Evento</p>
          <p className="text-text-muted text-sm max-w-xs">
            Conecte sua conta Google para ver as informações atualizadas do evento em tempo real.
          </p>
        </div>
        <button
          onClick={conectar}
          disabled={logando}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-6 rounded-xl transition-colors"
        >
          {logando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          {logando ? 'Conectando…' : 'Conectar com Google'}
        </button>
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (erro === 'not_found') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center text-text-muted">
        <AlertTriangle className="w-8 h-8 text-warning/60" />
        <p className="text-sm">Informações do evento ainda não disponíveis.</p>
        <button
          onClick={() => accessToken && void doFetch(accessToken)}
          className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 mt-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
        </button>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (erro === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertTriangle className="w-6 h-6 text-danger/70" />
        <p className="text-sm text-text-muted">Erro ao carregar dados. Tente novamente.</p>
        <button
          onClick={() => accessToken && void doFetch(accessToken)}
          className="text-xs text-primary hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!status) return null

  const { dados, numeros, fornecedores, lineup, cenografia, links } = status
  const isBaile = nm(status.tabName).includes('baile')

  return (
    <div className="space-y-5">
      {/* Última atualização */}
      {ultimaAt && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <Clock className="w-3.5 h-3.5" />
            Atualizado às {ultimaAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button
            onClick={() => accessToken && void doFetch(accessToken)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      )}

      {/* ── Bloco 1: Dados do Evento ─────────────────────────────────────── */}
      <Card title="Dados do Evento">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {dados.tipo    && <InfoCard label="Tipo de Evento"  value={dados.tipo} />}
          {dados.data    && <InfoCard label="Data"            value={`${dados.data}${dados.diaSemana ? ` — ${dados.diaSemana}` : ''}`} />}
          {dados.local   && <InfoCard label="Local"           value={dados.local} />}
          {dados.endereco && <InfoCard label="Endereço"       value={dados.endereco} />}
          {dados.horario && <InfoCard label="Horário"         value={dados.horario} />}
          {dados.tematica && <InfoCard label="Temática"       value={dados.tematica} />}
        </div>
      </Card>

      {/* ── Bloco 2: Números da Turma ────────────────────────────────────── */}
      {(numeros.totalConvidados || numeros.formandos || numeros.lotes.length > 0) && (
        <Card title="Números da Turma">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {numeros.totalConvidados && <InfoCard label="Total de Convidados"     value={numeros.totalConvidados} />}
            {numeros.formandos       && <InfoCard label="Nº de Formandos"         value={numeros.formandos} />}
            {numeros.pagantes        && <InfoCard label="Formandos Pagantes"      value={numeros.pagantes} />}
            {numeros.bolsaFolia      && <InfoCard label="Bolsa Fólia Individual"  value={numeros.bolsaFolia} />}
          </div>
          {numeros.lotes.length > 0 && (
            <div className="rounded-xl border border-white/8 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/4 border-b border-white/8">
                    <th className="text-left px-3 py-2 text-text-muted font-medium">Lote</th>
                    <th className="text-right px-3 py-2 text-text-muted font-medium">Vendas</th>
                  </tr>
                </thead>
                <tbody>
                  {numeros.lotes.map((l, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2 text-text-main">{l.nome}</td>
                      <td className="px-3 py-2 text-right text-text-main font-medium tabular-nums">{l.qtde}</td>
                    </tr>
                  ))}
                </tbody>
                {numeros.totalLotes > 0 && (
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/4">
                      <td className="px-3 py-2 text-text-muted font-semibold">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-primary tabular-nums">{numeros.totalLotes}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Bloco 3: Fornecedores ────────────────────────────────────────── */}
      {fornecedores.length > 0 && (
        <Card title="Fornecedores">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fornecedores.map((f, i) => (
              <div
                key={i}
                className={`rounded-xl px-4 py-3 border ${f.fechado ? 'border-success/25 bg-success/5' : 'border-white/8 bg-bg'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-muted font-medium">{f.categoria}</span>
                  {f.fechado
                    ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-warning/60 shrink-0" />}
                </div>
                <div className={`text-sm font-semibold ${f.fechado ? 'text-text-main' : 'text-text-muted/60'}`}>
                  {f.fechado ? f.fornecedor : 'Pendente'}
                </div>
                {f.obs && f.fechado && (
                  <div className="text-text-muted text-[11px] mt-1 leading-snug">{f.obs}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Bloco 4: Lineup Artístico ─────────────────────────────────────── */}
      {lineup.length > 0 && (
        <Card title="Lineup Artístico">
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/4 border-b border-white/8">
                  <th className="text-left px-3 py-2.5 text-text-muted font-medium w-20">Horário</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-medium">Artista</th>
                  <th className="text-left px-3 py-2.5 text-text-muted font-medium hidden sm:table-cell">Observações</th>
                </tr>
              </thead>
              <tbody>
                {lineup.map((l, i) => (
                  <tr
                    key={i}
                    className={`border-b border-white/5 last:border-0 ${l.isAlliance ? 'opacity-50' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-text-muted tabular-nums">{l.horario || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-semibold ${l.isAlliance ? 'text-text-muted' : 'text-text-main'}`}>
                        {l.artista}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-text-muted hidden sm:table-cell">{l.obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Bloco 5: Cenografia (apenas Baile) ───────────────────────────── */}
      {isBaile && cenografia && (cenografia.tema || cenografia.instagram || cenografia.compras.length > 0) && (
        <Card title="Cenografia / Tema">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cenografia.tema && <InfoCard label="Tema" value={cenografia.tema} />}
              {cenografia.instagram && (
                <div className="bg-bg rounded-xl px-4 py-3">
                  <div className="text-text-muted text-xs mb-1">Instagram</div>
                  <a
                    href={cenografia.instagram.startsWith('http') ? cenografia.instagram : `https://instagram.com/${cenografia.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm font-semibold hover:underline flex items-center gap-1"
                  >
                    {cenografia.instagram} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
            {cenografia.compras.length > 0 && (
              <div>
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-2">Lista de Compras</p>
                <div className="rounded-xl border border-white/8 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white/4 border-b border-white/8">
                        <th className="text-left px-3 py-2 text-text-muted font-medium">Item</th>
                        <th className="text-right px-3 py-2 text-text-muted font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cenografia.compras.map((comp, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                          <td className="px-3 py-2 text-text-main">{comp.item}</td>
                          <td className="px-3 py-2 text-right text-text-muted tabular-nums">{comp.valor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Bloco 6: Links úteis ─────────────────────────────────────────── */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link, i) => {
            const isIngresso = nm(link.label).includes('ingresso') || nm(link.label).includes('convite') || nm(link.label).includes('venda') || nm(link.label).includes('comprar') || nm(link.label).includes('sympla')
            return (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 rounded-xl px-5 py-4 font-semibold text-sm transition-colors ${
                  isIngresso
                    ? 'bg-primary hover:bg-primary/90 text-white'
                    : 'bg-surface border border-white/10 hover:bg-white/5 text-text-main'
                }`}
              >
                {isIngresso ? <Ticket className="w-5 h-5" /> : <ExternalLink className="w-4 h-4" />}
                {isIngresso ? 'Comprar ingresso' : link.label}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
