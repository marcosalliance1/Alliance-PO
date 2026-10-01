import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChevronDown, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatBRL } from '../utils/formatters'
import { exportarVerbasExcel, type CategoriaBloco, type ColunaProjeto, type LinhaValores } from '../lib/exportarVerbasExcel'

// ── Tipos locais ─────────────────────────────────────────────────────────────
// Lê direto de projetos.secoes — mesmo dado já mantido em dia pelo sync (manual
// ou automático, 10h/17h). Sem pipeline/tabela própria, sem sync próprio.

interface ItemRaw {
  item: string
  subcategoria: string
  valorOrcado: number
}
interface SecaoRaw {
  nome: string
  itens: ItemRaw[]
}
interface ProjetoRaw {
  id: string
  tap: { tipoEscola?: string; turma?: string; instituicao?: string; curso?: string }
  secoes: SecaoRaw[]
  total_convidados_atual?: number | null
}

// ── Categorias fixas, na ordem combinada ────────────────────────────────────
// "Bar" e "Food e Outros" ficam juntos porque são uma seção só na P.O. (2.4 CUSTO
// BAR & FOOD E OUTROS) — não dá pra separar sem inventar regra em cima do texto
// do item. Administrativos e Pré-Eventos ficam de fora (não são "verba" de
// produção do evento).
const CATEGORIAS_ORDEM = [
  'Produção', 'Artístico', 'Equipe', 'Bar & Food e Outros', 'Cerimônia Religiosa', 'Colação de Grau',
] as const

function categoriaDaSecao(nomeSecao: string): string | null {
  const n = (nomeSecao || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (n.includes('administrativ')) return null
  if (n.includes('pre-event') || n.includes('pre event') || n.includes('preevent') || n.includes('pre-eventos')) return null
  if (n.includes('producao')) return 'Produção'
  if (n.includes('artistic')) return 'Artístico'
  if (n.includes('equipe')) return 'Equipe'
  if (n.includes('bar') || n.includes('food')) return 'Bar & Food e Outros'
  if (n.includes('cerimonia')) return 'Cerimônia Religiosa'
  if (n.includes('colacao')) return 'Colação de Grau'
  return null
}

const SEGMENTOS = ['9º Ano', 'Ensino Médio', 'Ensino Superior'] as const
type Segmento = typeof SEGMENTOS[number]

const CORES_SEGMENTO: Record<string, string> = {
  '9º Ano': '#e94560',
  'Ensino Médio': '#0078d4',
  'Ensino Superior': '#00b894',
}

function segmentoDoTipo(tipoEscola?: string): Segmento {
  if (tipoEscola === 'SUPERIOR') return 'Ensino Superior'
  if (tipoEscola === 'FUNDAMENTAL') return '9º Ano'
  return 'Ensino Médio'
}

function linhaVazia(): LinhaValores { return { valores: {}, total: 0 } }
function somar(destino: LinhaValores, projetoId: string, valor: number) {
  destino.valores[projetoId] = (destino.valores[projetoId] ?? 0) + valor
  destino.total += valor
}

// ── Componente principal ──────────────────────────────────────────────────────

export function Verbas() {
  const [projetosRaw, setProjetosRaw] = useState<ProjetoRaw[]>([])
  const [loading, setLoading] = useState(true)

  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroSubcategoria, setFiltroSubcategoria] = useState('')
  const [filtroItem, setFiltroItem] = useState('')
  const [filtroProjetos, setFiltroProjetos] = useState<Set<string>>(new Set())
  const [showProjetoDropdown, setShowProjetoDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProjetoDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Carregar dados — direto de projetos.secoes, sempre em dia com o sync ────
  useEffect(() => {
    setLoading(true)
    supabase
      .from('projetos')
      .select('id, tap, secoes, total_convidados_atual')
      .then(({ data }) => {
        setProjetosRaw((data as ProjetoRaw[]) ?? [])
        setLoading(false)
      })
  }, [])

  // ── Derivações ──────────────────────────────────────────────────────────────

  const projetos = useMemo(() =>
    projetosRaw
      .map(p => ({
        id: p.id,
        nome: p.tap.turma || `${p.tap.instituicao ?? ''} ${p.tap.curso ?? ''}`.trim() || p.id.slice(0, 6),
        segmento: segmentoDoTipo(p.tap.tipoEscola),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
  [projetosRaw])

  const projetosFiltrados = useMemo(() =>
    filtroProjetos.size > 0 ? projetos.filter(p => filtroProjetos.has(p.id)) : projetos,
  [projetos, filtroProjetos])

  const idsFiltrados = useMemo(() => new Set(projetosFiltrados.map(p => p.id)), [projetosFiltrados])

  const totaisPorSegmento = useMemo(() => {
    const totais: Record<string, number> = { '9º Ano': 0, 'Ensino Médio': 0, 'Ensino Superior': 0 }
    const porProjeto = new Map(projetosRaw.map(p => [p.id, p]))
    for (const p of projetos) {
      const raw = porProjeto.get(p.id)
      if (!raw) continue
      for (const secao of raw.secoes ?? []) {
        const categoria = categoriaDaSecao(secao.nome)
        if (!categoria) continue
        for (const it of secao.itens ?? []) {
          if (!it.subcategoria?.trim()) continue
          totais[p.segmento] = (totais[p.segmento] ?? 0) + (it.valorOrcado ?? 0)
        }
      }
    }
    return totais
  }, [projetos, projetosRaw])

  // Todo item válido (categoria reconhecida, não é item-mãe, orçado > 0),
  // já com o filtro de projeto aplicado — fonte única pro gráfico, tabela e totais.
  const itensValidos = useMemo(() => {
    const lista: { projetoId: string; categoria: string; subCategoria: string; item: string; valor: number }[] = []
    for (const p of projetosRaw) {
      if (!idsFiltrados.has(p.id)) continue
      for (const secao of p.secoes ?? []) {
        const categoria = categoriaDaSecao(secao.nome)
        if (!categoria) continue
        for (const it of secao.itens ?? []) {
          if (!it.subcategoria?.trim()) continue // item-mãe / linha de grupo
          const valor = it.valorOrcado ?? 0
          if (valor <= 0) continue
          lista.push({ projetoId: p.id, categoria, subCategoria: it.subcategoria, item: it.item || '(sem nome)', valor })
        }
      }
    }
    return lista
  }, [projetosRaw, idsFiltrados])

  const dadosGrafico = useMemo(() => {
    const porCategoria: Record<string, number> = {}
    for (const i of itensValidos) porCategoria[i.categoria] = (porCategoria[i.categoria] ?? 0) + i.valor
    return CATEGORIAS_ORDEM
      .map(c => ({ name: c, total: porCategoria[c] ?? 0 }))
      .filter(d => d.total > 0)
  }, [itensValidos])

  const subcategorias = useMemo(() =>
    [...new Set(
      itensValidos.filter(i => !filtroCategoria || i.categoria === filtroCategoria).map(i => i.subCategoria),
    )].filter(Boolean).sort(),
  [itensValidos, filtroCategoria])

  const itensTabela = useMemo(() => itensValidos.filter(i => {
    if (filtroCategoria && i.categoria !== filtroCategoria) return false
    if (filtroSubcategoria && i.subCategoria !== filtroSubcategoria) return false
    if (filtroItem && !i.item.toLowerCase().includes(filtroItem.toLowerCase())) return false
    return true
  }), [itensValidos, filtroCategoria, filtroSubcategoria, filtroItem])

  // Monta os blocos Categoria → Sub Categoria → Item, já com subtotal por sub
  // categoria e total por categoria — mesma estrutura usada na tela e no Excel.
  const blocos = useMemo((): CategoriaBloco[] => {
    const porCategoria = new Map<string, Map<string, Map<string, LinhaValores>>>()

    for (const i of itensTabela) {
      if (!porCategoria.has(i.categoria)) porCategoria.set(i.categoria, new Map())
      const porSub = porCategoria.get(i.categoria)!
      if (!porSub.has(i.subCategoria)) porSub.set(i.subCategoria, new Map())
      const porItem = porSub.get(i.subCategoria)!
      if (!porItem.has(i.item)) porItem.set(i.item, linhaVazia())
      somar(porItem.get(i.item)!, i.projetoId, i.valor)
    }

    const resultado: CategoriaBloco[] = []
    for (const categoria of CATEGORIAS_ORDEM) {
      const porSub = porCategoria.get(categoria)
      if (!porSub) continue
      const categoriaTotal = linhaVazia()
      const subcategorias = [...porSub.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([nomeSub, porItem]) => {
        const subTotal = linhaVazia()
        const itens = [...porItem.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([item, linha]) => {
          for (const [pid, v] of Object.entries(linha.valores)) somar(subTotal, pid, v)
          return { item, ...linha }
        })
        for (const [pid, v] of Object.entries(subTotal.valores)) somar(categoriaTotal, pid, v)
        return { nome: nomeSub, itens, ...subTotal }
      })
      resultado.push({ categoria, subcategorias, ...categoriaTotal })
    }
    return resultado
  }, [itensTabela])

  const totalGeral = useMemo(() => {
    const t = linhaVazia()
    for (const bloco of blocos) {
      for (const [pid, v] of Object.entries(bloco.valores)) somar(t, pid, v)
    }
    return t
  }, [blocos])

  // ── Comparativo por Projeto (busca de item) — mesma lógica de antes, agora
  // sobre a mesma fonte única (projetosRaw) em vez de uma query separada ────────
  const comparativoPorProjeto = useMemo(() => {
    const q = filtroItem.trim().toLowerCase()
    if (!q) return []

    const map = new Map<string, {
      projetoId: string; projeto: string; ensino: string; ensinoOrder: number
      itemNome: string; qtde: number; total: number; convidados: number
    }>()

    for (const proj of projetosRaw) {
      if (filtroProjetos.size > 0 && !filtroProjetos.has(proj.id)) continue

      const titulo = proj.tap.turma
        || `${proj.tap.instituicao ?? ''} ${proj.tap.curso ?? ''}`.trim()
        || proj.id.slice(0, 6)
      const tipo = proj.tap.tipoEscola
      const ensino = tipo === 'SUPERIOR' ? 'Superior' : tipo === 'FUNDAMENTAL' ? 'Fundamental' : 'Médio'
      const ensinoOrder = tipo === 'SUPERIOR' ? 0 : tipo === 'FUNDAMENTAL' ? 2 : 1
      const convidados = proj.total_convidados_atual ?? 0

      for (const secao of proj.secoes ?? []) {
        for (const item of secao.itens ?? []) {
          const nome = (item.item || item.subcategoria || '').toLowerCase()
          if (!nome.includes(q)) continue
          const total = item.valorOrcado ?? 0
          if (total <= 0) continue

          const itemNome = item.item || item.subcategoria || ''
          const key = `${proj.id}|||${itemNome}`
          if (!map.has(key)) {
            map.set(key, { projetoId: proj.id, projeto: titulo, ensino, ensinoOrder, itemNome, qtde: 0, total: 0, convidados })
          }
          const entry = map.get(key)!
          entry.total += total
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.ensinoOrder !== b.ensinoOrder) return a.ensinoOrder - b.ensinoOrder
      if (a.projeto !== b.projeto) return a.projeto.localeCompare(b.projeto)
      return b.total - a.total
    })
  }, [filtroItem, projetosRaw, filtroProjetos])

  function handleExportar() {
    const colunas: ColunaProjeto[] = projetosFiltrados.map(p => ({ id: p.id, nome: p.nome }))
    exportarVerbasExcel(blocos, colunas, totalGeral)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Verbas 2026</h1>
          <p className="text-sm text-text-muted mt-0.5">Consolidado orçado por projeto e categoria</p>
        </div>
        <button
          onClick={handleExportar}
          disabled={blocos.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          <Download size={16} />
          Exportar Excel
        </button>
      </div>

      {/* Cards por segmento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SEGMENTOS.map(seg => (
          <div key={seg} className="card">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: CORES_SEGMENTO[seg] }}
              />
              <span className="text-xs font-medium text-text-muted">{seg}</span>
            </div>
            <div className="text-xl font-bold text-text-main">
              {formatBRL(totaisPorSegmento[seg] ?? 0)}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {projetos.filter(p => p.segmento === seg).length} projeto(s)
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico — 1 barra por categoria (fixa), em vez de 1 por projeto */}
      {dadosGrafico.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-text-main mb-4">Total Orçado por Categoria</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dadosGrafico} margin={{ top: 4, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#8892b0', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#8892b0', fontSize: 11 }}
                tickFormatter={v =>
                  new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(v as number)
                }
                width={64}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12,
                }}
                labelStyle={{ color: '#f0f0f0', marginBottom: 4 }}
                formatter={(value) => [formatBRL(Number(value ?? 0)), 'Total Orçado']}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={72} fill="#e94560" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela base */}
      <div className="card">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">

          {/* Multi-select projetos */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProjetoDropdown(v => !v)}
              className="bg-surface-2 border border-white/10 rounded-lg px-3 py-1.5 text-sm flex items-center gap-2 min-w-[200px]"
            >
              {filtroProjetos.size === 0
                ? <span className="text-text-muted">Todos os Projetos</span>
                : <span className="text-text-main">{filtroProjetos.size} projeto(s)</span>
              }
              <ChevronDown size={13} className="ml-auto text-text-muted shrink-0" />
            </button>
            {showProjetoDropdown && (
              <div className="absolute top-full left-0 mt-1 z-50 min-w-[240px] max-h-72 overflow-y-auto rounded-lg border border-white/10 shadow-xl"
                style={{ background: 'var(--color-surface, #0f0f1a)' }}>
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                  <span className="text-xs text-text-muted font-medium">Filtrar por Projeto</span>
                  {filtroProjetos.size > 0 && (
                    <button
                      onClick={() => setFiltroProjetos(new Set())}
                      className="text-[11px] text-text-muted hover:text-text-main"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                {projetos.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filtroProjetos.has(p.id)}
                      onChange={() => setFiltroProjetos(prev => {
                        const next = new Set(prev)
                        if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                        return next
                      })}
                      className="accent-primary shrink-0"
                    />
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CORES_SEGMENTO[p.segmento] ?? '#8892b0' }} />
                    <span className="text-sm text-text-main truncate">{p.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <select
            value={filtroCategoria}
            onChange={e => { setFiltroCategoria(e.target.value); setFiltroSubcategoria('') }}
            className="bg-surface-2 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
          >
            <option value="">Todas as Categorias</option>
            {CATEGORIAS_ORDEM.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filtroSubcategoria}
            onChange={e => setFiltroSubcategoria(e.target.value)}
            className="bg-surface-2 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
          >
            <option value="">Todas as Sub Categorias</option>
            {subcategorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <input
            type="text"
            placeholder="Buscar item..."
            value={filtroItem}
            onChange={e => setFiltroItem(e.target.value)}
            className="bg-surface-2 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main placeholder:text-text-muted flex-1 min-w-48"
          />
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="flex items-center justify-center h-24 text-text-muted text-sm gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Carregando...
          </div>
        ) : blocos.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-10">
            Nenhum item encontrado com os filtros selecionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted min-w-[160px] sticky left-0 bg-surface z-10">
                    Categoria / Sub Categoria / Item
                  </th>
                  {projetosFiltrados.map(p => (
                    <th
                      key={p.id}
                      className="text-right px-3 py-2.5 text-xs font-medium text-text-muted min-w-[150px] whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CORES_SEGMENTO[p.segmento] ?? '#8892b0' }}
                        />
                        {p.nome}
                      </div>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-primary min-w-[150px] whitespace-nowrap">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {blocos.map(bloco => (
                  <Fragment key={bloco.categoria}>
                    <tr className="bg-primary/10">
                      <td className="px-3 py-2 text-xs font-bold text-primary uppercase tracking-wide sticky left-0 bg-surface z-10" style={{ background: 'rgba(233,69,96,0.12)' }}>
                        {bloco.categoria}
                      </td>
                      {projetosFiltrados.map(p => <td key={p.id} />)}
                      <td />
                    </tr>
                    {bloco.subcategorias.map(sub => (
                      <Fragment key={sub.nome}>
                        {sub.itens.map((it, i) => (
                          <tr key={`${bloco.categoria}-${sub.nome}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-3 py-2 text-text-main sticky left-0 bg-surface z-10">
                              <span className="text-text-muted text-xs">{sub.nome}</span>
                              <span className="text-text-muted/50"> — </span>
                              {it.item}
                            </td>
                            {projetosFiltrados.map(p => (
                              <td key={p.id} className="px-3 py-2 text-right tabular-nums">
                                {it.valores[p.id]
                                  ? <span className="text-text-main">{formatBRL(it.valores[p.id])}</span>
                                  : <span className="text-white/20">—</span>}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-medium text-text-main tabular-nums">
                              {formatBRL(it.total)}
                            </td>
                          </tr>
                        ))}
                        <tr key={`sub-${bloco.categoria}-${sub.nome}`} className="border-b border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <td className="px-3 py-1.5 text-xs font-semibold text-text-muted sticky left-0 z-10" style={{ background: '#16213e' }}>
                            Subtotal — {sub.nome}
                          </td>
                          {projetosFiltrados.map(p => (
                            <td key={p.id} className="px-3 py-1.5 text-right text-xs font-semibold text-text-main tabular-nums">
                              {sub.valores[p.id] ? formatBRL(sub.valores[p.id]) : <span className="text-white/20">—</span>}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right text-xs font-semibold text-text-main tabular-nums">
                            {formatBRL(sub.total)}
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                    <tr className="border-b-2 border-white/10" style={{ background: 'rgba(233,69,96,0.06)' }}>
                      <td className="px-3 py-2 text-xs font-bold text-primary sticky left-0 z-10" style={{ background: '#1a1a2e' }}>
                        TOTAL — {bloco.categoria}
                      </td>
                      {projetosFiltrados.map(p => (
                        <td key={p.id} className="px-3 py-2 text-right text-sm font-bold text-primary tabular-nums">
                          {bloco.valores[p.id] ? formatBRL(bloco.valores[p.id]) : <span className="text-white/20">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-sm font-bold text-primary tabular-nums">
                        {formatBRL(bloco.total)}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/20" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <td className="px-3 py-3 text-sm font-bold text-text-main sticky left-0 z-10" style={{ background: '#1a1a2e' }}>
                    TOTAL GERAL
                  </td>
                  {projetosFiltrados.map(p => (
                    <td key={p.id} className="px-3 py-3 text-right text-sm font-bold text-text-main tabular-nums">
                      {totalGeral.valores[p.id] ? formatBRL(totalGeral.valores[p.id]) : <span className="text-white/20">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right text-base font-bold text-primary tabular-nums">
                    {formatBRL(totalGeral.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Tabela Comparativo por Projeto */}
      {filtroItem.trim() && (
        <div className="card">
          <h2 className="text-sm font-semibold text-text-main mb-4">
            Comparativo por Projeto{' '}
            <span className="font-normal text-text-muted">— "{filtroItem}"</span>
          </h2>

          {comparativoPorProjeto.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-8">
              Nenhum projeto com este item cadastrado com valor {'>'} 0.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted min-w-[160px]">Projeto</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted min-w-[180px]">Item</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted min-w-[120px]">Total Orçado</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted">Convidados</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted min-w-[110px]">Custo/Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {(['Superior', 'Médio', 'Fundamental'] as const).flatMap(ensino => {
                    const linhas = comparativoPorProjeto.filter(r => r.ensino === ensino)
                    if (linhas.length === 0) return []
                    const cor = ensino === 'Superior' ? '#00b894' : ensino === 'Médio' ? '#0078d4' : '#e94560'
                    const label = ensino === 'Superior' ? 'Ensino Superior' : ensino === 'Médio' ? 'Ensino Médio' : 'Fundamental / 9º Ano'
                    const projCount = new Set(linhas.map(r => r.projetoId)).size
                    return [
                      <tr key={`h-${ensino}`}>
                        <td colSpan={5} className="px-3 pt-4 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cor }}>{label}</span>
                            <span className="text-xs text-text-muted">· {projCount} projeto(s) · {linhas.length} item(s)</span>
                          </div>
                        </td>
                      </tr>,
                      ...linhas.map((row, i) => (
                        <tr key={`${ensino}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-3 py-2 text-text-main">{row.projeto}</td>
                          <td className="px-3 py-2 text-text-muted">{row.itemNome || <span className="text-white/30">—</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">
                            {formatBRL(row.total)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-muted">
                            {row.convidados > 0 ? row.convidados.toLocaleString('pt-BR') : <span className="text-white/30">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-main">
                            {row.convidados > 0 ? formatBRL(row.total / row.convidados) : <span className="text-white/30">—</span>}
                          </td>
                        </tr>
                      )),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
