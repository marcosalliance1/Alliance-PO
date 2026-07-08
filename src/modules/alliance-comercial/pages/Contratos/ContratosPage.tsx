import { useState } from 'react'
import { FilePlus, FileText } from 'lucide-react'
import NovoContrato from './NovoContrato'
import ContratosGerados from './ContratosGerados'

const ABAS = [
  { id: 'novo',    label: 'Novo Contrato',    Icon: FilePlus },
  { id: 'gerados', label: 'Contratos Gerados', Icon: FileText },
] as const
type AbaId = typeof ABAS[number]['id']

export default function ContratosPage() {
  const [aba, setAba] = useState<AbaId>('novo')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-text-main font-bold text-xl">Contratos</h1>
        <p className="text-text-muted text-sm mt-1">Geração de Termo de Adesão e Contrato de Comissão.</p>
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

      {aba === 'novo'    && <NovoContrato onGerado={() => setAba('gerados')} />}
      {aba === 'gerados' && <ContratosGerados />}
    </div>
  )
}
