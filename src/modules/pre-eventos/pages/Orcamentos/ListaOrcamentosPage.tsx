import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Eye, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { EVENT_TYPE_LABELS } from '../../data/defaults'
import { formatBRL, formatDate } from '../../utils/formatters'
import type { Orcamento, OrcamentoStatus } from '../../types'

const STATUS_COLORS: Record<OrcamentoStatus, string> = {
  RASCUNHO:    'bg-muted/20 text-muted border-muted/30',
  EM_ANDAMENTO:'bg-warning/20 text-warning border-warning/30',
  CONCLUIDO:   'bg-success/20 text-success border-success/30',
}

const allItemsOf = (o: Orcamento) => [...o.operacaoEstrutura, ...o.equipe, ...o.atracao, ...o.abBebidas, ...o.extras]
const receitasOf = (o: Orcamento) => o.bolsaFolia + o.receitasSympla.reduce((s, l) => s + l.total, 0)
const pagoOf = (o: Orcamento) => allItemsOf(o).reduce((s, i) => s + i.totalPagoReal, 0)
// BV = V.Cliente − Total Pago; itens "Pago (Comissão)" não geram BV.
const bvOf = (o: Orcamento) => allItemsOf(o).reduce((s, i) => s + (i.status === 'PAGO_COMISSAO' ? 0 : i.valorPassadoCliente - i.totalPagoReal), 0)
// Chave de agrupamento por turma: normaliza grafia ("BQ 78" e "BQ78" caem juntos).
const turmaKey = (t: string) => (t || '—').trim().replace(/\s+/g, '').toUpperCase() || '—'

export const ListaOrcamentosPage: React.FC = () => {
  const navigate = useNavigate()
  const { orcamentos, excluirOrcamento, confirm, addToast } = useAppContext()
  const [busca, setBusca] = useState('')
  const [filtroInst, setFiltroInst] = useState('')
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})

  const instituicoes = useMemo(() =>
    [...new Set(orcamentos.map(o => o.instituicao).filter(Boolean))].sort(),
  [orcamentos])

  // Agrupa: Instituição → Turma → orçamentos (tipos de evento).
  const grupos = useMemo(() => {
    const q = busca.toLowerCase()
    const filtrados = orcamentos.filter(o => {
      if (filtroInst && o.instituicao !== filtroInst) return false
      if (q && !o.instituicao.toLowerCase().includes(q) &&
               !o.turma.toLowerCase().includes(q) &&
               !EVENT_TYPE_LABELS[o.tipo].toLowerCase().includes(q)) return false
      return true
    })

    const instMap = new Map<string, Map<string, { label: string; itens: Orcamento[] }>>()
    for (const o of filtrados) {
      const inst = o.instituicao || '—'
      const tk = turmaKey(o.turma)
      if (!instMap.has(inst)) instMap.set(inst, new Map())
      const tm = instMap.get(inst)!
      if (!tm.has(tk)) tm.set(tk, { label: (o.turma || '—').trim() || '—', itens: [] })
      tm.get(tk)!.itens.push(o)
    }

    return [...instMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(([inst, tm]) => {
        const turmas = [...tm.values()]
          .map(t => ({ ...t, itens: [...t.itens].sort((a, b) => (a.data || '').localeCompare(b.data || '')) }))
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { numeric: true }))
        const nOrc = turmas.reduce((s, t) => s + t.itens.length, 0)
        return { inst, turmas, nOrc }
      })
  }, [orcamentos, busca, filtroInst])

  const totalFiltrado = grupos.reduce((s, g) => s + g.nOrc, 0)

  const toggle = (key: string) => setAbertos(prev => ({ ...prev, [key]: !prev[key] }))

  function handleDelete(id: string, nome: string) {
    confirm(`Deseja excluir o orçamento "${nome}"? Esta ação não pode ser desfeita.`, () => {
      excluirOrcamento(id)
      addToast('Orçamento excluído com sucesso.', 'success')
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-surface-2 border border-bordercol rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-muted outline-none focus:border-accent transition-colors"
          />
        </div>
        <select
          value={filtroInst}
          onChange={e => setFiltroInst(e.target.value)}
          className="bg-surface-2 border border-bordercol rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent"
        >
          <option value="">Todas as inst.</option>
          {instituicoes.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <button
          onClick={() => navigate('/pre-eventos/orcamentos/novo')}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shrink-0 min-h-[44px]"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo Orçamento</span>
        </button>
      </div>

      {/* Grupos: Instituição → Turma → orçamentos */}
      {grupos.length === 0 ? (
        <div className="bg-surface-2 border border-bordercol rounded-card p-12 text-center">
          <p className="text-white font-semibold">
            {busca || filtroInst ? 'Nenhum resultado encontrado' : 'Nenhum orçamento cadastrado'}
          </p>
          {!busca && !filtroInst && (
            <p className="text-muted text-sm mt-1">Clique em "Novo Orçamento" para começar.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map(({ inst, turmas, nOrc }) => {
            const instKey = `i:${inst}`
            const instOpen = abertos[instKey] ?? false
            return (
              <div key={inst} className="bg-surface-2 border border-bordercol rounded-card overflow-hidden">
                {/* Nível 1: Instituição */}
                <button
                  onClick={() => toggle(instKey)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <span className="text-muted shrink-0">
                    {instOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                  <span className="text-white font-semibold text-sm flex-1">{inst}</span>
                  <span className="text-muted text-xs shrink-0">
                    {turmas.length} turma{turmas.length !== 1 ? 's' : ''} · {nOrc} orçamento{nOrc !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Nível 2: Turmas */}
                {instOpen && (
                  <div className="border-t border-bordercol/50">
                    {turmas.map(t => {
                      const tKey = `t:${inst}::${turmaKey(t.label)}`
                      const tOpen = abertos[tKey] ?? false
                      const bvTurma = t.itens.reduce((s, o) => s + bvOf(o), 0)
                      return (
                        <div key={tKey}>
                          {/* Turma header (indentado) */}
                          <button
                            onClick={() => toggle(tKey)}
                            className="w-full flex items-center gap-3 pl-8 pr-4 py-2.5 bg-black/10 hover:bg-white/[0.03] transition-colors text-left border-b border-bordercol/30"
                          >
                            <span className="text-muted shrink-0">
                              {tOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                            <span className="text-white text-sm font-medium flex-1">{t.label}</span>
                            <span className="text-muted text-[11px] shrink-0">{t.itens.length} evento{t.itens.length !== 1 ? 's' : ''}</span>
                            <span className={`text-[11px] font-semibold shrink-0 w-24 text-right ${bvTurma >= 0 ? 'text-success' : 'text-danger'}`}>
                              BV {formatBRL(bvTurma)}
                            </span>
                          </button>

                          {/* Nível 3: tabela de orçamentos da turma */}
                          {tOpen && (
                            <div className="overflow-x-auto bg-black/20">
                              <table className="w-full text-sm" style={{ minWidth: 620 }}>
                                <thead>
                                  <tr className="bg-white/[0.03]">
                                    <th className="text-left text-muted font-medium px-4 py-2 text-xs pl-12">Tipo</th>
                                    <th className="text-center text-muted font-medium px-4 py-2 text-xs hidden md:table-cell">Data</th>
                                    <th className="text-center text-muted font-medium px-4 py-2 text-xs hidden lg:table-cell">Conv.</th>
                                    <th className="text-right text-muted font-medium px-4 py-2 text-xs">Receitas</th>
                                    <th className="text-right text-muted font-medium px-4 py-2 text-xs hidden md:table-cell">Total Pago</th>
                                    <th className="text-right text-muted font-medium px-4 py-2 text-xs hidden sm:table-cell">BV</th>
                                    <th className="text-center text-muted font-medium px-4 py-2 text-xs hidden sm:table-cell">Status</th>
                                    <th className="w-24 px-4 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {t.itens.map(o => (
                                    <tr
                                      key={o.id}
                                      className="border-t border-bordercol/30 hover:bg-white/[0.03] cursor-pointer transition-colors"
                                      onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                                    >
                                      <td className="px-4 py-2.5 text-white text-xs font-medium pl-12">{EVENT_TYPE_LABELS[o.tipo]}</td>
                                      <td className="px-4 py-2.5 text-center text-gray-300 text-xs hidden md:table-cell">{formatDate(o.data)}</td>
                                      <td className="px-4 py-2.5 text-center text-gray-300 text-xs hidden lg:table-cell">{o.quantidadeConvidados}</td>
                                      <td className="px-4 py-2.5 text-right text-success text-xs font-medium">{formatBRL(receitasOf(o))}</td>
                                      <td className="px-4 py-2.5 text-right text-gray-300 text-xs hidden md:table-cell">{formatBRL(pagoOf(o))}</td>
                                      <td className={`px-4 py-2.5 text-right text-xs font-semibold hidden sm:table-cell ${bvOf(o) >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatBRL(bvOf(o))}
                                      </td>
                                      <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                                        <span className={`text-xs border rounded px-2 py-0.5 whitespace-nowrap ${STATUS_COLORS[o.status]}`}>
                                          {o.status.replace('_', ' ')}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center gap-1 justify-end">
                                          <button
                                            onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                                            className="p-1.5 rounded text-muted hover:text-white hover:bg-white/10 transition-colors"
                                            title="Visualizar"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                                            className="p-1.5 rounded text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                                            title="Editar"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDelete(o.id, `${o.instituicao} ${o.turma}`)}
                                            className="p-1.5 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                            title="Excluir"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
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
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-muted text-xs text-right">
        {totalFiltrado} de {orcamentos.length} orçamento(s)
      </p>
    </div>
  )
}
