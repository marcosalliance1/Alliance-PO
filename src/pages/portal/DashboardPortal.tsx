import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { CheckCircle2, AlertTriangle, LogOut, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePortalAuth } from '../../contexts/PortalAuthContext'
import { calcResumoProjeto, filtrarItensCalculo, projetoVisaoCliente } from '../../utils/calculos'
import allianceLogo from '../../assets/alliance-logo.png'
import type { Projeto, SecaoCusto, TAP, Receitas, CustoAdicional, ConciliacaoEverest } from '../../types'
import type { Orcamento, ItemOrcamento } from '../../modules/pre-eventos/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtData(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function rowToProjeto(row: Record<string, unknown>): Projeto {
  return {
    id: row.id as string,
    tap: row.tap as TAP,
    secoes: (row.secoes as SecaoCusto[]) ?? [],
    receitas: (row.receitas as Receitas) ?? {},
    custosAdicionais: (row.custos_adicionais as CustoAdicional[]) ?? [],
    conciliacaoEverest: (row.conciliacao_everest as ConciliacaoEverest) ?? undefined,
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    sheetsUrl: (row.sheets_url as string) ?? undefined,
    status: (row.status as string) === 'realizado' ? 'realizado' : 'em_andamento',
  }
}

interface CapVencimento {
  fantasia_cliente_fornecedor: string
  desc_conta_gerencial: string
  d_vencimento: string | null
  v_lancamento: number
}

// ─── Chart constants ──────────────────────────────────────────────────────────

const TOOLTIP_STYLE = { backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }
const AXIS_STYLE = { fill: '#8892a4', fontSize: 11 }

// ─── Seção 2: Financeiro ──────────────────────────────────────────────────────

function SecaoFinanceiro({ projeto, vencimentos: _v }: { projeto: Projeto; vencimentos: CapVencimento[] }) {
  const resumo = useMemo(() => calcResumoProjeto(projeto), [projeto])
  // Tudo na MESMA coluna por linha, pra Receita − Custo = Saldo fechar na tela.
  const receitaPrevista = resumo.receitaBaile.orcado
  const custoPrevisto   = resumo.custoTotal.orcado
  const saldoPrevisto   = resumo.margem.orcado   // = receitaPrevista − custoPrevisto
  const receitaRecebida = resumo.receitaBaile.pago
  const custoPago       = resumo.custoTotal.pago
  const saldoAtual      = resumo.margem.pago     // = receitaRecebida − custoPago
  const pctExecutado = custoPrevisto > 0 ? Math.min(100, (custoPago / custoPrevisto) * 100) : 0

  const chartData = resumo.custos
    .filter(c => c.orcado > 0 || c.pago > 0)
    .map(c => ({ nome: c.nome.split(' ')[0], 'Custo Previsto': Math.round(c.orcado), Pago: Math.round(c.pago) }))

  const linhaPlano = [
    { label: 'Receita Prevista', value: fmtBRL(receitaPrevista) },
    { label: 'Custo Previsto',   value: fmtBRL(custoPrevisto) },
    { label: 'Saldo Previsto',   value: fmtBRL(saldoPrevisto), color: saldoPrevisto >= 0 ? 'text-success' : 'text-danger' },
  ]
  const linhaReal = [
    { label: 'Receita Recebida', value: fmtBRL(receitaRecebida) },
    { label: 'Custo Pago',       value: fmtBRL(custoPago) },
    { label: 'Saldo Atual',      value: fmtBRL(saldoAtual), color: saldoAtual >= 0 ? 'text-success' : 'text-danger' },
  ]

  return (
    <div className="space-y-6">
      {/* Plano (Orçado) — Receita − Custo = Saldo, fecha na horizontal */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-4 bg-primary rounded-full" />
          <h3 className="text-text-main text-sm font-semibold">Plano <span className="text-text-muted font-normal">· orçado</span></h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {linhaPlano.map(({ label, value, color }) => (
            <div key={label} className="bg-bg rounded-xl px-4 py-4">
              <div className="text-text-muted text-xs mb-1">{label}</div>
              <div className={`text-lg font-semibold ${color ?? 'text-text-main'}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recebido (Everest) — Receita − Custo = Saldo, fecha na horizontal */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-4 bg-success rounded-full" />
          <h3 className="text-text-main text-sm font-semibold">Recebido <span className="text-text-muted font-normal">· Everest</span></h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {linhaReal.map(({ label, value, color }) => (
            <div key={label} className="bg-bg rounded-xl px-4 py-4">
              <div className="text-text-muted text-xs mb-1">{label}</div>
              <div className={`text-lg font-semibold ${color ?? 'text-text-main'}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico Custo Previsto × Pago por seção */}
      {chartData.length > 0 && (
        <div className="bg-bg rounded-xl p-4">
          <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-4">Custo Previsto × Pago por Seção</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="nome" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={52} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [fmtBRL(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8892a4' }} />
              <Bar dataKey="Custo Previsto" fill="#E63329" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Pago"           fill="#00b894" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Barra de progresso: quanto do custo previsto já foi pago */}
      <div className="bg-bg rounded-xl px-4 py-4">
        <div className="mb-2">
          <span className="text-text-muted text-xs">Custo pago do previsto</span>
        </div>
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pctExecutado}%`, background: '#00b894' }} />
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-1.5">
          <span>{fmtBRL(custoPago)} pago</span>
          <span>{pctExecutado.toFixed(1)}% de {fmtBRL(custoPrevisto)}</span>
        </div>
      </div>

    </div>
  )
}

// ─── Seção 3: P.O. Resumido ───────────────────────────────────────────────────

function SecaoPO({ projeto }: { projeto: Projeto }) {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  // `projeto` já chega como visão do cliente (sem "Despesa Fee", spec #1). resumo e
  // "Saldo em Conta" usam a mesma base — batem com a aba Financeiro.
  const resumo = useMemo(() => calcResumoProjeto(projeto), [projeto])
  const resumoCompleto = resumo

  const anyOpen = Object.values(expandidos).some(Boolean)

  const composicao = useMemo(() =>
    resumo.custos
      .filter(c => c.contratado > 0)
      .map(c => ({ name: c.nome.split(' ')[0], value: c.contratado, secaoId: c.secaoId }))
      .sort((a, b) => b.value - a.value),
    [resumo]
  )
  const maxComposicao = composicao.length ? composicao[0].value : 0

  const barData = resumo.custos
    .filter(c => c.contratado > 0 || c.pago > 0)
    .map(c => ({ nome: c.nome.split(' ')[0], Contratado: Math.round(c.contratado), Pago: Math.round(c.pago) }))

  function toggle(id: string) {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      {/* Donut + Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Composição do custo — lista rankeada, barras neutras (sem arco-íris de cores) */}
        {composicao.length > 0 && (
          <div className="bg-bg rounded-xl p-4">
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Composição do Custo</h3>
            <div className="space-y-2.5">
              {composicao.map(entry => {
                const w = maxComposicao > 0 ? (entry.value / maxComposicao) * 100 : 0
                return (
                  <button
                    key={entry.secaoId}
                    onClick={() => toggle(entry.secaoId)}
                    className={`w-full text-left transition-opacity ${anyOpen && !expandidos[entry.secaoId] ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-muted truncate">{entry.name}</span>
                      <span className="text-xs text-text-main font-medium shrink-0 ml-2">{fmtBRL(entry.value)}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/30 rounded-full" style={{ width: `${w}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Bar chart */}
        {barData.length > 0 && (
          <div className="bg-bg rounded-xl p-4">
            <h3 className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">Contratado × Pago</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="nome" tick={AXIS_STYLE} />
                <YAxis tick={AXIS_STYLE} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={48} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [fmtBRL(Number(v)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8892a4' }} />
                <Bar dataKey="Contratado" fill="#E63329" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Pago"       fill="#00b894" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Saldo em Conta — resumo + drill-down das linhas de receita */}
      {(() => {
        const receitaPaga = resumoCompleto.receitaBaile.pago
        const custoPago = resumoCompleto.custoTotal.pago
        const saldoConta = resumoCompleto.margem.pago
        const pctConsumido = receitaPaga > 0 ? Math.min(100, (custoPago / receitaPaga) * 100) : 0
        const isOpen = expandidos['__saldo_conta__'] ?? false
        const linhasReceita = resumoCompleto.receitas.filter(r => r.orcado > 0 || r.pago > 0)

        return (
          <div className={`rounded-xl overflow-hidden transition-all mb-2 ${isOpen ? 'bg-surface ring-1 ring-white/10' : 'bg-bg'}`}>
            <button
              onClick={() => toggle('__saldo_conta__')}
              className="w-full px-4 py-3 text-left hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-text-muted shrink-0">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                <span className="flex-1 text-sm font-medium text-text-main">Saldo em Conta</span>
                <span className={`text-xs font-semibold ${saldoConta >= 0 ? 'text-success' : 'text-danger'}`}>{fmtBRL(saldoConta)}</span>
                <span className="text-xs text-text-muted">/ Receita Recebida {fmtBRL(receitaPaga)}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pctConsumido}%`, background: saldoConta >= 0 ? '#00b894' : '#e17055' }}
                />
              </div>
              <div className="text-right text-xs text-text-muted mt-1">{pctConsumido.toFixed(0)}% da receita recebida já utilizada</div>
            </button>

            {isOpen && (
              <div className="border-t border-white/8 px-4 pb-4 pt-3 space-y-2">
                {linhasReceita.length === 0 ? (
                  <p className="text-text-muted text-xs text-center py-2">Nenhuma linha de receita lançada.</p>
                ) : linhasReceita.map(r => {
                  const p = r.orcado > 0 ? Math.min(100, (r.pago / r.orcado) * 100) : 0
                  return (
                    <div key={r.descricao} className="space-y-1">
                      <div className="flex items-center gap-3">
                        {r.pago > 0
                          ? <CheckCircle2 size={13} className="text-success shrink-0" />
                          : <AlertTriangle size={13} className="text-warning/60 shrink-0" />
                        }
                        <span className="text-sm text-text-main flex-1">{r.descricao}</span>
                        <span className="text-xs text-success">{fmtBRL(r.pago)}</span>
                        <span className="text-xs text-text-muted">/ {fmtBRL(r.orcado)}</span>
                      </div>
                      {r.orcado > 0 && (
                        <div className="ml-[25px] h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-success/60 rounded-full" style={{ width: `${p}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Lista de seções com drill-down inline */}
      <div className="space-y-2">
        {resumo.custos.map(c => {
          const pct = c.contratado > 0 ? Math.min(100, (c.pago / c.contratado) * 100) : 0
          const isOpen = expandidos[c.secaoId] ?? false
          const secao = projeto.secoes.find(s => s.id === c.secaoId)

          return (
            <div key={c.secaoId} className={`rounded-xl overflow-hidden transition-all ${isOpen ? 'bg-surface ring-1 ring-white/10' : 'bg-bg'}`}>
              {/* Cabeçalho clicável */}
              <button
                onClick={() => toggle(c.secaoId)}
                className="w-full px-4 py-3 text-left hover:bg-white/3 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-text-muted shrink-0">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                  <span className="flex-1 text-sm font-medium text-text-main">{c.nome}</span>
                  <span className="text-xs text-success">{fmtBRL(c.pago)}</span>
                  <span className="text-xs text-text-muted">/ {fmtBRL(c.contratado)}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct >= 80 ? '#00b894' : pct >= 40 ? '#E63329' : '#f59e0b' }}
                  />
                </div>
                <div className="text-right text-xs text-text-muted mt-1">{pct.toFixed(0)}% pago</div>
              </button>

              {/* Drill-down inline */}
              {isOpen && secao && (() => {
                // Regra #2 da spec: só itens com dado real (esconde linhas de template R$0).
                const itensFiltrados = filtrarItensCalculo(secao.itens)
                  .filter(i => i.valorContratado > 0 || i.valorPago > 0 || i.valorOrcado > 0)
                const porSubcat: Record<string, { contratado: number; pago: number; itens: typeof itensFiltrados }> = {}
                for (const item of itensFiltrados) {
                  const sub = item.subcategoria?.trim() || item.area?.trim() || 'Geral'
                  if (!porSubcat[sub]) porSubcat[sub] = { contratado: 0, pago: 0, itens: [] }
                  porSubcat[sub].contratado += item.valorContratado
                  porSubcat[sub].pago += item.valorPago
                  porSubcat[sub].itens.push(item)
                }
                return (
                  <div className="border-t border-white/8 px-4 pb-4 pt-3">
                    {Object.entries(porSubcat).map(([sub, vals]) => {
                      const p = vals.contratado > 0 ? Math.min(100, (vals.pago / vals.contratado) * 100) : 0
                      return (
                        <div key={sub} className="space-y-1 border-t border-white/8 pt-3 mt-3 first:border-t-0 first:pt-0 first:mt-0">
                          <div className="flex items-center gap-3">
                            {vals.contratado > 0
                              ? <CheckCircle2 size={13} className="text-success shrink-0" />
                              : <AlertTriangle size={13} className="text-warning/60 shrink-0" />
                            }
                            <span className="text-sm text-text-main flex-1">{sub}</span>
                            <span className="text-xs text-success">{fmtBRL(vals.pago)}</span>
                            <span className="text-xs text-text-muted">/ {fmtBRL(vals.contratado)}</span>
                          </div>
                          {vals.contratado > 0 && (
                            <div className="ml-[25px] h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-success/60 rounded-full" style={{ width: `${p}%` }} />
                            </div>
                          )}

                          {/* Itens da subcategoria — qual item custou o quê */}
                          {vals.itens.length > 0 && (
                            <div className="ml-[25px] mt-1.5 space-y-1.5 border-l border-white/8 pl-3">
                              {vals.itens.map(item => {
                                const pi = item.valorContratado > 0 ? Math.min(100, (item.valorPago / item.valorContratado) * 100) : 0
                                return (
                                  <div key={item.id} className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-text-muted flex-1 truncate">{item.item || sub}</span>
                                      <span className="text-[11px] text-success shrink-0">{fmtBRL(item.valorPago)}</span>
                                      <span className="text-[11px] text-text-muted shrink-0">/ {fmtBRL(item.valorContratado)}</span>
                                    </div>
                                    {item.valorContratado > 0 && (
                                      <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-success/50 rounded-full" style={{ width: `${pi}%` }} />
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Seção 4: Pré-Eventos ─────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  FESTA_INTEGRACAO: 'Integração',
  FESTA_START: 'Start',
  FESTA_1_6: '1/6',
  FESTA_FIM_CICLO_BASICO: 'Fim Ciclo Básico',
  FESTA_MEIO_CURSO: 'Meio Curso',
  VIAGEM_MEIO_CURSO: 'Viagem Meio Curso',
  FESTA_PRE_INTERNATO: 'Pré-Internato',
  FESTA_X_DIAS: 'Festa X Dias',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  CONTRATADO: 'bg-success/15 text-success',
  PAGO:       'bg-blue-400/15 text-blue-400',
  PENDENTE:   'bg-warning/15 text-warning',
}
const STATUS_LABEL: Record<string, string> = {
  CONTRATADO: 'Contratado',
  PAGO:       'Pago',
  PENDENTE:   'Pendente',
}

// ─── Helpers financeiros ──────────────────────────────────────────────────────

function totalReceitas(orc: Orcamento) {
  return (orc.receitasSympla ?? []).reduce((s, l) => s + l.total, 0) + (orc.bolsaFolia ?? 0)
}

function totalDespesas(orc: Orcamento) {
  const secoes = [...(orc.operacaoEstrutura ?? []), ...(orc.atracao ?? []), ...(orc.abBebidas ?? []), ...(orc.extras ?? []), ...(orc.equipe ?? [])]
  return secoes.reduce((s, i) => s + (i.valorPassadoCliente ?? 0), 0)
}

// ─── Tabela de itens de uma seção ─────────────────────────────────────────────

function PlanilhaSecao({ titulo, items, col1 = 'Item', col2 = 'Fornecedor' }: {
  titulo: string
  items: ItemOrcamento[]
  col1?: string
  col2?: string
}) {
  if (!items.length) return null
  const temValor = items.some(i => (i.valorPassadoCliente ?? 0) > 0)
  return (
    <div>
      <h4 className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">{titulo}</h4>
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="text-left px-3 py-2 text-text-muted font-medium">{col1}</th>
              <th className="text-left px-3 py-2 text-text-muted font-medium">{col2}</th>
              {temValor && <th className="text-right px-3 py-2 text-text-muted font-medium">Valor</th>}
              <th className="text-right px-3 py-2 text-text-muted font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                <td className="px-3 py-2.5">
                  <div className="text-text-main font-medium">{item.item}</div>
                  {item.notas?.trim() && (
                    <div className="text-text-muted text-[10px] mt-0.5 leading-relaxed">{item.notas}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-text-main">
                  {item.fornecedor?.trim() || <span className="text-text-muted/50">—</span>}
                </td>
                {temValor && (
                  <td className="px-3 py-2.5 text-right text-text-main font-medium tabular-nums">
                    {(item.valorPassadoCliente ?? 0) > 0 ? fmtBRL(item.valorPassadoCliente) : <span className="text-text-muted/40">—</span>}
                  </td>
                )}
                <td className="px-3 py-2.5 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLE[item.status] ?? STATUS_STYLE.PENDENTE}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {temValor && (() => {
            const total = items.reduce((s, i) => s + (i.valorPassadoCliente ?? 0), 0)
            return total > 0 ? (
              <tfoot>
                <tr className="border-t border-white/10 bg-white/4">
                  <td colSpan={2} className="px-3 py-2 text-text-muted text-xs font-semibold">Total</td>
                  <td className="px-3 py-2 text-right text-text-main text-xs font-bold tabular-nums">{fmtBRL(total)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null
          })()}
        </table>
      </div>
    </div>
  )
}

function SecaoPreEventos({ projeto }: { projeto: Projeto }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  const hoje = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('orcamentos').select('dados')
      const todos: Orcamento[] = ((data ?? []) as { dados: Orcamento }[]).map(r => r.dados)

      const turmaProjeto = (projeto.tap.turma ?? '').toLowerCase()
      const filtrados = todos
        .filter(o => {
          const oTurma = (o.turma ?? '').toLowerCase()
          // Exact turma match: only show pre-eventos for THIS turma specifically
          const matchTurma = oTurma === turmaProjeto
          const isBV = oTurma.includes('bv') || (o.tipo ?? '').toLowerCase().includes('veterano')
          return matchTurma && !isBV
        })
        .sort((a, b) => {
          const aPast = a.data < hoje
          const bPast = b.data < hoje
          if (aPast && !bPast) return 1
          if (!aPast && bPast) return -1
          return (a.data || '').localeCompare(b.data || '')
        })

      setOrcamentos(filtrados)
      setLoading(false)
    }
    load()
  }, [projeto.tap.instituicao]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="text-text-muted text-sm text-center py-8">Carregando pré-eventos…</div>
  if (orcamentos.length === 0) return <div className="text-text-muted text-sm text-center py-8">Nenhum pré-evento encontrado.</div>

  return (
    <div className="space-y-3">
      {orcamentos.map(orc => {
        const isPast = orc.data && orc.data < hoje
        const isOpen = expandidos[orc.id] ?? false

        return (
          <div key={orc.id} className={`rounded-xl overflow-hidden transition-all ${isPast ? 'opacity-50' : ''} ${isOpen ? 'bg-surface ring-1 ring-white/10' : 'bg-bg'}`}>
            {/* Cabeçalho */}
            <button
              onClick={() => setExpandidos(prev => ({ ...prev, [orc.id]: !prev[orc.id] }))}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/3 transition-colors text-left"
            >
              <span className="text-text-muted shrink-0">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-text-main font-semibold text-sm">{TIPO_LABEL[orc.tipo] ?? orc.tipo}</div>
                <div className="text-text-muted text-xs mt-0.5">{orc.turma}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-text-main text-xs font-medium">{fmtData(orc.data)}</div>
                {isPast && <div className="text-text-muted text-xs">Realizado</div>}
              </div>
            </button>

            {/* Planilha expandida */}
            {isOpen && (
              <div className="border-t border-white/8 px-4 py-5 space-y-5">
                {/* KPIs financeiros */}
                {(() => {
                  const receita = totalReceitas(orc)
                  const despesa = totalDespesas(orc)
                  const saldo = receita - despesa
                  return (receita > 0 || despesa > 0) ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Receita', value: receita, color: 'text-success' },
                        { label: 'Despesa', value: despesa, color: 'text-primary' },
                        { label: 'Saldo',   value: saldo,   color: saldo >= 0 ? 'text-success' : 'text-danger' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-bg rounded-xl px-3 py-3 text-center">
                          <div className="text-text-muted text-[10px] mb-1">{label}</div>
                          <div className={`text-sm font-bold tabular-nums ${color}`}>{fmtBRL(value)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null
                })()}

                {/* Receitas Sympla */}
                {((orc.receitasSympla ?? []).length > 0 || (orc.bolsaFolia ?? 0) > 0) && (
                  <div>
                    <h4 className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Receitas</h4>
                    <div className="rounded-xl border border-white/8 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-surface border-b border-white/8">
                            <th className="text-left px-3 py-2 text-text-muted font-medium">Lote / Tipo</th>
                            <th className="text-right px-3 py-2 text-text-muted font-medium">Qtde</th>
                            <th className="text-right px-3 py-2 text-text-muted font-medium">Unit.</th>
                            <th className="text-right px-3 py-2 text-text-muted font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(orc.receitasSympla ?? []).map(l => (
                            <tr key={l.id} className="border-b border-white/5 last:border-0">
                              <td className="px-3 py-2 text-text-main">{l.nome}</td>
                              <td className="px-3 py-2 text-right text-text-muted tabular-nums">{l.qtde}</td>
                              <td className="px-3 py-2 text-right text-text-muted tabular-nums">{fmtBRL(l.valorUnitario)}</td>
                              <td className="px-3 py-2 text-right text-success font-semibold tabular-nums">{fmtBRL(l.total)}</td>
                            </tr>
                          ))}
                          {(orc.bolsaFolia ?? 0) > 0 && (
                            <tr className="border-b border-white/5 last:border-0">
                              <td className="px-3 py-2 text-text-main">Bolsa Folia</td>
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2 text-right text-success font-semibold tabular-nums">{fmtBRL(orc.bolsaFolia)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <PlanilhaSecao
                  titulo="Operação e Estrutura"
                  items={orc.operacaoEstrutura ?? []}
                />
                <PlanilhaSecao
                  titulo="Lineup Artístico"
                  items={orc.atracao ?? []}
                  col1="Horário / Atração"
                  col2="Artista"
                />
                <PlanilhaSecao
                  titulo="A&B / Bebidas"
                  items={orc.abBebidas ?? []}
                />
                <PlanilhaSecao
                  titulo="Extras"
                  items={orc.extras ?? []}
                />
                {(orc.cotacoes ?? []).length > 0 && (
                  <div>
                    <h4 className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Cotações</h4>
                    <div className="rounded-xl border border-white/8 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-surface border-b border-white/8">
                            <th className="text-left px-3 py-2 text-text-muted font-medium">Categoria</th>
                            <th className="text-left px-3 py-2 text-text-muted font-medium">Fornecedor</th>
                            <th className="text-right px-3 py-2 text-text-muted font-medium">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(orc.cotacoes ?? []).map(c => (
                            <tr key={c.id} className="border-b border-white/5 last:border-0">
                              <td className="px-3 py-2.5 text-text-muted">{c.categoria}</td>
                              <td className="px-3 py-2.5 text-text-main">{c.fornecedor || '—'}</td>
                              <td className="px-3 py-2.5 text-right text-text-main font-medium">{fmtBRL(c.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard Principal ──────────────────────────────────────────────────────

type TabId = 'financeiro' | 'po' | 'pre-eventos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'financeiro',   label: 'Financeiro' },
  { id: 'po',           label: 'P.O. Resumido' },
  { id: 'pre-eventos',  label: 'Pré-Eventos' },
]

export function DashboardPortal() {
  const { session, signOut } = usePortalAuth()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [projeto, setProjeto] = useState<Projeto | null>(null)
  const [vencimentos, setVencimentos] = useState<CapVencimento[]>([])
  const [loading, setLoading] = useState(true)
  const [tabAtiva, setTabAtiva] = useState<TabId>('financeiro')

  function handleSignOut() {
    signOut()
    navigate('/portal', { replace: true })
  }

  useEffect(() => {
    if (!session?.projetoId) return
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('projetos').select('*').eq('id', session!.projetoId).single()
      if (!data) { setLoading(false); return }

      const proj = rowToProjeto(data as Record<string, unknown>)
      setProjeto(proj)

      const filtro = proj.tap.turma || proj.tap.instituicao || ''
      if (filtro) {
        const hoje = new Date().toISOString().slice(0, 10)
        const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
        const { data: capData } = await supabase
          .from('financeiro_boletim')
          .select('fantasia_cliente_fornecedor, desc_conta_gerencial, d_vencimento, v_lancamento')
          .eq('tipo', 'DESPESA')
          .eq('situacao', 'ATIVO')
          .gte('d_vencimento', hoje)
          .lte('d_vencimento', em30)
          .ilike('desc_centro_custo', `%${filtro}%`)
          .order('d_vencimento')
          .limit(20)
        setVencimentos((capData ?? []) as CapVencimento[])
      }
      setLoading(false)
    }
    load()
  }, [session?.projetoId])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted text-sm gap-2">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Carregando...
      </div>
    )
  }

  if (!projeto) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted text-sm">Projeto não encontrado.</div>
  }

  const nomeEvento = [projeto.tap.instituicao, projeto.tap.turma].filter(Boolean).join(' — ')
  // Visão do cliente: remove linhas internas "Despesa Fee" antes de renderizar (spec #1).
  const projetoCliente = projetoVisaoCliente(projeto)

  return (
    <div className="min-h-screen bg-bg">
      {/* Banner de preview para admin */}
      {isAdmin && (
        <div className="bg-warning/15 border-b border-warning/30 px-4 py-2 flex items-center justify-between">
          <span className="text-warning text-xs font-medium">Você está visualizando o portal como: <strong>{session?.email}</strong></span>
          <button
            onClick={() => { signOut(); navigate('/portal-admin') }}
            className="text-xs text-warning hover:text-warning/80 underline transition-colors"
          >
            ← Voltar ao sistema
          </button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface border-b border-white/10 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={allianceLogo} alt="Alliance" className="h-7 w-auto" style={{ mixBlendMode: 'screen' }} />
          <div>
            <div className="text-text-main font-semibold text-sm">{nomeEvento}</div>
            {projeto.tap.dataEvento && (
              <div className="text-text-muted text-xs">
                {fmtData(projeto.tap.dataEvento)}{projeto.tap.local ? ` · ${projeto.tap.local}` : ''}
              </div>
            )}
          </div>
        </div>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-text-muted hover:text-text-main text-xs transition-colors">
          <LogOut size={13} /> Sair
        </button>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10 px-4 sm:px-8 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTabAtiva(id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tabAtiva === id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        {tabAtiva === 'financeiro'  && <SecaoFinanceiro projeto={projetoCliente} vencimentos={vencimentos} />}
        {tabAtiva === 'po'          && <SecaoPO projeto={projetoCliente} />}
        {tabAtiva === 'pre-eventos' && <SecaoPreEventos projeto={projeto} />}
      </main>
    </div>
  )
}
