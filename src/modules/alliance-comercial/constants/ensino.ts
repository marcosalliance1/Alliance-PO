import type { TipoEscola } from '../../../types'

export const ENSINO_LABEL: Record<TipoEscola, string> = {
  SUPERIOR: 'Superior',
  MEDIO: 'Médio',
  FUNDAMENTAL: 'Fundamental',
}

export const ENSINO_ORDEM: TipoEscola[] = ['SUPERIOR', 'MEDIO', 'FUNDAMENTAL']

// Paleta categórica validada para o fundo escuro do app (dataviz skill: blue/green/magenta,
// ordem fixa — a ordem é o que garante a separação em daltonismo, não é só estética).
export const ENSINO_COLOR: Record<TipoEscola, string> = {
  SUPERIOR: '#3987e5',
  MEDIO: '#008300',
  FUNDAMENTAL: '#d55181',
}
