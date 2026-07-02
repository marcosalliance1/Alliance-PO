import React from 'react'
import { RefreshCw } from 'lucide-react'
import type { CategoriaCusto, SimulacaoCategoriaBaseline } from '../../types'
import CampoMoeda from '../UI/CampoMoeda'

const LABELS_CATEGORIA: Record<CategoriaCusto, string> = {
  operacaoEstrutura: 'Operação / Estrutura',
  equipe: 'Equipe',
  atracao: 'Atração',
  abBebidas: 'A&B — Alimentos e Bebidas',
  extras: 'Extras',
}

const ORDEM_CATEGORIAS: CategoriaCusto[] = ['operacaoEstrutura', 'equipe', 'atracao', 'abBebidas', 'extras']

interface Props {
  baseline: SimulacaoCategoriaBaseline
  amostras: Record<CategoriaCusto, number>
  onChange: (categoria: CategoriaCusto, valor: number) => void
  onRecalcular: () => void
}

export const PainelBaseline: React.FC<Props> = ({ baseline, amostras, onChange, onRecalcular }) => {
  const inputCls = 'bg-surface border border-bordercol rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent w-full'
  const labelCls = 'block text-xs text-muted mb-1'

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">Custo Base (por categoria)</h2>
        <button
          onClick={onRecalcular}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          title="Recalcular todos os campos a partir da média histórica"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Recalcular da média
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ORDEM_CATEGORIAS.map((cat) => (
          <div key={cat}>
            <label className={labelCls}>{LABELS_CATEGORIA[cat]}</label>
            <CampoMoeda
              value={baseline[cat]}
              onChange={(v) => onChange(cat, v)}
              className={inputCls}
            />
            <p className="text-muted text-[10px] mt-1">
              {amostras[cat] > 0
                ? `baseado em ${amostras[cat]} evento${amostras[cat] !== 1 ? 's' : ''}`
                : 'sem histórico — ajuste manualmente'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
