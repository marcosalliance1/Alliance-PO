import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Eye, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { EVENT_TYPE_LABELS } from '../../data/defaults'
import { formatBRL, formatDate } from '../../utils/formatters'
import type { OrcamentoStatus } from '../../types'

const STATUS_COLORS: Record<OrcamentoStatus, string> = {
  RASCUNHO:    'bg-muted/20 text-muted border-muted/30',
  EM_ANDAMENTO:'bg-warning/20 text-warning border-warning/30',
  CONCLUIDO:   'bg-success/20 text-success border-success/30',
}

export const ListaOrcamentosPage: React.FC = () => {
  const navigate = useNavigate()
  const { orcamentos, excluirOrcamento, confirm, addToast } = useAppContext()
  const [busca, setBusca] = useState('')
  const [filtroInst, setFiltroInst] = useState('')
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})

  const instituicoes = useMemo(() =>
    [...new Set(orcamentos.map(o => o.instituicao).filter(Boolean))].sort(),
  [orcamentos])

  // Group filtered orçamentos by institution
  const grupos = useMemo(() => {
    const q = busca.toLowerCase()
    const filtrados = orcamentos.filter(o => {
      if (filtroInst && o.instituicao !== filtroInst) return false
      if (q && !o.instituicao.toLowerCase().includes(q) &&
               !o.turma.toLowerCase().includes(q) &&
               !EVENT_TYPE_LABELS[o.tipo].toLowerCase().includes(q)) return false
      return true
    })

    const map = new Map<string, typeof filtrados>()
    for (const o of filtrados) {
      const key = o.instituicao || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([inst, itens]) => [
        inst,
        [...itens].sort((a, b) => {
          const t = (a.turma || '').localeCompare(b.turma || '')
          return t !== 0 ? t : (a.data || '').localeCompare(b.data || '')
        }),
      ] as [string, typeof filtrados])
  }, [orcamentos, busca, filtroInst])

  const totalFiltrado = grupos.reduce((s, [, itens]) => s + itens.length, 0)

  function toggle(inst: string) {
    setAbertos(prev => ({ ...prev, [inst]: !prev[inst] }))
  }

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

      {/* Grupos por Instituição */}
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
          {grupos.map(([inst, itens]) => {
            const isOpen = abertos[inst] ?? false
            return (
              <div key={inst} className="bg-surface-2 border border-bordercol rounded-card overflow-hidden">
                {/* Institution header */}
                <button
                  onClick={() => toggle(inst)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <span className="text-muted shrink-0">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                  <span className="text-white font-semibold text-sm flex-1">{inst}</span>
                  <span className="text-muted text-xs shrink-0">{itens.length} orçamento{itens.length !== 1 ? 's' : ''}</span>
                </button>

                {/* Inner table */}
                {isOpen && (
                  <div className="border-t border-bordercol/50 overflow-x-auto">
                    <table className="w-full text-sm" style={{ minWidth: 620 }}>
                      <thead>
                        <tr className="bg-white/[0.03]">
                          <th className="text-left text-muted font-medium px-4 py-2 text-xs">Turma</th>
                          <th className="text-left text-muted font-medium px-4 py-2 text-xs hidden sm:table-cell">Tipo</th>
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
                        {itens.map(o => {
                          const allItems = [...o.operacaoEstrutura, ...o.equipe, ...o.atracao, ...o.abBebidas, ...o.extras]
                          const totalReceitas = o.bolsaFolia + o.receitasSympla.reduce((s, l) => s + l.total, 0)
                          const totalPago = allItems.reduce((s, i) => s + i.totalPagoReal, 0)
                          const totalBV   = allItems.reduce((s, i) => s + (i.valorPassadoCliente - i.totalPagoReal), 0)

                          return (
                            <tr
                              key={o.id}
                              className="border-t border-bordercol/30 hover:bg-white/[0.03] cursor-pointer transition-colors"
                              onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                            >
                              <td className="px-4 py-2.5 text-white text-xs font-medium">{o.turma || '—'}</td>
                              <td className="px-4 py-2.5 text-gray-300 text-xs hidden sm:table-cell">{EVENT_TYPE_LABELS[o.tipo]}</td>
                              <td className="px-4 py-2.5 text-center text-gray-300 text-xs hidden md:table-cell">{formatDate(o.data)}</td>
                              <td className="px-4 py-2.5 text-center text-gray-300 text-xs hidden lg:table-cell">{o.quantidadeConvidados}</td>
                              <td className="px-4 py-2.5 text-right text-success text-xs font-medium">{formatBRL(totalReceitas)}</td>
                              <td className="px-4 py-2.5 text-right text-gray-300 text-xs hidden md:table-cell">{formatBRL(totalPago)}</td>
                              <td className={`px-4 py-2.5 text-right text-xs font-semibold hidden sm:table-cell ${totalBV >= 0 ? 'text-success' : 'text-danger'}`}>
                                {formatBRL(totalBV)}
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
                          )
                        })}
                      </tbody>
                    </table>
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
