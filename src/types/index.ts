export type TipoEscola = 'FUNDAMENTAL' | 'MEDIO' | 'SUPERIOR'

export interface DivergenciaDetalhe {
  coluna: string
  qtde: number
  unitario: number
  totalPlanilha: number
  totalCalculado: number
}

export type StatusItem = 'orçar' | 'orçando' | 'estimado' | 'fechado' | 'N/A'

export type TipoCusto = 'Custo Fixo' | 'Custo Variável'

export type StatusPagamento = 'N/A' | 'em aberto' | 'parcial' | 'pago'

export interface ItemCusto {
  id: string
  codigo: string
  area: string
  subcategoria: string
  item: string
  fornecedor: string
  tipoCusto: TipoCusto
  moscow: string

  qtdeVendida: number
  valorUnitarioAtual: number
  totalAtual: number
  valorProjetado: number
  totalProjetado: number

  qtdeOrcada: number
  valorUnitarioOrcado: number
  valorOrcado: number

  qtdeContratada: number
  valorUnitarioContratado: number
  valorContratado: number

  responsavel: string
  status: StatusItem
  statusPagamento: StatusPagamento
  valorFinal: number
  valorPago: number
  faltaPagar: number
  totalProgramado: number
  emAberto: number

  jotform: string[]

  divergenciaTotais?: boolean
  divergenciaDetalhe?: DivergenciaDetalhe[]
}

export interface SecaoCusto {
  id: string
  numero: string
  nome: string
  itens: ItemCusto[]
}

export interface TAP {
  instituicao: string
  curso: string
  turma: string
  tipoEscola: TipoEscola
  anoOrcamento: number
  anoRealizacao: number
  modeloContrato: string
  qtdFormandos: number
  pacoteBase: string
  adesoesPrevistas: number
  qtdConvidadosBaile: number
  qtdConvidadosPosBaile: number
  ipca: number
  parcelas: number
  tempoContrato: string
  tempoDeFesta: string
  pacotes: { nome: string; valor: number }[]
  dataEvento: string
  local: string
}

export interface ReceitaLinha {
  vendido: number
  orcado: number
  contratado: number
  pago: number
  faltaPagar: number
}

export type Receitas = Record<string, ReceitaLinha>

export interface LinhaEverest {
  secaoId: string
  secaoNome: string
  valorEverest: number
  observacao: string
}

export interface ConciliacaoEverest {
  linhas: LinhaEverest[]
  observacaoGeral: string
}

export interface CustoAdicional {
  id: string
  descricao: string
  vendido: number
  orcado: number
  contratado: number
  pago: number
}

export interface LinhaResumoComercial {
  descricao: string       // "FEE Alliance", "Imposto FEE", "(CC) Custo Cerimonial", etc.
  valorComercial: number  // "Valor Previsto Comercial"
  valorProducao: number   // "Valor Previsto Produção"
  percentual: number      // "%" — normalizado pra escala 0–100 (13.07, não 0.1307)
  valorReal: number       // "Valor real"
}

// ─── Info do Evento (operacional) ─────────────────────────────────────────────
// Espelha o mesmo modelo do módulo pré-eventos (src/modules/pre-eventos/types) —
// copiado, não reinventado, pra manter os dois em sincronia.
export interface NotaFiscal {
  nome: string
  tipo: string
  dados: string   // base64
  tamanho: number // bytes
}

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

export interface Projeto {
  id: string
  tap: TAP
  secoes: SecaoCusto[]
  receitas: Receitas
  custosAdicionais?: CustoAdicional[]
  conciliacaoEverest?: ConciliacaoEverest
  resumoComercial?: LinhaResumoComercial[]
  infoEvento?: InfoEvento
  criadoEm: string
  atualizadoEm: string
  importadoDe?: string
  sheetsUrl?: string
  sheetLayout?: 'A' | 'B'
  status: 'em_andamento' | 'realizado'
  totalConvidadosAtual?: number
  totalAdesoesAtual?: number
}

export interface LineupItemEvento {
  horario: string
  artista: string
  obs: string
}

export interface EventoOperacional {
  id: string
  tabName: string
  turma: string
  nomeEvento: string
  tipo: string
  dataStr: string
  dataIso: string | null
  diaSemana: string
  local: string
  horario: string
  tematica: string
  totalConvidados: string
  dataAdimplencia: string
  vendaDeConvite: string
  linkVenda: string | null
  lineup: LineupItemEvento[]
  isRealizado: boolean
  sincronizadoEm: string
}

export interface ItemCatalogo {
  id: string
  codigo: string
  area: string
  subcategoria: string
  item: string
  fornecedorPadrao: string
  tipoCusto: TipoCusto
  valorUnitarioReferencia: number
  secaoAplicavel: string[]
  tiposEscolaAplicavel: TipoEscola[]
  ativo: boolean
}

export interface ConfiguracaoGlobal {
  ipcaPadrao: number
  fornecedoresFavoritos: string[]
}

export interface TotaisSecao {
  totalVendido: number
  totalProjetado: number
  totalOrcado: number
  totalContratado: number
  totalPago: number
  totalFaltaPagar: number
  custoPorFormandoVendido: number
  custoPorFormandoOrcado: number
  custoPorFormandoContratado: number
}

export interface ResumoLinhaReceita {
  descricao: string
  vendido: number
  orcado: number
  contratado: number
  pago: number
  faltaPagar: number
}

export interface ResumoProjeto {
  receitas: ResumoLinhaReceita[]
  receitaBaile: ResumoLinhaReceita
  custos: { secaoId: string; nome: string; vendido: number; projetado: number; orcado: number; contratado: number; pago: number; faltaPagar: number }[]
  custoTotal: { vendido: number; projetado: number; orcado: number; contratado: number; pago: number; faltaPagar: number }
  margem: { vendido: number; orcado: number; contratado: number; pago: number; faltaPagar: number }
}
