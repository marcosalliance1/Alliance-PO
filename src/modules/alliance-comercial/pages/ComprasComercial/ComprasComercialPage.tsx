import { useState } from 'react'
import { ClipboardList, BarChart2, GitCompare } from 'lucide-react'
import Lancamentos from './Lancamentos'
import DashboardCompras from './DashboardCompras'
import ConciliacaoComercial from './ConciliacaoComercial'

const ABAS = [
  { id: 'lancamentos', label: 'Lançamentos', Icon: ClipboardList },
  { id: 'dashboard',   label: 'Dashboard',    Icon: BarChart2 },
  { id: 'conciliacao', label: 'Conciliação Comercial', Icon: GitCompare },
] as const
type AbaId = typeof ABAS[number]['id']

export default function ComprasComercialPage() {
  const [aba, setAba] = useState<AbaId>('lancamentos')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-text-main font-bold text-xl">Compras Comercial</h1>
        <p className="text-text-muted text-sm mt-1">Controle dos gastos no cartão de crédito da empresa para apropriação no ERP financeiro.</p>
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {ABAS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              aba === id
                ? 'text-primary border-primary'
                : 'text-text-muted border-transparent hover:text-text-main'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {aba === 'lancamentos' && <Lancamentos />}
      {aba === 'dashboard'   && <DashboardCompras />}
      {aba === 'conciliacao' && <ConciliacaoComercial />}
    </div>
  )
}
