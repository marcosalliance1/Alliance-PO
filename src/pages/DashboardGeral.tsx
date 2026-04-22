import { useMemo } from 'react'
import type { Projeto } from '../types'
import { KPICard } from '../components/dashboard/KPICard'
import { GraficoBarras } from '../components/dashboard/GraficoBarras'
import { GraficoPizza } from '../components/dashboard/GraficoPizza'
import { GraficoLinha } from '../components/dashboard/GraficoLinha'
import { Header } from '../components/layout/Header'
import { calcResumoProjeto, calcPercentFechados } from '../utils/calculos'
import { formatBRL, formatPercent } from '../utils/formatters'
import { FolderOpen, TrendingUp, DollarSign, CheckCircle } from 'lucide-react'

interface DashboardGeralProps {
  projetos: Projeto[]
}

export function DashboardGeral({ projetos }: DashboardGeralProps) {
  const kpis = useMemo(() => {
    let totalReceita = 0
    let totalCusto = 0
    let totalFechados = 0
    let totalItens = 0

    for (const p of projetos) {
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
  }, [projetos])

  const barData = useMemo(() =>
    projetos.map((p) => {
      const resumo = calcResumoProjeto(p)
      return {
        nome: p.tap.turma || p.tap.instituicao || p.id.slice(0, 6),
        receita: resumo.receitaBaile.vendido,
        custo: resumo.custoTotal.vendido,
        margem: resumo.margem.vendido,
      }
    }), [projetos])

  const lineData = useMemo(() => {
    const byAno = new Map<number, { receita: number; margem: number }>()
    for (const p of projetos) {
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
  }, [projetos])

  const pizzaData = useMemo(() => {
    const bySecao = new Map<string, number>()
    for (const p of projetos) {
      const resumo = calcResumoProjeto(p)
      for (const c of resumo.custos) {
        bySecao.set(c.nome, (bySecao.get(c.nome) ?? 0) + c.vendido)
      }
    }
    return Array.from(bySecao.entries())
      .filter(([, v]) => v > 0)
      .map(([nome, valor]) => ({ nome: nome.split(' ').slice(1).join(' '), valor }))
  }, [projetos])

  return (
    <div>
      <Header title="Dashboard Geral" subtitle="Consolidado de todos os projetos" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard title="Projetos Ativos" value={String(projetos.length)} icon={FolderOpen} color="#74b9ff" />
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

      {projetos.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-text-muted">Nenhum projeto cadastrado ainda.</p>
          <p className="text-text-muted text-sm mt-1">Crie ou importe um projeto para ver os dados aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-text-main mb-4">Receita vs Custo por Projeto</h3>
            <GraficoBarras data={barData} />
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-text-main mb-4">Distribuição de Custos</h3>
            <GraficoPizza data={pizzaData} />
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
