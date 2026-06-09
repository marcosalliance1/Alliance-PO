import { useState, useRef, useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { Upload, Loader, TrendingUp, CreditCard, BarChart2, ChevronDown, ChevronRight, Table2, Search, ChevronLeft } from 'lucide-react'
import { useFinanceiro, type BoletimRecord, type CAPRecord, type DimensaoProjetoRecord } from '../hooks/useFinanceiro'
import { fmtCompact, tempoDesde, mesAno, nivelEnsino } from '../utils/parseFinanceiro'
import { useAuth } from '../contexts/AuthContext'
import { Toast } from '../components/ui/Toast'
import { KPICard } from '../components/dashboard/KPICard'

// ─── Constantes visuais ───────────────────────────────────────────
const C_RECEITA = '#00b894'
const C_DESPESA = '#e94560'
const C_AZUL    = '#0078d4'
const C_CORAL   = '#f97316'
const C_ROXO    = '#8B5CF6'
const CORES_MARGEM_ENSINO: Record<string, string> = { Superior: '#185FA5', 'Médio': '#3B6D11', Fundamental: '#854F0B' }
const CORES_CAT = ['#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16', '#EF4444', '#A78BFA', '#34D399']

const ABAS = [
  { id: 'resultado', label: 'Resultado Projetos', Icon: TrendingUp },
  { id: 'fluxo',    label: 'Fluxo de Caixa',      Icon: CreditCard },
  { id: 'despesas', label: 'Controle de Despesas', Icon: BarChart2 },
  { id: 'dados',    label: 'Dados',                Icon: Table2 },
] as const
type AbaId = typeof ABAS[number]['id']

// ─── Tooltip reutilizável ─────────────────────────────────────────
function TTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-white/10 rounded-inner p-3 text-xs shadow-card">
      <p className="text-text-main font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-text-muted">{p.name}: <span style={{ color: p.color }}>{fmtCompact(p.value)}</span></p>
      ))}
    </div>
  )
}

// ─── Aba 1: Resultado Projetos ────────────────────────────────────
function ResultadoProjetos({ boletim, cap, dimensaoProjetos, filtroProj }: { boletim: BoletimRecord[]; cap: CAPRecord[]; dimensaoProjetos: DimensaoProjetoRecord[]; filtroProj: string }) {
  const [ensinoAberto, setEnsinoAberto] = useState<Record<string, boolean>>({})
  const [instAberta, setInstAberta] = useState<Record<string, boolean>>({})

  const fp = filtroProj.toLowerCase()
  const boletimF = fp ? boletim.filter(r => r.desc_centro_custo.toLowerCase().includes(fp)) : boletim
  const capF     = fp ? cap.filter(r => r.desc_centro_custo.toLowerCase().includes(fp))     : cap

  const receitas    = boletimF.filter(r => r.tipo === 'RECEITA')
  const despesas    = boletimF.filter(r => r.tipo === 'DESPESA')
  const rendimentos = boletimF.filter(r => r.tipo === 'RENDIMENTO')

  // Realizado (só Boletim)
  const totalReceitas    = receitas.reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const totalDespesas    = despesas.reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const totalRendimentos = rendimentos.reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const resultado = totalReceitas - totalDespesas
  const margem = totalReceitas > 0 ? (resultado / totalReceitas) * 100 : 0

  // Projetado (Boletim + CAP ATIVO)
  const totalDespesasP = totalDespesas + capF.reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const resultadoP     = totalReceitas - totalDespesasP
  const margemP        = totalReceitas > 0 ? (resultadoP / totalReceitas) * 100 : 0

  const porAno: Record<string, { ano: string; receitas: number; despesas: number }> = {}
  for (const i of receitas) {
    const ano = i.d_competencia?.slice(0, 4); if (!ano) continue
    porAno[ano] ??= { ano, receitas: 0, despesas: 0 }
    porAno[ano].receitas += i.v_lancamento ?? 0
  }
  for (const i of despesas) {
    const ano = i.d_competencia?.slice(0, 4); if (!ano) continue
    porAno[ano] ??= { ano, receitas: 0, despesas: 0 }
    porAno[ano].despesas += i.v_lancamento ?? 0
  }
  const dadosAnos = Object.values(porAno).sort((a, b) => a.ano.localeCompare(b.ano))

  // Margem % por ensino
  const porNivelMargem: Record<string, { receita: number; despesa: number }> = {}
  for (const i of receitas) { const n = nivelEnsino(i.desc_centro_custo); porNivelMargem[n] ??= { receita: 0, despesa: 0 }; porNivelMargem[n].receita += i.v_lancamento ?? 0 }
  for (const i of despesas) { const n = nivelEnsino(i.desc_centro_custo); porNivelMargem[n] ??= { receita: 0, despesa: 0 }; porNivelMargem[n].despesa += i.v_lancamento ?? 0 }
  const donutMargem = Object.entries(porNivelMargem)
    .filter(([, v]) => v.receita > 0)
    .map(([name, { receita, despesa }]) => {
      const margemR = receita - despesa
      return { name, margemR, margemPct: (margemR / receita) * 100, value: Math.max(0, margemR) }
    })
    .sort((a, b) => b.margemR - a.margemR)

  // Receitas por conta gerencial
  const porConta: Record<string, number> = {}
  for (const i of receitas) { const c = i.desc_conta_gerencial || 'Outras'; porConta[c] = (porConta[c] ?? 0) + (i.v_lancamento ?? 0) }
  const totalConta = Object.values(porConta).reduce((s, v) => s + v, 0)
  const donutCat = Object.entries(porConta)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, pct: totalConta > 0 ? ((value / totalConta) * 100).toFixed(1) : '0' }))
    .sort((a, b) => b.value - a.value)

  const projMap: Record<string, { receita: number; despesa: number }> = {}
  for (const i of receitas) { projMap[i.desc_centro_custo] ??= { receita: 0, despesa: 0 }; projMap[i.desc_centro_custo].receita += i.v_lancamento ?? 0 }
  for (const i of despesas) { projMap[i.desc_centro_custo] ??= { receita: 0, despesa: 0 }; projMap[i.desc_centro_custo].despesa += i.v_lancamento ?? 0 }
  const top10 = Object.entries(projMap)
    .filter(([n]) => n)
    .map(([nome, { receita, despesa }]) => ({ nome, resultado: receita - despesa }))
    .sort((a, b) => b.resultado - a.resultado)
    .slice(0, 10)
  const maxRes = Math.abs(top10[0]?.resultado ?? 1) || 1

  const dimMapT: Record<string, { ensino: string; instituicao: string }> = {}
  for (const d of dimensaoProjetos) {
    if (d.nome_projeto) dimMapT[d.nome_projeto.trim()] = { ensino: normalizeEnsino(d.ensino), instituicao: d.instituicao.trim() }
  }
  const gruposTab: Record<string, Record<string, { receita: number; despesa: number; projetos: Record<string, { receita: number; despesa: number }> }>> = {}
  for (const [proj, { receita, despesa }] of Object.entries(projMap)) {
    if (!proj) continue
    const dim = dimMapT[proj]
    const ensino = dim?.ensino || 'Outros'
    const inst   = dim?.instituicao || 'Outros'
    gruposTab[ensino] ??= {}
    gruposTab[ensino][inst] ??= { receita: 0, despesa: 0, projetos: {} }
    gruposTab[ensino][inst].receita += receita
    gruposTab[ensino][inst].despesa += despesa
    gruposTab[ensino][inst].projetos[proj] = { receita, despesa }
  }
  type TabelaProj  = { nome: string; receita: number; despesa: number }
  type TabelaInst  = { nome: string; receita: number; despesa: number; projetos: TabelaProj[] }
  type TabelaEnsino = { nome: string; receita: number; despesa: number; instituicoes: TabelaInst[] }
  const tabelaEnsinos: TabelaEnsino[] = [
    ...ORDEM_ENSINO.filter(e => gruposTab[e]),
    ...Object.keys(gruposTab).filter(e => !ORDEM_ENSINO.includes(e)),
  ].map(ensino => {
    const instMap = gruposTab[ensino]
    let eRec = 0, eDesp = 0
    const instituicoes: TabelaInst[] = Object.entries(instMap)
      .sort((a, b) => (b[1].receita - b[1].despesa) - (a[1].receita - a[1].despesa))
      .map(([nome, { receita, despesa, projetos }]) => {
        eRec += receita; eDesp += despesa
        return {
          nome, receita, despesa,
          projetos: Object.entries(projetos)
            .sort((a, b) => (b[1].receita - b[1].despesa) - (a[1].receita - a[1].despesa))
            .map(([n, rv]) => ({ nome: n, receita: rv.receita, despesa: rv.despesa })),
        }
      })
    return { nome: ensino, receita: eRec, despesa: eDesp, instituicoes }
  })
  const totalGeralRec  = tabelaEnsinos.reduce((s, e) => s + e.receita, 0)
  const totalGeralDesp = tabelaEnsinos.reduce((s, e) => s + e.despesa, 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {/* Resultado Realizado */}
        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-3 pb-2 border-b border-white/10">Resultado Realizado</h3>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm"><span className="text-text-muted">Receitas</span><span className="font-semibold" style={{ color: C_RECEITA }}>{fmtCompact(totalReceitas)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-text-muted">Despesas</span><span className="font-semibold" style={{ color: C_DESPESA }}>{fmtCompact(totalDespesas)}</span></div>
            <div className="flex justify-between text-sm border-t border-white/10 pt-2"><span className="text-text-muted">Resultado</span><span className="font-bold" style={{ color: resultado >= 0 ? C_RECEITA : C_DESPESA }}>{fmtCompact(resultado)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-text-muted">Margem</span><span className="font-bold" style={{ color: C_AZUL }}>{margem.toFixed(1)}%</span></div>
            {totalRendimentos > 0 && (
              <div className="flex justify-between text-sm border-t border-white/10 pt-2"><span className="text-text-muted">Rendimentos Financeiros</span><span className="font-semibold" style={{ color: C_ROXO }}>{fmtCompact(totalRendimentos)}</span></div>
            )}
          </div>
        </div>
        {/* Resultado Projetado */}
        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-3 pb-2 border-b border-white/10">
            Resultado Projetado <span className="text-xs text-text-muted font-normal">+ CAP Ativo</span>
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm"><span className="text-text-muted">Receitas</span><span className="font-semibold" style={{ color: C_RECEITA }}>{fmtCompact(totalReceitas)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-text-muted">Despesas</span><span className="font-semibold" style={{ color: C_DESPESA }}>{fmtCompact(totalDespesasP)}</span></div>
            <div className="flex justify-between text-sm border-t border-white/10 pt-2"><span className="text-text-muted">Resultado</span><span className="font-bold" style={{ color: resultadoP >= 0 ? C_RECEITA : C_DESPESA }}>{fmtCompact(resultadoP)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-text-muted">Margem</span><span className="font-bold" style={{ color: C_AZUL }}>{margemP.toFixed(1)}%</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card col-span-2">
          <h3 className="text-text-main text-sm font-semibold mb-4">Receitas vs Despesas por Ano</h3>
          {dadosAnos.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dadosAnos}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="ano" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<TTip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
                <Bar dataKey="receitas" name="Receitas" fill={C_RECEITA} radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill={C_DESPESA} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Donut: Margem % por Ensino */}
        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-3">Margem % por Ensino</h3>
          {donutMargem.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={donutMargem} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value" labelLine={false}>
                    {donutMargem.map((d) => <Cell key={d.name} fill={CORES_MARGEM_ENSINO[d.name] ?? '#64748B'} />)}
                  </Pie>
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" fill="#f0f0f0" fontSize={13} fontWeight="bold">{margem.toFixed(1)}%</text>
                  <text x="50%" y="57%" textAnchor="middle" dominantBaseline="central" fill="#8892b0" fontSize={9}>Margem Geral</text>
                  <Tooltip formatter={(_v, _n, p) => [`${(p.payload as { margemPct: number }).margemPct.toFixed(1)}%`, p.name as string]} contentStyle={{ background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {donutMargem.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CORES_MARGEM_ENSINO[d.name] ?? '#64748B' }} />
                    <span className="text-text-muted flex-1">{d.name}</span>
                    <span className={`font-semibold ${d.margemPct >= 0 ? 'text-success' : 'text-danger'}`}>{d.margemPct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </div>

        {/* Donut: Receitas por Categoria */}
        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-3">Receitas por Categoria</h3>
          {donutCat.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={donutCat} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="value" labelLine={false}>
                    {donutCat.map((_, i) => <Cell key={i} fill={CORES_CAT[i % CORES_CAT.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} contentStyle={{ background: '#1e2235', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2 max-h-28 overflow-y-auto">
                {donutCat.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CORES_CAT[i % CORES_CAT.length] }} />
                    <span className="text-text-muted flex-1 truncate" title={d.name}>{d.name}</span>
                    <span className="text-text-muted text-[10px] shrink-0">{d.pct}%</span>
                    <span className="text-text-main font-semibold shrink-0">{d.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </div>
      </div>

      <div className="card">
        <h3 className="text-text-main text-sm font-semibold mb-4">Top 10 Projetos por Resultado</h3>
        {top10.length > 0 ? (
          <div className="space-y-3">
            {top10.map((p, idx) => {
              const pct = Math.max(0, (Math.abs(p.resultado) / maxRes) * 100)
              const cor = p.resultado >= 0 ? C_RECEITA : C_DESPESA
              return (
                <div key={p.nome}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-text-muted truncate flex-1 pr-3">{idx + 1}. {p.nome}</span>
                    <span className="text-xs font-semibold shrink-0" style={{ color: cor }}>{fmtCompact(p.resultado)}</span>
                  </div>
                  <div className="h-1.5 bg-black/30 rounded-full">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor, opacity: 0.75 }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : <EmptyChart />}
      </div>

      {/* Tabela Geral de Projetos */}
      {tabelaEnsinos.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-text-main text-sm font-semibold">Tabela Geral de Projetos</div>
          <div className="flex items-center px-5 py-2.5 border-b border-white/10 bg-white/5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            <span className="flex-1">Projeto / Instituição / Ensino</span>
            <span className="w-28 text-right shrink-0">Receita</span>
            <span className="w-28 text-right shrink-0">Despesa</span>
            <span className="w-28 text-right shrink-0">Resultado</span>
            <span className="w-20 text-right shrink-0">Margem %</span>
          </div>

          {tabelaEnsinos.map(ensino => {
            const cores = NIVEL_CORES[ensino.nome] ?? NIVEL_CORES['Outros']
            const eRes  = ensino.receita - ensino.despesa
            const eMarg = ensino.receita > 0 ? (eRes / ensino.receita) * 100 : 0
            const eAberto = !!ensinoAberto[ensino.nome]
            return (
              <div key={ensino.nome}>
                <button
                  onClick={() => setEnsinoAberto(p => ({ ...p, [ensino.nome]: !p[ensino.nome] }))}
                  className="w-full flex items-center px-5 py-3 text-left text-xs font-bold border-b border-white/10 hover:opacity-80 transition-opacity"
                  style={{ background: `${cores.forte}26`, borderLeft: `3px solid ${cores.forte}`, color: cores.claro }}
                >
                  <span className="flex items-center gap-2 flex-1 uppercase tracking-wider">
                    {eAberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {ensino.nome}
                  </span>
                  <span className="w-28 text-right shrink-0">{fmtCompact(ensino.receita)}</span>
                  <span className="w-28 text-right shrink-0">{fmtCompact(ensino.despesa)}</span>
                  <span className="w-28 text-right shrink-0" style={{ color: eRes >= 0 ? C_RECEITA : C_DESPESA }}>{fmtCompact(eRes)}</span>
                  <span className="w-20 text-right shrink-0 font-semibold" style={{ color: eMarg >= 0 ? C_RECEITA : C_DESPESA }}>{eMarg.toFixed(1)}%</span>
                </button>

                {eAberto && ensino.instituicoes.map(inst => {
                  const ik     = `${ensino.nome}::${inst.nome}`
                  const iRes   = inst.receita - inst.despesa
                  const iMarg  = inst.receita > 0 ? (iRes / inst.receita) * 100 : 0
                  const iAberta = !!instAberta[ik]
                  return (
                    <div key={inst.nome}>
                      <button
                        onClick={() => setInstAberta(p => ({ ...p, [ik]: !p[ik] }))}
                        className="w-full flex items-center px-5 py-2.5 pl-10 text-left text-xs font-semibold border-b border-white/5 hover:opacity-80 transition-opacity"
                        style={{ background: `${cores.claro}12`, borderLeft: `2px solid ${cores.claro}`, color: cores.claro }}
                      >
                        <span className="flex items-center gap-2 flex-1 uppercase tracking-wide">
                          {iAberta ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          {inst.nome}
                        </span>
                        <span className="w-28 text-right shrink-0">{fmtCompact(inst.receita)}</span>
                        <span className="w-28 text-right shrink-0">{fmtCompact(inst.despesa)}</span>
                        <span className="w-28 text-right shrink-0" style={{ color: iRes >= 0 ? C_RECEITA : C_DESPESA }}>{fmtCompact(iRes)}</span>
                        <span className="w-20 text-right shrink-0 font-semibold" style={{ color: iMarg >= 0 ? C_RECEITA : C_DESPESA }}>{iMarg.toFixed(1)}%</span>
                      </button>

                      {iAberta && inst.projetos.map(proj => {
                        const pRes  = proj.receita - proj.despesa
                        const pMarg = proj.receita > 0 ? (pRes / proj.receita) * 100 : 0
                        return (
                          <div key={proj.nome} className="flex items-center px-5 py-2 pl-16 text-xs border-b border-white/5 bg-black/15">
                            <span className="flex-1 truncate pr-3 text-text-main">{proj.nome}</span>
                            <span className="w-28 text-right shrink-0 text-text-muted">{fmtCompact(proj.receita)}</span>
                            <span className="w-28 text-right shrink-0 text-text-muted">{fmtCompact(proj.despesa)}</span>
                            <span className="w-28 text-right shrink-0 font-medium" style={{ color: pRes >= 0 ? C_RECEITA : C_DESPESA }}>{fmtCompact(pRes)}</span>
                            <span className="w-20 text-right shrink-0 font-semibold" style={{ color: pMarg >= 0 ? C_RECEITA : C_DESPESA }}>{pMarg.toFixed(1)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {(() => {
            const totRes  = totalGeralRec - totalGeralDesp
            const totMarg = totalGeralRec > 0 ? (totRes / totalGeralRec) * 100 : 0
            return (
              <div className="flex items-center px-5 py-3 border-t border-white/15 bg-white/5 text-xs font-bold text-text-main">
                <span className="flex-1">Total Geral</span>
                <span className="w-28 text-right shrink-0">{fmtCompact(totalGeralRec)}</span>
                <span className="w-28 text-right shrink-0">{fmtCompact(totalGeralDesp)}</span>
                <span className="w-28 text-right shrink-0" style={{ color: totRes >= 0 ? C_RECEITA : C_DESPESA }}>{fmtCompact(totRes)}</span>
                <span className="w-20 text-right shrink-0" style={{ color: totMarg >= 0 ? C_RECEITA : C_DESPESA }}>{totMarg.toFixed(1)}%</span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Aba 2: Fluxo de Caixa ────────────────────────────────────────
function FluxoCaixa({ cap: capRaw, filtroProj }: { cap: CAPRecord[]; filtroProj: string }) {
  const fp = filtroProj.toLowerCase().trim()
  const cap = fp ? capRaw.filter(r => r.desc_centro_custo.toLowerCase().includes(fp)) : capRaw

  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [expandidosProjetos, setExpandidosProjetos] = useState<Record<string, boolean>>({})
  const [expandidosContas, setExpandidosContas] = useState<Record<string, boolean>>({})
  const hoje = new Date().toISOString().slice(0, 10)
  const em7  = new Date(Date.now() + 7  * 86400000).toISOString().slice(0, 10)
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const totalAberto  = cap.reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const totalVencido = cap.filter(i => i.d_vencimento && i.d_vencimento < hoje).reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const aVencer7     = cap.filter(i => i.d_vencimento && i.d_vencimento >= hoje && i.d_vencimento <= em7).reduce((s, i) => s + (i.v_titulo ?? 0), 0)
  const aVencer30    = cap.filter(i => i.d_vencimento && i.d_vencimento >= hoje && i.d_vencimento <= em30).reduce((s, i) => s + (i.v_titulo ?? 0), 0)

  const porMes: Record<string, { mes: string; sortKey: string; valor: number }> = {}
  for (const i of cap) {
    const key = mesAno(i.d_vencimento); if (!key || !i.d_vencimento) continue
    porMes[key] ??= { mes: key, sortKey: i.d_vencimento.slice(0, 7), valor: 0 }
    porMes[key].valor += i.v_titulo ?? 0
  }
  const dadosMes = Object.values(porMes).sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  type FornMap = Record<string, number>
  type ContaFC = { total: number; fornecedores: FornMap }
  type ProjFC  = { total: number; contas: Record<string, ContaFC> }
  type MesFC   = { mes: string; sortKey: string; total: number; vencido: boolean; projetos: Record<string, ProjFC> }
  const pagPorMes: Record<string, MesFC> = {}
  for (const i of cap) {
    const key  = mesAno(i.d_vencimento); if (!key || !i.d_vencimento) continue
    const proj = i.desc_centro_custo     || '(sem projeto)'
    const g    = i.desc_conta_gerencial  || '(sem categoria)'
    const forn = i.fantasia_fornecedor   || '(sem fornecedor)'
    pagPorMes[key] ??= { mes: key, sortKey: i.d_vencimento.slice(0, 7), total: 0, vencido: i.d_vencimento < hoje, projetos: {} }
    pagPorMes[key].total += i.v_titulo ?? 0
    pagPorMes[key].projetos[proj] ??= { total: 0, contas: {} }
    pagPorMes[key].projetos[proj].total += i.v_titulo ?? 0
    pagPorMes[key].projetos[proj].contas[g] ??= { total: 0, fornecedores: {} }
    pagPorMes[key].projetos[proj].contas[g].total += i.v_titulo ?? 0
    pagPorMes[key].projetos[proj].contas[g].fornecedores[forn] = (pagPorMes[key].projetos[proj].contas[g].fornecedores[forn] ?? 0) + (i.v_titulo ?? 0)
  }
  const linhasPag = Object.values(pagPorMes).sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Total em Aberto"    value={fmtCompact(totalAberto)}  color="#94a3b8" />
        <KPICard title="Total Vencido"      value={fmtCompact(totalVencido)} color={C_DESPESA} subtitle="ATIVO com data passada" />
        <KPICard title="A Vencer 7 dias"    value={fmtCompact(aVencer7)}    color="#f59e0b" />
        <KPICard title="A Vencer 30 dias"   value={fmtCompact(aVencer30)}   color={C_AZUL} />
      </div>

      <div className="card">
        <h3 className="text-text-main text-sm font-semibold mb-4">Total a Pagar por Mês (títulos ATIVO)</h3>
        {dadosMes.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<TTip />} />
              <Bar dataKey="valor" name="A Pagar" fill={C_AZUL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart label="Nenhum título ATIVO com data de vencimento" />}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-text-main text-sm font-semibold">Pagamentos em Aberto por Mês</div>
        {linhasPag.length > 0 ? linhasPag.map(({ mes, total, vencido, projetos }) => (
          <div key={mes}>
            <button
              onClick={() => setExpandidos(p => ({ ...p, [mes]: !p[mes] }))}
              className="w-full flex items-center gap-2 px-5 py-3 text-left text-sm text-text-muted hover:bg-white/5 transition-colors border-b border-white/5"
            >
              {expandidos[mes] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="flex-1">{mes}</span>
              {vencido && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 mr-2">VENCIDO</span>}
              <span className={`font-semibold ${vencido ? 'text-danger' : 'text-text-main'}`}>{fmtCompact(total)}</span>
            </button>
            {expandidos[mes] && Object.entries(projetos).sort((a, b) => b[1].total - a[1].total).map(([proj, { total: pTotal, contas }]) => {
              const pk = `${mes}::${proj}`
              return (
                <div key={proj}>
                  <button
                    onClick={() => setExpandidosProjetos(p => ({ ...p, [pk]: !p[pk] }))}
                    className="w-full flex items-center gap-2 px-5 py-2 pl-10 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/20"
                  >
                    {expandidosProjetos[pk] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span className="flex-1 truncate">{proj}</span>
                    <span className={`font-medium ${vencido ? 'text-red-400' : 'text-text-main'}`}>{fmtCompact(pTotal)}</span>
                  </button>
                  {expandidosProjetos[pk] && Object.entries(contas).sort((a, b) => b[1].total - a[1].total).map(([conta, { total: cTotal, fornecedores }]) => {
                    const ck = `${mes}::${proj}::${conta}`
                    return (
                      <div key={conta}>
                        <button
                          onClick={() => setExpandidosContas(c => ({ ...c, [ck]: !c[ck] }))}
                          className="w-full flex items-center gap-2 px-5 py-2 pl-14 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/25"
                        >
                          {expandidosContas[ck] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          <span className="flex-1 truncate">{conta}</span>
                          <span>{fmtCompact(cTotal)}</span>
                        </button>
                        {expandidosContas[ck] && Object.entries(fornecedores).sort((a, b) => b[1] - a[1]).map(([forn, fVal]) => (
                          <div key={forn} className="flex justify-between px-5 py-1.5 pl-20 text-xs text-text-muted border-b border-white/5 bg-black/35">
                            <span className="truncate flex-1 pr-3">{forn}</span>
                            <span className="shrink-0">{fmtCompact(fVal)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )) : <div className="px-5 py-8 text-center text-text-muted text-sm">Nenhum título em aberto</div>}
      </div>
    </div>
  )
}

// ─── Aba 3: Controle de Despesas ──────────────────────────────────
const NIVEL_CORES: Record<string, { forte: string; claro: string }> = {
  'Superior':    { forte: '#185FA5', claro: '#B5D4F4' },
  'Médio':       { forte: '#3B6D11', claro: '#C0DD97' },
  'Fundamental': { forte: '#854F0B', claro: '#FAC775' },
  'Outros':      { forte: '#5F5E5A', claro: '#94A3B8' },
}
const ORDEM_ENSINO = ['Superior', 'Médio', 'Fundamental', 'Outros']

function normalizeEnsino(raw: string): string {
  const s = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (s.includes('superior')) return 'Superior'
  if (s.includes('medio')) return 'Médio'
  if (s.includes('fundament')) return 'Fundamental'
  return raw.trim() || 'Outros'
}

function ControleDespesas({ boletim: boletimRaw, dimensaoProjetos, filtroProj }: {
  boletim: BoletimRecord[]
  dimensaoProjetos: DimensaoProjetoRecord[]
  filtroProj: string
}) {
  const fp = filtroProj.toLowerCase().trim()
  const despesas = (fp
    ? boletimRaw.filter(r => r.tipo === 'DESPESA' && r.desc_centro_custo.toLowerCase().includes(fp))
    : boletimRaw.filter(r => r.tipo === 'DESPESA')
  )
  const [expandidosEnsino, setExpandidosEnsino] = useState<Record<string, boolean>>({})
  const [expandidosInst, setExpandidosInst] = useState<Record<string, boolean>>({})
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [expandidosContas, setExpandidosContas] = useState<Record<string, boolean>>({})

  const totalDespesas  = despesas.reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const totalLiquidado = despesas.filter(i => i.situacao === 'LIQUIDADO').reduce((s, i) => s + (i.v_lancamento ?? 0), 0)
  const totalAberto    = despesas.filter(i => i.situacao === 'ATIVO').reduce((s, i) => s + (i.v_lancamento ?? 0), 0)

  const porGerencial: Record<string, number> = {}
  for (const i of despesas) { const g = i.desc_conta_gerencial || '(sem categoria)'; porGerencial[g] = (porGerencial[g] ?? 0) + (i.v_lancamento ?? 0) }
  const top10Ger = Object.entries(porGerencial).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }))

  const porAno: Record<string, number> = {}
  for (const i of despesas) { const ano = i.d_competencia?.slice(0, 4); if (!ano) continue; porAno[ano] = (porAno[ano] ?? 0) + (i.v_lancamento ?? 0) }
  const dadosAno = Object.entries(porAno).sort((a, b) => a[0].localeCompare(b[0])).map(([ano, valor]) => ({ ano, valor }))

  const dimMap = useMemo(() => {
    const m: Record<string, { ensino: string; instituicao: string }> = {}
    for (const d of dimensaoProjetos) {
      if (d.nome_projeto) m[d.nome_projeto.trim()] = { ensino: normalizeEnsino(d.ensino), instituicao: d.instituicao.trim() }
    }
    return m
  }, [dimensaoProjetos])

  type ProjData = { total: number; contas: Record<string, { total: number; fornecedores: Record<string, number> }> }
  type GrupoInst = { total: number; projetos: Record<string, ProjData> }
  type GrupoEnsino = { total: number; instituicoes: Record<string, GrupoInst> }

  const grupos = useMemo(() => {
    const porProj: Record<string, ProjData> = {}
    for (const i of despesas) {
      const proj = i.desc_centro_custo    || '(sem projeto)'
      const g    = i.desc_conta_gerencial || '(sem categoria)'
      const forn = i.fantasia_cliente_fornecedor             || '(sem fornecedor)'
      porProj[proj] ??= { total: 0, contas: {} }
      porProj[proj].total += i.v_lancamento ?? 0
      porProj[proj].contas[g] ??= { total: 0, fornecedores: {} }
      porProj[proj].contas[g].total += i.v_lancamento ?? 0
      porProj[proj].contas[g].fornecedores[forn] = (porProj[proj].contas[g].fornecedores[forn] ?? 0) + (i.v_lancamento ?? 0)
    }

    const result: Record<string, GrupoEnsino> = {}
    for (const [proj, data] of Object.entries(porProj)) {
      if (!proj) continue
      const dim    = dimMap[proj]
      const ensino = dim?.ensino    || 'Outros'
      const inst   = dim?.instituicao || 'Outros'
      result[ensino] ??= { total: 0, instituicoes: {} }
      result[ensino].total += data.total
      result[ensino].instituicoes[inst] ??= { total: 0, projetos: {} }
      result[ensino].instituicoes[inst].total += data.total
      result[ensino].instituicoes[inst].projetos[proj] = data
    }
    return result
  }, [despesas, dimMap])

  const gruposOrdenados: [string, GrupoEnsino][] = [
    ...ORDEM_ENSINO.filter(e => grupos[e]).map(e => [e, grupos[e]] as [string, GrupoEnsino]),
    ...Object.entries(grupos).filter(([e]) => !ORDEM_ENSINO.includes(e)),
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Total Despesas"  value={fmtCompact(totalDespesas)}  color="#94a3b8" />
        <KPICard title="Total Liquidado" value={fmtCompact(totalLiquidado)} color={C_RECEITA} />
        <KPICard title="Total em Aberto" value={fmtCompact(totalAberto)}    color={C_CORAL} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-4">Top 10 Contas Gerenciais</h3>
          {top10Ger.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={top10Ger} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip content={<TTip />} />
                <Bar dataKey="value" name="Valor" fill={C_CORAL} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-4">Evolução de Despesas por Ano</h3>
          {dadosAno.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dadosAno}>
                <defs>
                  <linearGradient id="coralGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C_CORAL} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C_CORAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="ano" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtCompact(v as number)} tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<TTip />} />
                <Area type="monotone" dataKey="valor" name="Despesas" stroke={C_CORAL} fill="url(#coralGrad)" strokeWidth={2} dot={{ fill: C_CORAL, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-text-main text-sm font-semibold">Despesas por Projeto</div>
        {gruposOrdenados.length > 0 ? gruposOrdenados.map(([ensino, { total: ensinoTotal, instituicoes }]) => {
          const cores = NIVEL_CORES[ensino] ?? NIVEL_CORES['Outros']
          const instSort = Object.entries(instituicoes).sort((a, b) => b[1].total - a[1].total)

          const ensinoHeader = (
            <button
              onClick={() => setExpandidosEnsino(p => ({ ...p, [ensino]: !p[ensino] }))}
              className="w-full flex items-center gap-2 px-5 py-3 text-left text-sm font-bold border-b border-white/10 hover:opacity-80 transition-opacity"
              style={{ background: `${cores.forte}26`, borderLeft: `3px solid ${cores.forte}`, color: cores.claro }}
            >
              {expandidosEnsino[ensino] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="flex-1 uppercase tracking-wider">{ensino}</span>
              <span>{fmtCompact(ensinoTotal)}</span>
            </button>
          )

          if (ensino === 'Outros') {
            const projMap: Record<string, ProjData> = {}
            for (const { projetos } of Object.values(instituicoes)) {
              for (const [proj, data] of Object.entries(projetos)) {
                projMap[proj] ??= { total: 0, contas: {} }
                projMap[proj].total += data.total
                for (const [conta, cData] of Object.entries(data.contas)) {
                  projMap[proj].contas[conta] ??= { total: 0, fornecedores: {} }
                  projMap[proj].contas[conta].total += cData.total
                  for (const [forn, fVal] of Object.entries(cData.fornecedores)) {
                    projMap[proj].contas[conta].fornecedores[forn] = (projMap[proj].contas[conta].fornecedores[forn] ?? 0) + fVal
                  }
                }
              }
            }
            const projSort = Object.entries(projMap).sort((a, b) => b[1].total - a[1].total)
            return (
              <div key={ensino}>
                {ensinoHeader}
                {expandidosEnsino[ensino] && projSort.map(([proj, { total: projTotal, contas }]) => (
                  <div key={proj}>
                    <button
                      onClick={() => setExpandidos(p => ({ ...p, [proj]: !p[proj] }))}
                      className="w-full flex items-center gap-2 px-5 py-2.5 pl-10 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/15"
                    >
                      {expandidos[proj] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      <span className="flex-1 truncate">{proj}</span>
                      <span className="font-medium text-text-main">{fmtCompact(projTotal)}</span>
                    </button>
                    {expandidos[proj] && Object.entries(contas).sort((a, b) => b[1].total - a[1].total).map(([conta, { total: cTotal, fornecedores }]) => {
                      const ck = `${proj}::${conta}`
                      return (
                        <div key={conta}>
                          <button
                            onClick={() => setExpandidosContas(p => ({ ...p, [ck]: !p[ck] }))}
                            className="w-full flex items-center gap-2 px-5 py-2 pl-14 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/20"
                          >
                            {expandidosContas[ck] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            <span className="flex-1 truncate">{conta}</span>
                            <span>{fmtCompact(cTotal)}</span>
                          </button>
                          {expandidosContas[ck] && Object.entries(fornecedores).sort((a, b) => b[1] - a[1]).map(([forn, fVal]) => (
                            <div key={forn} className="flex justify-between px-5 py-1.5 pl-20 text-xs text-text-muted border-b border-white/5 bg-black/30">
                              <span className="truncate flex-1 pr-3">{forn}</span>
                              <span className="shrink-0">{fmtCompact(fVal)}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          }

          return (
            <div key={ensino}>
              {ensinoHeader}
              {expandidosEnsino[ensino] && instSort.map(([inst, { total: instTotal, projetos }]) => {
                const ik = `${ensino}::${inst}`
                const projSort = Object.entries(projetos).sort((a, b) => b[1].total - a[1].total)
                return (
                  <div key={inst}>
                    <button
                      onClick={() => setExpandidosInst(p => ({ ...p, [ik]: !p[ik] }))}
                      className="w-full flex items-center gap-2 px-5 py-2.5 pl-10 text-left text-xs font-semibold border-b border-white/5 hover:opacity-80 transition-opacity"
                      style={{ background: `${cores.claro}12`, borderLeft: `2px solid ${cores.claro}`, color: cores.claro }}
                    >
                      {expandidosInst[ik] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      <span className="flex-1 uppercase tracking-wide">{inst}</span>
                      <span>{fmtCompact(instTotal)}</span>
                    </button>
                    {expandidosInst[ik] && projSort.map(([proj, { total: projTotal, contas }]) => (
                      <div key={proj}>
                        <button
                          onClick={() => setExpandidos(p => ({ ...p, [proj]: !p[proj] }))}
                          className="w-full flex items-center gap-2 px-5 py-2.5 pl-16 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/15"
                        >
                          {expandidos[proj] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          <span className="flex-1 truncate">{proj}</span>
                          <span className="font-medium text-text-main">{fmtCompact(projTotal)}</span>
                        </button>
                        {expandidos[proj] && Object.entries(contas).sort((a, b) => b[1].total - a[1].total).map(([conta, { total: cTotal, fornecedores }]) => {
                          const ck = `${proj}::${conta}`
                          return (
                            <div key={conta}>
                              <button
                                onClick={() => setExpandidosContas(p => ({ ...p, [ck]: !p[ck] }))}
                                className="w-full flex items-center gap-2 px-5 py-2 pl-20 text-left text-xs text-text-muted hover:bg-white/5 transition-colors border-b border-white/5 bg-black/20"
                              >
                                {expandidosContas[ck] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                <span className="flex-1 truncate">{conta}</span>
                                <span>{fmtCompact(cTotal)}</span>
                              </button>
                              {expandidosContas[ck] && Object.entries(fornecedores).sort((a, b) => b[1] - a[1]).map(([forn, fVal]) => (
                                <div key={forn} className="flex justify-between px-5 py-1.5 pl-24 text-xs text-text-muted border-b border-white/5 bg-black/30">
                                  <span className="truncate flex-1 pr-3">{forn}</span>
                                  <span className="shrink-0">{fmtCompact(fVal)}</span>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        }) : <div className="px-5 py-8 text-center text-text-muted text-sm">Nenhum dado disponível</div>}
      </div>
    </div>
  )
}

// ─── Aba 4: Dados (tabela bruta boletim) ─────────────────────────
const PAGE_SIZE = 100

function TabelaDados({ boletim: boletimRaw, filtroProj }: { boletim: BoletimRecord[]; filtroProj: string }) {
  const fp = filtroProj.toLowerCase().trim()
  const boletim = fp ? boletimRaw.filter(r => r.desc_centro_custo.toLowerCase().includes(fp)) : boletimRaw
  const [filtro, setFiltro] = useState('')
  const [pagina, setPagina] = useState(0)

  const filtradas = useMemo(() => {
    const f = filtro.toLowerCase().trim()
    if (!f) return boletim
    return boletim.filter(r =>
      r.desc_centro_custo.toLowerCase().includes(f) ||
      r.fantasia_cliente_fornecedor.toLowerCase().includes(f) ||
      r.desc_conta_gerencial.toLowerCase().includes(f)
    )
  }, [boletim, filtro])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginaAtual  = Math.min(pagina, totalPaginas - 1)
  const inicio       = paginaAtual * PAGE_SIZE
  const pagina_dados = filtradas.slice(inicio, inicio + PAGE_SIZE)

  function trocarFiltro(v: string) { setFiltro(v); setPagina(0) }

  const totalFiltrado = filtradas.reduce((s, r) => s + (r.v_lancamento ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={filtro}
            onChange={e => trocarFiltro(e.target.value)}
            placeholder="Filtrar por fantasia, c. custo ou gerencial…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="text-xs text-text-muted shrink-0">
          <span className="text-text-main font-semibold">{filtradas.length.toLocaleString('pt-BR')}</span> linhas
          {filtro && <span className="ml-1">(filtrado)</span>}
          {' · '}
          <span className="text-text-main font-semibold">{fmtCompact(totalFiltrado)}</span>
          {' · '}pág. {paginaAtual + 1}/{totalPaginas}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Tipo</th>
                <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Fantasia</th>
                <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">C. Custo</th>
                <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">C. Gerencial</th>
                <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Vencimento</th>
                <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Liquidação</th>
                <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Competência</th>
                <th className="text-right px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">V. Lançamento</th>
                <th className="text-left px-3 py-2.5 text-text-muted font-semibold whitespace-nowrap">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pagina_dados.map((r, i) => (
                <tr key={r.id ?? i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      r.tipo === 'RECEITA'    ? 'bg-emerald-500/15 text-emerald-400' :
                      r.tipo === 'DESPESA'    ? 'bg-red-500/15 text-red-400' :
                                               'bg-purple-500/15 text-purple-400'
                    }`}>{r.tipo}</span>
                  </td>
                  <td className="px-3 py-2 text-text-main max-w-[160px] truncate" title={r.fantasia_cliente_fornecedor}>{r.fantasia_cliente_fornecedor || '—'}</td>
                  <td className="px-3 py-2 text-text-main max-w-[180px] truncate" title={r.desc_centro_custo}>{r.desc_centro_custo || '—'}</td>
                  <td className="px-3 py-2 text-text-muted max-w-[160px] truncate" title={r.desc_conta_gerencial}>{r.desc_conta_gerencial || '—'}</td>
                  <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r.d_vencimento ?? '—'}</td>
                  <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r.d_liquidacao ?? '—'}</td>
                  <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r.d_competencia ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-text-main whitespace-nowrap">{r.v_lancamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.situacao === 'LIQUIDADO' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {r.situacao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPagina(p => Math.max(0, p - 1))}
            disabled={paginaAtual === 0}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-text-muted hover:text-text-main disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(7, totalPaginas) }, (_, i) => {
            const offset = Math.max(0, Math.min(paginaAtual - 3, totalPaginas - 7))
            const pg = i + offset
            return (
              <button
                key={pg}
                onClick={() => setPagina(pg)}
                className={`w-7 h-7 rounded-lg text-xs transition-colors ${
                  pg === paginaAtual
                    ? 'bg-primary text-white'
                    : 'bg-white/5 border border-white/10 text-text-muted hover:text-text-main'
                }`}
              >
                {pg + 1}
              </button>
            )
          })}
          <button
            onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
            disabled={paginaAtual >= totalPaginas - 1}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-text-muted hover:text-text-main disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Empty state genérico ─────────────────────────────────────────
function EmptyChart({ label = 'Sem dados' }: { label?: string }) {
  return <div className="flex items-center justify-center h-40 text-text-muted text-sm">{label}</div>
}

// ─── Página principal ─────────────────────────────────────────────
export function Financeiro() {
  const { boletim, cap, dimensaoProjetos, uploadMeta, carregando, uploadBoletim, uploadCAP } = useFinanceiro()
  const { isAdmin } = useAuth()
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('resultado')
  const [filtroProj, setFiltroProj] = useState('')
  const [processando, setProcessando] = useState({ BOLETIM: false, CAP: false })
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'sucesso' | 'erro' } | null>(null)
  const boletimRef = useRef<HTMLInputElement>(null)
  const capRef     = useRef<HTMLInputElement>(null)

  const semDados = boletim.length === 0

  async function handleBoletim(arquivo: File | undefined) {
    if (!arquivo) return
    if (!arquivo.name.toLowerCase().endsWith('.xlsx')) { setToast({ mensagem: 'Envie um arquivo .xlsx válido.', tipo: 'erro' }); return }
    setProcessando(p => ({ ...p, BOLETIM: true }))
    try {
      const { totalLinhas } = await uploadBoletim(arquivo)
      setToast({ mensagem: `Boletim atualizado — ${totalLinhas.toLocaleString('pt-BR')} registros importados.`, tipo: 'sucesso' })
    } catch (err: unknown) {
      const e = err as { message?: string; tipo?: string }
      setToast({ mensagem: e.tipo === 'ABA_NAO_ENCONTRADA' ? (e.message ?? 'Erro') : `Erro ao processar Boletim: ${e.message}`, tipo: 'erro' })
    } finally {
      setProcessando(p => ({ ...p, BOLETIM: false }))
      if (boletimRef.current) boletimRef.current.value = ''
    }
  }

  async function handleCAP(arquivo: File | undefined) {
    if (!arquivo) return
    if (!arquivo.name.toLowerCase().endsWith('.xlsx')) { setToast({ mensagem: 'Envie um arquivo .xlsx válido.', tipo: 'erro' }); return }
    setProcessando(p => ({ ...p, CAP: true }))
    try {
      const { totalLinhas } = await uploadCAP(arquivo)
      setToast({ mensagem: `CAP atualizado — ${totalLinhas.toLocaleString('pt-BR')} títulos ATIVO importados.`, tipo: 'sucesso' })
    } catch (err: unknown) {
      const e = err as { message?: string; tipo?: string }
      setToast({ mensagem: e.tipo === 'ABA_NAO_ENCONTRADA' ? (e.message ?? 'Erro') : `Erro ao processar CAP: ${e.message}`, tipo: 'erro' })
    } finally {
      setProcessando(p => ({ ...p, CAP: false }))
      if (capRef.current) capRef.current.value = ''
    }
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-text-main text-xl font-bold">Financeiro</h1>
          <p className="text-text-muted text-xs mt-0.5">Boletim Financeiro Consolidado</p>
        </div>

        {isAdmin && (
          <div className="flex gap-3 flex-wrap items-start">
            {/* Boletim */}
            <div className="flex flex-col items-end gap-1">
              <input ref={boletimRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => handleBoletim(e.target.files?.[0])} />
              <button
                onClick={() => boletimRef.current?.click()}
                disabled={processando.BOLETIM}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
              >
                {processando.BOLETIM ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                Atualizar Boletim
              </button>
              {uploadMeta.BOLETIM && (
                <span className="text-xs text-text-muted">
                  {tempoDesde(uploadMeta.BOLETIM.uploaded_at)} · {(uploadMeta.BOLETIM.total_linhas ?? 0).toLocaleString('pt-BR')} linhas
                </span>
              )}
            </div>
            {/* CAP */}
            <div className="flex flex-col items-end gap-1">
              <input ref={capRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => handleCAP(e.target.files?.[0])} />
              <button
                onClick={() => capRef.current?.click()}
                disabled={processando.CAP}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-white/5 border border-white/10 text-text-muted hover:text-text-main hover:bg-white/10"
              >
                {processando.CAP ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                Atualizar CAP
              </button>
              {uploadMeta.CAP && (
                <span className="text-xs text-text-muted">
                  {tempoDesde(uploadMeta.CAP.uploaded_at)} · {(uploadMeta.CAP.total_linhas ?? 0).toLocaleString('pt-BR')} linhas
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sub-abas + filtro de projeto */}
      <div className="flex items-end justify-between border-b border-white/10 mb-5 gap-4 flex-wrap">
        <div className="flex gap-1">
          {ABAS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setAbaAtiva(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                abaAtiva === id
                  ? 'text-primary border-primary'
                  : 'text-text-muted border-transparent hover:text-text-main'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="relative mb-1 shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={filtroProj}
            onChange={e => setFiltroProj(e.target.value)}
            placeholder="Filtrar por projeto…"
            className="w-56 bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Conteúdo */}
      {carregando ? (
        <div className="flex items-center justify-center h-64 gap-3 text-text-muted">
          <Loader size={20} className="animate-spin" />
          <span className="text-sm">Carregando dados financeiros...</span>
        </div>
      ) : semDados ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="rounded-inner p-3 bg-white/5">
            <Upload size={24} className="text-text-muted" />
          </div>
          <p className="text-text-muted font-medium">Nenhum dado financeiro carregado</p>
          <p className="text-text-muted text-xs max-w-sm leading-relaxed">
            Use o botão <strong className="text-primary">Atualizar Boletim</strong> para importar o Boletim Financeiro Consolidado.
          </p>
        </div>
      ) : (
        <>
          {abaAtiva === 'resultado' && <ResultadoProjetos boletim={boletim} cap={cap} dimensaoProjetos={dimensaoProjetos} filtroProj={filtroProj} />}
          {abaAtiva === 'fluxo'    && <FluxoCaixa cap={cap} filtroProj={filtroProj} />}
          {abaAtiva === 'despesas' && <ControleDespesas boletim={boletim} dimensaoProjetos={dimensaoProjetos} filtroProj={filtroProj} />}
          {abaAtiva === 'dados'    && <TabelaDados boletim={boletim} filtroProj={filtroProj} />}
        </>
      )}

      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onFechar={() => setToast(null)} />}
    </div>
  )
}
