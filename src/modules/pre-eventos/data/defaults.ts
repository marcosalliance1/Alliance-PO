import type {
  ConfiguracaoAutomacoes,
  TipoEvento,
  EventType,
} from '../types'

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  FESTA_INTEGRACAO:      'Festa de Integração',
  FESTA_START:           'Festa Start',
  FESTA_1_6:             'Festa 1/6',
  FESTA_FIM_CICLO_BASICO:'Festa Fim de Ciclo Básico',
  FESTA_MEIO_CURSO:      'Festa de Meio de Curso',
  VIAGEM_MEIO_CURSO:     'Viagem de Meio de Curso',
  FESTA_PRE_INTERNATO:   'Festa Pré-Internato',
  FESTA_X_DIAS:          'Festa X Dias',
}

export const EVENT_TYPES: EventType[] = [
  'FESTA_INTEGRACAO',
  'FESTA_START',
  'FESTA_1_6',
  'FESTA_FIM_CICLO_BASICO',
  'FESTA_MEIO_CURSO',
  'VIAGEM_MEIO_CURSO',
  'FESTA_PRE_INTERNATO',
  'FESTA_X_DIAS',
]

export function getEventCategory(tipo: EventType, qtde: number): TipoEvento | null {
  switch (tipo) {
    case 'FESTA_INTEGRACAO':
    case 'FESTA_START':
    case 'FESTA_1_6':
    case 'FESTA_FIM_CICLO_BASICO':
    case 'FESTA_PRE_INTERNATO':
    case 'FESTA_X_DIAS':
      return 'PRE-EVENTO'
    case 'FESTA_MEIO_CURSO':
      return qtde <= 200 ? 'PEQUENO BAILE' : 'GRANDE BAILE'
    case 'VIAGEM_MEIO_CURSO':
      return null
    default:
      return 'PRE-EVENTO'
  }
}

export const CONFIG_PADRAO: ConfiguracaoAutomacoes = {
  seguranca: [
    { convidados: 100, quantidade: 2 },
    { convidados: 200, quantidade: 3 },
    { convidados: 250, quantidade: 4 },
    { convidados: 300, quantidade: 4 },
    { convidados: 350, quantidade: 5 },
    { convidados: 400, quantidade: 6 },
  ],
  custoSeguranca: 300,

  brigadista: [
    { convidados: 100, quantidade: 1 },
    { convidados: 200, quantidade: 1 },
    { convidados: 250, quantidade: 1 },
    { convidados: 300, quantidade: 2 },
    { convidados: 350, quantidade: 2 },
    { convidados: 400, quantidade: 2 },
  ],
  custoBrigadista: 300,

  limpeza: [
    { convidados: 100, quantidade: 2 },
    { convidados: 200, quantidade: 4 },
    { convidados: 250, quantidade: 5 },
    { convidados: 300, quantidade: 6 },
    { convidados: 400, quantidade: 7 },
  ],
  custoLimpeza: 250,

  custoCarregador: 240,

  hostess: [
    { convidados: 100, quantidade: 1 },
    { convidados: 200, quantidade: 2 },
    { convidados: 250, quantidade: 2 },
    { convidados: 300, quantidade: 3 },
    { convidados: 400, quantidade: 3 },
  ],
  custoHostess: 160,

  equipeEvento: {
    'MICRO EVENTO': [
      { cargo: 'Produtor', qtde: 2, valor: 100 },
    ],
    'PRE-EVENTO': [
      { cargo: 'Produtor', qtde: 1, valor: 300 },
      { cargo: 'Assistente de Produção', qtde: 3, valor: 250 },
      { cargo: 'Diária Montagem/Desmontagem', qtde: 2, valor: 220 },
    ],
    'PEQUENO BAILE': [
      { cargo: 'Produtor', qtde: 1, valor: 350 },
      { cargo: 'Assistente de Produção', qtde: 3, valor: 300 },
      { cargo: 'Diária Montagem/Desmontagem', qtde: 2, valor: 220 },
    ],
    'GRANDE BAILE': [
      { cargo: 'Produtor', qtde: 2, valor: 400 },
      { cargo: 'Assistente de Produção', qtde: 3, valor: 350 },
      { cargo: 'Diária Montagem/Desmontagem', qtde: 2, valor: 220 },
    ],
  },
}

export const ITENS_OPERACAO_ESTRUTURA = [
  'Locação', 'Projeto', 'Legalização', 'Mobiliário',
  'Cenografia', 'Box Truss', 'Cênica', 'Eletricista', 'Palco/Rider',
]

export const ITENS_EQUIPE_FIXOS = [
  'Time Alliance', 'Segurança', 'Brigadista', 'Ambulância',
  'Limpeza', 'Limpeza Pré', 'Limpeza Pós', 'Estoquista',
  'Carregador', 'Hostess', 'VJ',
]

export const ITENS_AB = [
  'Bar de Drinks', 'Bartenders Extra', 'Soft Drinks', 'Chopp', 'Buffet', 'Custos Bebidas',
]

// Extras nasce vazio — o usuário adiciona linhas conforme precisa (ou o import
// do Drive cria as reais). Evita as linhas em branco de template que viravam lixo.
export const ITENS_EXTRAS: string[] = []
