import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Eye } from 'lucide-react'
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
  const [busca, setBusca]           = useState('')
  const [filtroInst, setFiltroInst] = useState('')
  const [filtroTurma, setFiltroTurma] = useState('')

  // Unique institutions
  const instituicoes = useMemo(() =>
    [...new Set(orcamentos.map(o => o.instituicao).filter(Boolean))].sort(),
  [orcamentos])

  // Turmas for selected institution
  const turmas = useMemo(() =>
    filtroInst
      ? [...new Set(orcamentos.filter(o => o.instituicao === filtroInst).map(o => o.turma).filter(Boolean))].sort()
      : [],
  [orcamentos, filtroInst])

  const filtered = useMemo(() => {
    const q = busca.toLowerCase()
    return orcamentos.filter(o => {
      if (filtroInst  && o.instituicao !== filtroInst)  return false
      if (filtroTurma && o.turma       !== filtroTurma) return false
      if (q && !o.instituicao.toLowerCase().includes(q) &&
               !o.turma.toLowerCase().includes(q) &&
               !EVENT_TYPE_LABELS[o.tipo].toLowerCase().includes(q)) return false
      return true
    })
  }, [orcamentos, busca, filtroInst, filtroTurma])

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
          onChange={e => { setFiltroInst(e.target.value); setFiltroTurma('') }}
          className="bg-surface-2 border border-bordercol rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent"
        >
          <option value="">Todas as inst.</option>
          {instituicoes.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        {filtroInst && turmas.length > 0 && (
          <select
            value={filtroTurma}
            onChange={e => setFiltroTurma(e.target.value)}
            className="bg-surface-2 border border-bordercol rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent"
          >
            <option value="">Todas as turmas</option>
            {turmas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <button
          onClick={() => navigate('/pre-eventos/orcamentos/novo')}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shrink-0 min-h-[44px]"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo Orçamento</span>
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-surface-2 border border-bordercol rounded-card p-12 text-center">
          <p className="text-white font-semibold">
            {busca || filtroInst ? 'Nenhum resultado encontrado' : 'Nenhum orçamento cadastrado'}
          </p>
          <p className="text-muted text-sm mt-1">
            {!busca && !filtroInst && 'Clique em "Novo Orçamento" para começar.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-bordercol rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead className="bg-surface2/50">
                <tr>
                  <th className="text-left text-muted font-medium px-4 py-3">Instituição / Turma</th>
                  <th className="text-left text-muted font-medium px-4 py-3 hidden sm:table-cell">Tipo</th>
                  <th className="text-center text-muted font-medium px-4 py-3 hidden md:table-cell">Data</th>
                  <th className="text-center text-muted font-medium px-4 py-3 hidden lg:table-cell">Conv.</th>
                  <th className="text-right text-muted font-medium px-4 py-3">Receitas</th>
                  <th className="text-right text-muted font-medium px-4 py-3 hidden md:table-cell">Total Pago</th>
                  <th className="text-right text-muted font-medium px-4 py-3 hidden sm:table-cell">BV</th>
                  <th className="text-center text-muted font-medium px-4 py-3 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, idx) => {
                  const allItems = [...o.operacaoEstrutura, ...o.equipe, ...o.atracao, ...o.abBebidas, ...o.extras]
                  const totalReceitas = o.bolsaFolia + o.receitasSympla.reduce((s, l) => s + l.total, 0)
                  const totalPago = allItems.reduce((s, i) => s + i.totalPagoReal, 0)
                  const totalBV   = allItems.reduce((s, i) => s + i.bvAbsoluto, 0)
                  const isNewInst = idx > 0 && filtered[idx - 1].instituicao !== o.instituicao

                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-white/[0.03] cursor-pointer transition-colors ${isNewInst ? 'border-t-2 border-accent/50' : 'border-t border-bordercol/50'}`}
                      onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{o.instituicao || '—'}</p>
                        <p className="text-muted text-xs">{o.turma || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs hidden sm:table-cell">{EVENT_TYPE_LABELS[o.tipo]}</td>
                      <td className="px-4 py-3 text-center text-gray-300 text-xs hidden md:table-cell">{formatDate(o.data)}</td>
                      <td className="px-4 py-3 text-center text-gray-300 hidden lg:table-cell">{o.quantidadeConvidados}</td>
                      <td className="px-4 py-3 text-right text-success text-xs font-medium">{formatBRL(totalReceitas)}</td>
                      <td className="px-4 py-3 text-right text-gray-300 text-xs hidden md:table-cell">{formatBRL(totalPago)}</td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold hidden sm:table-cell ${totalBV >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatBRL(totalBV)}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`text-xs border rounded px-2 py-0.5 whitespace-nowrap ${STATUS_COLORS[o.status]}`}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                            className="p-2 rounded text-muted hover:text-white hover:bg-white/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/pre-eventos/orcamentos/${o.id}`)}
                            className="p-2 rounded text-muted hover:text-accent hover:bg-accent/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(o.id, `${o.instituicao} ${o.turma}`)}
                            className="p-2 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-muted text-xs text-right">
        {filtered.length} de {orcamentos.length} orçamento(s)
      </p>
    </div>
  )
}
