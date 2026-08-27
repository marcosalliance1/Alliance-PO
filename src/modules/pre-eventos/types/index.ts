export type EventType =
  | 'FESTA_INTEGRACAO'
  | 'TROTE_ALLIANCE'
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

// ─── Info do Evento (operacional) ─────────────────────────────────────────────
// Criada/editada no próprio sistema (salva no orçamento). A leitura da planilha
// "Operacional" do Drive é só migração dos eventos passados pra cá.
export type FornecedorStatus = 'aberto' | 'aguardando' | 'fechado'
export interface InfoEventoFornecedor {
  categoria: string
  fornecedor: string
  status?: FornecedorStatus // 3 estados (aberto | aguardando assinatura | fechado)
  fechado?: boolean         // legado — dados antigos; ler via statusFornecedor()
}
// Deriva o status novo, cobrindo dados antigos que só tinham `fechado`.
export function statusFornecedor(f: InfoEventoFornecedor): FornecedorStatus {
  return f.status ?? (f.fechado ? 'fechado' : 'aberto')
}
export interface InfoEventoLineup {
  atracao: string
  horarioInicio: string   // "23:00"
  horarioTermino: string  // "00:30"
  status?: FornecedorStatus
  rider?: NotaFiscal       // arquivo do rider anexado
  // legado (dados antigos): ler via lineupView()
  artista?: string
  horario?: string
  obs?: string
}

// Normaliza um item de lineup, cobrindo dados antigos (artista/horario texto).
export function lineupView(l: InfoEventoLineup): { atracao: string; inicio: string; termino: string; status: FornecedorStatus } {
  const atracao = l.atracao || l.artista || ''
  let inicio = l.horarioInicio || ''
  let termino = l.horarioTermino || ''
  if (!inicio && !termino && l.horario) {
    const m = l.horario.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/)
    if (m) { inicio = m[1]; termino = m[2] }
    else { const m2 = l.horario.match(/(\d{1,2}:\d{2})/); if (m2) inicio = m2[1] }
  }
  return { atracao, inicio, termino, status: l.status ?? 'aberto' }
}
export interface InfoEvento {
  nomeEvento: string
  tipo: string
  data: string
  diaSemana: string
  local: string
  horario: string
  tematica: string
  totalConvidados: string
  formandos: string
  pagantes: string
  bolsaFolia: string
  dataAdimplencia: string
  vendaDeConvite: string
  fornecedores: InfoEventoFornecedor[]
  lineup: InfoEventoLineup[]
  linkVenda: string | null
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
  atualizadoPor?: string // nome de quem salvou por último (autoria)
  bolsaFolia: number
  receitasSympla: SymplaLote[]
  plataformasVenda?: string[] // por onde os ingressos são vendidos (Sympla, PIX, …) — múltiplo
  operacaoEstrutura: ItemOrcamento[]
  equipe: ItemOrcamento[]
  atracao: ItemOrcamento[]
  abBebidas: ItemOrcamento[]
  extras: ItemOrcamento[]
  cotacoes?: Cotacao[]
  infoEvento?: InfoEvento   // dados operacionais do evento, editáveis no sistema
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

// ─── Simulador ───────────────────────────────────────────────────────────────

export type CategoriaCusto = 'operacaoEstrutura' | 'equipe' | 'atracao' | 'abBebidas' | 'extras'
export type SimulacaoCategoriaBaseline = Record<CategoriaCusto, number>

export interface Simulacao {
  id: string
  nome: string
  tipoEvento: EventType | ''
  quantidadeConvidados: number
  notas: string
  bolsaFolia: number
  loteIngressos: SymplaLote[]
  numeroLotesEscala: number
  baseline: SimulacaoCategoriaBaseline
  criadoEm: string
  atualizadoEm: string
}
