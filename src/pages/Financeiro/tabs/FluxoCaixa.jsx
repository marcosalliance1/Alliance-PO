import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { fmtBRL, mesAno } from '../../../utils/parseFinanceiro'
import { ChevronDown, ChevronRight } from 'lucide-react'

function KPICard({ label, valor, cor, sub }) {
  return (
    <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor || '#F1F5F9' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function TooltipBRL({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#3B82F6' }}>{fmtBRL(payload[0].value)}</div>
    </div>
  )
}

export default function FluxoCaixa({ cap }) {
  const [expandidos, setExpandidos] = useState({})

  const hoje = new Date().toISOString().slice(0, 10)
  const em7  = new Date(Date.now() + 7  * 86400000).toISOString().slice(0, 10)
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const capAtivo = cap.filter(i => i.situacao === 'ATIVO')

  const totalAberto  = capAtivo.reduce((s, i) => s + (i.v_titulo || 0), 0)
  const totalVencido = capAtivo.filter(i => i.d_vencimento && i.d_vencimento < hoje).reduce((s, i) => s + (i.v_titulo || 0), 0)
  const aVencer7     = capAtivo.filter(i => i.d_vencimento && i.d_vencimento >= hoje && i.d_vencimento <= em7).reduce((s, i) => s + (i.v_titulo || 0), 0)
  const aVencer30    = capAtivo.filter(i => i.d_vencimento && i.d_vencimento >= hoje && i.d_vencimento <= em30).reduce((s, i) => s + (i.v_titulo || 0), 0)

  // Gráfico: a pagar por mês (ATIVO)
  const porMes = {}
  for (const i of capAtivo) {
    const key = mesAno(i.d_vencimento)
    if (!key) continue
    if (!porMes[key]) porMes[key] = { mes: key, ano: i.d_vencimento?.slice(0, 7) || '', valor: 0 }
    porMes[key].valor += i.v_titulo || 0
  }
  const dadosMes = Object.values(porMes)
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map(({ mes, valor }) => ({ mes, valor }))

  // Tabela: vencidos por mês, expandível por projeto
  const vencidos = capAtivo.filter(i => i.d_vencimento && i.d_vencimento < hoje)
  const vencidosPorMes = {}
  for (const i of vencidos) {
    const key = mesAno(i.d_vencimento)
    if (!key) continue
    if (!vencidosPorMes[key]) vencidosPorMes[key] = { mes: key, ano: i.d_vencimento?.slice(0, 7) || '', total: 0, projetos: {} }
    vencidosPorMes[key].total += i.v_titulo || 0
    const proj = i.desc_centro_custo || '(sem projeto)'
    vencidosPorMes[key].projetos[proj] = (vencidosPorMes[key].projetos[proj] || 0) + (i.v_titulo || 0)
  }
  const linhasVencidos = Object.values(vencidosPorMes).sort((a, b) => a.ano.localeCompare(b.ano))

  function toggleMes(key) {
    setExpandidos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KPICard label="Total em Aberto"     valor={fmtBRL(totalAberto)}  cor="#F1F5F9" />
        <KPICard label="Total Vencido"        valor={fmtBRL(totalVencido)} cor="#EF4444" sub="situação ATIVO e data passada" />
        <KPICard label="A Vencer em 7 dias"   valor={fmtBRL(aVencer7)}    cor="#F59E0B" />
        <KPICard label="A Vencer em 30 dias"  valor={fmtBRL(aVencer30)}   cor="#3B82F6" />
      </div>

      {/* Gráfico a pagar por mês */}
      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 16 }}>Total a Pagar por Mês (títulos ATIVO)</div>
        {dadosMes.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosMes} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" />
              <XAxis dataKey="mes" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<TooltipBRL />} />
              <Bar dataKey="valor" name="A Pagar" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
            Nenhum título ATIVO com data de vencimento
          </div>
        )}
      </div>

      {/* Tabela vencidos expandível */}
      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #2E3150', fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>
          Vencidos por Mês
        </div>
        {linhasVencidos.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 32px', padding: '8px 20px', fontSize: 11, color: '#64748B', borderBottom: '1px solid #1E2235' }}>
              <span>Mês/Ano</span>
              <span style={{ textAlign: 'right', paddingRight: 32 }}>Valor Vencido</span>
            </div>
            {linhasVencidos.map(({ mes, total, projetos }) => (
              <div key={mes}>
                <button
                  onClick={() => toggleMes(mes)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto 32px', width: '100%', padding: '10px 20px', background: 'none', border: 'none', borderBottom: '1px solid #1E2235', cursor: 'pointer', color: '#CBD5E1', fontSize: 13 }}
                >
                  <span style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {expandidos[mes] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {mes}
                  </span>
                  <span style={{ textAlign: 'right', paddingRight: 32, fontWeight: 600, color: '#EF4444' }}>{fmtBRL(total)}</span>
                </button>
                {expandidos[mes] && (
                  <div style={{ background: '#141726' }}>
                    {Object.entries(projetos)
                      .sort((a, b) => b[1] - a[1])
                      .map(([proj, val]) => (
                        <div key={proj} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '7px 20px 7px 44px', borderBottom: '1px solid #1A1D2E', fontSize: 12 }}>
                          <span style={{ color: '#94A3B8' }}>{proj}</span>
                          <span style={{ color: '#F87171', fontWeight: 500 }}>{fmtBRL(val)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <div style={{ padding: 24, color: '#475569', fontSize: 13, textAlign: 'center' }}>
            Nenhum título vencido
          </div>
        )}
      </div>
    </div>
  )
}
