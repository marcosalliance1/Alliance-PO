import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useGoogleAuth } from '../contexts/GoogleAuthContext'
import { sincronizarVerbas, sleep } from '../utils/verbasSync'
import { formatBRL } from '../utils/formatters'

// ── Tipos locais ─────────────────────────────────────────────────────────────

interface VerbasItemRow {
  id: string
  projeto_id: string
  projeto_nome: string
  segmento: string
  categoria: string
  sub_categoria: string
  item: string
  valor_orcado: number
}

interface ProjetoSumarizacao {
  id: string
  nome: string
  segmento: string
}

interface PivotRow {
  categoria: string
  sub_categoria: string
  item: string
  valores: Record<string, number>
  total: number
}

interface ProjetoComparativo {
  id: string
  tap: { tipoEscola?: string; turma?: string; instituicao?: string; curso?: string }
  secoes: Array<{
    itens: Array<{
      item: string; subcategoria: string
      qtdeContratada: number; valorUnitarioContratado: number; valorContratado: number
      qtdeOrcada: number; valorUnitarioOrcado: number; valorOrcado: number
    }>
  }>
  total_convidados_atual?: number | null
}

// ── Constantes visuais ────────────────────────────────────────────────────────

const SEGMENTOS = ['9º Ano', 'Ensino Médio', 'Ensino Superior'] as const

const CORES_SEGMENTO: Record<string, string> = {
  '9º Ano': '#e94560',
  'Ensino Médio': '#0078d4',
  'Ensino Superior': '#00b894',
}

// ── Componente principal ──────────────────────────────────────────────────────

export function Verbas() {
  const { accessToken, conectar } = useGoogleAuth()

  const [itens, setItens] = useState<VerbasItemRow[]>([])
  const [loadingDados, setLoadingDados] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null)

  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroSubcategoria, setFiltroSubcategoria] = useState('')
  const [filtroItem, setFiltroItem] = useState('')
  const [projetosData, setProjetosData] = useState<ProjetoComparativo[]>([])

  // ── Carregar dados ──────────────────────────────────────────────────────────

  const carregarDados = async () => {
    setLoadingDados(true)
    const { data, error } = await supabase
      .from('verbas_itens')
      .select('*')
      .order('categoria')
      .order('sub_categoria')
      .order('item')
    if (!error && data) setItens(data as VerbasItemRow[])
    setLoadingDados(false)
  }

  useEffect(() => { carregarDados() }, [])

  useEffect(() => {
    supabase
      .from('projetos')
      .select('id, tap, secoes, total_convidados_atual')
      .then(({ data }) => { if (data) setProjetosData(data as ProjetoComparativo[]) })
  }, [])

  // ── Derivações ──────────────────────────────────────────────────────────────

  const projetos = useMemo((): ProjetoSumarizacao[] => {
    const map = new Map<string, ProjetoSumarizacao>()
    for (const it of itens) {
      if (!map.has(it.projeto_id)) {
        map.set(it.projeto_id, { id: it.projeto_id, nome: it.projeto_nome, segmento: it.segmento })
      }
    }
    return Array.from(map.values())
  }, [itens])

  const totaisPorSegmento = useMemo(() => {
    const totais: Record<string, number> = { '9º Ano': 0, 'Ensino Médio': 0, 'Ensino Superior': 0 }
    for (const it of itens) {
      totais[it.segmento] = (totais[it.segmento] ?? 0) + it.valor_orcado
    }
    return totais
  }, [itens])

  const dadosGrafico = useMemo(() => {
    const segOrder = Object.fromEntries(SEGMENTOS.map((s, i) => [s, i]))
    return projetos
      .map(p => ({
        name: p.nome,
        segmento: p.segmento,
        total: itens.filter(it => it.projeto_id === p.id).reduce((s, it) => s + it.valor_orcado, 0),
      }))
      .sort((a, b) => {
        const d = (segOrder[a.segmento] ?? 99) - (segOrder[b.segmento] ?? 99)
        return d !== 0 ? d : a.name.localeCompare(b.name)
      })
  }, [projetos, itens])

  const categorias = useMemo(
    () => [...new Set(itens.map(it => it.categoria))].sort(),
    [itens],
  )

  const subcategorias = useMemo(
    () => [...new Set(
      itens.filter(it => !filtroCategoria || it.categoria === filtroCategoria).map(it => it.sub_categoria),
    )].filter(Boolean).sort(),
    [itens, filtroCategoria],
  )

  const itensFiltrados = useMemo(() => itens.filter(it => {
    if (filtroCategoria && it.categoria !== filtroCategoria) return false
    if (filtroSubcategoria && it.sub_categoria !== filtroSubcategoria) return false
    if (filtroItem && !it.item.toLowerCase().includes(filtroItem.toLowerCase())) return false
    return true
  }), [itens, filtroCategoria, filtroSubcategoria, filtroItem])

  const linhasPivot = useMemo((): PivotRow[] => {
    const map = new Map<string, PivotRow>()
    for (const it of itensFiltrados) {
      const chave = `${it.categoria}|||${it.sub_categoria}|||${it.item}`
      if (!map.has(chave)) {
        map.set(chave, {
          categoria: it.categoria,
          sub_categoria: it.sub_categoria,
          item: it.item,
          valores: {},
          total: 0,
        })
      }
      const row = map.get(chave)!
      row.valores[it.projeto_id] = (row.valores[it.projeto_id] ?? 0) + it.valor_orcado
      row.total += it.valor_orcado
    }
    return Array.from(map.values())
  }, [itensFiltrados])

  const comparativoPorProjeto = useMemo(() => {
    const q = filtroItem.trim().toLowerCase()
    if (!q) return []

    const map = new Map<string, {
      projetoId: string; projeto: string; ensino: string; ensinoOrder: number
      qtde: number; total: number; convidados: number; temCont: boolean; temOrc: boolean
    }>()

    for (const proj of projetosData) {
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

          const useContratado = (item.valorContratado ?? 0) > 0
          const qtde = useContratado ? (item.qtdeContratada ?? 0) : (item.qtdeOrcada ?? 0)
          const total = useContratado ? (item.valorContratado ?? 0) : (item.valorOrcado ?? 0)
          if (total <= 0) continue

          if (!map.has(proj.id)) {
            map.set(proj.id, { projetoId: proj.id, projeto: titulo, ensino, ensinoOrder, qtde: 0, total: 0, convidados, temCont: false, temOrc: false })
          }
          const entry = map.get(proj.id)!
          entry.qtde += qtde
          entry.total += total
          if (useContratado) entry.temCont = true; else entry.temOrc = true
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => a.ensinoOrder !== b.ensinoOrder ? a.ensinoOrder - b.ensinoOrder : b.total - a.total)
  }, [filtroItem, projetosData])

  const statsComparativo = useMemo(() => {
    if (comparativoPorProjeto.length === 0) return null
    const totalGeral = comparativoPorProjeto.reduce((s, r) => s + r.total, 0)
    const qtdeTotal = comparativoPorProjeto.reduce((s, r) => s + r.qtde, 0)
    const vus = comparativoPorProjeto.filter(r => r.qtde > 0).map(r => r.total / r.qtde)
    return {
      media: qtdeTotal > 0 ? totalGeral / qtdeTotal : 0,
      menor: vus.length > 0 ? Math.min(...vus) : 0,
      maior: vus.length > 0 ? Math.max(...vus) : 0,
      totalGeral,
    }
  }, [comparativoPorProjeto])

  // ── Sincronizar ─────────────────────────────────────────────────────────────

  async function handleSincronizar() {
    if (!accessToken) { conectar(); return }

    setSincronizando(true)
    setFeedback(null)
    setProgresso('Buscando projetos...')

    try {
      const { data: rows, error } = await supabase
        .from('projetos')
        .select('id, tap, sheets_url')

      if (error) throw new Error(error.message)

      const comUrl = (rows ?? []).filter(r => r.sheets_url) as Array<{
        id: string
        tap: Record<string, unknown>
        sheets_url: string
      }>

      if (comUrl.length === 0) {
        setFeedback({ tipo: 'erro', msg: 'Nenhum projeto com URL do Google Sheets cadastrada.' })
        return
      }

      const todosItens: {
        projeto_id: string
        projeto_nome: string
        segmento: string
        categoria: string
        sub_categoria: string
        item: string
        valor_orcado: number
      }[] = []

      const idsProcessados: string[] = []
      const erros: string[] = []

      for (let idx = 0; idx < comUrl.length; idx++) {
        const row = comUrl[idx]
        const nome =
          (row.tap.nome as string | undefined) ??
          (row.tap.instituicao as string | undefined) ??
          row.id
        const curso = row.tap.curso as string | undefined

        // Delay entre projetos para evitar quota do Google Sheets API
        if (idx > 0) await sleep(2000)

        try {
          const itensProj = await sincronizarVerbas(
            row.id,
            nome,
            row.sheets_url,
            curso,
            accessToken,
            msg => setProgresso(msg),
          )
          todosItens.push(...itensProj)
          idsProcessados.push(row.id)
        } catch (e) {
          if ((e as Error & { tipo?: string }).tipo === 'TOKEN_EXPIRADO') throw e
          erros.push(`${nome}: ${(e as Error).message}`)
        }
      }

      setProgresso('Salvando no banco...')

      if (idsProcessados.length > 0) {
        const { error: delErr } = await supabase
          .from('verbas_itens')
          .delete()
          .in('projeto_id', idsProcessados)
        if (delErr) throw new Error(delErr.message)
      }

      if (todosItens.length > 0) {
        const BATCH = 500
        for (let i = 0; i < todosItens.length; i += BATCH) {
          const { error: insErr } = await supabase
            .from('verbas_itens')
            .insert(todosItens.slice(i, i + BATCH))
          if (insErr) throw new Error(insErr.message)
        }
      }

      await carregarDados()

      const msg = `${todosItens.length} itens sincronizados de ${idsProcessados.length} projeto(s).`
      const msgErros = erros.length ? ` Erros: ${erros.join('; ')}` : ''
      setFeedback({ tipo: erros.length ? 'erro' : 'sucesso', msg: msg + msgErros })
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: (e as Error).message })
    } finally {
      setSincronizando(false)
      setProgresso('')
    }
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
          onClick={handleSincronizar}
          disabled={sincronizando}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
          {sincronizando ? (progresso || 'Sincronizando...') : 'Sincronizar'}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-lg text-sm ${
          feedback.tipo === 'sucesso'
            ? 'bg-success/10 border border-success/30 text-success'
            : 'bg-danger/10 border border-danger/30 text-danger'
        }`}>
          {feedback.tipo === 'sucesso'
            ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
            : <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />}
          {feedback.msg}
        </div>
      )}

      {/* Cards por segmento */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* Gráfico de barras */}
      {dadosGrafico.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-text-main mb-4">Total Orçado por Projeto</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosGrafico} margin={{ top: 4, right: 16, left: 8, bottom: 72 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#8892b0', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fill: '#8892b0', fontSize: 11 }}
                tickFormatter={v =>
                  new Intl.NumberFormat('pt-BR', {
                    notation: 'compact', compactDisplay: 'short', currency: 'BRL',
                  }).format(v as number)
                }
                width={72}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#f0f0f0', marginBottom: 4 }}
                itemStyle={{ color: '#8892b0' }}
                formatter={(value) => [formatBRL(Number(value ?? 0)), 'Total Orçado']}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {dadosGrafico.map((entry, idx) => (
                  <Cell key={idx} fill={CORES_SEGMENTO[entry.segmento] ?? '#8892b0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legenda manual */}
          <div className="flex gap-5 mt-1 justify-center">
            {SEGMENTOS.map(seg => (
              <div key={seg} className="flex items-center gap-1.5 text-xs text-text-muted">
                <span
                  className="w-3 h-3 rounded-sm inline-block flex-shrink-0"
                  style={{ backgroundColor: CORES_SEGMENTO[seg] }}
                />
                {seg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela base */}
      <div className="card">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={filtroCategoria}
            onChange={e => { setFiltroCategoria(e.target.value); setFiltroSubcategoria('') }}
            className="bg-surface-2 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
          >
            <option value="">Todas as Categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
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
        {loadingDados ? (
          <div className="flex items-center justify-center h-24 text-text-muted text-sm gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Carregando...
          </div>
        ) : linhasPivot.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-10">
            {itens.length === 0
              ? 'Nenhum dado. Clique em Sincronizar para importar.'
              : 'Nenhum item encontrado com os filtros selecionados.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted min-w-[160px] sticky left-0 bg-surface z-10">
                    Categoria
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted min-w-[160px]">
                    Sub Categoria
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted min-w-[200px]">
                    Item
                  </th>
                  {projetos.map(p => (
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
                    Total Geral
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhasPivot.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-3 py-2 text-xs text-text-muted sticky left-0 bg-surface z-10">
                      {row.categoria}
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {row.sub_categoria || <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-3 py-2 text-text-main">{row.item}</td>
                    {projetos.map(p => (
                      <td key={p.id} className="px-3 py-2 text-right tabular-nums">
                        {row.valores[p.id]
                          ? <span className="text-text-main">{formatBRL(row.valores[p.id])}</span>
                          : <span className="text-white/20">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold text-primary tabular-nums">
                      {formatBRL(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
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
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted min-w-[180px]">Projeto</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted">Qtde</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted min-w-[120px]">Valor Unitário</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted min-w-[120px]">Total</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted">Convidados</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted min-w-[110px]">Custo/Conv.</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-text-muted">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {(['Superior', 'Médio', 'Fundamental'] as const).flatMap(ensino => {
                    const linhas = comparativoPorProjeto.filter(r => r.ensino === ensino)
                    if (linhas.length === 0) return []
                    const cor = ensino === 'Superior' ? '#00b894' : ensino === 'Médio' ? '#0078d4' : '#e94560'
                    const label = ensino === 'Superior' ? 'Ensino Superior' : ensino === 'Médio' ? 'Ensino Médio' : 'Fundamental / 9º Ano'
                    return [
                      <tr key={`h-${ensino}`}>
                        <td colSpan={7} className="px-3 pt-4 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cor }}>{label}</span>
                            <span className="text-xs text-text-muted">· {linhas.length} projeto(s)</span>
                          </div>
                        </td>
                      </tr>,
                      ...linhas.map((row, i) => {
                        const vu = row.qtde > 0 ? row.total / row.qtde : null
                        const fonte = row.temCont && row.temOrc ? 'misto' : row.temCont ? 'cont' : 'orc'
                        return (
                          <tr key={`${ensino}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-3 py-2 text-text-main">{row.projeto}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-main">
                              {row.qtde > 0 ? row.qtde.toLocaleString('pt-BR') : <span className="text-white/30">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-text-main">
                              {vu !== null ? formatBRL(vu) : <span className="text-white/30">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">
                              {formatBRL(row.total)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-muted">
                              {row.convidados > 0 ? row.convidados.toLocaleString('pt-BR') : <span className="text-white/30">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-main">
                              {row.convidados > 0 ? formatBRL(row.total / row.convidados) : <span className="text-white/30">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={fonte === 'cont'
                                  ? { background: 'rgba(22,163,74,0.15)', color: '#16A34A' }
                                  : fonte === 'orc'
                                  ? { background: 'rgba(234,179,8,0.15)', color: '#CA8A04' }
                                  : { background: 'rgba(148,163,184,0.15)', color: '#94A3B8' }}
                              >
                                {fonte === 'cont' ? 'Cont.' : fonte === 'orc' ? 'Orç.' : 'Misto'}
                              </span>
                            </td>
                          </tr>
                        )
                      }),
                    ]
                  })}
                </tbody>
                {statsComparativo && (
                  <tfoot>
                    <tr className="border-t-2 border-white/20" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <td className="px-3 py-2.5 text-xs text-text-muted">
                        {comparativoPorProjeto.length} projeto(s)
                      </td>
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 text-right">
                        <div className="text-[10px] text-text-muted">Média VU</div>
                        <div className="text-xs font-semibold text-text-main tabular-nums">{formatBRL(statsComparativo.media)}</div>
                        <div className="text-[10px] text-text-muted tabular-nums mt-0.5">
                          {formatBRL(statsComparativo.menor)} – {formatBRL(statsComparativo.maior)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="text-[10px] text-text-muted">Total Geral</div>
                        <div className="text-xs font-bold text-primary tabular-nums">{formatBRL(statsComparativo.totalGeral)}</div>
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
