import { useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, AreaChart, Area,
} from 'recharts'
import { fmtBRL } from '../../../utils/parseFinanceiro'
import { ChevronDown, ChevronRight } from 'lucide-react'

const COR_CORAL = '#F97316'

function KPICard({ label, valor, cor }) {
  return (
    <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor || '#F1F5F9' }}>{valor}</div>
    </div>
  )
}

function TooltipBRL({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ color: COR_CORAL }}>{fmtBRL(payload[0].value)}</div>
    </div>
  )
}

export default function ControleDespesas({ cap }) {
  const [expandidos, setExpandidos] = useState({})

  const totalDespesas  = cap.reduce((s, i) => s + (i.v_titulo || 0), 0)
  const totalLiquidado = cap.filter(i => i.situacao === 'LIQUIDADO').reduce((s, i) => s + (i.v_titulo || 0), 0)
  const totalAberto    = cap.filter(i => i.situacao === 'ATIVO').reduce((s, i) => s + (i.v_titulo || 0), 0)

  // Top 10 contas gerenciais
  const porGerencial = {}
  for (const i of cap) {
    const g = i.desc_conta_gerencial || '(sem categoria)'
    porGerencial[g] = (porGerencial[g] || 0) + (i.v_titulo || 0)
  }
  const top10Gerencial = Object.entries(porGerencial)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }))

  // Evolução por ano (d_competencia)
  const porAno = {}
  for (const i of cap) {
    const ano = i.d_competencia?.slice(0, 4)
    if (!ano) continue
    porAno[ano] = (porAno[ano] || 0) + (i.v_titulo || 0)
  }
  const dadosAno = Object.entries(porAno)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ano, valor]) => ({ ano, valor }))

  // Tabela hierárquica por projeto → conta gerencial
  const porProjeto = {}
  for (const i of cap) {
    const proj = i.desc_centro_custo || '(sem projeto)'
    if (!porProjeto[proj]) porProjeto[proj] = { total: 0, contas: {} }
    porProjeto[proj].total += i.v_titulo || 0
    const g = i.desc_conta_gerencial || '(sem categoria)'
    porProjeto[proj].contas[g] = (porProjeto[proj].contas[g] || 0) + (i.v_titulo || 0)
  }
  const projetos = Object.entries(porProjeto)
    .sort((a, b) => b[1].total - a[1].total)

  function toggleProj(key) {
    setExpandidos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KPICard label="Total Despesas"  valor={fmtBRL(totalDespesas)}  cor="#F1F5F9" />
        <KPICard label="Total Liquidado" valor={fmtBRL(totalLiquidado)} cor="#22C55E" />
        <KPICard label="Total em Aberto" valor={fmtBRL(totalAberto)}    cor="#F97316" />
      </div>

      {/* Gráficos lado a lado */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Barras horizontais top 10 contas */}
        <div style={{ flex: 1, background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 16 }}>Top 10 Contas Gerenciais</div>
          {top10Gerencial.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={top10Gerencial} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtBRL(v)} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip content={<TooltipBRL />} />
                <Bar dataKey="value" fill={COR_CORAL} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>Sem dados</div>
          )}
        </div>

        {/* Área evolução por ano */}
        <div style={{ flex: 1, background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 16 }}>Evolução de Despesas por Ano</div>
          {dadosAno.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dadosAno} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="coralGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COR_CORAL} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COR_CORAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" />
                <XAxis dataKey="ano" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<TooltipBRL />} />
                <Area type="monotone" dataKey="valor" stroke={COR_CORAL} fill="url(#coralGrad)" strokeWidth={2} dot={{ fill: COR_CORAL, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>Sem dados</div>
          )}
        </div>
      </div>

      {/* Tabela hierárquica */}
      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #2E3150', fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>
          Despesas por Projeto
        </div>
        {projetos.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 20px', fontSize: 11, color: '#64748B', borderBottom: '1px solid #1E2235' }}>
              <span>Projeto</span>
              <span>Total</span>
            </div>
            {projetos.map(([proj, { total, contas }]) => (
              <div key={proj}>
                <button
                  onClick={() => toggleProj(proj)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto', width: '100%', padding: '10px 20px', background: 'none', border: 'none', borderBottom: '1px solid #1E2235', cursor: 'pointer', color: '#CBD5E1', fontSize: 13 }}
                >
                  <span style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {expandidos[proj] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {proj}
                  </span>
                  <span style={{ fontWeight: 600, color: '#F1F5F9' }}>{fmtBRL(total)}</span>
                </button>
                {expandidos[proj] && (
                  <div style={{ background: '#141726' }}>
                    {Object.entries(contas)
                      .sort((a, b) => b[1] - a[1])
                      .map(([conta, val]) => (
                        <div key={conta} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '7px 20px 7px 44px', borderBottom: '1px solid #1A1D2E', fontSize: 12 }}>
                          <span style={{ color: '#94A3B8' }}>{conta}</span>
                          <span style={{ color: '#CBD5E1' }}>{fmtBRL(val)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <div style={{ padding: 24, color: '#475569', fontSize: 13, textAlign: 'center' }}>
            Nenhum dado de despesa disponível
          </div>
        )}
      </div>
    </div>
  )
}
