import type { TipoEscola } from '../types'

export interface DefinicaoSecao {
  numero: string
  nome: string
}

const SECOES_FUNDAMENTAL_MEDIO: DefinicaoSecao[] = [
  { numero: '2.1', nome: 'CUSTO PRODUÇÃO' },
  { numero: '2.2', nome: 'CUSTO ARTÍSTICO' },
  { numero: '2.3', nome: 'CUSTO EQUIPE' },
  { numero: '2.4', nome: 'CUSTO BAR & FOOD E OUTROS' },
  { numero: '2.5', nome: 'CUSTO CERIMÔNIA RELIGIOSA' },
  { numero: '2.6', nome: 'CUSTO COLAÇÃO DE GRAU' },
  { numero: '2.7', nome: 'CUSTOS ADMINISTRATIVOS' },
]

const SECOES_SUPERIOR: DefinicaoSecao[] = [
  { numero: '2.1', nome: 'CUSTO PRODUÇÃO' },
  { numero: '2.2', nome: 'CUSTO ARTÍSTICO' },
  { numero: '2.3', nome: 'CUSTO EQUIPE' },
  { numero: '2.4', nome: 'CUSTO BAR & FOOD E OUTROS' },
  { numero: '2.5', nome: 'CUSTO PRÉ-EVENTOS' },
  { numero: '2.6', nome: 'CUSTO CERIMÔNIA RELIGIOSA' },
  { numero: '2.7', nome: 'CUSTO COLAÇÃO DE GRAU' },
  { numero: '2.8', nome: 'CUSTOS ADMINISTRATIVOS' },
]

export function getSecoesPorTipo(tipo: TipoEscola): DefinicaoSecao[] {
  if (tipo === 'SUPERIOR') return SECOES_SUPERIOR
  return SECOES_FUNDAMENTAL_MEDIO
}

export function getNomeSecao(numero: string, tipo: TipoEscola): string {
  const secoes = getSecoesPorTipo(tipo)
  return secoes.find((s) => s.numero === numero)?.nome ?? numero
}
