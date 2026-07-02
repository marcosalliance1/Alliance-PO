import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Calculator } from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import { EVENT_TYPE_LABELS } from '../../data/defaults'
import { formatBRL } from '../../utils/formatters'
import { calcularCenarios } from '../../utils/simulador'

export const ListaSimuladorPage: React.FC = () => {
  const navigate = useNavigate()
  const { simulacoes, excluirSimulacao, confirm, addToast } = useAppContext()

  function handleDelete(id: string, nome: string) {
    confirm(`Deseja excluir a simulação "${nome || 'sem nome'}"? Esta ação não pode ser desfeita.`, () => {
      excluirSimulacao(id)
      addToast('Simulação excluída com sucesso.', 'success')
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1" />
        <button
          onClick={() => navigate('/pre-eventos/simulador/novo')}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shrink-0 min-h-[44px]"
        >
          <Plus className="w-4 h-4" /> Nova Simulação
        </button>
      </div>

      {simulacoes.length === 0 ? (
        <div className="bg-surface-2 border border-bordercol rounded-card p-12 text-center">
          <Calculator className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-white font-semibold">Nenhuma simulação cadastrada</p>
          <p className="text-muted text-sm mt-1">
            Crie uma simulação pra projetar o resultado financeiro de um evento antes de fechá-lo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {simulacoes.map((sim) => {
            const saldoSemVenda = calcularCenarios(sim.baseline, sim.bolsaFolia)[0].saldoMin
            return (
              <div key={sim.id} className="bg-surface-2 border border-bordercol rounded-card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-white font-semibold text-sm truncate">{sim.nome || 'Sem nome'}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => navigate(`/pre-eventos/simulador/${sim.id}`)}
                      className="text-muted hover:text-white transition-colors p-1"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sim.id, sim.nome)}
                      className="text-muted hover:text-danger transition-colors p-1"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-muted text-xs mb-3">
                  {sim.tipoEvento ? EVENT_TYPE_LABELS[sim.tipoEvento] : 'Média geral'}
                  {sim.quantidadeConvidados ? ` · ${sim.quantidadeConvidados} convidados` : ''}
                </p>
                <div className="flex items-center justify-between border-t border-bordercol/50 pt-3">
                  <span className="text-muted text-xs">Bolsa Folia</span>
                  <span className="text-white text-sm font-medium">{formatBRL(sim.bolsaFolia)}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-muted text-xs">Saldo (sem venda)</span>
                  <span className={`text-sm font-bold ${saldoSemVenda >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatBRL(saldoSemVenda)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
