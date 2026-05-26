import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { fmtBRL, nivelEnsino } from '../../../utils/parseFinanceiro'

const COR_RECEITA  = '#22C55E'
const COR_DESPESA  = '#EF4444'
const COR_NEUTRO   = '#3B82F6'
const CORES_ENSINO = ['#3B82F6', '#A855F7', '#F97316']

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
      <div style={{ color: '#94A3B8', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtBRL(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function ResultadoProjetos({ cap, car }) {
  const totalReceitas = car.reduce((s, i) => s + (i.v_lancamento || 0), 0)
  const totalDespesas = cap.reduce((s, i) => s + (i.v_titulo || 0), 0)
  const resultado = totalReceitas - totalDespesas
  const margem = totalReceitas > 0 ? (resultado / totalReceitas) * 100 : 0

  // Receitas vs Despesas por ano
  const porAno = {}
  for (const i of car) {
    const ano = i.competencia?.slice(0, 4)
    if (!ano) continue
    if (!porAno[ano]) porAno[ano] = { ano, receitas: 0, despesas: 0 }
    porAno[ano].receitas += i.v_lancamento || 0
  }
  for (const i of cap) {
    const ano = i.d_competencia?.slice(0, 4)
    if (!ano) continue
    if (!porAno[ano]) porAno[ano] = { ano, receitas: 0, despesas: 0 }
    porAno[ano].despesas += i.v_titulo || 0
  }
  const dadosAnos = Object.values(porAno).sort((a, b) => a.ano.localeCompare(b.ano))

  // Distribuição por nível de ensino
  const porNivel = {}
  for (const i of car) {
    const nivel = nivelEnsino(i.desc_centro_custo)
    porNivel[nivel] = (porNivel[nivel] || 0) + (i.v_lancamento || 0)
  }
  const total = Object.values(porNivel).reduce((s, v) => s + v, 0)
  const donutData = Object.entries(porNivel).map(([name, value]) => ({
    name,
    value,
    pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
  }))

  // Top 10 projetos por resultado
  const projMap = {}
  for (const i of car) {
    if (!projMap[i.desc_centro_custo]) projMap[i.desc_centro_custo] = { receita: 0, despesa: 0 }
    projMap[i.desc_centro_custo].receita += i.v_lancamento || 0
  }
  for (const i of cap) {
    if (!projMap[i.desc_centro_custo]) projMap[i.desc_centro_custo] = { receita: 0, despesa: 0 }
    projMap[i.desc_centro_custo].despesa += i.v_titulo || 0
  }
  const top10 = Object.entries(projMap)
    .map(([nome, { receita, despesa }]) => ({ nome, receita, despesa, resultado: receita - despesa }))
    .filter(p => p.nome)
    .sort((a, b) => b.resultado - a.resultado)
    .slice(0, 10)
  const maxRes = top10[0]?.resultado || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KPICard label="Receitas Totais"  valor={fmtBRL(totalReceitas)} cor={COR_RECEITA} />
        <KPICard label="Despesas Totais"  valor={fmtBRL(totalDespesas)} cor={COR_DESPESA} />
        <KPICard label="Resultado"        valor={fmtBRL(resultado)}     cor={resultado >= 0 ? COR_RECEITA : COR_DESPESA} />
        <KPICard label="Margem"           valor={`${margem.toFixed(1)}%`} cor={COR_NEUTRO} />
      </div>

      {/* Gráficos lado a lado */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Barras por ano */}
        <div style={{ flex: 2, background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 16 }}>Receitas vs Despesas por Ano</div>
          {dadosAnos.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dadosAnos} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3150" />
                <XAxis dataKey="ano" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtBRL(v)} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<TooltipBRL />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
                <Bar dataKey="receitas" name="Receitas" fill={COR_RECEITA} radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill={COR_DESPESA} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
              Sem dados
            </div>
          )}
        </div>

        {/* Donut por nível */}
        <div style={{ flex: 1, background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 16 }}>Receita por Nível de Ensino</div>
          {donutData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={55} outerRadius={80}
                    paddingAngle={3} dataKey="value"
                    label={({ pct }) => `${pct}%`}
                    labelLine={false}
                  >
                    {donutData.map((_, idx) => (
                      <Cell key={idx} fill={CORES_ENSINO[idx % CORES_ENSINO.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {donutData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: CORES_ENSINO[i % CORES_ENSINO.length], flexShrink: 0 }} />
                    <span style={{ color: '#94A3B8', flex: 1 }}>{d.name}</span>
                    <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>Sem dados</div>
          )}
        </div>
      </div>

      {/* Top 10 projetos */}
      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 16 }}>Top 10 Projetos por Resultado</div>
        {top10.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top10.map((p, idx) => {
              const pct = Math.max(0, (p.resultado / maxRes) * 100)
              const cor = p.resultado >= 0 ? COR_RECEITA : COR_DESPESA
              return (
                <div key={p.nome}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: '#CBD5E1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                      {idx + 1}. {p.nome}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cor, flexShrink: 0 }}>{fmtBRL(p.resultado)}</span>
                  </div>
                  <div style={{ height: 6, background: '#0D1220', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 3, opacity: 0.7 + idx * 0.03 }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: 13 }}>Sem dados</div>
        )}
      </div>
    </div>
  )
}
