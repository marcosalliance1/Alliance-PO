import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjetos, mapearProjetoDoDB, mapearItemDoDB } from '../../hooks/useProjetos'
import { supabase } from '../../lib/supabase'
import { formatarMoeda, formatarPercentual, abreviarValor } from '../../utils/formatters'
import { calcularTotaisItens, calcularMargem, MAPEAMENTO_RESUMO } from '../../utils/calculadora'
import { ORDEM_SECOES } from '../../data/bancoItensDefault'
import { ChevronDown, ChevronRight, Loader } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine
} from 'recharts'

const CORES_GRAFICO = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

// ─── Cálculo por projeto ──────────────────────────────────────────
function calcularDadosProjeto(projeto) {
  const secoes = projeto.secoes || {}
  const itens = ORDEM_SECOES.flatMap(s => secoes[s] || [])

  const custosPorCategoria = {}
  for (const [linha, cfg] of Object.entries(MAPEAMENTO_RESUMO)) {
    const itensSecao = secoes[cfg.secao] || []
    const itensFiltrados = itensSecao.filter(cfg.filtro)
    custosPorCategoria[linha] = calcularTotaisItens(itensFiltrados)
  }

  const totalCustoVendido = Object.values(custosPorCategoria).reduce((a, c) => a + (c.totalAtual || 0), 0)
  const totalCustoOrcado = Object.values(custosPorCategoria).reduce((a, c) => a + (c.totalOrcado || 0), 0)
  const totalCustoContratado = Object.values(custosPorCategoria).reduce((a, c) => a + (c.totalContratado || 0), 0)
  const totalCustoPago = Object.values(custosPorCategoria).reduce((a, c) => a + (c.totalPago || 0), 0)

  const receitas = projeto.conciliacaoEverest?.receitas || {}
  const receitaVendida = Object.values(receitas).reduce((a, r) => a + (r.vendido || 0), 0)
  const receitaOrcada = Object.values(receitas).reduce((a, r) => a + (r.orcado || 0), 0)
  const receitaContratada = Object.values(receitas).reduce((a, r) => a + (r.contratado || 0), 0)
  const receitaEverest = Object.values(receitas).reduce((a, r) => a + (r.everestPago || 0), 0)

  const margemOrcado = calcularMargem(receitaOrcada, totalCustoOrcado)
  const margemContratado = calcularMargem(receitaContratada, totalCustoContratado)
  const margemEverest = calcularMargem(receitaEverest, totalCustoPago)

  const itensFechados = itens.filter(i => i.status === 'Fechado').length
  const pctFechados = itens.length > 0 ? (itensFechados / itens.length) * 100 : 0

  const totais = calcularTotaisItens(itens)

  return {
    receitaVendida, receitaOrcada, receitaContratada, receitaEverest,
    custoVendido: totalCustoVendido,
    custoOrcado: totalCustoOrcado,
    custoContratado: totalCustoContratado,
    custoPago: totalCustoPago,
    margemOrcado, margemContratado, margemEverest,
    custosPorCategoria, pctFechados,
    totalAtual: totais.totalAtual,
    totalOrcado: totais.totalOrcado,
    totalContratado: totais.totalContratado,
  }
}

// ─── Tooltip customizado do gráfico de barras ─────────────────────
function TooltipBarrasOrcado({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const receita = payload.find(p => p.dataKey === 'Receita Orçada')?.value || 0
  const custo = payload.find(p => p.dataKey === 'Custo Orçado')?.value || 0
  const margem = receita - custo
  const margemPct = receita > 0 ? ((margem / receita) * 100).toFixed(1) : '0,0'
  return (
    <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#93C5FD', marginBottom: 3 }}>Receita Orçada: {formatarMoeda(receita)}</div>
      <div style={{ color: '#FCA5A5', marginBottom: 3 }}>Custo Orçado: {formatarMoeda(custo)}</div>
      <div style={{ color: '#86EFAC' }}>
        Margem Orçada: {formatarMoeda(margem)} ({margemPct}%)
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────
export default function DashboardGeralPage() {
  const navigate = useNavigate()
  const { projetos: projetosRaw, carregando: carregandoProjetos } = useProjetos()
  const [allItems, setAllItems] = useState([])
  const [allConciliacao, setAllConciliacao] = useState([])
  const [carregandoDados, setCarregandoDados] = useState(true)

  const [filtroAno, setFiltroAno] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [painelVendidoAberto, setPainelVendidoAberto] = useState(false)

  // Carrega itens e conciliação em paralelo
  useEffect(() => {
    async function carregar() {
      setCarregandoDados(true)
      const [{ data: items }, { data: conciliacao }] = await Promise.all([
        supabase.from('po_itens').select('*').eq('ativo', true),
        supabase.from('po_conciliacao_everest').select('*'),
      ])
      setAllItems(items || [])
      setAllConciliacao(conciliacao || [])
      setCarregandoDados(false)
    }
    carregar()
  }, [])

  // Agrega itens e conciliação por projeto
  const projetosComDados = useMemo(() => {
    const itemsByProjeto = {}
    for (const item of allItems) {
      const pid = item.projeto_id
      if (!itemsByProjeto[pid]) itemsByProjeto[pid] = {}
      if (!itemsByProjeto[pid][item.secao]) itemsByProjeto[pid][item.secao] = []
      itemsByProjeto[pid][item.secao].push(mapearItemDoDB(item))
    }

    const conciliacaoByProjeto = {}
    for (const row of allConciliacao) {
      const pid = row.projeto_id
      if (!conciliacaoByProjeto[pid]) conciliacaoByProjeto[pid] = { receitas: {} }
      if (row.tipo === 'receita') {
        conciliacaoByProjeto[pid].receitas[row.linha] = {
          vendido: row.vendido || 0,
          orcado: row.orcado || 0,
          contratado: row.contratado || 0,
          everestPago: row.everest_pago || 0,
          everestFalta: row.everest_falta || 0,
        }
      } else {
        conciliacaoByProjeto[pid][row.linha] = {
          valorPago: row.everest_pago || 0,
          faltaPagar: row.everest_falta || 0,
        }
      }
    }

    return projetosRaw.map(p => ({
      ...mapearProjetoDoDB(p),
      secoes: itemsByProjeto[p.id] || Object.fromEntries(ORDEM_SECOES.map(s => [s, []])),
      conciliacaoEverest: conciliacaoByProjeto[p.id] || { receitas: {} },
    }))
  }, [projetosRaw, allItems, allConciliacao])

  const anos = useMemo(() =>
    [...new Set(projetosComDados.map(p => p.anoRealizacao).filter(Boolean))].sort().reverse(),
    [projetosComDados]
  )

  const projetosFiltrados = useMemo(() =>
    projetosComDados.filter(p => {
      if (filtroAno && p.anoRealizacao !== filtroAno) return false
      if (filtroTipo && p.tipoEnsino !== filtroTipo) return false
      return true
    }),
    [projetosComDados, filtroAno, filtroTipo]
  )

  const dadosProjetos = useMemo(() =>
    projetosFiltrados.map(p => ({ ...p, ...calcularDadosProjeto(p) })),
    [projetosFiltrados]
  )

  // KPIs consolidados (base = Orçado)
  const kpis = useMemo(() => {
    const soma = (fn) => dadosProjetos.reduce((a, p) => a + (fn(p) || 0), 0)
    const receitaOrcada = soma(p => p.receitaOrcada)
    const custoOrcado = soma(p => p.custoOrcado)
    const receitaEverest = soma(p => p.receitaEverest)
    const custoPago = soma(p => p.custoPago)
    const receitaVendida = soma(p => p.receitaVendida)
    const custoVendido = soma(p => p.custoVendido)

    // Projeto com melhor margem orçada
    const melhorProjeto = dadosProjetos.length > 0
      ? dadosProjetos.reduce((best, p) => (p.margemOrcado || 0) > (best.margemOrcado || 0) ? p : best, dadosProjetos[0])
      : null

    return {
      receitaOrcada, custoOrcado,
      margemOrcada: calcularMargem(receitaOrcada, custoOrcado),
      receitaEverest, custoPago,
      margemEverest: calcularMargem(receitaEverest, custoPago),
      receitaVendida, custoVendido,
      melhorProjeto: melhorProjeto ? `${melhorProjeto.nome?.split('—')[0]?.trim() || '—'} (${formatarPercentual(melhorProjeto.margemOrcado)})` : '—',
    }
  }, [dadosProjetos])

  // Gráfico 1 — Receita vs Custo por Turma (Orçado)
  const dadosBarrasOrcado = dadosProjetos.map(p => ({
    name: p.turma || p.nome?.split('—')[0]?.trim().slice(0, 12) || p.id.slice(0, 6),
    nomeFull: p.nome || `${p.curso} — ${p.turma}`,
    'Receita Orçada': p.receitaOrcada,
    'Custo Orçado': p.custoOrcado,
    'Margem Orçada': Math.max(0, p.receitaOrcada - p.custoOrcado),
    tipo: p.tipoEnsino,
  }))

  // Gráfico 2 — Composição de custos (Orçado)
  const custosPorCat = useMemo(() => {
    const totais = {}
    for (const p of dadosProjetos) {
      for (const [cat, c] of Object.entries(p.custosPorCategoria || {})) {
        totais[cat] = (totais[cat] || 0) + (c.totalOrcado || 0)
      }
    }
    return Object.entries(totais)
      .filter(([, v]) => v > 0)
      .map(([name, value], i) => ({ name, value, fill: CORES_GRAFICO[i % CORES_GRAFICO.length] }))
      .sort((a, b) => b.value - a.value)
  }, [dadosProjetos])

  // Gráfico 3 — Evolução da margem orçada
  const dadosLinha = dadosProjetos
    .filter(p => p.anoRealizacao)
    .sort((a, b) => a.anoRealizacao?.localeCompare(b.anoRealizacao))
    .map(p => ({
      name: p.turma || p.nome?.slice(0, 12),
      tipo: p.tipoEnsino,
      margem: parseFloat(p.margemOrcado?.toFixed(1)) || 0,
      metaSuperior: 15,
      metaMedio: 25,
      id: p.id,
    }))

  // Gráfico 4 — Funil financeiro
  const totalVendido = dadosProjetos.reduce((a, p) => a + (p.totalAtual || 0), 0)
  const dadosFunil = [
    { name: 'Vendido', valor: totalVendido, pct: 100 },
    { name: 'Orçado', valor: kpis.custoOrcado, pct: totalVendido > 0 ? (kpis.custoOrcado / totalVendido * 100) : 0 },
    { name: 'Contratado', valor: dadosProjetos.reduce((a, p) => a + (p.custoContratado || 0), 0), pct: totalVendido > 0 ? (dadosProjetos.reduce((a, p) => a + (p.custoContratado || 0), 0) / totalVendido * 100) : 0 },
    { name: 'Pago (Everest)', valor: kpis.custoPago, pct: totalVendido > 0 ? (kpis.custoPago / totalVendido * 100) : 0 },
  ]

  // Gráfico Vendido vs Orçado
  const dadosVendidoOrcado = dadosProjetos.map(p => ({
    name: p.turma || p.nome?.split('—')[0]?.trim().slice(0, 10) || p.id.slice(0, 6),
    'Receita Vendida': p.receitaVendida,
    'Receita Orçada': p.receitaOrcada,
    'Custo Vendido': p.custoVendido,
    'Custo Orçado': p.custoOrcado,
  }))

  const corTipo = { Superior: '#3B82F6', Médio: '#F59E0B', Fundamental: '#10B981' }
  const carregando = carregandoProjetos || carregandoDados

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: '#64748B' }}>
        <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Carregando dashboard...
      </div>
    )
  }

  return (
    <div>
      {/* Cabeçalho + filtros */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>Dashboard Geral</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Visão consolidada de todos os projetos — base Orçado</p>
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
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            <KPI label="Receita Orçada" valor={formatarMoeda(kpis.receitaOrcada)} sub="Total orçado" cor="#2563EB" />
            <KPI label="Custo Orçado" valor={formatarMoeda(kpis.custoOrcado)} sub="Total de custos" cor="#DC2626" />
            <KPI label="Margem Orçada" valor={formatarPercentual(kpis.margemOrcada)} sub="Receita − Custo (Orç.)" cor={kpis.margemOrcada >= 0 ? '#16A34A' : '#DC2626'} valorCor={kpis.margemOrcada >= 0 ? '#22C55E' : '#EF4444'} />
            <KPI label="Melhor Margem" valor={kpis.melhorProjeto} sub="Projeto (Orçado)" cor="#7C3AED" />
            <KPI label="Receita Everest" valor={formatarMoeda(kpis.receitaEverest)} sub="Receita paga" cor="#0891B2" />
            <KPI label="Margem Real Everest" valor={formatarPercentual(kpis.margemEverest)} sub="Resultado real" cor="#D97706" valorCor={kpis.margemEverest >= 0 ? '#FCD34D' : '#EF4444'} dourado />
          </div>

          {/* Gráficos linha 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Gráfico 1 — Receita vs Custo (Orçado) */}
            <GraficoCard titulo="Receita vs Custo por Turma (Orçado)">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dadosBarrasOrcado} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" />
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tickFormatter={v => abreviarValor(v).replace('R$ ', '')} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip content={<TooltipBarrasOrcado />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                  <Bar dataKey="Receita Orçada" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Custo Orçado" fill="#EF4444" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Margem Orçada" fill="#22C55E" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GraficoCard>

            {/* Gráfico 2 — Composição de Custos (Orçado) */}
            <GraficoCard titulo="Composição de Custos (Orçado)">
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
                    formatter={(v, e) => `${v} (${formatarPercentual(kpis.custoOrcado > 0 ? (e.payload.value / kpis.custoOrcado * 100) : 0)})`}
                    wrapperStyle={{ fontSize: 10, color: '#94A3B8' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </GraficoCard>
          </div>

          {/* Gráficos linha 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Gráfico 3 — Evolução da Margem Orçada */}
            <GraficoCard titulo="Evolução da Margem por Projeto (Orçado)">
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

          {/* Painel Vendido vs Orçado (colapsável) */}
          <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
            <button
              onClick={() => setPainelVendidoAberto(v => !v)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: painelVendidoAberto ? '1px solid #2E3150' : 'none' }}
            >
              {painelVendidoAberto ? <ChevronDown size={15} style={{ color: '#64748B' }} /> : <ChevronRight size={15} style={{ color: '#64748B' }} />}
              <span style={{ fontWeight: 600, fontSize: 14, color: '#F1F5F9' }}>Vendido vs Orçado</span>
              <span style={{ fontSize: 11, color: '#64748B' }}>Comparativo por projeto</span>
            </button>
            {painelVendidoAberto && (
              <div style={{ padding: '14px 16px' }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dadosVendidoOrcado} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" />
                    <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} angle={-30} textAnchor="end" />
                    <YAxis tickFormatter={v => abreviarValor(v).replace('R$ ', '')} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip
                      formatter={(v) => formatarMoeda(v)}
                      contentStyle={{ background: '#1A1D2E', border: '1px solid #2E3150', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                    <Bar dataKey="Receita Vendida" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Receita Orçada" fill="#10B981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Custo Vendido" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Custo Orçado" fill="#EF4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
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
                    {['Projeto', 'Ano', 'Tipo', 'Alunos', 'Receita Orç.', 'Custo Orç.', 'Margem Orç. %', 'Everest', 'Margem Real %', '% Fechados'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', color: '#64748B', fontWeight: 600, fontSize: 11, textAlign: h.includes('%') || h.includes('Receita') || h.includes('Custo') || h.includes('Everest') || h.includes('Alunos') ? 'right' : 'left', borderBottom: '1px solid #2E3150' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...dadosProjetos].sort((a, b) => (b.margemOrcado || 0) - (a.margemOrcado || 0)).map(p => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/dashboard/${p.id}`)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #2E3150' }}
                    >
                      <td style={{ padding: '9px 14px', color: '#F1F5F9', fontWeight: 500 }}>{p.nome || `${p.curso} — ${p.turma}`}</td>
                      <td style={{ padding: '9px 14px', color: '#94A3B8' }}>{p.anoRealizacao}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: (corTipo[p.tipoEnsino] || '#64748B') + '33', color: corTipo[p.tipoEnsino] || '#64748B' }}>
                          {p.tipoEnsino}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#94A3B8' }}>{p.totalAlunos || '—'}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F1F5F9' }}>{formatarMoeda(p.receitaOrcada)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#F1F5F9' }}>{formatarMoeda(p.custoOrcado)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: p.margemOrcado >= 0 ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                        {formatarPercentual(p.margemOrcado)}
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

// ─── Subcomponentes ───────────────────────────────────────────────
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
      <div style={{ fontSize: 14, fontWeight: 700, color: valorCor || '#F1F5F9', wordBreak: 'break-word' }}>{valor}</div>
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
