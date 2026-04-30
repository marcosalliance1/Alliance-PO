export type TipoEscola = 'FUNDAMENTAL' | 'MEDIO' | 'SUPERIOR'

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
}

export interface Receitas {
  faturamentoAdesoes: ReceitaLinha
  vendasConvitesExtras: ReceitaLinha
  vendasMesasExtras: ReceitaLinha
  arrecadacaoExtra: ReceitaLinha
  receitaVendasBaile: ReceitaLinha
  outros: ReceitaLinha
  receitaRescisoes: ReceitaLinha
}

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

export interface Projeto {
  id: string
  tap: TAP
  secoes: SecaoCusto[]
  receitas: Receitas
  conciliacaoEverest?: ConciliacaoEverest
  criadoEm: string
  atualizadoEm: string
  importadoDe?: string
  sheetsUrl?: string
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
