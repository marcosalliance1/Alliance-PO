export type EventType =
  | 'FESTA_INTEGRACAO'
  | 'FESTA_START'
  | 'FESTA_1_6'
  | 'FESTA_FIM_CICLO_BASICO'
  | 'FESTA_MEIO_CURSO'
  | 'VIAGEM_MEIO_CURSO'
  | 'FESTA_PRE_INTERNATO'
  | 'FESTA_X_DIAS'

export type OrcamentoStatus = 'RASCUNHO' | 'EM_ANDAMENTO' | 'CONCLUIDO'
export type ItemStatus = 'PENDENTE' | 'CONTRATADO' | 'PAGO'

export interface NotaFiscal {
  nome: string
  tipo: string
  dados: string   // base64
  tamanho: number // bytes
}

export interface ItemOrcamento {
  id: string
  item: string
  fornecedor: string
  qtde: number
  custoUnitario: number
  totalOrcado: number
  totalPagoReal: number
  valorPassadoCliente: number
  bvAbsoluto: number
  bvPercentual: number
  status: ItemStatus
  dataPagamento?: string | null
  notas: string
  automatico: boolean
  fixo: boolean
  grupo?: string          // ex: 'Time Alliance' → aparece agrupado
  notaFiscal?: NotaFiscal
}

export interface SymplaLote {
  id: string
  nome: string
  qtde: number
  valorUnitario: number
  total: number
}

export interface DocumentoCotacao {
  nome: string
  url: string
  tamanho: number
  tipo: string
}

export interface Cotacao {
  id: string
  categoria: string
  fornecedor: string
  valor: number
  notas: string
  documentos?: DocumentoCotacao[]
}

export interface Orcamento {
  id: string
  tipo: EventType
  instituicao: string
  turma: string
  data: string
  quantidadeConvidados: number
  status: OrcamentoStatus
  criadoEm: string
  atualizadoEm: string
  bolsaFolia: number
  receitasSympla: SymplaLote[]
  operacaoEstrutura: ItemOrcamento[]
  equipe: ItemOrcamento[]
  atracao: ItemOrcamento[]
  abBebidas: ItemOrcamento[]
  extras: ItemOrcamento[]
  cotacoes?: Cotacao[]
}

// ─── Config Automações ───────────────────────────────────────────────────────

export interface LinhaTabelaQtde {
  convidados: number
  quantidade: number
}

export interface EquipeEventoConfig {
  cargo: string
  qtde: number
  valor: number
}

export type TipoEvento = 'PRE-EVENTO' | 'PEQUENO BAILE' | 'GRANDE BAILE' | 'MICRO EVENTO'

export interface ConfiguracaoAutomacoes {
  seguranca: LinhaTabelaQtde[]
  custoSeguranca: number
  brigadista: LinhaTabelaQtde[]
  custoBrigadista: number
  limpeza: LinhaTabelaQtde[]
  custoLimpeza: number
  custoCarregador: number
  hostess: LinhaTabelaQtde[]
  custoHostess: number
  equipeEvento: Record<TipoEvento, EquipeEventoConfig[]>
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface ResumoOrcamento {
  id: string
  nome: string
  tipo: EventType
  totalOrcado: number
  totalPago: number
  totalReceitas: number
  totalBV: number
  status: OrcamentoStatus
}
