import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Projeto, TipoEscola } from '../types'
import { KPICard } from '../components/dashboard/KPICard'
import { GraficoBarras } from '../components/dashboard/GraficoBarras'
import { GraficoLinha } from '../components/dashboard/GraficoLinha'
import { CalendarioEventos } from '../components/dashboard/CalendarioEventos'
import { Header } from '../components/layout/Header'
import { calcResumoProjeto, calcPercentFechados, filtrarItensCalculo } from '../utils/calculos'
import { formatBRL, formatPercent } from '../utils/formatters'
import { FolderOpen, TrendingUp, DollarSign, CheckCircle, SlidersHorizontal, Award, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DashboardGeralProps {
  projetos: Projeto[]
}

type FiltroStatus = 'todos' | 'em_andamento' | 'realizados'

const TIPO_ESCOLA_OPTS: { value: 'TODOS' | TipoEscola; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'SUPERIOR', label: 'Ensino Superior' },
  { value: 'MEDIO', label: 'Ensino Médio' },
  { value: 'FUNDAMENTAL', label: 'Ensino Fundamental' },
]

const STATUS_OPTS: { value: FiltroStatus; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'realizados', label: 'Realizados' },
]

export function DashboardGeral({ projetos }: DashboardGeralProps) {
  const navigate = useNavigate()
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  const [filtroTipoEscola, setFiltroTipoEscola] = useState<'TODOS' | TipoEscola>('TODOS')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('em_andamento')
  const [showVendidoVsOrcado, setShowVendidoVsOrcado] = useState(false)
  const [showConvidados, setShowConvidados] = useState(false)

  const fornecedoresUsados = useMemo(() => {
    const names = new Set<string>()
    for (const p of projetos)
      for (const sec of p.secoes)
        for (const item of sec.itens)
          if (item.fornecedor?.trim()) names.add(item.fornecedor.trim())
    return [...names].sort()
  }, [projetos])

  // Filtro de tipo de escola (aplicado a todos os subsets)
  function filtrarPorTipo(lista: Projeto[]) {
    let r = lista
    if (filtroTipoEscola !== 'TODOS') r = r.filter((p) => p.tap.tipoEscola === filtroTipoEscola)
    if (filtroFornecedor) r = r.filter((p) => p.secoes.some((sec) => sec.itens.some((i) => i.fornecedor?.trim() === filtroFornecedor)))
    return r
  }

  const projetosEmAndamento = useMemo(() => filtrarPorTipo(projetos.filter((p) => p.status !== 'realizado')), [projetos, filtroTipoEscola, filtroFornecedor]) // eslint-disable-line react-hooks/exhaustive-deps
  const projetosRealizados = useMemo(() => filtrarPorTipo(projetos.filter((p) => p.status === 'realizado')), [projetos, filtroTipoEscola, filtroFornecedor]) // eslint-disable-line react-hooks/exhaustive-deps

  const projetosFiltrados = useMemo(() => {
    if (filtroStatus === 'em_andamento') return projetosEmAndamento
    if (filtroStatus === 'realizados') return projetosRealizados
    return [...projetosEmAndamento, ...projetosRealizados]
  }, [filtroStatus, projetosEmAndamento, projetosRealizados])

  // KPIs — em andamento
  const kpisEmAndamento = useMemo(() => {
    let totalReceita = 0
    let totalCusto = 0
    let totalFechados = 0
    let totalItens = 0
    for (const p of projetosEmAndamento) {
      const resumo = calcResumoProjeto(p)
      totalReceita += resumo.receitaBaile.orcado
      totalCusto += resumo.custoTotal.orcado
      const pct = calcPercentFechados(p)
      const itens = p.secoes.reduce((s, sec) => s + sec.itens.length, 0)
      totalFechados += pct * itens
      totalItens += itens
    }
    return {
      totalReceita,
      margem: totalReceita - totalCusto,
      pctFechados: totalItens > 0 ? totalFechados / totalItens : 0,
    }
  }, [projetosEmAndamento])

  // KPIs — realizados
  const kpisRealizados = useMemo(() => {
    let totalContratado = 0
    let totalPago = 0
    let margemReal = 0
    for (const p of projetosRealizados) {
      const resumo = calcResumoProjeto(p)
      totalContratado += resumo.custoTotal.contratado
      const pagoEverest = resumo.custoTotal.pago
      totalPago += pagoEverest
      margemReal += resumo.receitaBaile.contratado - pagoEverest
    }
    return { totalContratado, totalPago, margemReal }
  }, [projetosRealizados])

  const totalConvidadosEmAndamento = useMemo(() =>
    projetosEmAndamento.reduce((s, p) => s + (p.totalConvidadosAtual ?? 0), 0),
  [projetosEmAndamento])

  const totalConvidadosRealizados = useMemo(() =>
    projetosRealizados.reduce((s, p) => s + (p.totalConvidadosAtual ?? 0), 0),
  [projetosRealizados])

  // Sempre soma em andamento + realizados — não deve ficar zerado quando o
  // toggle de status (topo) está em "Em Andamento", já que convidados de
  // eventos passados também contam pro total.
  const projetosParaConvidados = useMemo(() =>
    [...projetosEmAndamento, ...projetosRealizados],
  [projetosEmAndamento, projetosRealizados])

  const totalConvidadosGeral = useMemo(() =>
    projetosParaConvidados.reduce((s, p) => s + (p.totalConvidadosAtual ?? 0), 0),
  [projetosParaConvidados])

  const convidadosPorEnsino = useMemo(() => {
    const grupos: Record<'SUPERIOR' | 'MEDIO' | 'FUNDAMENTAL', { id: string; titulo: string; total: number; realizado: boolean }[]> = {
      SUPERIOR: [], MEDIO: [], FUNDAMENTAL: [],
    }
    for (const p of projetosParaConvidados) {
      if (!p.totalConvidadosAtual) continue
      const tipo = (p.tap.tipoEscola ?? 'MEDIO') as 'SUPERIOR' | 'MEDIO' | 'FUNDAMENTAL'
      const titulo = p.tap.turma || `${p.tap.instituicao} ${p.tap.curso}`.trim() || `Projeto #${p.id.slice(0, 6)}`
      grupos[tipo].push({ id: p.id, titulo, total: p.totalConvidadosAtual, realizado: p.status === 'realizado' })
    }
    for (const tipo of ['SUPERIOR', 'MEDIO', 'FUNDAMENTAL'] as const) {
      // Em andamento primeiro (ordenados por total), depois realizados — a UI separa os dois grupos com uma linha
      grupos[tipo].sort((a, b) => (a.realizado === b.realizado ? b.total - a.total : a.realizado ? 1 : -1))
    }
    return grupos
  }, [projetosParaConvidados])

  const TIPO_LABELS: Record<string, string> = {
    SUPERIOR: 'Ensino Superior',
    MEDIO: 'Ensino Médio',
    FUNDAMENTAL: 'Ensino Fundamental',
  }

  const barDataPorTipo = useMemo(() => {
    const grupos = new Map<string, { nome: string; receita: number; custo: number; margem: number }[]>()
    for (const p of projetosFiltrados) {
      if (p.status === 'realizado') continue
      const tipo = p.tap.tipoEscola ?? 'MEDIO'
      const resumo = calcResumoProjeto(p)
      const custo = filtroFornecedor
        ? p.secoes.reduce((s, sec) =>
            s + filtrarItensCalculo(sec.itens)
              .filter(i => i.fornecedor?.trim() === filtroFornecedor)
              .reduce((ss, i) => ss + (i.valorOrcado ?? 0), 0), 0)
        : resumo.custoTotal.orcado
      const entry = { nome: p.tap.turma || p.id.slice(0, 6), receita: resumo.receitaBaile.orcado, custo, margem: resumo.margem.orcado }
      grupos.set(tipo, [...(grupos.get(tipo) ?? []), entry])
    }
    return (['SUPERIOR', 'MEDIO', 'FUNDAMENTAL'] as const)
      .filter(t => grupos.has(t))
      .map(t => ({ tipo: t, label: TIPO_LABELS[t], data: grupos.get(t)! }))
  }, [projetosFiltrados, filtroFornecedor])

  // Dados para gráfico "Contratado vs Pago" (realizados)
  const barDataRealizados = useMemo(() => {
    return projetosRealizados.map((p) => {
      const resumo = calcResumoProjeto(p)
      return {
        nome: p.tap.turma || p.id.slice(0, 6),
        contratado: resumo.custoTotal.contratado,
        pago: resumo.custoTotal.pago,
      }
    })
  }, [projetosRealizados])

  const custoFornecedorTotal = useMemo(() => {
    if (!filtroFornecedor) return 0
    return projetosFiltrados.reduce((total, p) =>
      total + p.secoes.reduce((s, sec) =>
        s + filtrarItensCalculo(sec.itens)
          .filter(i => i.fornecedor?.trim() === filtroFornecedor)
          .reduce((ss, i) => ss + (i.valorOrcado ?? 0), 0), 0), 0)
  }, [projetosFiltrados, filtroFornecedor])

  const lineData = useMemo(() => {
    const byAno = new Map<number, { receita: number; margem: number }>()
    for (const p of projetosFiltrados) {
      if (p.status === 'realizado') continue
      const ano = p.tap.anoRealizacao
      const resumo = calcResumoProjeto(p)
      const cur = byAno.get(ano) ?? { receita: 0, margem: 0 }
      byAno.set(ano, {
        receita: cur.receita + resumo.receitaBaile.orcado,
        margem: cur.margem + resumo.margem.orcado,
      })
    }
    return Array.from(byAno.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ano, vals]) => ({ ano: String(ano), ...vals }))
  }, [projetosFiltrados])

  const vendidoVsOrcadoData = useMemo(() =>
    projetosFiltrados
      .filter(p => p.status !== 'realizado')
      .map((p) => {
        const resumo = calcResumoProjeto(p)
        return {
          nome: p.tap.turma || p.id.slice(0, 6),
          receitaVendido: resumo.receitaBaile.vendido,
          receitaOrcado: resumo.receitaBaile.orcado,
          custoVendido: resumo.custoTotal.vendido,
          custoOrcado: resumo.custoTotal.orcado,
        }
      }),
  [projetosFiltrados])

  const ranking = useMemo(() => {
    return projetosFiltrados
      .filter(p => p.status !== 'realizado')
      .map((p) => {
        const resumo = calcResumoProjeto(p)
        const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)
        const margemProjetadaPct = pct(resumo.receitaBaile.vendido - resumo.custoTotal.projetado, resumo.receitaBaile.vendido)
        const margemOrcadaPct = pct(resumo.receitaBaile.orcado - resumo.custoTotal.orcado, resumo.receitaBaile.orcado)
        const margemContratadaPct = pct(resumo.receitaBaile.contratado - resumo.custoTotal.contratado, resumo.receitaBaile.contratado)
        const faltaPagarR = resumo.custoTotal.faltaPagar
        const pctFalta = pct(faltaPagarR, resumo.custoTotal.contratado)
        return { projeto: p, margemProjetadaPct, margemOrcadaPct, margemContratadaPct, faltaPagarR, pctFalta, alertaFalta: pctFalta > 20 }
      })
      .sort((a, b) => b.margemOrcadaPct - a.margemOrcadaPct)
  }, [projetosFiltrados])

  const resumoPorTipo = useMemo(() => {
    const grupos: Record<'SUPERIOR' | 'MEDIO' | 'FUNDAMENTAL', { receita: number; custo: number; count: number }> = {
      SUPERIOR: { receita: 0, custo: 0, count: 0 },
      MEDIO: { receita: 0, custo: 0, count: 0 },
      FUNDAMENTAL: { receita: 0, custo: 0, count: 0 },
    }
    for (const p of projetosFiltrados) {
      if (p.status === 'realizado') continue
      const tipo = (p.tap.tipoEscola ?? 'MEDIO') as 'SUPERIOR' | 'MEDIO' | 'FUNDAMENTAL'
      const resumo = calcResumoProjeto(p)
      grupos[tipo].receita += resumo.receitaBaile.orcado
      grupos[tipo].custo += resumo.custoTotal.orcado
      grupos[tipo].count += 1
    }
    const receitaTotal = grupos.SUPERIOR.receita + grupos.MEDIO.receita + grupos.FUNDAMENTAL.receita
    return (['SUPERIOR', 'MEDIO', 'FUNDAMENTAL'] as const)
      .map((tipo) => {
        const g = grupos[tipo]
        const margem = g.receita - g.custo
        return {
          tipo,
          receita: g.receita,
          margem,
          count: g.count,
          margemPct: g.receita > 0 ? (margem / g.receita) * 100 : 0,
          participacao: receitaTotal > 0 ? (g.receita / receitaTotal) * 100 : 0,
        }
      })
      .filter((g) => g.count > 0)
  }, [projetosFiltrados])

  const selectCls = 'bg-surface border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main outline-none focus:border-primary hover:border-white/20 transition-colors'

  const showEmAndamentoCharts = filtroStatus !== 'realizados'
  const showRealizadosCharts = filtroStatus === 'realizados'

  return (
    <div>
      <Header title="Dashboard Geral" subtitle="Consolidado de todos os projetos" />

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="card flex flex-wrap items-center gap-2 mb-6 p-3">
        <div className="flex items-center gap-1.5 text-text-muted pr-2 border-r border-white/10 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Filtros</span>
        </div>

        {/* Toggle status */}
        <div className="flex gap-1 bg-surface-2 rounded-inner p-0.5">
          {STATUS_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFiltroStatus(opt.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filtroStatus === opt.value ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Toggle tipo de ensino */}
        <div className="flex gap-1 bg-surface-2 rounded-inner p-0.5">
          {TIPO_ESCOLA_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFiltroTipoEscola(opt.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filtroTipoEscola === opt.value ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filtroStatus !== 'realizados' && fornecedoresUsados.length > 0 && (
          <select value={filtroFornecedor} onChange={(e) => setFiltroFornecedor(e.target.value)} className={selectCls}>
            <option value="">Todos os fornecedores</option>
            {fornecedoresUsados.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}

        {(filtroFornecedor || filtroTipoEscola !== 'TODOS' || filtroStatus !== 'em_andamento') && (
          <button
            onClick={() => { setFiltroFornecedor(''); setFiltroTipoEscola('TODOS'); setFiltroStatus('em_andamento') }}
            className="ml-auto text-xs text-text-muted hover:text-text-main transition-colors underline underline-offset-2"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── KPIs "Todos" — dois blocos separados ──────────────────────── */}
      {filtroStatus === 'todos' && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Bloco Em Andamento */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Em Andamento · {projetosEmAndamento.length}</p>
            <div className="grid grid-cols-2 gap-3">
              <KPICard title="Receita Orçada" value={formatBRL(kpisEmAndamento.totalReceita)} icon={DollarSign} color="#00b894" />
              <KPICard title="Margem Orçada" value={formatBRL(kpisEmAndamento.margem)} icon={TrendingUp} color={kpisEmAndamento.margem >= 0 ? '#00b894' : '#e17055'} />
              <KPICard title="Projetos" value={String(projetosEmAndamento.length)} icon={FolderOpen} color="#74b9ff" />
              <KPICard title="Itens Fechados" value={formatPercent(kpisEmAndamento.pctFechados)} icon={CheckCircle} color="#fdcb6e" />
              {totalConvidadosEmAndamento > 0 && (
                <KPICard title="Total de Convidados" value={totalConvidadosEmAndamento.toLocaleString('pt-BR')} icon={Users} color="#74b9ff" />
              )}
            </div>
          </div>
          {/* Bloco Realizados */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-success/70 uppercase tracking-wider mb-3">Realizados · {projetosRealizados.length}</p>
            <div className="grid grid-cols-2 gap-3">
              <KPICard title="Total Contratado" value={formatBRL(kpisRealizados.totalContratado)} icon={DollarSign} color="#6366F1" />
              <KPICard title="Total Pago (Everest)" value={formatBRL(kpisRealizados.totalPago)} icon={CheckCircle} color="#00b894" />
              <KPICard title="Margem Real" value={formatBRL(kpisRealizados.margemReal)} icon={TrendingUp} color={kpisRealizados.margemReal >= 0 ? '#00b894' : '#e17055'} />
              <KPICard title="Projetos" value={String(projetosRealizados.length)} icon={FolderOpen} color="#74b9ff" />
              {totalConvidadosRealizados > 0 && (
                <KPICard title="Total de Convidados" value={totalConvidadosRealizados.toLocaleString('pt-BR')} icon={Users} color="#74b9ff" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs "Em Andamento" ───────────────────────────────────────── */}
      {filtroStatus === 'em_andamento' && (
        <div className={`grid gap-4 mb-6 ${totalConvidadosEmAndamento > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <KPICard title="Projetos" value={String(projetosEmAndamento.length)} icon={FolderOpen} color="#74b9ff" />
          <KPICard title="Receita Orçada" value={formatBRL(kpisEmAndamento.totalReceita)} icon={DollarSign} color="#00b894" />
          <KPICard title="Margem Orçada" value={formatBRL(kpisEmAndamento.margem)} icon={TrendingUp} color={kpisEmAndamento.margem >= 0 ? '#00b894' : '#e17055'} />
          <KPICard title="Itens Fechados" value={formatPercent(kpisEmAndamento.pctFechados)} icon={CheckCircle} color="#fdcb6e" />
          {totalConvidadosEmAndamento > 0 && (
            <KPICard title="Total de Convidados" value={totalConvidadosEmAndamento.toLocaleString('pt-BR')} icon={Users} color="#74b9ff" />
          )}
        </div>
      )}

      {/* ── KPIs "Realizados" ─────────────────────────────────────────── */}
      {filtroStatus === 'realizados' && (
        <div className={`grid gap-4 mb-6 ${totalConvidadosRealizados > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <KPICard title="Projetos Realizados" value={String(projetosRealizados.length)} icon={FolderOpen} color="#6366F1" />
          <KPICard title="Total Contratado" value={formatBRL(kpisRealizados.totalContratado)} icon={DollarSign} color="#6366F1" />
          <KPICard title="Total Pago (Everest)" value={formatBRL(kpisRealizados.totalPago)} icon={CheckCircle} color="#00b894" />
          <KPICard title="Margem Real" value={formatBRL(kpisRealizados.margemReal)} icon={TrendingUp} color={kpisRealizados.margemReal >= 0 ? '#00b894' : '#e17055'} />
          {totalConvidadosRealizados > 0 && (
            <KPICard title="Total de Convidados" value={totalConvidadosRealizados.toLocaleString('pt-BR')} icon={Users} color="#74b9ff" />
          )}
        </div>
      )}

      {/* ── Calendário de Eventos ──────────────────────────────────────── */}
      <CalendarioEventos projetos={projetosFiltrados} />

      {/* ── Convidados por Ensino ─────────────────────────────────────── */}
      {totalConvidadosGeral > 0 && (
        <div className="card mb-6">
          <button className="flex items-center gap-2 w-full text-left" onClick={() => setShowConvidados((v) => !v)}>
            {showConvidados ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
            <Users className="w-4 h-4" style={{ color: '#74b9ff' }} />
            <h3 className="text-sm font-semibold text-text-main">Convidados por Ensino</h3>
            <div className="ml-auto text-right">
              <p className="text-sm font-bold text-text-main">{totalConvidadosGeral.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-text-muted">
                {totalConvidadosEmAndamento.toLocaleString('pt-BR')} em andamento · {totalConvidadosRealizados.toLocaleString('pt-BR')} realizados
              </p>
            </div>
          </button>
          {showConvidados && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              {(['SUPERIOR', 'MEDIO', 'FUNDAMENTAL'] as const).map((tipo) => {
                const cor = tipo === 'SUPERIOR' ? '#74b9ff' : tipo === 'MEDIO' ? '#00b894' : '#fdcb6e'
                const label = tipo === 'SUPERIOR' ? 'Superior' : tipo === 'MEDIO' ? 'Médio' : 'Fundamental'
                const lista = convidadosPorEnsino[tipo]
                if (lista.length === 0) return null
                const totalTipo = lista.reduce((s, p) => s + p.total, 0)
                const emAndamento = lista.filter(p => !p.realizado)
                const realizados = lista.filter(p => p.realizado)
                const totalTipoAndamento = emAndamento.reduce((s, p) => s + p.total, 0)
                const totalTipoRealizados = realizados.reduce((s, p) => s + p.total, 0)
                return (
                  <div key={tipo}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cor }}>{label}</span>
                      <span className="text-xs text-text-muted ml-auto">{totalTipo.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="space-y-0.5">
                      {emAndamento.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 py-1 px-1 border-b border-white/5 cursor-pointer hover:bg-white/5 rounded transition-colors"
                          onClick={() => navigate(`/projetos/${p.id}`)}
                        >
                          <span className="text-xs text-text-main flex-1 truncate">{p.titulo}</span>
                          <span className="text-xs font-medium shrink-0" style={{ color: cor }}>{p.total.toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                      {realizados.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 pt-2 pb-0.5">
                            <span className="text-[10px] text-text-muted uppercase tracking-wider">Realizados</span>
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-[10px] text-text-muted">{totalTipoRealizados.toLocaleString('pt-BR')}</span>
                          </div>
                          {realizados.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 py-1 px-1 border-b border-white/5 cursor-pointer hover:bg-white/5 rounded transition-colors opacity-50"
                              onClick={() => navigate(`/projetos/${p.id}`)}
                            >
                              <span className="text-xs text-text-main flex-1 truncate">{p.titulo}</span>
                              <span className="text-xs font-medium shrink-0" style={{ color: cor }}>{p.total.toLocaleString('pt-BR')}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    {emAndamento.length > 0 && realizados.length > 0 && (
                      <p className="text-[10px] text-text-muted mt-1.5">{totalTipoAndamento.toLocaleString('pt-BR')} em andamento</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Estado vazio ──────────────────────────────────────────────── */}
      {projetosFiltrados.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-text-muted">Nenhum projeto encontrado.</p>
          <p className="text-text-muted text-sm mt-1">
            {projetos.length === 0
              ? 'Crie ou importe um projeto para ver os dados aqui.'
              : 'Ajuste os filtros para ver resultados.'}
          </p>
        </div>
      )}

      {projetosFiltrados.length > 0 && (
        <>
          {/* ── Gráfico Contratado vs Pago — Realizados ──────────────── */}
          {showRealizadosCharts && barDataRealizados.length > 0 && (
            <div className="card mb-6">
              <h3 className="text-sm font-semibold text-text-main mb-4">Contratado vs Pago por Turma</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barDataRealizados} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="nome" tick={{ fill: '#8892b0', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-surface, #1a1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#f0f0f0' }}
                    itemStyle={{ color: '#8892b0' }}
                    formatter={(v) => formatBRL(Number(v) || 0)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
                  <Bar dataKey="contratado" name="Custo Contratado" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pago" name="Pago (CAP)" fill="#00b894" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Gráficos Em Andamento ─────────────────────────────────── */}
          {showEmAndamentoCharts && barDataPorTipo.length > 0 && (
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="card">
                <h3 className="text-sm font-semibold text-text-main mb-3">Receita vs Custo por Turma (Orçado)</h3>
                {filtroFornecedor && (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-inner px-3 py-2 mb-4">
                    <span className="text-xs text-text-muted">
                      Total orçado — <span className="text-text-main font-medium">{filtroFornecedor}</span>
                    </span>
                    <span className="text-sm font-bold text-primary">{formatBRL(custoFornecedorTotal)}</span>
                  </div>
                )}
                {barDataPorTipo.map((grupo, idx) => {
                  const chartHeight = barDataPorTipo.length === 1 ? 260 : barDataPorTipo.length === 2 ? 200 : 170
                  return (
                    <div key={grupo.tipo} className={idx > 0 ? 'mt-4 pt-4 border-t border-white/5' : ''}>
                      {barDataPorTipo.length > 1 && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">{grupo.label}</p>
                      )}
                      <GraficoBarras data={grupo.data} height={chartHeight} custoLabel={filtroFornecedor ? 'Custo Fornecedor' : 'Custo'} />
                    </div>
                  )
                })}
              </div>

              {resumoPorTipo.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-text-main mb-4">Receita e Margem por Tipo de Ensino <span className="text-xs text-text-muted font-normal">Orçado</span></h3>
                  <div className="space-y-4">
                    {resumoPorTipo.map((g) => {
                      const cor = g.tipo === 'SUPERIOR' ? '#74b9ff' : g.tipo === 'MEDIO' ? '#00b894' : '#fdcb6e'
                      const label = TIPO_LABELS[g.tipo]
                      return (
                        <div key={g.tipo}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
                            <span className="text-xs font-semibold" style={{ color: cor }}>{label}</span>
                            <span className="text-[11px] text-text-muted">{g.count} projeto{g.count !== 1 ? 's' : ''}</span>
                            <span className="ml-auto text-xs font-semibold text-text-main">{formatBRL(g.receita)}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-full rounded-full" style={{ width: `${g.participacao}%`, background: cor }} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-text-muted">
                            <span>{g.participacao.toFixed(0)}% da receita orçada</span>
                            <span>
                              Margem <span className="font-medium" style={{ color: g.margem >= 0 ? '#16A34A' : '#DC2626' }}>{formatBRL(g.margem)} · {g.margemPct.toFixed(1)}%</span>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="card col-span-2">
                <h3 className="text-sm font-semibold text-text-main mb-4">Evolução por Ano</h3>
                <GraficoLinha data={lineData} />
              </div>
            </div>
          )}

          {/* ── Vendido vs Orçado ─────────────────────────────────────── */}
          {showEmAndamentoCharts && vendidoVsOrcadoData.length > 0 && (
            <div className="card mb-6">
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => setShowVendidoVsOrcado((v) => !v)}
              >
                {showVendidoVsOrcado ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                <h3 className="text-sm font-semibold text-text-main">Vendido vs Orçado por Turma</h3>
              </button>
              {showVendidoVsOrcado && (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={vendidoVsOrcadoData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="nome" tick={{ fill: '#8892b0', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-surface, #1a1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ color: '#f0f0f0' }}
                        itemStyle={{ color: '#8892b0' }}
                        formatter={(v) => formatBRL(Number(v) || 0)}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
                      <Bar dataKey="receitaVendido" name="Receita Vendida" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="receitaOrcado" name="Receita Orçada" fill="#00b894" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="custoVendido" name="Custo Vendido" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="custoOrcado" name="Custo Orçado" fill="#e94560" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── Ranking de projetos ────────────────────────────────────── */}
          {showEmAndamentoCharts && ranking.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(251,191,36,0.15)' }}>
                  <Award className="w-3.5 h-3.5" style={{ color: '#FBBF24' }} />
                </div>
                <h3 className="text-sm font-semibold text-text-main">Top Projetos — Margem de Contribuição</h3>
              </div>
              <div className="space-y-2">
                {ranking.map((r, idx) => {
                  const titulo = r.projeto.tap.turma || `${r.projeto.tap.instituicao} ${r.projeto.tap.curso}`.trim() || `Projeto #${r.projeto.id.slice(0, 6)}`
                  return (
                    <div
                      key={r.projeto.id}
                      className="flex items-center gap-3 p-3 rounded-inner hover:bg-white/5 cursor-pointer transition-colors border border-white/5"
                      onClick={() => navigate(`/projetos/${r.projeto.id}`)}
                    >
                      <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color: idx === 0 ? '#FBBF24' : idx === 1 ? '#94A3B8' : idx === 2 ? '#CD7F32' : '#64748B' }}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-main truncate">{titulo}</p>
                        <p className="text-[11px] text-text-muted">
                          {r.projeto.tap.tipoEscola === 'SUPERIOR' ? 'Ensino Superior' : r.projeto.tap.tipoEscola === 'FUNDAMENTAL' ? 'Ensino Fundamental' : 'Ensino Médio'}
                          {r.projeto.tap.anoRealizacao ? ` · ${r.projeto.tap.anoRealizacao}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center min-w-[52px]">
                          <p className="text-[10px] text-text-muted">Projetada</p>
                          <p className="text-sm font-semibold" style={{ color: r.margemProjetadaPct >= 0 ? '#16A34A' : '#DC2626' }}>{r.margemProjetadaPct.toFixed(1)}%</p>
                        </div>
                        <div className="text-center min-w-[48px]">
                          <p className="text-[10px] text-text-muted">Orçada</p>
                          <p className="text-sm font-semibold" style={{ color: r.margemOrcadaPct >= 0 ? '#16A34A' : '#DC2626' }}>{r.margemOrcadaPct.toFixed(1)}%</p>
                        </div>
                        <div className="text-center min-w-[56px]">
                          <p className="text-[10px] text-text-muted">Contratada</p>
                          <p className="text-sm font-semibold" style={{ color: r.margemContratadaPct >= 0 ? '#16A34A' : '#DC2626' }}>{r.margemContratadaPct.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 min-w-[120px]">
                        <p className="text-[11px] text-text-muted">Falta Pagar</p>
                        <p className="text-sm font-medium text-text-main">{formatBRL(r.faltaPagarR)}</p>
                        <p className="text-[10px]" style={{ color: r.alertaFalta ? '#F59E0B' : '#64748B' }}>{r.pctFalta.toFixed(1)}% do contratado</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 w-14">
                        {r.alertaFalta ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>⚠ Falta</span>
                        ) : r.margemOrcadaPct > 0 ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A' }}>✓</span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-text-muted text-center mt-3">Clique em um projeto para abrir o dashboard detalhado</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
