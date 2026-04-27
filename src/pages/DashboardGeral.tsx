import { useMemo, useState } from 'react'
import type { Projeto } from '../types'
import { KPICard } from '../components/dashboard/KPICard'
import { GraficoBarras } from '../components/dashboard/GraficoBarras'
import { GraficoLinha } from '../components/dashboard/GraficoLinha'
import { Header } from '../components/layout/Header'
import { calcResumoProjeto, calcPercentFechados } from '../utils/calculos'
import { formatBRL, formatPercent } from '../utils/formatters'
import { FolderOpen, TrendingUp, DollarSign, CheckCircle, SlidersHorizontal, Package } from 'lucide-react'

interface DashboardGeralProps {
  projetos: Projeto[]
}

export function DashboardGeral({ projetos }: DashboardGeralProps) {
  const [filtroFornecedor, setFiltroFornecedor] = useState('')

  const fornecedoresUsados = useMemo(() => {
    const names = new Set<string>()
    for (const p of projetos)
      for (const sec of p.secoes)
        for (const item of sec.itens)
          if (item.fornecedor?.trim()) names.add(item.fornecedor.trim())
    return [...names].sort()
  }, [projetos])

  const projetosFiltrados = useMemo(() =>
    filtroFornecedor
      ? projetos.filter(p => p.secoes.some(sec => sec.itens.some(i => i.fornecedor?.trim() === filtroFornecedor)))
      : projetos,
  [projetos, filtroFornecedor])

  const kpis = useMemo(() => {
    let totalReceita = 0
    let totalCusto = 0
    let totalFechados = 0
    let totalItens = 0

    for (const p of projetosFiltrados) {
      const resumo = calcResumoProjeto(p)
      totalReceita += resumo.receitaBaile.vendido
      totalCusto += resumo.custoTotal.vendido
      const pct = calcPercentFechados(p)
      const itens = p.secoes.reduce((s, sec) => s + sec.itens.length, 0)
      totalFechados += pct * itens
      totalItens += itens
    }

    const margem = totalReceita - totalCusto
    const pctFechados = totalItens > 0 ? totalFechados / totalItens : 0

    return { totalReceita, totalCusto, margem, pctFechados }
  }, [projetosFiltrados])

  const barData = useMemo(() =>
    projetosFiltrados.map((p) => {
      const resumo = calcResumoProjeto(p)
      return {
        nome: p.tap.turma || p.id.slice(0, 6),
        receita: resumo.receitaBaile.vendido,
        custo: resumo.custoTotal.vendido,
        margem: resumo.margem.vendido,
      }
    }), [projetosFiltrados])

  const lineData = useMemo(() => {
    const byAno = new Map<number, { receita: number; margem: number }>()
    for (const p of projetosFiltrados) {
      const ano = p.tap.anoRealizacao
      const resumo = calcResumoProjeto(p)
      const cur = byAno.get(ano) ?? { receita: 0, margem: 0 }
      byAno.set(ano, {
        receita: cur.receita + resumo.receitaBaile.vendido,
        margem: cur.margem + resumo.margem.vendido,
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
        for (const item of sec.itens) {
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

  const selectCls = 'bg-surface border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main outline-none focus:border-primary hover:border-white/20 transition-colors'

  return (
    <div>
      <Header title="Dashboard Geral" subtitle="Consolidado de todos os projetos" />

      {/* ── Filtros ── */}
      <div className="card flex flex-wrap items-center gap-2 mb-6 p-3">
        <div className="flex items-center gap-1.5 text-text-muted pr-2 border-r border-white/10 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Filtros</span>
        </div>
        {fornecedoresUsados.length > 0 && (
          <select value={filtroFornecedor} onChange={e => setFiltroFornecedor(e.target.value)} className={selectCls}>
            <option value="">Todos os fornecedores</option>
            {fornecedoresUsados.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        {filtroFornecedor && (
          <button onClick={() => setFiltroFornecedor('')} className="ml-auto text-xs text-text-muted hover:text-text-main transition-colors underline underline-offset-2">
            Limpar filtro
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard title="Projetos" value={String(projetosFiltrados.length)} icon={FolderOpen} color="#74b9ff" />
        <KPICard title="Receita Total" value={formatBRL(kpis.totalReceita)} icon={DollarSign} color="#00b894" />
        <KPICard
          title="Margem Total"
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
            {projetos.length === 0 ? 'Crie ou importe um projeto para ver os dados aqui.' : 'Ajuste os filtros para ver resultados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-text-main mb-4">Receita vs Custo por Turma</h3>
            <GraficoBarras data={barData} />
          </div>

          {/* Top Fornecedores */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(116,185,255,0.15)' }}>
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
                          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pagoPct}%`, background: 'rgba(0,184,148,0.8)' }} />
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
      )}
    </div>
  )
}
