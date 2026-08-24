import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { CheckCircle2, AlertTriangle, LogOut, ChevronDown, ChevronRight, Download } from 'lucide-react'
import { gerarPrestacaoContas } from '../../lib/gerarPrestacaoContas'
import { supabase } from '../../lib/supabase'
import { usePortalAuth } from '../../contexts/PortalAuthContext'
import { calcResumoProjeto, filtrarItensCalculo, projetoVisaoCliente } from '../../utils/calculos'
import allianceLogo from '../../assets/alliance-logo.png'
import type { Projeto, SecaoCusto, TAP, Receitas, CustoAdicional, ConciliacaoEverest, LinhaResumoComercial } from '../../types'
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
    resumoComercial: (row.resumo_comercial as LinhaResumoComercial[]) ?? undefined,
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

// % do "(CC) Custo Cerimonial" do projeto (o fee que a turma paga pela Alliance),
// vindo do resumoComercial. percentual já vem na escala 0–100 (ex: 17).
function feeCerimonialPct(projeto: Projeto): number {
  const linha = (projeto.resumoComercial ?? []).find(l => /custo cerimonial|\(cc\)/i.test(l.descricao ?? ''))
  return linha?.percentual ?? 0
}

function SecaoFinanceiro({ projeto, vencimentos: _v }: { projeto: Projeto; vencimentos: CapVencimento[] }) {
  const resumo = useMemo(() => calcResumoProjeto(projeto), [projeto])
  const receitaRecebida = resumo.receitaBaile.pago
  const ccPct = feeCerimonialPct(projeto)
  const fee = receitaRecebida * (ccPct / 100)
  const arrecadadoLiquido = receitaRecebida - fee
  const custoContratado = resumo.custoTotal.contratado
  const custoPago = resumo.custoTotal.pago
  const faltaPagar = Math.max(0, custoContratado - custoPago)
  const saldoLiquido = arrecadadoLiquido - custoPago
  const pctPago = custoContratado > 0 ? Math.min(100, (custoPago / custoContratado) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Baixar Prestação de Contas em PDF */}
      <div className="flex justify-end">
        <button
          onClick={() => gerarPrestacaoContas(projeto)}
          className="flex items-center gap-2 border border-white/15 hover:border-primary/60 hover:bg-white/5 text-text-muted hover:text-text-main text-xs font-medium py-2 px-4 rounded-lg transition-colors"
        >
          <Download size={14} /> Baixar Prestação de Contas (PDF)
        </button>
      </div>

      {/* O que entrou e como está sendo usado */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-4 bg-primary rounded-full" />
          <h3 className="text-text-main text-sm font-semibold">O que entrou e como está sendo usado</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-bg rounded-xl px-4 py-4">
            <div className="text-text-muted text-xs mb-1">Arrecadado da turma</div>
            <div className="text-lg font-semibold text-success">{fmtBRL(arrecadadoLiquido)}</div>
            <div className="text-text-muted/60 text-[11px] mt-0.5">já sem o fee Alliance</div>
          </div>
          <div className="bg-bg rounded-xl px-4 py-4">
            <div className="text-text-muted text-xs mb-1">Custo do evento</div>
            <div className="text-lg font-semibold text-text-main">{fmtBRL(custoContratado)}</div>
            <div className="text-text-muted/60 text-[11px] mt-0.5">contratado até agora</div>
          </div>
          <div className="bg-bg rounded-xl px-4 py-4">
            <div className="text-text-muted text-xs mb-1">Falta pagar</div>
            <div className="text-lg font-semibold text-warning">{fmtBRL(faltaPagar)}</div>
            <div className="text-text-muted/60 text-[11px] mt-0.5">{fmtBRL(custoPago)} já pago</div>
          </div>
          <div className="bg-bg rounded-xl px-4 py-4">
            <div className="text-text-muted text-xs mb-1">Saldo líquido</div>
            <div className={`text-lg font-semibold ${saldoLiquido >= 0 ? 'text-success' : 'text-danger'}`}>{fmtBRL(saldoLiquido)}</div>
            <div className="text-text-muted/60 text-[11px] mt-0.5">arrecadado − já pago</div>
          </div>
        </div>
      </div>

      {/* Receita: bruta − fee Alliance = líquida da turma */}
      <div className="bg-bg rounded-xl px-4 py-3 text-xs space-y-1.5">
        <div className="flex justify-between">
          <span className="text-text-muted">Receita recebida (bruta)</span>
          <span className="text-text-main tabular-nums">{fmtBRL(receitaRecebida)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">(−) Fee Alliance ({ccPct.toFixed(ccPct % 1 === 0 ? 0 : 2)}%)</span>
          <span className="text-danger tabular-nums">−{fmtBRL(fee)}</span>
        </div>
        <div className="flex justify-between border-t border-white/8 pt-1.5">
          <span className="text-text-main font-medium">Arrecadado da turma</span>
          <span className="text-success font-semibold tabular-nums">{fmtBRL(arrecadadoLiquido)}</span>
        </div>
      </div>

      {/* Progresso: pago do que já foi contratado */}
      <div className="bg-bg rounded-xl px-4 py-4">
        <div className="mb-2">
          <span className="text-text-muted text-xs">Pagamento do que já foi contratado</span>
        </div>
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pctPago}%`, background: '#00b894' }} />
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-1.5">
          <span>{fmtBRL(custoPago)} pago</span>
          <span>{pctPago.toFixed(0)}% de {fmtBRL(custoContratado)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Seção 3: P.O. Resumido ───────────────────────────────────────────────────

function SecaoPO({ projeto }: { projeto: Projeto }) {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  // `projeto` já chega como visão do cliente (sem "Despesa Fee", spec #1).
  const resumo = useMemo(() => calcResumoProjeto(projeto), [projeto])

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

// ─── Cronograma (régua) — leitura no portal ──────────────────────────────────

const STATUS_REGUA_CHIP: Record<string, string> = {
  'Concluído':    'bg-success/15 text-success',
  'A iniciar':    'bg-white/10 text-white',
  'Em andamento': 'bg-yellow-400/15 text-yellow-400',
  'Pendente':     'bg-orange-400/15 text-orange-400',
  'Cancelado':    'bg-red-400/15 text-red-400 line-through',
}

const STATUS_DOT: Record<string, string> = {
  'Concluído':    'bg-success',
  'A iniciar':    'bg-white',
  'Em andamento': 'bg-yellow-400',
  'Pendente':     'bg-orange-400',
  'Cancelado':    'bg-red-400',
}

interface ReguaTarefaPortal {
  id: string; tarefa: string; momento: string; dias: number; responsavel: string; status: string
}

function dataMenosDias(iso: string, dias: number): string {
  if (!iso) return '—'
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  d.setDate(d.getDate() - dias)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function diasAteEvento(iso: string): number | null {
  if (!iso) return null
  const alvo = new Date(iso.slice(0, 10) + 'T00:00:00')
  if (isNaN(alvo.getTime())) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

// Fases da régua (pra agrupar as tarefas em barras no Gantt, em vez de 1 ponto por tarefa).
const FASES_REGUA = [
  { nome: 'Concepção',    min: 65,        max: Infinity },
  { nome: 'Fornecedores', min: 35,        max: 65 },
  { nome: 'Vendas',       min: 10,        max: 35 },
  { nome: 'Reta final',   min: -Infinity, max: 10 },
]

function corFase(tasks: { status: string }[]): string {
  const ativos = tasks.filter(t => t.status !== 'Cancelado')
  if (ativos.length === 0) return 'bg-white/10'
  if (ativos.every(t => t.status === 'Concluído')) return 'bg-success'
  if (ativos.some(t => t.status === 'Concluído' || t.status === 'Em andamento')) return 'bg-yellow-400'
  if (ativos.some(t => t.status === 'A iniciar')) return 'bg-white'
  return 'bg-orange-400'
}

// Marcas de mês entre duas datas, com posição x (%) na linha do tempo.
function mesesEntre(start: Date, end: Date): { label: string; x: number }[] {
  const total = end.getTime() - start.getTime()
  if (total <= 0) return []
  const res: { label: string; x: number }[] = []
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  if (d < start) d.setMonth(d.getMonth() + 1)
  let guard = 0
  while (d <= end && guard < 60) {
    const x = ((d.getTime() - start.getTime()) / total) * 100
    const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    res.push({ label: `${mes}/${String(d.getFullYear()).slice(2)}`, x })
    d.setMonth(d.getMonth() + 1)
    guard++
  }
  return res
}

function CronogramaPortal({ tarefas, dataEvento }: { tarefas: ReguaTarefaPortal[]; dataEvento: string }) {
  if (tarefas.length === 0) return null

  const dias = diasAteEvento(dataEvento)
  const total = tarefas.length
  const concluidas = tarefas.filter(t => t.status === 'Concluído').length
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0

  return (
    <div>
      <h4 className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Cronograma</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-bg rounded-xl px-3 py-3">
          <div className="text-text-muted text-[10px] mb-1">Contagem regressiva</div>
          <div className="text-primary text-sm font-bold">
            {dias == null ? '—' : dias >= 0 ? `faltam ${dias} dias` : `${Math.abs(dias)} dias atrás`}
          </div>
        </div>
        <div className="bg-bg rounded-xl px-3 py-3">
          <div className="text-text-muted text-[10px] mb-1">Jornada</div>
          <div className="text-text-main text-sm font-bold">{concluidas} de {total} · {pct}%</div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
            <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="text-left px-3 py-2 text-text-muted font-medium w-14">Prazo</th>
              <th className="text-left px-3 py-2 text-text-muted font-medium">Tarefa</th>
              <th className="text-right px-3 py-2 text-text-muted font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {tarefas.map(t => (
              <tr key={t.id} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-2.5 text-text-muted whitespace-nowrap tabular-nums">{dataMenosDias(dataEvento, t.dias)}</td>
                <td className="px-3 py-2.5 text-text-main">
                  {t.tarefa}
                  {t.responsavel && <span className="text-text-muted/70"> · {t.responsavel}</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${STATUS_REGUA_CHIP[t.status] ?? STATUS_REGUA_CHIP.Pendente}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

function GanttPortal({ tarefas, dataEvento }: { tarefas: ReguaTarefaPortal[]; dataEvento: string }) {
  const [fasesAbertas, setFasesAbertas] = useState<Record<string, boolean>>({})

  if (tarefas.length === 0) return null

  const dias = diasAteEvento(dataEvento)
  const diasArr = tarefas.map(t => t.dias)
  const maxDias = Math.max(...diasArr, 0)
  const minDias = Math.min(...diasArr, 0)
  const range = (maxDias - minDias) || 1
  const xPos = (d: number) => ((maxDias - d) / range) * 100
  const xHoje = dias == null ? null : Math.max(0, Math.min(100, ((maxDias - dias) / range) * 100))
  const evDate = dataEvento ? new Date(dataEvento.slice(0, 10) + 'T00:00:00') : null
  const eventoValida = !!evDate && !isNaN(evDate.getTime())
  const meses = eventoValida
    ? (() => {
        const ini = new Date(evDate!); ini.setDate(ini.getDate() - maxDias)
        const fim = new Date(evDate!); fim.setDate(fim.getDate() - minDias)
        return mesesEntre(ini, fim)
      })()
    : []
  const fasesGantt = FASES_REGUA.map(f => {
    const ts = tarefas.filter(t => t.dias < f.max && t.dias >= f.min)
    if (ts.length === 0) return null
    const ds = ts.map(t => t.dias)
    return {
      nome: f.nome,
      left: xPos(Math.max(...ds)),
      right: xPos(Math.min(...ds)),
      cor: corFase(ts),
      n: ts.length,
      feitas: ts.filter(t => t.status === 'Concluído').length,
      inicio: dataMenosDias(dataEvento, Math.max(...ds)),
      fim: dataMenosDias(dataEvento, Math.min(...ds)),
      tasks: ts,
    }
  }).filter((f): f is NonNullable<typeof f> => f !== null)

  if (fasesGantt.length === 0) return null

  return (
    <div>
      <h4 className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Linha do tempo</h4>
      <div className="rounded-xl border border-white/8 p-3">
        {/* eixo de meses */}
        <div className="flex mb-2">
          <div className="w-48 shrink-0" />
          <div className="relative flex-1 h-3">
            {meses.map((m, i) => (
              <span key={i} className="absolute -translate-x-1/2 text-[9px] text-text-muted whitespace-nowrap" style={{ left: `${m.x}%` }}>{m.label}</span>
            ))}
          </div>
        </div>
        {/* barras de fase — clica pra recolher/expandir as tarefas */}
        <div className="space-y-2">
          {fasesGantt.map(f => {
            const aberta = fasesAbertas[f.nome] ?? true
            return (
              <div key={f.nome}>
                <div className="flex items-center">
                  <button
                    onClick={() => setFasesAbertas(p => ({ ...p, [f.nome]: !aberta }))}
                    className="w-48 shrink-0 pr-2 flex items-center gap-1 text-[12px] text-text-main hover:text-primary transition-colors text-left"
                  >
                    {aberta ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                    <span className="truncate">{f.nome}</span>
                  </button>
                  <div className="relative flex-1 h-4">
                    {meses.map((m, i) => <div key={i} className="absolute top-0 bottom-0 w-px bg-white/6" style={{ left: `${m.x}%` }} />)}
                    {xHoje != null && <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: `${xHoje}%` }} />}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full ${f.cor}`}
                      style={{ left: `${f.left}%`, width: `${Math.max(2, f.right - f.left)}%` }}
                      title={`${f.inicio} – ${f.fim} · ${f.feitas}/${f.n} concluídas`}
                    />
                  </div>
                </div>
                {aberta && f.tasks.map(t => (
                  <div key={t.id} className="flex items-start mt-1">
                    <span className="w-48 shrink-0 pr-2 pl-5 text-[10px] leading-tight text-text-muted" title={`${dataMenosDias(dataEvento, t.dias)} · ${t.status}`}>
                      {t.tarefa}
                    </span>
                    <div className="relative flex-1 h-4">
                      {meses.map((m, i) => <div key={i} className="absolute top-0 bottom-0 w-px bg-white/4" style={{ left: `${m.x}%` }} />)}
                      {xHoje != null && <div className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: `${xHoje}%` }} />}
                      <div className="absolute left-0 right-0 top-2 h-px bg-white/5" />
                      <div
                        className={`absolute top-2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.status] ?? 'bg-orange-400'}`}
                        style={{ left: `${xPos(t.dias)}%` }}
                        title={`${dataMenosDias(dataEvento, t.dias)} · ${t.status}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        {/* hoje / evento */}
        <div className="flex text-[9px] text-text-muted mt-2">
          <div className="w-48 shrink-0" />
          <div className="relative flex-1 h-3">
            {xHoje != null && <span className="absolute -translate-x-1/2 text-white/60" style={{ left: `${xHoje}%` }}>hoje</span>}
            <span className="absolute right-0">{eventoValida ? fmtData(dataEvento) : 'evento'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SecaoPreEventos({ projeto }: { projeto: Projeto }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [reguas, setReguas] = useState<Record<string, ReguaTarefaPortal[]>>({})

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

      // Carrega as réguas de todos os pré-eventos desta turma de uma vez.
      const ids = filtrados.map(o => o.id).filter(Boolean)
      if (ids.length > 0) {
        const { data: rt } = await supabase
          .from('regua_tarefas')
          .select('id, orcamento_id, tarefa, momento, dias, responsavel, status')
          .in('orcamento_id', ids)
          .order('ordem', { ascending: true })
        const map: Record<string, ReguaTarefaPortal[]> = {}
        for (const t of ((rt ?? []) as (ReguaTarefaPortal & { orcamento_id: string })[])) {
          (map[t.orcamento_id] ??= []).push(t)
        }
        setReguas(map)
      }
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
            {isOpen && (() => {
              const tarefasRegua = reguas[orc.id] ?? []
              const temCronograma = tarefasRegua.length > 0
              return (
              <div className="border-t border-white/8 px-4 py-5 space-y-5">
                <div className={`grid grid-cols-1 gap-8 items-start ${temCronograma ? 'lg:grid-cols-2' : ''}`}>
                {temCronograma && (
                  <div className="space-y-5">
                    <CronogramaPortal tarefas={tarefasRegua} dataEvento={orc.data} />
                  </div>
                )}

                {/* Orçamento completo */}
                <div className="space-y-5">
                <h4 className="text-text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Orçamento</h4>
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
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1 h-4 bg-success rounded-full" />
                      <h4 className="text-text-main text-sm font-semibold">Receitas</h4>
                    </div>
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

                <div className="flex items-center gap-2 pt-1">
                  <span className="w-1 h-4 bg-primary rounded-full" />
                  <h4 className="text-text-main text-sm font-semibold">Despesas</h4>
                </div>
                <PlanilhaSecao
                  titulo="Operação e Estrutura"
                  items={orc.operacaoEstrutura ?? []}
                />
                <PlanilhaSecao
                  titulo="Equipe"
                  items={orc.equipe ?? []}
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
                </div>
                {temCronograma && <GanttPortal tarefas={tarefasRegua} dataEvento={orc.data} />}
              </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard Principal ──────────────────────────────────────────────────────

type TabId = 'financeiro' | 'pre-eventos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'financeiro',   label: 'Financeiro' },
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
      <main className={`${tabAtiva === 'pre-eventos' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto px-4 sm:px-8 py-8 transition-[max-width]`}>
        {tabAtiva === 'financeiro'  && (
          <div className="space-y-8">
            <SecaoFinanceiro projeto={projetoCliente} vencimentos={vencimentos} />
            <SecaoPO projeto={projetoCliente} />
          </div>
        )}
        {tabAtiva === 'pre-eventos' && <SecaoPreEventos projeto={projeto} />}
      </main>
    </div>
  )
}
