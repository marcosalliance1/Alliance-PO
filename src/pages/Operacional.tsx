import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle,
  Loader, Globe, RefreshCw, Ticket,
} from 'lucide-react'
import { useGoogleAuth } from '../contexts/GoogleAuthContext'
import { fetchSheetNames, fetchAba } from '../utils/sheetsSync'

const SHEET_ID = '1VpA4_lRcZlJ75Qc93VZZZvwW748Xnw-UsmQVCB-tRjc'

// ── Abas genéricas a ignorar (match exato normalizado) ────────────────────────
const TABS_IGNORAR = new Set([
  'sheet1', 'índice', 'indice', 'index', 'resumo geral', 'resumo',
  'tap', 'simulador', 'simulador de eventos', 'config',
  'configuracoes', 'configurações',
])

// ── Seções conhecidas (delimitadores de bloco rosa) ───────────────────────────
const SECOES_CONHECIDAS = new Set([
  'dados do evento', 'dados gerais', 'informacoes gerais', 'informações gerais',
  'fornecedores', 'lineup artistico', 'lineup artístico', 'lineup', 'artistico',
  'numeros da turma', 'números da turma', 'numeros', 'números',
  'links uteis', 'links úteis', 'links',
  'cenografia',
])

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventoInfo {
  tabName: string
  nome: string
  date: Date | null
  dateStr: string
  isRealizado: boolean
}

interface Fornecedor {
  categoria: string
  fornecedor: string
  fechado: boolean
}

interface LineupItem {
  horario: string
  artista: string
  obs: string
}

interface EventoDetalhes {
  nomeEvento: string
  tipo: string
  data: string
  diaSemana: string
  local: string
  horario: string
  tematica: string
  totalConvidados: string
  formandos: string
  pagantes: string
  bolsaFolia: string
  dataAdimplencia: string
  vendaDeConvite: string
  fornecedores: Fornecedor[]
  lineup: LineupItem[]
  linkVenda: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function nm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cel(row: unknown[], i: number): string {
  return String(row[i] ?? '').trim()
}

// Match normalizado na coluna A (sem acento, case-insensitive)
function findExact(rows: unknown[][], field: string): string {
  const fieldNorm = nm(field)
  for (const row of rows) {
    if (nm(cel(row, 0)) === fieldNorm) {
      return cel(row, 1) || cel(row, 2) || ''
    }
  }
  return ''
}


function isSecaoConhecida(row: unknown[]): boolean {
  return SECOES_CONHECIDAS.has(nm(cel(row, 0)))
}

// Retorna linhas entre o cabeçalho de seção e o próximo cabeçalho
function secaoRows(rows: unknown[][], headerLabel: string): unknown[][] {
  let start = -1
  for (let i = 0; i < rows.length; i++) {
    if (nm(cel(rows[i], 0)) === nm(headerLabel) && isSecaoConhecida(rows[i])) {
      start = i + 1
      break
    }
  }
  if (start === -1) return []
  const result: unknown[][] = []
  for (let i = start; i < rows.length; i++) {
    if (isSecaoConhecida(rows[i])) break
    if (cel(rows[i], 0) || cel(rows[i], 1)) result.push(rows[i])
  }
  return result
}

// Data do evento: "Data" exato na planilha, fallback ao nome da aba
function parseDateFromTabName(tabName: string): { date: Date | null; dateStr: string } {
  const m = tabName.match(/\|\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (!m) return { date: null, dateStr: '' }
  const day = parseInt(m[1])
  const month = parseInt(m[2]) - 1
  const now = new Date()
  let year = now.getFullYear()
  if (m[3]) {
    year = parseInt(m[3].length === 2 ? '20' + m[3] : m[3])
  } else {
    const candidate = new Date(year, month, day)
    if (candidate < new Date(now.getTime() - 90 * 86400000)) year += 1
  }
  return {
    date: new Date(year, month, day),
    dateStr: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
  }
}

type CanonicalCat = 'Buffet' | 'Bar' | 'Cerveja' | 'Destilados' | 'Japa' | 'Hamburgueria'

function canonicalCat(cat: string): CanonicalCat | null {
  const n = nm(cat)
  if (n.includes('buffet')) return 'Buffet'
  if (n === 'bar' || n.startsWith('bar ')) return 'Bar'
  if (n.includes('cerveja') || n.includes('chopp')) return 'Cerveja'
  if (n.includes('destilados')) return 'Destilados'
  if (n.includes('japa') || n.includes('japonesa')) return 'Japa'
  if (n.includes('hamburguer') || n.includes('burger') || n.includes('hamburgueria')) return 'Hamburgueria'
  return null
}

// ── Parser principal ───────────────────────────────────────────────────────────

function parseEventoDetalhes(rows: unknown[][], tabName: string): EventoDetalhes {
  // ── DIAGNÓSTICO — abra o console (F12) para inspecionar a leitura ──────────
  console.group(`📋 Aba: "${tabName}" (${rows.length} linhas)`)
  console.log('Linhas brutas [i] [colA, colB, colC]:')
  rows.forEach((r, i) => {
    const row = r as unknown[]
    const a = String(row[0] ?? ''), b = String(row[1] ?? ''), c = String(row[2] ?? '')
    if (a || b) console.log(`  [${i}]`, JSON.stringify([a, b, c]))
  })

  // Nome do evento: célula A1 ou B1
  const nomeEvento = cel(rows[0] ?? [], 0) || cel(rows[0] ?? [], 1) || tabName.split('|')[0].trim()

  // Campos com match normalizado na coluna A
  const data           = findExact(rows, 'Data')
  const diaSemana      = findExact(rows, 'Dia da semana')
  const tipo           = findExact(rows, 'Pré Evento')
  const tematica       = findExact(rows, 'Temática')
  const local          = findExact(rows, 'Local')
  const horario        = findExact(rows, 'Horário')
  const totalConvidados  = findExact(rows, 'Total de convidados')
  const formandos        = findExact(rows, 'N° de formandos')
  const pagantes         = findExact(rows, 'N° de formandos pagantes')
  const bolsaFolia       = findExact(rows, 'Bolsa Folia individual')
  const dataAdimplencia  = findExact(rows, 'Data para adimplencia')
  const vendaDeConvite   = findExact(rows, 'Venda de Convite')
  const linkVendaRaw     = findExact(rows, 'Link de venda')
  const linkVenda        = linkVendaRaw.startsWith('http') ? linkVendaRaw : null

  console.log('Campos encontrados:', { data, diaSemana, tipo, tematica, local, horario, totalConvidados, formandos, linkVenda })

  // Seção Fornecedores
  const isBaile = nm(tipo).includes('baile') || nm(tabName).includes('baile')
  const BASE_CATS: CanonicalCat[] = ['Buffet', 'Bar', 'Cerveja', 'Destilados', 'Japa']
  const CATS: CanonicalCat[] = isBaile ? [...BASE_CATS, 'Hamburgueria'] : BASE_CATS

  const fornRows = secaoRows(rows, 'Fornecedores')
  console.log('Seção Fornecedores:', fornRows.map(r => ({ A: (r as unknown[])[0], B: (r as unknown[])[1] })))

  const fornMap: Partial<Record<CanonicalCat, Fornecedor>> = {}
  for (const row of fornRows) {
    const cat = cel(row, 0)
    if (!cat) continue
    const canon = canonicalCat(cat)
    if (!canon || fornMap[canon]) continue
    const fornecedor = cel(row, 1)
    const nForn = nm(fornecedor)
    fornMap[canon] = {
      categoria: canon,
      fornecedor,
      fechado: !!fornecedor &&
        fornecedor !== '-' && fornecedor !== '—' &&
        nForn !== 'nao tem' && nForn !== 'nao' && nForn !== 'nao ha' &&
        fornecedor.length > 1,
    }
  }
  const fornecedores: Fornecedor[] = CATS.map(cat => fornMap[cat] ?? { categoria: cat, fornecedor: '', fechado: false })

  // Seção Lineup Artístico — tenta variações do cabeçalho rosa
  let lineupSection = secaoRows(rows, 'Lineup Artístico')
  if (lineupSection.length === 0) lineupSection = secaoRows(rows, 'Artístico')
  if (lineupSection.length === 0) lineupSection = secaoRows(rows, 'Lineup')
  console.log('Seção Lineup:', lineupSection.map(r => ({ A: (r as unknown[])[0], B: (r as unknown[])[1], C: (r as unknown[])[2] })))

  const lineup: LineupItem[] = []
  let passedHeader = false
  for (const row of lineupSection) {
    const a = nm(cel(row, 0))
    const b = nm(cel(row, 1))
    if ((a.includes('horario') || a.includes('hora')) && (b.includes('artista') || b.includes('atracao'))) {
      passedHeader = true
      continue
    }
    const artista = cel(row, 1) || cel(row, 0)
    if (!artista || (!passedHeader && !cel(row, 0))) continue
    passedHeader = true
    lineup.push({ horario: cel(row, 0), artista, obs: cel(row, 2) || cel(row, 3) || '' })
  }

  console.log('Lineup final:', lineup)
  console.groupEnd()

  return {
    nomeEvento,
    tipo,
    data,
    diaSemana,
    local,
    horario,
    tematica,
    totalConvidados,
    formandos,
    pagantes,
    bolsaFolia,
    dataAdimplencia,
    vendaDeConvite,
    fornecedores,
    lineup,
    linkVenda,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg rounded-xl px-3 py-3">
      <div className="text-text-muted text-xs mb-1">{label}</div>
      <div className="text-text-main text-sm font-semibold leading-snug">{value}</div>
    </div>
  )
}

function EventoDetalhesView({ d }: { d: EventoDetalhes }) {
  return (
    <div className="space-y-5">
      {/* Dados principais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {d.tipo      && <InfoCard label="Tipo"     value={d.tipo} />}
        {d.data      && <InfoCard label="Data"     value={`${d.data}${d.diaSemana ? ` — ${d.diaSemana}` : ''}`} />}
        {d.local     && <InfoCard label="Local"    value={d.local} />}
        {d.horario   && <InfoCard label="Horário"  value={d.horario} />}
        {d.tematica  && <InfoCard label="Temática" value={d.tematica} />}
      </div>

      {/* Números */}
      {(d.totalConvidados || d.formandos || d.pagantes || d.bolsaFolia) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {d.totalConvidados && <InfoCard label="Total Convidados"  value={d.totalConvidados} />}
          {d.formandos       && <InfoCard label="Formandos"         value={d.formandos} />}
          {d.pagantes        && <InfoCard label="Pagantes"          value={d.pagantes} />}
          {d.bolsaFolia      && <InfoCard label="Bolsa Fólia"       value={d.bolsaFolia} />}
        </div>
      )}

      {/* Fornecedores */}
      <div>
        <h4 className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Fornecedores</h4>
        <div className={`grid grid-cols-2 gap-2 ${d.fornecedores.length >= 6 ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
          {d.fornecedores.map(f => (
            <div
              key={f.categoria}
              className={`rounded-xl px-3 py-3 border text-center ${f.fechado ? 'border-success/25 bg-success/5' : 'border-warning/20 bg-bg'}`}
            >
              <div className="text-xs text-text-muted mb-1.5">{f.categoria}</div>
              <div className="flex items-center justify-center gap-1">
                {f.fechado
                  ? <><CheckCircle2 size={12} className="text-success" /><span className="text-xs text-success font-medium">Fechado</span></>
                  : <><AlertTriangle size={12} className="text-warning/70" /><span className="text-xs text-warning/80 font-medium">Pendente</span></>
                }
              </div>
              {f.fechado && f.fornecedor && (
                <div className="text-[10px] text-text-muted mt-1.5 leading-tight truncate">{f.fornecedor}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lineup */}
      {d.lineup.length > 0 && (
        <div>
          <h4 className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Lineup Artístico</h4>
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/4 border-b border-white/8">
                  <th className="text-left px-3 py-2 text-text-muted font-medium w-20">Horário</th>
                  <th className="text-left px-3 py-2 text-text-muted font-medium">Artista</th>
                  <th className="text-left px-3 py-2 text-text-muted font-medium hidden sm:table-cell">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {d.lineup.map((l, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2.5 text-text-muted tabular-nums">{l.horario || '—'}</td>
                    <td className="px-3 py-2.5 text-text-main font-medium">{l.artista}</td>
                    <td className="px-3 py-2.5 text-text-muted hidden sm:table-cell">{l.obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Informações extras e links */}
      {(d.dataAdimplencia || d.vendaDeConvite || d.linkVenda) && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {d.dataAdimplencia && <InfoCard label="Data p/ Adimplência" value={d.dataAdimplencia} />}
            {d.vendaDeConvite  && <InfoCard label="Venda de Convite"    value={d.vendaDeConvite} />}
          </div>
          {d.linkVenda && (
            <a
              href={d.linkVenda}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold py-3 px-5 rounded-xl transition-colors w-fit"
            >
              <Ticket size={15} /> Link de Venda
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function SecaoExpandivel({
  titulo, count, aberta, onToggle, children,
}: {
  titulo: string
  count: number
  aberta: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 text-left"
      >
        {aberta
          ? <ChevronDown size={16} className="text-text-muted" />
          : <ChevronRight size={16} className="text-text-muted" />
        }
        <span className="text-text-main font-semibold text-base flex-1">{titulo}</span>
        <span className="text-text-muted text-sm">{count} evento{count !== 1 ? 's' : ''}</span>
      </button>
      {aberta && children}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function Operacional() {
  const { accessToken, conectado, logando, conectar, invalidarToken } = useGoogleAuth()
  const [eventos, setEventos] = useState<EventoInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [detalhes, setDetalhes] = useState<Record<string, EventoDetalhes | 'loading' | 'error'>>({})
  const [secoes, setSecoes] = useState({ em_andamento: true, realizados: false })

  const fetchEventos = useCallback(async (token: string) => {
    setLoading(true)
    setErro('')
    try {
      const tabNames = await fetchSheetNames(SHEET_ID, token)
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const parsed: EventoInfo[] = []
      for (const tabName of tabNames) {
        // Ignorar abas genéricas
        if (TABS_IGNORAR.has(nm(tabName))) continue
        const { date, dateStr } = parseDateFromTabName(tabName)
        parsed.push({
          tabName,
          nome: tabName.split('|')[0].trim(),
          date,
          dateStr,
          isRealizado: date ? date < now : false,
        })
      }
      setEventos(parsed)
    } catch (err) {
      if ((err as Error & { tipo?: string }).tipo === 'TOKEN_EXPIRADO') invalidarToken()
      else setErro('error')
    } finally {
      setLoading(false)
    }
  }, [invalidarToken])

  useEffect(() => {
    if (accessToken) void fetchEventos(accessToken)
  }, [accessToken, fetchEventos])

  async function toggleEvento(tabName: string) {
    const isOpen = expandidos[tabName]
    setExpandidos(prev => ({ ...prev, [tabName]: !prev[tabName] }))
    if (!isOpen && !detalhes[tabName] && accessToken) {
      setDetalhes(prev => ({ ...prev, [tabName]: 'loading' }))
      try {
        const rows = await fetchAba(SHEET_ID, tabName, accessToken)
        if (!rows || rows.length === 0) {
          setDetalhes(prev => ({ ...prev, [tabName]: 'error' }))
          return
        }
        setDetalhes(prev => ({ ...prev, [tabName]: parseEventoDetalhes(rows, tabName) }))
      } catch (err) {
        if ((err as Error & { tipo?: string }).tipo === 'TOKEN_EXPIRADO') invalidarToken()
        setDetalhes(prev => ({ ...prev, [tabName]: 'error' }))
      }
    }
  }

  const emAndamento = eventos
    .filter(e => !e.isRealizado)
    .sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.getTime() - b.date.getTime()
    })

  const realizados = eventos
    .filter(e => e.isRealizado)
    .sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return b.date.getTime() - a.date.getTime()
    })

  function renderCard(evento: EventoInfo) {
    const isOpen = expandidos[evento.tabName]
    const det = detalhes[evento.tabName]
    return (
      <div key={evento.tabName} className={`rounded-xl overflow-hidden ${isOpen ? 'bg-surface ring-1 ring-white/10' : 'bg-bg'}`}>
        <button
          onClick={() => void toggleEvento(evento.tabName)}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/3 transition-colors text-left"
        >
          <span className="text-text-muted shrink-0">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-text-main font-semibold text-sm">{evento.nome}</div>
            {evento.dateStr && (
              <div className="text-text-muted text-xs mt-0.5">{evento.dateStr}</div>
            )}
          </div>
          {evento.isRealizado && (
            <span className="text-xs text-text-muted/60 shrink-0">Realizado</span>
          )}
        </button>
        {isOpen && (
          <div className="border-t border-white/8 px-4 py-5">
            {det === 'loading' && (
              <div className="flex items-center gap-2 text-text-muted text-sm py-4 justify-center">
                <Loader size={14} className="animate-spin" /> Carregando…
              </div>
            )}
            {det === 'error' && (
              <p className="text-text-muted text-sm text-center py-4">Erro ao carregar dados.</p>
            )}
            {det && det !== 'loading' && det !== 'error' && <EventoDetalhesView d={det} />}
          </div>
        )}
      </div>
    )
  }

  // ── Não conectado ─────────────────────────────────────────────────────────
  if (!conectado && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Calendar size={24} className="text-primary" />
        </div>
        <div>
          <p className="text-text-main font-semibold text-base mb-1">Eventos</p>
          <p className="text-text-muted text-sm max-w-xs">
            Conecte sua conta Google para visualizar os eventos da planilha.
          </p>
        </div>
        <button
          onClick={conectar}
          disabled={logando}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-6 rounded-xl transition-colors"
        >
          {logando ? <Loader size={14} className="animate-spin" /> : <Globe size={14} />}
          {logando ? 'Conectando…' : 'Conectar com Google Drive'}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-text-muted">
        <Loader size={16} className="animate-spin" />
        <span className="text-sm">Carregando eventos…</span>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle size={24} className="text-warning/60" />
        <p className="text-text-muted text-sm">Erro ao carregar lista de eventos.</p>
        <button
          onClick={() => accessToken && void fetchEventos(accessToken)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <RefreshCw size={12} /> Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-text-main font-bold text-xl">Eventos</h1>
        <button
          onClick={() => accessToken && void fetchEventos(accessToken)}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors"
        >
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      <SecaoExpandivel
        titulo="Em Andamento"
        count={emAndamento.length}
        aberta={secoes.em_andamento}
        onToggle={() => setSecoes(prev => ({ ...prev, em_andamento: !prev.em_andamento }))}
      >
        {emAndamento.length === 0
          ? <p className="text-text-muted text-sm text-center py-4">Nenhum evento em andamento.</p>
          : <div className="space-y-2">{emAndamento.map(e => renderCard(e))}</div>
        }
      </SecaoExpandivel>

      <SecaoExpandivel
        titulo="Realizados"
        count={realizados.length}
        aberta={secoes.realizados}
        onToggle={() => setSecoes(prev => ({ ...prev, realizados: !prev.realizados }))}
      >
        {realizados.length === 0
          ? <p className="text-text-muted text-sm text-center py-4">Nenhum evento realizado.</p>
          : <div className="space-y-2">{realizados.map(e => renderCard(e))}</div>
        }
      </SecaoExpandivel>
    </div>
  )
}
