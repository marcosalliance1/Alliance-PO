import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStorage } from '../../hooks/useStorage'
import { formatarMoeda, formatarPercentual, abreviarValor } from '../../utils/formatters'
import { calcularTotaisItens, calcularMargem, MAPEAMENTO_RESUMO } from '../../utils/calculadora'
import { ORDEM_SECOES } from '../../data/bancoItensDefault'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine
} from 'recharts'

const CORES_GRAFICO = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

function calcularDadosProjeto(projeto) {
  const itens = ORDEM_SECOES.flatMap(s => projeto.secoes?.[s] || [])
  const totais = calcularTotaisItens(itens)

  const custosPorCategoria = {}
  for (const [linha, cfg] of Object.entries(MAPEAMENTO_RESUMO)) {
    const itensSecao = projeto.secoes?.[cfg.secao] || []
    const itensFiltrados = itensSecao.filter(cfg.filtro)
    custosPorCategoria[linha] = calcularTotaisItens(itensFiltrados)
  }

  const totalCustoContratado = Object.values(custosPorCategoria).reduce((a, c) => a + c.totalContratado, 0)
  const totalCustoPago = Object.values(custosPorCategoria).reduce((a, c) => a + c.totalPago, 0)

  const receitas = projeto.conciliacaoEverest?.receitas || {}
  const receitaContratada = Object.values(receitas).reduce((a, r) => a + (r.contratado || 0), 0)
  const receitaEverest = Object.values(receitas).reduce((a, r) => a + (r.everestPago || 0), 0)

  const margemContratado = calcularMargem(receitaContratada, totalCustoContratado)
  const margemEverest = calcularMargem(receitaEverest, totalCustoPago)

  const itensFechados = itens.filter(i => i.status === 'Fechado').length
  const pctFechados = itens.length > 0 ? (itensFechados / itens.length) * 100 : 0

  return {
    receitaContratada,
    custoContratado: totalCustoContratado,
    margemContratado,
    receitaEverest,
    custoPago: totalCustoPago,
    margemEverest,
    custosPorCategoria,
    pctFechados,
    totalAtual: totais.totalAtual,
    totalOrcado: totais.totalOrcado,
    totalContratado: totais.totalContratado,
  }
}

export default function DashboardGeralPage() {
  const navigate = useNavigate()
  const [projetos] = useStorage('projetos', [])
  const [filtroAno, setFiltroAno] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  const anos = useMemo(() => [...new Set(projetos.map(p => p.anoRealizacao).filter(Boolean))].sort().reverse(), [projetos])

  const projetosFiltrados = useMemo(() => projetos.filter(p => {
    if (filtroAno && p.anoRealizacao !== filtroAno) return false
    if (filtroTipo && p.tipoEnsino !== filtroTipo) return false
    return true
  }), [projetos, filtroAno, filtroTipo])

  const dadosProjetos = useMemo(() => projetosFiltrados.map(p => ({
    ...p,
    ...calcularDadosProjeto(p),
  })), [projetosFiltrados])

  // KPIs consolidados
  const kpis = useMemo(() => {
    const soma = (fn) => dadosProjetos.reduce((a, p) => a + (fn(p) || 0), 0)
    const receitaContratada = soma(p => p.receitaContratada)
    const custoContratado = soma(p => p.custoContratado)
    const receitaEverest = soma(p => p.receitaEverest)
    const custoPago = soma(p => p.custoPago)
    const totalOrcado = soma(p => p.totalOrcado)
    const totalAtual = soma(p => p.totalAtual)
    return {
      receitaContratada, custoContratado, receitaEverest, custoPago,
      margemContratado: calcularMargem(receitaContratada, custoContratado),
      margemEverest: calcularMargem(receitaEverest, custoPago),
      totalOrcado, totalAtual,
    }
  }, [dadosProjetos])

  // Dados gráfico 1 — comparativo por projeto
  const dadosBarras = dadosProjetos.map(p => ({
    name: p.nome?.split('—')[0]?.trim().slice(0, 15) || p.id.slice(0, 6),
    'Receita': p.receitaContratada,
    'Custo': p.custoContratado,
    'Margem': p.receitaContratada - p.custoContratado,
  }))

  // Dados gráfico 2 — composição custos consolidada
  const custosPorCat = useMemo(() => {
    const totais = {}
    for (const p of dadosProjetos) {
      for (const [cat, c] of Object.entries(p.custosPorCategoria || {})) {
        totais[cat] = (totais[cat] || 0) + c.totalContratado
      }
    }
    return Object.entries(totais)
      .filter(([, v]) => v > 0)
      .map(([name, value], i) => ({ name, value, fill: CORES_GRAFICO[i % CORES_GRAFICO.length] }))
      .sort((a, b) => b.value - a.value)
  }, [dadosProjetos])

  // Dados gráfico 3 — evolução margem
  const dadosLinha = dadosProjetos
    .filter(p => p.anoRealizacao)
    .sort((a, b) => a.anoRealizacao?.localeCompare(b.anoRealizacao))
    .map(p => ({
      name: p.nome?.slice(0, 12),
      tipo: p.tipoEnsino,
      margem: parseFloat(p.margemContratado?.toFixed(1)) || 0,
      metaSuperior: 15,
      metaMedio: 25,
      metaFundamental: 15,
      id: p.id,
    }))

  // Dados gráfico 4 — funil
  const totalVendido = dadosProjetos.reduce((a, p) => a + p.totalAtual, 0)
  const dadosFunil = [
    { name: 'Vendido', valor: totalVendido, pct: 100 },
    { name: 'Orçado', valor: kpis.totalOrcado, pct: totalVendido > 0 ? (kpis.totalOrcado / totalVendido * 100) : 0 },
    { name: 'Contratado', valor: kpis.custoContratado, pct: totalVendido > 0 ? (kpis.custoContratado / totalVendido * 100) : 0 },
    { name: 'Pago (Everest)', valor: kpis.custoPago, pct: totalVendido > 0 ? (kpis.custoPago / totalVendido * 100) : 0 },
  ]

  const corTipo = { Superior: '#3B82F6', Médio: '#F59E0B', Fundamental: '#10B981' }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>Dashboard Geral</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Visão consolidada de todos os projetos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} style={selStyle}>
            <option value="">Todos os anos</option>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selStyle}>
            <option value="">Todos os tipos</option>
            {['Fundamental', 'Médio', 'Superior'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {projetosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748B' }}>
          <p>Nenhum projeto encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            <KPI label="Receita Contratada" valor={formatarMoeda(kpis.receitaContratada)} sub="Total contratado" cor="#2563EB" />
            <KPI label="Custo Contratado" valor={formatarMoeda(kpis.custoContratado)} sub="Total de custos" cor="#DC2626" />
            <KPI label="Margem Contratado" valor={formatarPercentual(kpis.margemContratado)} sub="Receita - Custo" cor={kpis.margemContratado >= 0 ? '#16A34A' : '#DC2626'} valorCor={kpis.margemContratado >= 0 ? '#22C55E' : '#EF4444'} />
            <KPI label="Receita Everest" valor={formatarMoeda(kpis.receitaEverest)} sub="Receita paga" cor="#7C3AED" />
            <KPI label="Custo Pago" valor={formatarMoeda(kpis.custoPago)} sub="Pagos efetivos" cor="#D97706" />
            <KPI label="Margem Real Everest" valor={formatarPercentual(kpis.margemEverest)} sub="Resultado real" cor="#D97706" valorCor={kpis.margemEverest >= 0 ? '#FCD34D' : '#EF4444'} dourado />
          </div>

          {/* Gráficos linha 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Gráfico 1 — Comparativo por Projeto */}
            <GraficoCard titulo="Comparativo por Projeto">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dadosBarras} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" />
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tickFormatter={v => abreviarValor(v).replace('R$ ', '')} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatarMoeda(v)} contentStyle={{ background: '#1A1D2E', border: '1px solid #2E3150', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                  <Bar dataKey="Receita" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Custo" fill="#EF4444" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Margem" fill="#22C55E" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GraficoCard>

            {/* Gráfico 2 — Composição de Custos */}
            <GraficoCard titulo="Composição de Custos">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={custosPorCat}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {custosPorCat.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatarMoeda(v)}
                    contentStyle={{ background: '#1A1D2E', border: '1px solid #2E3150', fontSize: 12 }}
                  />
                  <Legend
                    formatter={(v, e) => `${v} (${formatarPercentual(kpis.custoContratado > 0 ? (e.payload.value / kpis.custoContratado * 100) : 0)})`}
                    wrapperStyle={{ fontSize: 10, color: '#94A3B8' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </GraficoCard>
          </div>

          {/* Gráficos linha 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Gráfico 3 — Evolução da Margem Real */}
            <GraficoCard titulo="Evolução da Margem por Projeto">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dadosLinha} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" />
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip
                    formatter={(v) => `${Number(v).toFixed(1)}%`}
                    contentStyle={{ background: '#1A1D2E', border: '1px solid #2E3150', fontSize: 12 }}
                  />
                  <ReferenceLine y={15} stroke="#3B82F6" strokeDasharray="5 5" label={{ value: 'Meta Superior 15%', fill: '#3B82F6', fontSize: 9 }} />
                  <ReferenceLine y={25} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: 'Meta Médio 25%', fill: '#F59E0B', fontSize: 9 }} />
                  <Line
                    type="monotone"
                    dataKey="margem"
                    stroke="#22C55E"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      return (
                        <circle
                          key={payload.id}
                          cx={cx} cy={cy} r={4}
                          fill={corTipo[payload.tipo] || '#22C55E'}
                          stroke="#fff"
                          strokeWidth={1}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/dashboard/${payload.id}`)}
                        />
                      )
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </GraficoCard>

            {/* Gráfico 4 — Funil Financeiro */}
            <GraficoCard titulo="Funil Financeiro">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dadosFunil} layout="vertical" margin={{ top: 5, right: 60, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => abreviarValor(v).replace('R$ ', '')} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} width={90} />
                  <Tooltip
                    formatter={(v, n, p) => [`${formatarMoeda(v)} (${p.payload.pct?.toFixed(1)}%)`, n]}
                    contentStyle={{ background: '#1A1D2E', border: '1px solid #2E3150', fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {dadosFunil.map((entry, i) => {
                      const cores = ['#3B82F6', '#6366F1', '#10B981', '#22C55E']
                      return <Cell key={i} fill={cores[i]} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GraficoCard>
          </div>

          {/* Tabela por Projeto */}
          <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2E3150' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#F1F5F9' }}>Projetos</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0F1117' }}>
                    {['Projeto', 'Ano', 'Tipo', 'Alunos', 'Receita Contr.', 'Custo Contr.', 'Margem %', 'Everest', 'Margem Real %', '% Fechados'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', color: '#64748B', fontWeight: 600, fontSize: 11, textAlign: h.includes('%') || h.includes('Receita') || h.includes('Custo') || h.includes('Everest') || h.includes('Alunos') ? 'right' : 'left', borderBottom: '1px solid #2E3150' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...dadosProjetos].sort((a, b) => (b.margemEverest || 0) - (a.margemEverest || 0)).map(p => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/dashboard/${p.id}`)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #2E3150' }}
                    >
                      <td style={{ padding: '9px 14px', color: '#F1F5F9', fontWeight: 500 }}>{p.nome || `${p.curso} — ${p.turma}`}</td>
                      <td style={{ padding: '9px 14px', color: '#94A3B8' }}>{p.anoRealizacao}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: corTipo[p.tipoEnsino] + '33', color: corTipo[p.tipoEnsino] }}>
                          {p.tipoEnsino}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#94A3B8' }}>{p.totalAlunos || '—'}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F1F5F9' }}>{formatarMoeda(p.receitaContratada)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F1F5F9' }}>{formatarMoeda(p.custoContratado)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: p.margemContratado >= 0 ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                        {formatarPercentual(p.margemContratado)}
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F1F5F9' }}>{formatarMoeda(p.receitaEverest)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: p.margemEverest >= 0 ? '#FCD34D' : '#EF4444' }}>
                        {formatarPercentual(p.margemEverest)}
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#94A3B8' }}>
                        {p.pctFechados?.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KPI({ label, valor, sub, cor, valorCor, dourado }) {
  return (
    <div style={{
      background: '#1A1D2E',
      border: '1px solid #2E3150',
      borderRadius: 8,
      padding: '14px 16px',
      borderTop: `3px solid ${cor}`,
      boxShadow: dourado ? '0 0 12px rgba(250,204,21,0.1)' : undefined,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748B', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: valorCor || '#F1F5F9' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function GraficoCard({ titulo, children }) {
  return (
    <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 12 }}>{titulo}</div>
      {children}
    </div>
  )
}

const selStyle = {
  background: '#1A1D2E',
  border: '1px solid #2E3150',
  borderRadius: 6,
  padding: '7px 10px',
  color: '#F1F5F9',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
}
