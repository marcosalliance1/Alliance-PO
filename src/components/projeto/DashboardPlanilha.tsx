import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Projeto } from '../../types'
import { calcResumoProjeto, filtrarItensCalculo } from '../../utils/calculos'
import { padronizarCaixa } from '../../utils/caixa'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'

// Dashboard do projeto no estilo da planilha, em azul (dashboard pede cor mais calma que o vermelho das
// tabelas): blocos com barra de título azul, bastante espaço, números menores, tudo à esquerda.
// Mesmos cálculos do dashboard atual (ProjectDashboard). Gráfico de custo por seção com escala de cor
// (maior = azul mais escuro) e drill-down: clicar numa seção abre as áreas dela, com tooltip dos itens.

const AZUL = '#4a72b0' // azul mais suave (o #1e56c0 era forte demais)
const COR = { orcado: '#f0a500', contratado: '#137333', pago: '#4a72b0', receita: '#16a34a' }
const CLARO: [number, number, number] = [214, 228, 247]
const ESCURO: [number, number, number] = [74, 114, 176]

// cores suaves distintas por seção (composição dos custos)
const PALETA = ['#6f9bd8', '#7fbf9a', '#e6b25f', '#c98fb8', '#6fc0c0', '#a99be0', '#e39a8a', '#9aa7b8', '#c9b46a']

/** Escala azul: menor valor = claro, maior = escuro. */
function corEscala(v: number, min: number, max: number): string {
  const t = max > min ? (v - min) / (max - min) : 1
  const c = CLARO.map((a, i) => Math.round(a + (ESCURO[i] - a) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

const brl = (n: number) => {
  if (!n || Math.abs(n) < 0.005) return '—'
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `R$ (${s})` : `R$ ${s}`
}
const pct1 = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const mil = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))

function Bloco({ titulo, children, direita }: { titulo: string; children: ReactNode; direita?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-md border border-[#e2e6ec] bg-white">
      <header className="flex items-center justify-between gap-3 px-3 py-2 text-[#ffffff]" style={{ background: AZUL }}>
        <h3 className="text-[11px] font-bold uppercase tracking-wide">{titulo}</h3>
        {direita}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Kpi({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  return (
    <div className="rounded-md border border-[#e2e6ec] bg-white px-3 py-2.5" style={{ borderLeft: `4px solid ${cor}` }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64707f]">{rotulo}</div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums text-[#1e2430]">{valor}</div>
    </div>
  )
}

const TH = 'px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-[#ffffff] whitespace-nowrap'
const THS: React.CSSProperties = { background: AZUL }
const TD = 'px-3 py-1.5 text-left text-[11px] tabular-nums whitespace-nowrap'

interface ItemTip { nome: string; proj: number; orc: number; contr: number; pago: number; falta: number }
interface LinhaSecao { nome: string; secaoId: string; titulo: string; valor: number }
interface LinhaArea { nome: string; valor: number; orc: number; contr: number; pago: number; itens: ItemTip[] }

// Tooltip das barras de área: lista os itens do bloco (maiores primeiro)
function TooltipArea({ active, payload }: { active?: boolean; payload?: { payload?: LinhaArea }[] }) {
  const a = active ? payload?.[0]?.payload : undefined
  if (!a) return null
  const itens = [...a.itens].sort((x, y) => y.proj - x.proj)
  const mostrar = itens.slice(0, 12)
  return (
    <div className="max-w-[360px] rounded-md border border-[#cfd5df] bg-white p-3 shadow-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="text-[12px] font-bold text-[#1e2430]">{a.nome}</div>
      <div className="mb-2 text-[11px] tabular-nums text-[#64707f]">
        vendido {brl(a.valor)} · orçado {brl(a.orc)} · contratado {brl(a.contr)}
      </div>
      <div className="space-y-0.5">
        {mostrar.map((i, n) => (
          <div key={n} className="flex items-baseline justify-between gap-4 text-[11px]">
            <span className="truncate text-[#1e2430]">{i.nome || '(sem nome)'}</span>
            <span className="shrink-0 tabular-nums text-[#1e2430]">{brl(i.proj)}</span>
          </div>
        ))}
        {itens.length > mostrar.length && <div className="pt-1 text-[10px] text-[#64707f]">+ {itens.length - mostrar.length} itens</div>}
      </div>
      <div className="mt-2 text-[10px] text-[#64707f]">clique na barra para listar os itens</div>
    </div>
  )
}

export function DashboardPlanilha({ projeto }: { projeto: Projeto }) {
  const [aberto, setAberto] = useState<string | null>(null)
  const [drill, setDrill] = useState<string | null>(null)
  const [areaAberta, setAreaAberta] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const resumo = useMemo(() => calcResumoProjeto(projeto), [projeto])

  const receita = resumo.receitaBaile
  const ct = resumo.custoTotal
  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)

  const margens = [
    { rotulo: 'Projetada', valor: receita.vendido - ct.projetado, p: pct(receita.vendido - ct.projetado, receita.vendido) },
    { rotulo: 'Orçada', valor: receita.orcado - ct.orcado, p: pct(receita.orcado - ct.orcado, receita.orcado) },
    { rotulo: 'Contratada', valor: receita.contratado - ct.contratado, p: pct(receita.contratado - ct.contratado, receita.contratado) },
    { rotulo: 'Real (Everest)', valor: receita.pago - ct.pago, p: pct(receita.pago - ct.pago, receita.pago) },
  ]

  const dados1: LinhaSecao[] = resumo.custos.map(c => ({ nome: c.nome.split(' ')[0], secaoId: c.secaoId, titulo: padronizarCaixa(c.nome), valor: Math.round(c.projetado) }))
  const min1 = Math.min(...dados1.map(d => d.valor), 0)
  const max1 = Math.max(...dados1.map(d => d.valor), 1)
  const dados2 = resumo.custos.map(c => ({ nome: c.nome.split(' ')[0], secaoId: c.secaoId, Orçado: Math.round(c.orcado), Contratado: Math.round(c.contratado), Pago: Math.round(c.pago) }))

  // drill-down: áreas da seção escolhida, com os itens de cada uma
  const secaoDrill = drill ? projeto.secoes.find(s => s.id === drill) : undefined
  const areas: LinhaArea[] = useMemo(() => {
    if (!secaoDrill) return []
    const m = new Map<string, LinhaArea>()
    for (const i of filtrarItensCalculo(secaoDrill.itens)) {
      const k = padronizarCaixa((i.area || '').trim() || '(sem área)')
      const a = m.get(k) ?? { nome: k, valor: 0, orc: 0, contr: 0, pago: 0, itens: [] }
      a.valor += i.totalProjetado ?? 0
      a.orc += i.valorOrcado ?? 0
      a.contr += i.valorContratado ?? 0
      a.pago += i.valorPago ?? 0
      a.itens.push({
        nome: padronizarCaixa(i.item || i.subcategoria || ''),
        proj: i.totalProjetado ?? 0, orc: i.valorOrcado ?? 0, contr: i.valorContratado ?? 0, pago: i.valorPago ?? 0, falta: i.faltaPagar ?? 0,
      })
      m.set(k, a)
    }
    return [...m.values()].filter(a => a.valor || a.orc || a.contr || a.pago).sort((a, b) => b.valor - a.valor)
  }, [secaoDrill])
  const minA = Math.min(...areas.map(a => a.valor), 0)
  const maxA = Math.max(...areas.map(a => a.valor), 1)
  const areaSel = areas.find(a => a.nome === areaAberta)

  const composicao = resumo.custos.filter(c => c.contratado > 0).sort((a, b) => b.contratado - a.contratado)
  const contratadoTotal = ct.contratado
  const progresso = contratadoTotal > 0 ? Math.min((ct.pago / contratadoTotal) * 100, 100) : 0
  const dentro = ct.orcado === 0 || ct.contratado <= ct.orcado
  const desvio = ct.orcado > 0 ? (ct.contratado / ct.orcado - 1) * 100 : null

  const secaoAdmin = projeto.secoes.find(s => `${s.numero} ${s.nome}`.toLowerCase().includes('administrativ'))
  const feePago = (secaoAdmin?.itens ?? []).filter(i => i.subcategoria.trim().toLowerCase() === 'despesa fee').reduce((s, i) => s + i.valorPago, 0)

  const achados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return []
    const out: { id: string; nome: string; secao: string; valor: number }[] = []
    for (const s of projeto.secoes) for (const i of s.itens) {
      const nome = i.item || i.subcategoria
      if (nome && nome.toLowerCase().includes(q)) out.push({ id: i.id, nome, secao: `${s.numero} ${s.nome}`, valor: i.valorContratado })
    }
    return out.sort((a, b) => b.valor - a.valor).slice(0, 40)
  }, [busca, projeto.secoes])

  const receitas = resumo.receitas.filter(r => r.vendido || r.orcado || r.contratado || r.pago)
  const axis = { fill: '#64707f', fontSize: 11 }
  const tip = { backgroundColor: '#fff', border: '1px solid #e2e6ec', borderRadius: 6, color: '#1e2430', fontSize: 12 }

  const abrirSecao = (id: string) => { setDrill(id === drill ? null : id); setAreaAberta(null) }

  return (
    <div className="dash-azul space-y-8" style={{ fontFamily: "'Montserrat', ui-sans-serif, system-ui, sans-serif", color: '#1e2430' }}>
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi rotulo="Receita vendida (proj.)" valor={brl(receita.vendido)} cor={AZUL} />
        <Kpi rotulo="Custo orçado" valor={brl(ct.orcado)} cor={COR.orcado} />
        <Kpi rotulo="Custo contratado" valor={brl(ct.contratado)} cor={COR.contratado} />
        <Kpi rotulo="Pago (Everest)" valor={brl(ct.pago)} cor="#0d9488" />
        <Kpi rotulo="Falta pagar" valor={brl(ct.faltaPagar)} cor="#c0392b" />
      </div>

      {/* Margens */}
      <Bloco titulo="Margem de contribuição">
        {/* celular: 4 cartões em vez de tabela larga */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          {margens.map(m => (
            <div key={m.rotulo} className="rounded-md border border-[#e2e6ec] bg-[#fafbfc] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64707f]">{m.rotulo}</div>
              <div className="text-[16px] font-bold tabular-nums" style={{ color: m.p >= 0 ? '#137333' : '#c0392b' }}>{pct1(m.p)}</div>
              <div className="text-[11px] tabular-nums text-[#1e2430]">{brl(m.valor)}</div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr><th className={TH} style={{ ...THS, textAlign: 'left' }}> </th>{margens.map(m => <th key={m.rotulo} className={TH} style={THS}>{m.rotulo}</th>)}</tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#e2e6ec]">
                <td className={`${TD} bg-[#f5f7fa] font-medium text-[12.5px]`}>Margem %</td>
                {margens.map(m => (
                  <td key={m.rotulo} className={`${TD} text-[15px] font-bold`} style={{ color: m.p >= 0 ? '#137333' : '#c0392b' }}>{pct1(m.p)}</td>
                ))}
              </tr>
              <tr className="border-t border-[#e2e6ec] bg-[#fafbfc]">
                <td className={`${TD} bg-[#f5f7fa] font-medium text-[12.5px]`}>Margem R$</td>
                {margens.map(m => <td key={m.rotulo} className={TD}>{brl(m.valor)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        {feePago > 0 && (
          <p className="mt-3 text-[11px] text-[#64707f]">
            Despesa fee já paga: <b className="tabular-nums text-[#1e2430]">{brl(feePago)}</b> ({pct1(pct(feePago, ct.pago))} do total pago)
          </p>
        )}
      </Bloco>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Bloco titulo="Custo vendido (proj.) por seção" direita={<span className="text-[10px] font-medium opacity-90">clique numa barra para detalhar</span>}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dados1} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="nome" tick={axis} />
              <YAxis tick={axis} tickFormatter={mil} width={46} />
              <Tooltip
                contentStyle={tip}
                cursor={{ fill: 'rgba(74,114,176,0.07)' }}
                formatter={(v: unknown) => [brl(Number(v ?? 0)), 'Custo vendido']}
                labelFormatter={(_l: unknown, p: readonly { payload?: LinhaSecao }[]) => p?.[0]?.payload?.titulo ?? ''}
              />
              {receita.vendido > 0 && (
                <ReferenceLine y={receita.vendido} stroke={COR.receita} strokeDasharray="6 3" label={{ value: 'Receita', position: 'insideTopRight', fill: COR.receita, fontSize: 10 }} />
              )}
              <Bar dataKey="valor" name="Custo vendido (proj.)" radius={[3, 3, 0, 0]} style={{ cursor: 'pointer' }}>
                {dados1.map(d => (
                  <Cell
                    key={d.secaoId}
                    fill={corEscala(d.valor, min1, max1)}
                    stroke={drill === d.secaoId ? '#2c4a7c' : 'none'}
                    strokeWidth={2}
                    onClick={() => abrirSecao(d.secaoId)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Bloco>

        <Bloco titulo="Orçado × contratado × pago por seção" direita={<span className="text-[10px] font-medium opacity-90">clique numa barra para detalhar</span>}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dados2} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="nome" tick={axis} />
              <YAxis tick={axis} tickFormatter={mil} width={46} />
              <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(74,114,176,0.07)' }} formatter={(v: unknown, n: unknown) => [brl(Number(v ?? 0)), String(n ?? '')]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {(['Orçado', 'Contratado', 'Pago'] as const).map(k => (
                <Bar key={k} dataKey={k} fill={k === 'Orçado' ? COR.orcado : k === 'Contratado' ? COR.contratado : COR.pago} radius={[3, 3, 0, 0]} style={{ cursor: 'pointer' }}>
                  {dados2.map(d => <Cell key={d.secaoId} onClick={() => abrirSecao(d.secaoId)} />)}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Bloco>
      </div>

      {/* Drill-down da seção clicada: áreas (blocos) com tooltip dos itens */}
      {secaoDrill && (
        <Bloco
          titulo={`${padronizarCaixa(`${secaoDrill.numero} ${secaoDrill.nome}`)} — blocos da seção`}
          direita={<button onClick={() => abrirSecao(secaoDrill.id)} className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold hover:bg-white/25">fechar ✕</button>}
        >
          {areas.length === 0 ? (
            <p className="py-3 text-[12px] text-[#64707f]">Sem valores lançados nesta seção.</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-[#64707f]">
                Passe o mouse numa barra para ver os itens do bloco; clique para listar abaixo. Valor = custo vendido (proj.).
              </p>
              <ResponsiveContainer width="100%" height={Math.max(180, areas.length * 36 + 40)}>
                <BarChart data={areas} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" horizontal={false} />
                  <XAxis type="number" tick={axis} tickFormatter={mil} />
                  <YAxis type="category" dataKey="nome" tick={{ ...axis, fill: '#1e2430' }} width={170} />
                  <Tooltip content={<TooltipArea />} cursor={{ fill: 'rgba(74,114,176,0.07)' }} />
                  <Bar dataKey="valor" radius={[0, 3, 3, 0]} style={{ cursor: 'pointer' }}
                    label={{ position: 'right', fontSize: 10, fill: '#64707f', formatter: (v: unknown) => mil(Number(v ?? 0)) }}>
                    {areas.map(a => (
                      <Cell
                        key={a.nome}
                        fill={corEscala(a.valor, minA, maxA)}
                        stroke={areaAberta === a.nome ? '#2c4a7c' : 'none'}
                        strokeWidth={2}
                        onClick={() => setAreaAberta(areaAberta === a.nome ? null : a.nome)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {areaSel && (
                <div className="mt-4 overflow-x-auto rounded border border-[#e2e6ec]">
                  <table className="w-full border-collapse">
                    <thead><tr>
                      <th className={TH} style={{ ...THS, textAlign: 'left' }}>{areaSel.nome}</th>
                      <th className={TH} style={THS}>Vendido (proj.)</th><th className={TH} style={THS}>Orçado</th>
                      <th className={TH} style={THS}>Contratado</th><th className={TH} style={THS}>Pago</th><th className={TH} style={THS}>Falta</th>
                    </tr></thead>
                    <tbody>
                      {[...areaSel.itens].sort((x, y) => y.proj - x.proj).map((i, n) => (
                        <tr key={n} className={`border-t border-[#e2e6ec] ${n % 2 ? 'bg-[#fafbfc]' : ''}`}>
                          <td className={`${TD} bg-[#f5f7fa] text-[12.5px] font-medium`}>{i.nome || '(sem nome)'}</td>
                          <td className={TD}>{brl(i.proj)}</td><td className={TD}>{brl(i.orc)}</td><td className={TD}>{brl(i.contr)}</td>
                          <td className={TD}>{brl(i.pago)}</td>
                          <td className={TD} style={{ color: i.falta > 0 ? '#c0392b' : undefined }}>{brl(i.falta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Bloco>
      )}

      {/* Composição (clique para ver os itens) */}
      {composicao.length > 0 && (
        <Bloco titulo="Composição dos custos contratados" direita={<span className="text-[10px] font-medium opacity-90">clique numa seção para ver os itens</span>}>
          <div className="space-y-1">
            {composicao.map((c, ci) => {
              const p = pct(c.contratado, contratadoTotal)
              const sec = projeto.secoes.find(s => s.id === c.secaoId)
              const itens = (sec?.itens ?? []).filter(i => i.valorContratado > 0).sort((a, b) => b.valorContratado - a.valorContratado)
              const isOpen = aberto === c.secaoId
              return (
                <div key={c.secaoId}>
                  <button
                    onClick={() => setAberto(isOpen ? null : c.secaoId)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-1.5 text-left hover:bg-[#f5f7fa]"
                  >
                    <span className="w-full truncate text-[12.5px] font-medium sm:w-56 sm:shrink-0">{padronizarCaixa(c.nome)}</span>
                    <span className="h-2.5 min-w-[100px] flex-1 overflow-hidden rounded-full bg-[#eceff3]">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(p, 100)}%`, background: PALETA[ci % PALETA.length] }} />
                    </span>
                    <span className="w-14 shrink-0 text-[11px] tabular-nums text-[#64707f]">{pct1(p)}</span>
                    <span className="w-32 shrink-0 text-[11px] font-semibold tabular-nums">{brl(c.contratado)}</span>
                  </button>
                  {isOpen && (
                    <div className="mb-2 ml-2 overflow-x-auto rounded border border-[#e2e6ec]">
                      <table className="w-full border-collapse">
                        <thead><tr>
                          <th className={TH} style={{ ...THS, textAlign: 'left' }}>Item</th><th className={TH} style={THS}>Contratado</th><th className={TH} style={THS}>Pago</th><th className={TH} style={THS}>Falta</th>
                        </tr></thead>
                        <tbody>
                          {itens.map((i, n) => (
                            <tr key={`${i.id}-${n}`} className={`border-t border-[#e2e6ec] ${n % 2 ? 'bg-[#fafbfc]' : ''}`}>
                              <td className={`${TD} text-[12.5px]`}>{padronizarCaixa(i.item || i.subcategoria || '—')}</td>
                              <td className={TD}>{brl(i.valorContratado)}</td>
                              <td className={TD}>{brl(i.valorPago)}</td>
                              <td className={TD} style={{ color: i.faltaPagar > 0 ? '#c0392b' : undefined }}>{brl(i.faltaPagar)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Bloco>
      )}

      {/* Orçado × realizado */}
      <Bloco titulo="Orçado × realizado">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <tbody>
              {([
                ['Custo orçado total', brl(ct.orcado), null],
                ['Custo contratado total', brl(ct.contratado), desvio],
                ['Pago (Everest)', brl(ct.pago), null],
                ['Falta pagar', brl(ct.faltaPagar), null],
              ] as [string, string, number | null][]).map(([r, v, d], n) => (
                <tr key={r} className={`border-t border-[#e2e6ec] ${n % 2 ? 'bg-[#fafbfc]' : ''}`}>
                  <td className={`${TD} bg-[#f5f7fa] text-[12.5px] font-medium`}>{r}</td>
                  <td className={`${TD} font-semibold`}>
                    {v}
                    {d !== null && (
                      <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: dentro ? '#e6f4ea' : '#fde8e8', color: dentro ? '#137333' : '#c0392b' }}>
                        {d >= 0 ? '+' : ''}{d.toFixed(1).replace('.', ',')}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="flex flex-col justify-center gap-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#64707f]">Progresso de pagamento</span>
              <span className="font-semibold">{progresso.toFixed(0)}% pago</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#eceff3]">
              <div className="h-full rounded-full" style={{ width: `${progresso}%`, background: dentro ? COR.contratado : '#c0392b' }} />
            </div>
            <span
              className="self-start rounded px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: dentro ? '#e6f4ea' : '#fde8e8', color: dentro ? '#137333' : '#c0392b' }}
            >
              {dentro ? '✓ Dentro do orçamento' : '⚠ Acima do orçamento'}
            </span>
          </div>
        </div>
      </Bloco>

      {/* Custo por convidado */}
      <Bloco
        titulo="Custo por convidado"
        direita={projeto.totalConvidadosAtual ? (
          <span className="text-[10px] font-medium opacity-90">
            {projeto.totalConvidadosAtual.toLocaleString('pt-BR')} convidados
            {projeto.totalAdesoesAtual ? ` · ${projeto.totalAdesoesAtual.toLocaleString('pt-BR')} adesões` : ''}
          </span>
        ) : undefined}
      >
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar item da P.O.…"
          className="mb-3 w-full rounded-md border border-[#cfd5df] px-3 py-2 text-[12.5px] focus:outline-none focus:border-[#4a72b0]"
        />
        {busca.trim() && achados.length === 0 && <p className="py-3 text-[12px] text-[#64707f]">Nenhum item encontrado.</p>}
        {achados.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {achados.map((a, an) => {
              const conv = projeto.totalConvidadosAtual ?? 0
              return (
                <div key={`${a.id}-${an}`} className="rounded-md border border-[#e2e6ec] bg-[#fafbfc] p-3">
                  <div className="text-[10px] text-[#64707f]">{padronizarCaixa(a.secao)}</div>
                  <div className="text-[12.5px] font-medium">{padronizarCaixa(a.nome)}</div>
                  <div className="mt-1 text-[13px] font-bold tabular-nums">{brl(a.valor)}</div>
                  {conv > 0 && <div className="text-[11px] tabular-nums text-[#4a72b0]">{brl(a.valor / conv)} / convidado</div>}
                </div>
              )
            })}
          </div>
        )}
      </Bloco>

      {/* Receitas */}
      <Bloco titulo="Receitas">
        {receitas.length === 0 ? (
          <p className="py-3 text-[12px] italic text-[#64707f]">Sem receitas lançadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>
                <th className={TH} style={{ ...THS, textAlign: 'left' }}>Descrição</th><th className={TH} style={THS}>Vendido</th><th className={TH} style={THS}>Orçado</th><th className={TH} style={THS}>Contratado</th><th className={TH} style={THS}>Pago</th>
              </tr></thead>
              <tbody>
                {receitas.map((r, n) => (
                  <tr key={r.descricao} className={`border-t border-[#e2e6ec] ${n % 2 ? 'bg-[#fafbfc]' : ''}`}>
                    <td className={`${TD} bg-[#f5f7fa] text-[12.5px] font-medium`}>{padronizarCaixa(r.descricao)}</td>
                    <td className={TD}>{brl(r.vendido)}</td><td className={TD}>{brl(r.orcado)}</td><td className={TD}>{brl(r.contratado)}</td><td className={TD}>{brl(r.pago)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[#cfd5df] bg-[#ebeff1] font-bold">
                  <td className={`${TD} text-[12.5px] uppercase text-[#ffffff]`} style={{ background: AZUL }}>Receita total</td>
                  <td className={TD}>{brl(receita.vendido)}</td><td className={TD}>{brl(receita.orcado)}</td><td className={TD}>{brl(receita.contratado)}</td><td className={TD}>{brl(receita.pago)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Bloco>
    </div>
  )
}
