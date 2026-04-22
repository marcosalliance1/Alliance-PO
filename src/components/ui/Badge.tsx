import type { StatusItem, TipoEscola } from '../../types'

const STATUS_CLASSES: Record<StatusItem, string> = {
  'orçar': 'bg-gray-100 text-gray-600',
  'orçando': 'bg-yellow-100 text-yellow-700',
  'estimado': 'bg-blue-100 text-blue-700',
  'fechado': 'bg-green-100 text-green-700',
  'N/A': 'bg-gray-50 text-gray-400',
}

const ESCOLA_CLASSES: Record<TipoEscola, string> = {
  FUNDAMENTAL: 'bg-purple-100 text-purple-700',
  MEDIO: 'bg-blue-100 text-blue-700',
  SUPERIOR: 'bg-orange-100 text-orange-700',
}

const ESCOLA_LABELS: Record<TipoEscola, string> = {
  FUNDAMENTAL: 'Fundamental',
  MEDIO: 'Médio',
  SUPERIOR: 'Superior',
}

interface BadgeStatusProps {
  status: StatusItem
}

export function BadgeStatus({ status }: BadgeStatusProps) {
  if (status === 'N/A') return null
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {status}
    </span>
  )
}

interface BadgeEscolaProps {
  tipo: TipoEscola
}

export function BadgeEscola({ tipo }: BadgeEscolaProps) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ESCOLA_CLASSES[tipo]}`}>
      {ESCOLA_LABELS[tipo]}
    </span>
  )
}
