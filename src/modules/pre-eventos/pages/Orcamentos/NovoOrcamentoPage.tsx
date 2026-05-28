import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../contexts/AppContext'
import { criarOrcamentoVazio } from '../../hooks/useOrcamentos'
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '../../data/defaults'
import type { EventType } from '../../types'

export const NovoOrcamentoPage: React.FC = () => {
  const navigate = useNavigate()
  const { salvarOrcamento, addToast, config } = useAppContext()
  const [tipo, setTipo] = useState<EventType>('FESTA_INTEGRACAO')

  function handleCriar() {
    const orc = criarOrcamentoVazio(tipo, config)
    salvarOrcamento(orc)
    addToast('Orçamento criado!', 'success')
    navigate(`/pre-eventos/orcamentos/${orc.id}`)
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-surface-2 border border-bordercol rounded-card p-8">
        <h2 className="text-white font-bold text-xl mb-2">Novo Orçamento</h2>
        <p className="text-muted text-sm mb-6">Selecione o tipo de pré-evento para começar.</p>

        <label className="block mb-2 text-sm text-muted">Tipo de Evento</label>
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value as EventType)}
          className="w-full bg-surface border border-bordercol rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-accent transition-colors mb-6"
        >
          {EVENT_TYPES.map(t => (
            <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/pre-eventos/orcamentos')}
            className="flex-1 py-2.5 rounded-lg border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCriar}
            className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white font-semibold text-sm transition-colors"
          >
            Criar Orçamento
          </button>
        </div>
      </div>
    </div>
  )
}
