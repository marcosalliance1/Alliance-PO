import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Projeto, TipoEscola } from '../types'
import { KPICard } from '../components/dashboard/KPICard'
import { GraficoBarras } from '../components/dashboard/GraficoBarras'
import { GraficoLinha } from '../components/dashboard/GraficoLinha'
import { Header } from '../components/layout/Header'
import { calcResumoProjeto, calcPercentFechados, filtrarItensCalculo } from '../utils/calculos'
import { formatBRL, formatPercent } from '../utils/formatters'
import { FolderOpen, TrendingUp, DollarSign, CheckCircle, SlidersHorizontal, Package, Award, ChevronDown, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DashboardGeralProps {
  projetos: Projeto[]
}

const TIPO_ESCOLA_OPTS: { value: 'TODOS' | TipoEscola; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'SUPERIOR', label: 'Ensino Superior' },
  { value: 'MEDIO', label: 'Ensino Médio' },
  { value: 'FUNDAMENTAL', label: 'Ensino Fundamental' },
]

export function DashboardGeral({ projetos }: DashboardGeralProps) {
  const navigate = useNavigate()
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  const [filtroTipoEscola, setFiltroTipoEscola] = useState<'TODOS' | TipoEscola>('TODOS')
  const [showVendidoVsOrcado, setShowVendidoVsOrcado] = useState(false)

  const fornecedoresUsados = useMemo(() => {
    const names = new Set<string>()
    for (const p of projetos)
      for (const sec of p.secoes)
        for (const item of sec.itens)
          if (item.fornecedor?.trim()) names.add(item.fornecedor.trim())
    return [...names].sort()
  }, [projetos])

  const projetosFiltrados = useMemo(() => {
    let lista = projetos
    if (filtroTipoEscola !== 'TODOS') {
      lista = lista.filter((p) => p.tap.tipoEscola === filtroTipoEscola)
    }
    if (filtroFornecedor) {
      lista = lista.filter((p) =>
        p.secoes.some((sec) => sec.itens.some((i) => i.fornecedor?.trim() === filtroFornecedor)),
      )
    }
    return lista
  }, [projetos, filtroFornecedor, filtroTipoEscola])

  const kpis = useMemo(() => {
    let totalReceita = 0
    let totalCusto = 0
    let totalFechados = 0
    let totalItens = 0

    for (const p of projetosFiltrados) {
      const resumo = calcResumoProjeto(p)
      totalReceita += resumo.receitaBaile.orcado
      totalCusto += resumo.custoTotal.orcado
      const pct = calcPercentFechados(p)
      const itens = p.secoes.reduce((s, sec) => s + sec.itens.length, 0)
      totalFechados += pct * itens
      totalItens += itens
    }

    const margem = totalReceita - totalCusto
    const pctFechados = totalItens > 0 ? totalFechados / totalItens : 0

    return { totalReceita, totalCusto, margem, pctFechados }
  }, [projetosFiltrados])

  const TIPO_LABELS: Record<string, string> = {
    SUPERIOR: 'Ensino Superior',
    MEDIO: 'Ensino Médio',
    FUNDAMENTAL: 'Ensino Fundamental',
  }

  const barDataPorTipo = useMemo(() => {
    const grupos = new Map<string, { nome: string; receita: number; custo: number; margem: number }[]>()
    for (const p of projetosFiltrados) {
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

  const topFornecedores = useMemo(() => {
    const map = new Map<string, { orcado: number; pago: number }>()
    for (const p of projetosFiltrados) {
      for (const sec of p.secoes) {
        for (const item of filtrarItensCalculo(sec.itens)) {
          const key = item.fornecedor?.trim() || 'Sem fornecedor'
          if (!item.valorOrcado && !item.valorPago) continue
          const prev = map.get(key) ?? { orcado: 0, pago: 0 }
          map.set(key, { orcado: prev.orcado + (item.valorOrcado || 0), pago: prev.pago + (item.valorPago || 0) })
        }
      }
    }
    return [...map.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.orcado - a.orcado)
      .slice(0, 8)
  }, [projetosFiltrados])

  const vendidoVsOrcadoData = useMemo(() =>
    projetosFiltrados.map((p) => {
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

  // ── Ranking de projetos por margem (Correção 6) ───────────────────────────
  const ranking = useMemo(() => {
    return projetosFiltrados
      .map((p) => {
        const resumo = calcResumoProjeto(p)
        const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)
        const margemProjetadaPct = pct(
          resumo.receitaBaile.vendido - resumo.custoTotal.projetado,
          resumo.receitaBaile.vendido,
        )
        const margemOrcadaPct = pct(
          resumo.receitaBaile.orcado - resumo.custoTotal.orcado,
          resumo.receitaBaile.orcado,
        )
        const margemContratadaPct = pct(
          resumo.receitaBaile.contratado - resumo.custoTotal.contratado,
          resumo.receitaBaile.contratado,
        )
        const faltaPagarR = resumo.custoTotal.faltaPagar
        const pctFalta = pct(faltaPagarR, resumo.custoTotal.contratado)
        return {
          projeto: p,
          margemProjetadaPct,
          margemOrcadaPct,
          margemContratadaPct,
          faltaPagarR,
          pctFalta,
          alertaFalta: pctFalta > 20,
        }
      })
      .sort((a, b) => b.margemOrcadaPct - a.margemOrcadaPct)
  }, [projetosFiltrados])

  const selectCls =
    'bg-surface border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main outline-none focus:border-primary hover:border-white/20 transition-colors'

  return (
    <div>
      <Header title="Dashboard Geral" subtitle="Consolidado de todos os projetos" />

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="card flex flex-wrap items-center gap-2 mb-6 p-3">
        <div className="flex items-center gap-1.5 text-text-muted pr-2 border-r border-white/10 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Filtros</span>
        </div>

        {/* Toggle tipo de ensino */}
        <div className="flex gap-1 bg-surface-2 rounded-inner p-0.5">
          {TIPO_ESCOLA_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFiltroTipoEscola(opt.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filtroTipoEscola === opt.value
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {fornecedoresUsados.length > 0 && (
          <select
            value={filtroFornecedor}
            onChange={(e) => setFiltroFornecedor(e.target.value)}
            className={selectCls}
          >
            <option value="">Todos os fornecedores</option>
            {fornecedoresUsados.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}

        {(filtroFornecedor || filtroTipoEscola !== 'TODOS') && (
          <button
            onClick={() => { setFiltroFornecedor(''); setFiltroTipoEscola('TODOS') }}
            className="ml-auto text-xs text-text-muted hover:text-text-main transition-colors underline underline-offset-2"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard title="Projetos" value={String(projetosFiltrados.length)} icon={FolderOpen} color="#74b9ff" />
        <KPICard title="Receita Orçada" value={formatBRL(kpis.totalReceita)} icon={DollarSign} color="#00b894" />
        <KPICard
          title="Margem Orçada"
          value={formatBRL(kpis.margem)}
          icon={TrendingUp}
          color={kpis.margem >= 0 ? '#00b894' : '#e17055'}
        />
        <KPICard
          title="Itens Fechados"
          value={formatPercent(kpis.pctFechados)}
          icon={CheckCircle}
          color="#fdcb6e"
        />
      </div>

      {projetosFiltrados.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-text-muted">Nenhum projeto encontrado.</p>
          <p className="text-text-muted text-sm mt-1">
            {projetos.length === 0
              ? 'Crie ou importe um projeto para ver os dados aqui.'
              : 'Ajuste os filtros para ver resultados.'}
          </p>
        </div>
      ) : (
        <>
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
                    <GraficoBarras
                      data={grupo.data}
                      height={chartHeight}
                      custoLabel={filtroFornecedor ? 'Custo Fornecedor' : 'Custo'}
                    />
                  </div>
                )
              })}
            </div>

            {/* Top Fornecedores */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(116,185,255,0.15)' }}
                >
                  <Package className="w-3.5 h-3.5" style={{ color: '#74b9ff' }} />
                </div>
                <h3 className="text-sm font-semibold text-text-main">Top Fornecedores por Custo</h3>
              </div>
              {topFornecedores.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">Sem dados de fornecedores</p>
              ) : (
                <div className="space-y-3">
                  {topFornecedores.map((f, i) => {
                    const maxOrcado = topFornecedores[0].orcado
                    const pct = maxOrcado > 0 ? (f.orcado / maxOrcado) * 100 : 0
                    const pagoPct = f.orcado > 0 ? (f.pago / f.orcado) * 100 : 0
                    return (
                      <div key={f.nome}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-text-muted w-3 text-right shrink-0">{i + 1}</span>
                          <span className="text-xs text-text-main truncate flex-1" title={f.nome}>{f.nome}</span>
                          <span className="text-xs font-medium text-text-main shrink-0">{formatBRL(f.orcado)}</span>
                        </div>
                        <div className="ml-5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full relative" style={{ width: `${pct}%`, background: 'rgba(59,130,246,0.45)' }}>
                            <div
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ width: `${pagoPct}%`, background: 'rgba(0,184,148,0.8)' }}
                            />
                          </div>
                        </div>
                        <div className="ml-5 flex gap-3 mt-0.5">
                          <span className="text-[9px]" style={{ color: '#74b9ff' }}>Orç. {formatBRL(f.orcado)}</span>
                          <span className="text-[9px]" style={{ color: '#00b894' }}>Pago {formatBRL(f.pago)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="text-[10px] text-text-muted mt-4 text-center">Barra: azul = orçado · verde = pago</p>
            </div>

            <div className="card col-span-2">
              <h3 className="text-sm font-semibold text-text-main mb-4">Evolução por Ano</h3>
              <GraficoLinha data={lineData} />
            </div>
          </div>

          {/* ── Vendido vs Orçado ─────────────────────────────────────── */}
          {vendidoVsOrcadoData.length > 0 && (
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

          {/* ── Ranking de projetos (Correção 6) ──────────────────────── */}
          {ranking.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(251,191,36,0.15)' }}
                >
                  <Award className="w-3.5 h-3.5" style={{ color: '#FBBF24' }} />
                </div>
                <h3 className="text-sm font-semibold text-text-main">
                  Top Projetos — Margem de Contribuição
                </h3>
              </div>

              <div className="space-y-2">
                {ranking.map((r, idx) => {
                  const titulo =
                    r.projeto.tap.turma ||
                    `${r.projeto.tap.instituicao} ${r.projeto.tap.curso}`.trim() ||
                    `Projeto #${r.projeto.id.slice(0, 6)}`

                  return (
                    <div
                      key={r.projeto.id}
                      className="flex items-center gap-3 p-3 rounded-inner hover:bg-white/5 cursor-pointer transition-colors border border-white/5"
                      onClick={() => navigate(`/projetos/${r.projeto.id}`)}
                    >
                      {/* Posição */}
                      <span
                        className="text-xs font-bold w-5 text-center shrink-0"
                        style={{ color: idx === 0 ? '#FBBF24' : idx === 1 ? '#94A3B8' : idx === 2 ? '#CD7F32' : '#64748B' }}
                      >
                        {idx + 1}
                      </span>

                      {/* Nome + tipo escola */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-main truncate">{titulo}</p>
                        <p className="text-[11px] text-text-muted">
                          {r.projeto.tap.tipoEscola === 'SUPERIOR' ? 'Ensino Superior'
                            : r.projeto.tap.tipoEscola === 'FUNDAMENTAL' ? 'Ensino Fundamental'
                            : 'Ensino Médio'}
                          {r.projeto.tap.anoRealizacao ? ` · ${r.projeto.tap.anoRealizacao}` : ''}
                        </p>
                      </div>

                      {/* Margens */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center min-w-[52px]">
                          <p className="text-[10px] text-text-muted">Projetada</p>
                          <p className="text-sm font-semibold" style={{ color: r.margemProjetadaPct >= 0 ? '#16A34A' : '#DC2626' }}>
                            {r.margemProjetadaPct.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-center min-w-[48px]">
                          <p className="text-[10px] text-text-muted">Orçada</p>
                          <p className="text-sm font-semibold" style={{ color: r.margemOrcadaPct >= 0 ? '#16A34A' : '#DC2626' }}>
                            {r.margemOrcadaPct.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-center min-w-[56px]">
                          <p className="text-[10px] text-text-muted">Contratada</p>
                          <p className="text-sm font-semibold" style={{ color: r.margemContratadaPct >= 0 ? '#16A34A' : '#DC2626' }}>
                            {r.margemContratadaPct.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Falta Pagar */}
                      <div className="text-right shrink-0 min-w-[120px]">
                        <p className="text-[11px] text-text-muted">Falta Pagar</p>
                        <p className="text-sm font-medium text-text-main">{formatBRL(r.faltaPagarR)}</p>
                        <p className="text-[10px]" style={{ color: r.alertaFalta ? '#F59E0B' : '#64748B' }}>
                          {r.pctFalta.toFixed(1)}% do contratado
                        </p>
                      </div>

                      {/* Alertas */}
                      <div className="flex items-center gap-1.5 shrink-0 w-14">
                        {r.alertaFalta ? (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                          >
                            ⚠ Falta
                          </span>
                        ) : r.margemOrcadaPct > 0 ? (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A' }}
                          >
                            ✓
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-text-muted text-center mt-3">
                Clique em um projeto para abrir o dashboard detalhado
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
