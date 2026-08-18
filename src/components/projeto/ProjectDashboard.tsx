import { useMemo, useState } from 'react'
import type { Projeto } from '../../types'
import { calcResumoProjeto } from '../../utils/calculos'
import { formatBRL } from '../../utils/formatters'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'

interface Props {
  projeto: Projeto
}

const PIE_COLORS = ['#3B82F6', '#EAB308', '#16A34A', '#EC4899', '#8B5CF6', '#F97316', '#14B8A6', '#F43F5E']

const AXIS_STYLE = { fill: '#94A3B8', fontSize: 11 }
const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#f1f5f9',
}
const TOOLTIP_LABEL_STYLE = { color: '#94A3B8', fontSize: 12 }

function KPIBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1" style={{ borderTop: `3px solid ${color}` }}>
      <p className="text-[11px] text-text-muted leading-tight">{label}</p>
      <p className="text-base font-bold text-text-main">{value}</p>
    </div>
  )
}

function MargemItem({ label, value, gold = false }: { label: string; value: number; gold?: boolean }) {
  const isPos = value >= 0
  return (
    <div
      className="text-center p-3 rounded-inner"
      style={gold
        ? { border: '2px solid #F59E0B' }
        : { border: '1px solid rgba(255,255,255,0.08)' }
      }
    >
      <p className="text-[11px] text-text-muted mb-1">{label}</p>
      <p className="text-base font-bold" style={{ color: isPos ? '#16A34A' : '#DC2626' }}>
        {value.toFixed(1)}%
      </p>
    </div>
  )
}

export function ProjectDashboard({ projeto }: Props) {
  const [drillSecaoId, setDrillSecaoId] = useState<string | null>(null)
  const [buscaConvidado, setBuscaConvidado] = useState('')

  const resumo = useMemo(() => calcResumoProjeto(projeto), [projeto])

  const itensBusca = useMemo(() => {
    const q = buscaConvidado.trim().toLowerCase()
    if (!q) return []
    const resultado: { id: string; nome: string; secaoNumero: string; secaoNome: string; valorContratado: number }[] = []
    for (const secao of projeto.secoes) {
      for (const item of secao.itens) {
        const nome = item.item || item.subcategoria
        if (!nome || !nome.toLowerCase().includes(q)) continue
        resultado.push({ id: item.id, nome, secaoNumero: secao.numero, secaoNome: secao.nome, valorContratado: item.valorContratado })
      }
    }
    const totalConv = projeto.totalConvidadosAtual ?? 0
    return resultado.sort((a, b) =>
      totalConv > 0 ? b.valorContratado / totalConv - a.valorContratado / totalConv : b.valorContratado - a.valorContratado
    )
  }, [buscaConvidado, projeto.secoes, projeto.totalConvidadosAtual])

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const receitaVendida = resumo.receitaBaile.vendido
  const custoProjetado = resumo.custoTotal.projetado
  const custoOrcado = resumo.custoTotal.orcado
  const custoContratado = resumo.custoTotal.contratado
  const valorPago = resumo.custoTotal.pago
  const faltaPagar = resumo.custoTotal.faltaPagar

  // ── Margens ───────────────────────────────────────────────────────────────
  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)
  const margemProj = pct(receitaVendida - custoProjetado, receitaVendida)
  const margemOrcada = pct(resumo.receitaBaile.orcado - custoOrcado, resumo.receitaBaile.orcado)
  const margemContratada = pct(resumo.receitaBaile.contratado - custoContratado, resumo.receitaBaile.contratado)
  const margemEverest = pct(resumo.receitaBaile.pago - valorPago, resumo.receitaBaile.pago)

  // ── Chart 1: Custo Projetado por seção ───────────────────────────────────
  const chart1Data = useMemo(() =>
    resumo.custos.map((c) => ({
      nome: c.nome.split(' ')[0],
      'Custo Proj.': Math.round(c.projetado),
    })), [resumo])

  // ── Chart 2: Orçado × Contratado × Pago por seção ────────────────────────
  const chart2Data = useMemo(() =>
    resumo.custos.map((c) => ({
      nome: c.nome.split(' ')[0],
      Orçado: Math.round(c.orcado),
      Contratado: Math.round(c.contratado),
      Pago: Math.round(c.pago),
    })), [resumo])

  // ── Chart 3: Pizza (% contratado por seção) ───────────────────────────────
  const pieData = useMemo(() =>
    resumo.custos
      .filter((c) => c.contratado > 0)
      .map((c, i) => ({
        name: c.nome.split(' ')[0],
        fullName: c.nome,
        value: c.contratado,
        secaoId: c.secaoId,
        color: PIE_COLORS[i % PIE_COLORS.length],
      })), [resumo])

  const drillSecao = drillSecaoId
    ? projeto.secoes.find((s) => s.id === drillSecaoId)
    : null
  const drillLabel = drillSecaoId
    ? pieData.find((p) => p.secaoId === drillSecaoId)?.fullName
    : null

  // ── Progresso de pagamento ────────────────────────────────────────────────
  const progresso = custoContratado > 0
    ? Math.min((valorPago / custoContratado) * 100, 100)
    : 0
  const dentroOrcamento = custoOrcado === 0 || custoContratado <= custoOrcado
  const desvioOrcamento = custoOrcado > 0
    ? ((custoContratado / custoOrcado - 1) * 100).toFixed(1)
    : null

  // ── Receitas ──────────────────────────────────────────────────────────────
  const receitasVazias = resumo.receitas.every(
    (r) => r.vendido === 0 && r.orcado === 0 && r.contratado === 0 && r.pago === 0,
  )

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPIBlock label="Receita Vendida (Proj.)" value={formatBRL(receitaVendida)} color="#3B82F6" />
        <KPIBlock label="Custo Total Orçado" value={formatBRL(custoOrcado)} color="#EAB308" />
        <KPIBlock label="Custo Total Contratado" value={formatBRL(custoContratado)} color="#16A34A" />
        <KPIBlock label="Valor Pago (Everest)" value={formatBRL(valorPago)} color="#059669" />
        <KPIBlock label="Falta Pagar" value={formatBRL(faltaPagar)} color="#DC2626" />
      </div>

      {/* ── Margens ───────────────────────────────────────────────────────── */}
      <div className="card grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MargemItem label="Margem Proj. (%)" value={margemProj} />
        <MargemItem label="Margem Orçada (%)" value={margemOrcada} />
        <MargemItem label="Margem Contratada (%)" value={margemContratada} />
        <MargemItem label="Margem Real Everest (%)" value={margemEverest} gold />
      </div>

      {/* ── Gráfico 1 e 2 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Gráfico 1: Custo Projetado por categoria + ref de receita */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-main mb-4">Custo Vendido Proj. por Categoria</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart1Data} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="nome" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={55} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(v: unknown) => [formatBRL(Number(v ?? 0)), 'Custo Proj.']}
              />
              {receitaVendida > 0 && (
                <ReferenceLine
                  y={receitaVendida}
                  stroke="#22C55E"
                  strokeDasharray="6 3"
                  label={{ value: 'Receita', position: 'insideTopRight', fill: '#22C55E', fontSize: 10 }}
                />
              )}
              <Bar dataKey="Custo Proj." fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {receitaVendida > 0 && (
            <p className="text-[10px] text-text-muted text-center mt-1">
              Linha verde = Receita Vendida total ({formatBRL(receitaVendida)})
            </p>
          )}
        </div>

        {/* Gráfico 2: Orçado × Contratado × Pago */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-main mb-4">Orçado × Contratado × Pago</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart2Data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="nome" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={55} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(v: unknown, name: unknown) => [formatBRL(Number(v ?? 0)), String(name ?? '')]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
              <Bar dataKey="Orçado" fill="#EAB308" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Contratado" fill="#16A34A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Pago" fill="#0EA5E9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Gráfico 3: Pizza com drilldown ────────────────────────────────── */}
      {pieData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-main">
              Composição de Custos Contratados
            </h3>
            {drillSecaoId && (
              <button
                onClick={() => setDrillSecaoId(null)}
                className="text-xs text-text-muted hover:text-text-main underline underline-offset-2"
              >
                ← Ver todos
              </button>
            )}
          </div>
          <div className="flex gap-6 flex-wrap">
            <div className="shrink-0">
              <ResponsiveContainer width={250} height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    dataKey="value"
                    onClick={(d) => {
                      const entry = d as unknown as typeof pieData[0]
                      setDrillSecaoId(entry.secaoId === drillSecaoId ? null : entry.secaoId)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.secaoId}
                        fill={entry.color}
                        opacity={drillSecaoId && drillSecaoId !== entry.secaoId ? 0.3 : 1}
                        stroke={drillSecaoId === entry.secaoId ? '#fff' : 'transparent'}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: unknown, _: unknown, p: { payload?: { fullName?: string } }) =>
                      [formatBRL(Number(v ?? 0)), p.payload?.fullName ?? '']
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 min-w-0">
              {!drillSecaoId ? (
                <div className="space-y-1.5">
                  {pieData.map((d) => {
                    const pctSlice = custoContratado > 0 ? (d.value / custoContratado) * 100 : 0
                    return (
                      <div
                        key={d.secaoId}
                        className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-2 py-1 transition-colors"
                        onClick={() => setDrillSecaoId(d.secaoId)}
                      >
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-text-main flex-1 truncate">{d.fullName}</span>
                        <span className="text-xs text-text-muted shrink-0 w-10 text-right">
                          {pctSlice.toFixed(1)}%
                        </span>
                        <span className="text-xs font-medium text-text-main shrink-0 w-28 text-right">
                          {formatBRL(d.value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-text-main mb-3">
                    {drillLabel} — Detalhamento
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-1 text-text-muted font-medium">Item</th>
                          <th className="text-right py-1 text-text-muted font-medium">Status</th>
                          <th className="text-right py-1 text-text-muted font-medium">Contratado</th>
                          <th className="text-right py-1 text-text-muted font-medium">Pago</th>
                          <th className="text-right py-1 text-text-muted font-medium">Falta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillSecao?.itens.map((i) => (
                          <tr key={i.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-1.5 text-text-main max-w-[140px] truncate" title={i.item}>
                              {i.item || i.subcategoria || '—'}
                            </td>
                            <td className="py-1.5 text-right text-text-muted">{i.status}</td>
                            <td className="py-1.5 text-right font-medium">
                              {formatBRL(i.valorContratado)}
                            </td>
                            <td className="py-1.5 text-right">{formatBRL(i.valorPago)}</td>
                            <td
                              className={`py-1.5 text-right font-medium ${i.faltaPagar > 0 ? 'text-red-400' : 'text-text-muted'}`}
                            >
                              {formatBRL(i.faltaPagar)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Orçado × Realizado (Correção 5) ───────────────────────────────── */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-main mb-4">Orçado × Realizado</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-xs text-text-muted">Custo Orçado Total</span>
              <span className="text-sm font-semibold text-text-main">{formatBRL(custoOrcado)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-xs text-text-muted">Custo Contratado Total</span>
              <div className="flex items-center gap-2">
                {desvioOrcamento !== null && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={
                      dentroOrcamento
                        ? { background: 'rgba(22,163,74,0.12)', color: '#16A34A' }
                        : { background: 'rgba(220,38,38,0.12)', color: '#DC2626' }
                    }
                  >
                    {Number(desvioOrcamento) >= 0 ? '+' : ''}{desvioOrcamento}%
                  </span>
                )}
                <span className="text-sm font-semibold text-text-main">{formatBRL(custoContratado)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-xs text-text-muted">Pago (Everest)</span>
              <span className="text-sm font-semibold text-text-main">{formatBRL(valorPago)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">Falta Pagar</span>
              <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>{formatBRL(faltaPagar)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 justify-center">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">Progresso de Pagamento</span>
                <span className="text-xs font-semibold text-text-main">{progresso.toFixed(0)}% pago</span>
              </div>
              <div
                className="h-4 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progresso}%`,
                    background: dentroOrcamento ? '#16A34A' : '#DC2626',
                  }}
                />
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-inner font-medium self-start"
              style={
                dentroOrcamento
                  ? { background: 'rgba(22,163,74,0.1)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)' }
                  : { background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }
              }
            >
              {dentroOrcamento ? '✓ Dentro do orçamento' : '⚠ Acima do orçamento'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Custo por Convidado ───────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-main">Custo por Convidado</h3>
          {projeto.totalConvidadosAtual ? (
            <span className="text-xs text-text-muted">
              👥 {projeto.totalConvidadosAtual.toLocaleString('pt-BR')} convidados
              {projeto.totalAdesoesAtual ? ` · 🎓 ${projeto.totalAdesoesAtual.toLocaleString('pt-BR')} adesões` : ''}
            </span>
          ) : (
            <span className="text-xs text-text-muted italic">Sincronize a PO para carregar o total de convidados</span>
          )}
        </div>
        <input
          type="text"
          value={buscaConvidado}
          onChange={(e) => setBuscaConvidado(e.target.value)}
          placeholder="Buscar item da PO..."
          className="w-full px-3 py-2 rounded-inner border border-white/10 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary mb-4"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
        {buscaConvidado.trim() && itensBusca.length === 0 && (
          <p className="text-text-muted text-sm text-center py-4">Nenhum item encontrado</p>
        )}
        {itensBusca.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {itensBusca.map((item) => {
              const custoPorConvidado = projeto.totalConvidadosAtual && projeto.totalConvidadosAtual > 0
                ? item.valorContratado / projeto.totalConvidadosAtual
                : null
              return (
                <div key={item.id} className="flex-1 min-w-[180px] p-3 rounded-inner border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-[10px] text-text-muted mb-1">{item.secaoNumero} — {item.secaoNome}</p>
                  <p className="text-sm font-medium text-text-main mb-2" title={item.nome}>{item.nome}</p>
                  <p className="text-base font-bold text-text-main">{formatBRL(item.valorContratado)}</p>
                  {custoPorConvidado !== null && (
                    <p className="text-xs mt-1" style={{ color: '#74b9ff' }}>{formatBRL(custoPorConvidado)} / convidado</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Receitas do Resumo Geral (Correção 3) ─────────────────────────── */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-main mb-4">Receitas — Resumo Geral</h3>
        {receitasVazias ? (
          <p className="text-text-muted text-sm italic py-4 text-center">
            Preencha o Resumo Geral para visualizar as receitas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-1.5 text-xs font-medium text-text-muted">Descrição</th>
                <th className="text-right py-1.5 text-xs font-medium text-text-muted">Vendido</th>
                <th className="text-right py-1.5 text-xs font-medium text-text-muted">Orçado</th>
                <th className="text-right py-1.5 text-xs font-medium text-text-muted">Contratado</th>
                <th className="text-right py-1.5 text-xs font-medium text-text-muted">Pago</th>
                <th className="text-right py-1.5 text-xs font-medium text-text-muted">Falta Pagar</th>
              </tr>
            </thead>
            <tbody>
              {resumo.receitas.map((r) => {
                const isVerbaExtra =
                  r.descricao.toLowerCase().includes('extra') &&
                  (r.vendido > 0 || r.contratado > 0)
                return (
                  <tr
                    key={r.descricao}
                    className="border-b border-white/5 hover:bg-white/5"
                    style={isVerbaExtra ? { borderLeft: '3px solid #F59E0B' } : {}}
                  >
                    <td className="py-1.5 text-text-main">
                      {r.descricao}
                      {isVerbaExtra && (
                        <span
                          className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                        >
                          Verba Extra
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {r.vendido > 0 ? formatBRL(r.vendido) : '—'}
                    </td>
                    <td className="py-1.5 text-right text-text-muted">
                      {r.orcado > 0 ? formatBRL(r.orcado) : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {r.contratado > 0 ? formatBRL(r.contratado) : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {r.pago > 0 ? formatBRL(r.pago) : '—'}
                    </td>
                    <td
                      className={`py-1.5 text-right text-sm ${r.faltaPagar > 0 ? 'text-red-400 font-medium' : 'text-text-muted'}`}
                    >
                      {formatBRL(r.faltaPagar)}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-white/20 bg-surface-2">
                <td className="py-2 font-bold text-text-main text-sm">RECEITA BAILE</td>
                <td className="py-2 text-right font-bold" style={{ color: '#3B82F6' }}>
                  {formatBRL(resumo.receitaBaile.vendido)}
                </td>
                <td className="py-2 text-right font-bold text-text-main">
                  {formatBRL(resumo.receitaBaile.orcado)}
                </td>
                <td className="py-2 text-right font-bold text-text-main">
                  {formatBRL(resumo.receitaBaile.contratado)}
                </td>
                <td className="py-2 text-right font-bold text-text-main">
                  {formatBRL(resumo.receitaBaile.pago)}
                </td>
                <td
                  className={`py-2 text-right font-bold text-sm ${resumo.receitaBaile.faltaPagar > 0 ? 'text-red-400' : 'text-text-muted'}`}
                >
                  {formatBRL(resumo.receitaBaile.faltaPagar)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
