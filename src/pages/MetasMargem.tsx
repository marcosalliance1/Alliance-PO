import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FilterX, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  COR_LOCAL, LOCAIS_ORDEM, ROTULO_ENSINO, agruparPorLocal, calcularProjeto, somarResultados,
  type Ensino, type MetasPct, type ProjetoBruto, type ResultadoProjeto,
} from '../lib/economiaFechados'
import { exportarMetasMargemCsv, exportarMetasMargemXlsx } from '../lib/exportarMetasMargemExcel'
import { MultiSelect, type OpcaoMulti } from '../components/verbas/MultiSelect'
import { TabelaLocal } from '../components/metas/TabelaLocal'
import { GraficosMetas } from '../components/metas/GraficosMetas'
import { DetalheProjeto } from '../components/metas/DetalheProjeto'
import { EditorMetas } from '../components/metas/EditorMetas'
import { COR_ECONOMIA, COR_FALTA, COR_META, COR_POTENCIAL, ensinoCurto, pct0, reais } from '../components/metas/formato'
import { lerMetas, salvarMetas } from '../utils/metasMargem'
import { padronizarCaixa } from '../utils/caixa'

// Dashboard "Metas de margem × Economia dos fechados". SOMENTE LEITURA: lê `projetos` (secoes, tap,
// resumo_geral_orcado) e calcula tudo no navegador — nada é gravado.

const COLUNAS = 'id, status, tap, secoes, receitas, custos_adicionais, resumo_geral_orcado, atualizado_em'

const pctMeta = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function Kpi({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub: string; cor?: string }) {
  return (
    <div className="card !p-3.5" style={cor ? { borderTop: `3px solid ${cor}` } : undefined}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{rotulo}</div>
      <div className="mt-1 break-words text-lg font-bold tabular-nums leading-tight text-text-main" style={cor ? { color: cor } : undefined}>{valor}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-text-muted">{sub}</div>
    </div>
  )
}

export function MetasMargem() {
  const [brutos, setBrutos] = useState<ProjetoBruto[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [metas, setMetas] = useState<MetasPct>(() => lerMetas())
  const [editandoMetas, setEditandoMetas] = useState(false)
  const [avisoMetas, setAvisoMetas] = useState<string | null>(null)

  const [fAnos, setFAnos] = useState<Set<string>>(new Set())
  const [fLocais, setFLocais] = useState<Set<string>>(new Set())
  const [fEnsinos, setFEnsinos] = useState<Set<string>>(new Set())
  const [fProjetos, setFProjetos] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [incluirRealizados, setIncluirRealizados] = useState(false)
  const [anoPadraoAplicado, setAnoPadraoAplicado] = useState(false)
  const [abertoId, setAbertoId] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    supabase
      .from('projetos')
      .select(COLUNAS)
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) setErro(error.message)
        setBrutos((data as ProjetoBruto[] | null) ?? [])
        setLoading(false)
      })
    return () => { vivo = false }
  }, [])

  // Cálculo base (com as metas atuais), sem filtros
  const todos = useMemo(() => brutos.map((p) => calcularProjeto(p, metas)), [brutos, metas])

  // Ano padrão: o ano corrente, se houver projetos nele (senão, todos)
  useEffect(() => {
    if (anoPadraoAplicado || todos.length === 0) return
    const atual = String(new Date().getFullYear())
    if (todos.some((r) => String(r.ano) === atual)) setFAnos(new Set([atual]))
    setAnoPadraoAplicado(true)
  }, [todos, anoPadraoAplicado])

  const passa = useCallback((r: ResultadoProjeto, ignorar?: 'projetos') => {
    if (!incluirRealizados && r.status === 'realizado') return false
    if (fAnos.size > 0 && !fAnos.has(String(r.ano ?? ''))) return false
    if (fLocais.size > 0 && !fLocais.has(r.local)) return false
    if (fEnsinos.size > 0 && !fEnsinos.has(r.ensino ?? '')) return false
    if (ignorar !== 'projetos' && fProjetos.size > 0 && !fProjetos.has(r.id)) return false
    const q = semAcento(busca.trim())
    if (q && !semAcento(`${r.turma} ${r.local}`).includes(q)) return false
    return true
  }, [incluirRealizados, fAnos, fLocais, fEnsinos, fProjetos, busca])

  const resultados = useMemo(
    () => todos.filter((r) => passa(r)),
    [todos, passa],
  )
  const grupos = useMemo(() => agruparPorLocal(resultados), [resultados])
  const tot = useMemo(() => somarResultados(resultados), [resultados])

  // ── Opções dos filtros ──
  const opAnos: OpcaoMulti[] = useMemo(() =>
    [...new Set(todos.map((r) => r.ano).filter((a): a is number => a !== null))].sort().map((a) => ({ value: String(a), label: String(a) })),
  [todos])
  const opLocais: OpcaoMulti[] = useMemo(() =>
    LOCAIS_ORDEM.filter((l) => todos.some((r) => r.local === l)).map((l) => ({ value: l, label: l, cor: COR_LOCAL[l] })),
  [todos])
  const opEnsinos: OpcaoMulti[] = (['MEDIO', 'SUPERIOR', 'FUNDAMENTAL'] as Ensino[]).map((e) => ({ value: e, label: ROTULO_ENSINO[e] }))
  const opProjetos: OpcaoMulti[] = useMemo(() =>
    todos
      .filter((r) => passa(r, 'projetos'))
      .sort((a, b) => (a.ano ?? 9999) - (b.ano ?? 9999) || a.turma.localeCompare(b.turma))
      .map((r) => ({ value: r.id, label: padronizarCaixa(r.turma), grupo: String(r.ano ?? 'Sem ano'), subgrupo: ensinoCurto(r), cor: COR_LOCAL[r.local], dica: r.local })),
  [todos, passa])

  const temFiltro = fAnos.size > 0 || fLocais.size > 0 || fEnsinos.size > 0 || fProjetos.size > 0 || busca.trim() !== '' || incluirRealizados
  function limpar() {
    setFAnos(new Set()); setFLocais(new Set()); setFEnsinos(new Set()); setFProjetos(new Set()); setBusca('')
    setIncluirRealizados(false)
  }

  function salvar(m: MetasPct) {
    setMetas(m)
    setEditandoMetas(false)
    setAvisoMetas(salvarMetas(m) ? null : 'O navegador não permitiu salvar as metas: elas valem só enquanto esta página estiver aberta.')
  }

  const aberto = abertoId ? resultados.find((r) => r.id === abertoId) ?? todos.find((r) => r.id === abertoId) ?? null : null
  const fechar = useCallback(() => setAbertoId(null), [])

  const atualizadoEm = useMemo(() => {
    const t = resultados.map((r) => r.atualizadoEm).filter((x): x is string => !!x).sort()
    return t.length ? new Date(t[t.length - 1]) : null
  }, [resultados])
  const comSoma = resultados.filter((r) => r.fonte !== 'planilha')
  const ajustados = resultados.filter((r) => r.localCorrigido)

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Metas de margem</h1>
          <p className="mt-0.5 text-sm text-text-muted">Quanto falta para a margem chegar na meta × quanto os itens fechados já economizaram.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditandoMetas(true)} className="btn-secondary flex items-center gap-2" title="Editar metas de margem">
            <SlidersHorizontal size={16} />
            <span className="text-xs sm:text-sm">Metas: Médio {pctMeta(metas.MEDIO)} · Superior {pctMeta(metas.SUPERIOR)} · Fund. {pctMeta(metas.FUNDAMENTAL)}</span>
          </button>
          <button type="button" onClick={() => exportarMetasMargemCsv(resultados)} disabled={resultados.length === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
            <FileSpreadsheet size={16} /> CSV
          </button>
          <button type="button" onClick={() => exportarMetasMargemXlsx(resultados, metas)} disabled={resultados.length === 0} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            <Download size={16} /> Exportar Excel
          </button>
        </div>
      </div>

      {avisoMetas && <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-text-main">{avisoMetas}</p>}

      {/* Filtros */}
      <div className="card !p-4">
        <div className="flex flex-wrap items-center gap-3">
          <MultiSelect rotulo="Ano da festa" vazio="Todos" opcoes={opAnos} selecionados={fAnos} onChange={setFAnos} />
          <MultiSelect rotulo="Local" vazio="Todos" opcoes={opLocais} selecionados={fLocais} onChange={setFLocais} />
          <MultiSelect rotulo="Ensino" vazio="Todos" opcoes={opEnsinos} selecionados={fEnsinos} onChange={setFEnsinos} />
          <MultiSelect rotulo="Projetos" vazio="Todos" opcoes={opProjetos} selecionados={fProjetos} onChange={setFProjetos} largura={340} />
          <input
            type="text"
            placeholder="Buscar projeto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="min-w-40 flex-1 rounded-lg border border-white/10 bg-surface-2 px-3 py-2.5 text-sm text-text-main placeholder:text-text-muted"
          />
          {temFiltro && (
            <button type="button" onClick={limpar} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-text-muted hover:text-text-main">
              <FilterX size={15} /> Limpar
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-3 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-text-main" title="Por padrão, festas já realizadas ficam de fora">
            <input type="checkbox" checked={incluirRealizados} onChange={(e) => setIncluirRealizados(e.target.checked)} className="h-4 w-4 accent-[#e94560]" />
            Incluir festas já realizadas
          </label>
        </div>
      </div>

      {erro && <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">Não consegui carregar os projetos: {erro}</p>}

      {loading ? (
        <div className="flex h-32 items-center justify-center gap-2 text-sm text-text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Carregando…
        </div>
      ) : resultados.length === 0 ? (
        erro ? null : <p className="card py-12 text-center text-sm text-text-muted">Nenhum projeto com esses filtros.</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Kpi rotulo="Falta total" valor={reais(tot.falta)} cor={tot.falta > 0 ? COR_FALTA : COR_ECONOMIA} sub="para todos chegarem na meta" />
            <Kpi rotulo="Economia líquida" valor={reais(tot.liquida)} cor={tot.liquida >= 0 ? COR_ECONOMIA : COR_FALTA} sub={`economias ${reais(tot.economias)} − estouros ${reais(tot.estouros)}`} />
            <Kpi rotulo="% da falta coberta" valor={pct0(tot.cobertura)} cor={tot.cobertura !== null && tot.cobertura >= 1 ? COR_ECONOMIA : COR_META} sub="economia líquida ÷ falta" />
            <Kpi rotulo="Ainda falta" valor={reais(tot.aindaFalta)} cor={tot.aindaFalta > 0 ? COR_FALTA : COR_ECONOMIA} sub={tot.aindaFalta > 0 ? 'falta menos economia líquida' : 'meta coberta no total'} />
            <Kpi rotulo="Potencial a economizar" valor={reais(tot.estimadosOrcado)} cor={COR_POTENCIAL} sub="orçado dos itens estimados, ainda não contratados" />
            <Kpi rotulo="Fechados a zero" valor={reais(tot.fechadosZero)} sub="itens fechados com contratado R$ 0, já descontados os estouros do mesmo bloco" />
            <Kpi rotulo="Abaixo da meta" valor={`${tot.nAbaixoMeta} de ${tot.nProjetos}`} cor={tot.nAbaixoMeta > 0 ? COR_META : COR_ECONOMIA} sub={tot.nAbaixoMeta === 1 ? 'projeto' : 'projetos'} />
          </div>

          <GraficosMetas resultados={resultados} onAbrir={setAbertoId} />

          {/* Um bloco por local */}
          <div className="space-y-4">
            {grupos.map((g) => (
              <TabelaLocal key={g.local} local={g.local} projetos={[...g.projetos].sort((a, b) => b.aindaFalta - a.aindaFalta)} totais={g.totais} onAbrir={setAbertoId} />
            ))}
          </div>

          {/* Rodapé */}
          <footer className="space-y-1 pb-4 text-[11px] text-text-muted">
            <p>
              Dados atualizados em{' '}
              <b className="text-text-main">{atualizadoEm ? atualizadoEm.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</b>
              {' '}(última sincronização com as planilhas entre os projetos exibidos). Receita e custo orçados vêm do Resumo Geral de cada P.O.
            </p>
            {comSoma.length > 0 && (
              <p>• {comSoma.length === 1 ? 'Um projeto usa' : `${comSoma.length} projetos usam`} a soma dos itens no lugar do Resumo Geral (ainda não lido pelo sync): {comSoma.map((r) => padronizarCaixa(r.turma)).join(', ')}.</p>
            )}
            {ajustados.length > 0 && (
              <p>• Local ajustado no dashboard (o cadastro não foi alterado): {ajustados.map((r) => `${padronizarCaixa(r.turma)} → ${r.local}`).join('; ')}.</p>
            )}
          </footer>
        </>
      )}

      {editandoMetas && <EditorMetas metas={metas} onSalvar={salvar} onFechar={() => setEditandoMetas(false)} />}
      {aberto && <DetalheProjeto r={aberto} onFechar={fechar} />}
    </div>
  )
}
