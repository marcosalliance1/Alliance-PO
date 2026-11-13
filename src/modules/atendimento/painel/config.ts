// Configuração das abas do painel do Atendimento.
// Portado do "Painel Alliance" desenhado pela equipe de Atendimento (HTML + Apps Script):
// mesmos campos, opções e regras de "finalizado". A turma passa a ser a P.O. do PO V2.
// Fase 1: fora daqui ficam Sorteios & Rifas, Pagamento, Contratos, Régua e Relatórios.

export type TipoCampo =
  | 'text' | 'textarea' | 'select' | 'date' | 'number'
  | 'turma'        // seleciona a P.O. (ou "Geral")
  | 'image'        // anexo no bucket atendimento-anexos
  | 'calculated'   // calculado (só leitura)
  | 'memberList'   // lista de membros (comissão)

export type CorCampo = 'boolean' | 'category' | 'priority'

export interface Campo {
  key: string
  label: string
  type: TipoCampo
  options?: string[]
  cor?: CorCampo
  secao?: string           // título de seção dentro do formulário
  naTabela?: boolean       // false = só no formulário
}

export type Hub = 'geral' | 'turmas'

export interface Categoria {
  id: string
  label: string
  slug: string             // rota: /atendimento/<slug>
  hubs: Hub[]
  subtitulo: string
  campos: Campo[]
  campoStatus?: string     // espelha em atendimento_registros.status
  finalizados?: string[]   // valores do campoStatus que mandam a linha p/ "Finalizados"
  porAniversario?: boolean
  calendario?: boolean
  calculadora?: boolean
  fixavel?: boolean
  copiavel?: string        // campo cujo texto ganha botão "Copiar"
}

const SIM_NAO = ['Não', 'Sim']
const STATUS_SIMPLES = ['Pendente', 'Em andamento', 'Concluído']

export const CATEGORIAS: Categoria[] = [
  {
    id: 'demandas', label: 'Demandas', slug: 'demandas', hubs: ['geral', 'turmas'],
    subtitulo: 'Tarefas do dia por turma, com comentário, status e grau de prioridade.',
    campoStatus: 'status', finalizados: ['Finalizado', 'Ignorado'], fixavel: true,
    campos: [
      { key: 'prioridade', label: 'Prioridade', type: 'select', options: ['Urgente', 'Médio', 'Pouco'], cor: 'priority' },
      { key: 'tarefa', label: 'Tarefa', type: 'text' },
      { key: 'turma', label: 'Turma / Projeto', type: 'turma' },
      { key: 'comentario', label: 'Comentário sobre a demanda', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['Contato inicial feito', 'Aguardando', 'Fazendo', 'Finalizado', 'Ignorado'] },
    ],
  },
  {
    id: 'turmas', label: 'Turmas', slug: 'turmas', hubs: ['geral', 'turmas'],
    subtitulo: 'Perfil individual de cada turma, ligado à P.O. do projeto.',
    campoStatus: 'encerrada', finalizados: ['Sim'],
    campos: [
      { key: 'turma', label: 'Turma (P.O.)', type: 'turma' },
      { key: 'ano', label: 'Ano que forma', type: 'text' },
      { key: 'ensino', label: 'Ensino', type: 'select', options: ['Fundamental', 'Médio', 'Superior'], cor: 'category' },
      { key: 'quemAtende', label: 'Quem atende a turma', type: 'text' },
      { key: 'encerrada', label: 'Turma encerrada/finalizada?', type: 'select', options: SIM_NAO, cor: 'boolean' },
      { key: 'projetoNumero', label: 'Nº do projeto de formatura', type: 'text', secao: 'Perfil da turma', naTabela: false },
      { key: 'tipoTurma', label: 'Assessoria ou produção?', type: 'select', options: ['Assessoria', 'Produção'], cor: 'category' },
      { key: 'dataEvento', label: 'Data da formatura/evento', type: 'date' },
      { key: 'dataAssinatura', label: 'Data da assinatura', type: 'date', naTabela: false },
      { key: 'bateuMeta', label: 'Já bateu a meta?', type: 'select', options: SIM_NAO, cor: 'boolean' },
      { key: 'instagram', label: 'Instagram', type: 'text', naTabela: false },
      { key: 'identidadeVisual', label: 'Identidade visual', type: 'text', naTabela: false },
      { key: 'fotografia', label: 'Fotografia', type: 'text', naTabela: false },
      { key: 'comoAdquireFoto', label: 'Como adquire a foto', type: 'textarea', naTabela: false },
      { key: 'atualizacoes', label: 'Informações e atualizações da turma', type: 'textarea', secao: 'Informações e atualizações', naTabela: false },
      { key: 'comissao', label: 'Comissão de formatura', type: 'memberList', secao: 'Comissão de formatura' },
    ],
  },
  {
    id: 'rescisao', label: 'Rescisão', slug: 'rescisao', hubs: ['geral'],
    subtitulo: 'Processos de rescisão de contrato — anexe comprovantes e registre o aviso à comissão.',
    campoStatus: 'status', finalizados: ['Concluído'],
    campos: [
      { key: 'responsavelEquipe', label: 'Responsável (equipe)', type: 'text' },
      { key: 'formando', label: 'Formando', type: 'text' },
      { key: 'turma', label: 'Turma / Projeto', type: 'turma' },
      { key: 'dataSolicitacao', label: 'Data da solicitação', type: 'date' },
      { key: 'motivo', label: 'Motivo da rescisão', type: 'textarea' },
      { key: 'avisouComissao', label: 'Já avisou a comissão?', type: 'select', options: SIM_NAO, cor: 'boolean' },
      { key: 'anexo', label: 'Anexar imagem (termo, print, etc.)', type: 'image' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_SIMPLES },
    ],
  },
  {
    id: 'alteracaoplano', label: 'Alteração de Plano', slug: 'alteracao-plano', hubs: ['geral'],
    subtitulo: 'Mudanças de plano solicitadas pelas turmas — plano anterior e novo plano.',
    campoStatus: 'status', finalizados: ['Concluído'],
    campos: [
      { key: 'turma', label: 'Turma / Projeto', type: 'turma' },
      { key: 'formando', label: 'Formando', type: 'text' },   // não existia no painel original; a planilha tem
      { key: 'dataAlteracao', label: 'Data da alteração', type: 'date' },
      { key: 'planoAnterior', label: 'Plano anterior', type: 'text' },
      { key: 'planoNovo', label: 'Novo plano', type: 'text' },
      { key: 'responsavel', label: 'Responsável (equipe)', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_SIMPLES },
    ],
  },
  {
    id: 'calculoRescisao', label: 'Cálculo Rescisão', slug: 'calculo-rescisao', hubs: ['geral'],
    subtitulo: 'Calcule o valor a devolver com base no contrato e nas parcelas já pagas.',
    calculadora: true,
    campos: [
      { key: 'turma', label: 'Turma / Projeto', type: 'turma' },
      { key: 'formando', label: 'Formando', type: 'text' },
      { key: 'valorTotalContrato', label: 'Valor total do contrato (R$)', type: 'number' },
      { key: 'valorPago', label: 'Valor já pago (R$)', type: 'number' },
      { key: 'percentualMulta', label: 'Percentual retido / multa (%)', type: 'number' },
      { key: 'valorDevolver', label: 'Valor a devolver / a reter (calculado)', type: 'calculated' },
    ],
  },
  {
    id: 'achados', label: 'Achados & Perdidos', slug: 'achados', hubs: ['geral'],
    subtitulo: 'Itens encontrados em eventos e o processo de devolução ao dono.',
    campoStatus: 'retirou', finalizados: ['Sim'],
    campos: [
      { key: 'evento', label: 'Evento', type: 'text' },
      { key: 'turma', label: 'Turma', type: 'turma' },
      { key: 'data', label: 'Data', type: 'date' },
      { key: 'categoria', label: 'Categoria', type: 'select', options: ['Chapelaria', 'Solicitação de cliente', 'Achado'], cor: 'category' },
      { key: 'numero', label: 'Número', type: 'text', naTabela: false },
      { key: 'itemNome', label: 'Descrição do item', type: 'text', secao: 'Item encontrado' },
      { key: 'foto', label: 'Foto do produto', type: 'image' },
      { key: 'responsavelNome', label: 'Nome do responsável', type: 'text', secao: 'Informações de contato' },
      { key: 'telefone', label: 'Telefone', type: 'text', naTabela: false },
      { key: 'contatoFeito', label: 'Contato feito?', type: 'select', options: SIM_NAO, cor: 'boolean' },
      { key: 'retirou', label: 'Retirou?', type: 'select', options: SIM_NAO, cor: 'boolean' },
    ],
  },
  {
    id: 'aniversarios', label: 'Aniversários', slug: 'aniversarios', hubs: ['geral'],
    subtitulo: 'Aniversários dos formandos, listados em ordem.',
    porAniversario: true,
    campos: [
      { key: 'formando', label: 'Nome do formando', type: 'text' },
      { key: 'turma', label: 'Turma / Projeto', type: 'turma' },
      { key: 'aniversario', label: 'Dia do aniversário', type: 'date' },
    ],
  },
  {
    id: 'calendario', label: 'Calendário de Eventos', slug: 'calendario', hubs: ['geral', 'turmas'],
    // No painel original esta aba é a Google Agenda da equipe embutida (link salvo em
    // Configurações) — não tem cadastro próprio. O link fica em categoria 'config'.
    subtitulo: 'A Google Agenda da equipe, embutida no painel.',
    calendario: true,
    campos: [],
  },
  {
    id: 'eventos', label: 'Eventos', slug: 'eventos', hubs: ['turmas'],
    subtitulo: 'Detalhes de cada evento — local, horário, convidados e responsável.',
    campoStatus: 'status', finalizados: ['Concluído', 'Cancelado'],
    campos: [
      { key: 'turma', label: 'Turma / Projeto', type: 'turma' },
      { key: 'nomeEvento', label: 'Nome do evento', type: 'text' },
      { key: 'tipoEvento', label: 'Tipo de evento', type: 'select', cor: 'category',
        options: ['Baile de Formatura', 'Culto/Missa de Ação de Graças', 'Colação de Grau', 'Chá de Bar/Bá', 'Confraternização', 'Outro'] },
      { key: 'data', label: 'Data', type: 'date' },
      { key: 'horario', label: 'Horário', type: 'text' },
      { key: 'local', label: 'Local (nome e endereço)', type: 'textarea', naTabela: false },
      { key: 'numeroConvidados', label: 'Número de convidados', type: 'number' },
      { key: 'responsavel', label: 'Responsável (equipe)', type: 'text' },
      { key: 'observacoes', label: 'Observações', type: 'textarea', naTabela: false },
      { key: 'status', label: 'Status', type: 'select', options: ['Planejamento', 'Confirmado', 'Concluído', 'Cancelado'] },
    ],
  },
  {
    id: 'guias', label: 'Guias & Modelos', slug: 'guias', hubs: ['geral', 'turmas'],
    subtitulo: 'Passo a passo de processos prontos para usar.',
    copiavel: 'conteudo',
    campos: [
      { key: 'titulo', label: 'Título', type: 'text' },
      { key: 'categoria', label: 'Categoria', type: 'text' },
      { key: 'conteudo', label: 'Conteúdo / Passo a passo', type: 'textarea' },
    ],
  },
  {
    id: 'mensagens', label: 'Mensagens prontas', slug: 'mensagens', hubs: ['geral', 'turmas'],
    subtitulo: 'Textos padrão para copiar e colar no WhatsApp.',
    copiavel: 'mensagem',
    campos: [
      { key: 'tema', label: 'Tema', type: 'text' },
      { key: 'titulo', label: 'Título', type: 'text' },
      { key: 'mensagem', label: 'Mensagem', type: 'textarea' },
    ],
  },
]

export const HUB_LABEL: Record<Hub, string> = {
  geral: 'Atendimento Geral',
  turmas: 'Atendimento de Turmas',
}

export function categoriaPorSlug(slug: string | undefined): Categoria | undefined {
  return CATEGORIAS.find(c => c.slug === slug)
}

// ── Cores das tags (mesma regra do painel original) ───────────────────────────
const VERDE = 'bg-emerald-500/15 text-emerald-400'
const AMARELO = 'bg-amber-500/15 text-amber-400'
const VERMELHO = 'bg-primary/15 text-primary'
const CINZA = 'bg-white/5 text-text-muted'
const PALETA = [
  'bg-sky-500/15 text-sky-400', 'bg-violet-500/15 text-violet-400', 'bg-teal-500/15 text-teal-400',
  'bg-pink-500/15 text-pink-400', 'bg-indigo-500/15 text-indigo-400', 'bg-orange-500/15 text-orange-400',
  'bg-lime-500/15 text-lime-400', 'bg-cyan-500/15 text-cyan-400',
]

export function corTag(valor: string, campo?: Campo): string {
  const v = valor.trim().toLowerCase()
  if (campo?.cor === 'category') {
    const i = (campo.options ?? []).findIndex(o => o.toLowerCase() === v)
    return PALETA[(i < 0 ? 0 : i) % PALETA.length]
  }
  if (v === 'urgente' || v === 'fechada' || v === 'ignorado' || v === 'cancelado') return VERMELHO
  if (['sim', 'pago', 'concluído', 'finalizado', 'entregue', 'confirmado'].includes(v)) return VERDE
  if (['em andamento', 'pendente', 'agendado', 'médio', 'aguardando', 'fazendo', 'contato inicial feito', 'planejamento'].includes(v)) return AMARELO
  return CINZA
}

// Cálculo de rescisão — fórmula do painel original, sem alteração:
// valor a devolver = valor pago × (1 − multa%/100).
export function calcularDevolucao(valorPago: number, percentualMulta: number): number {
  return valorPago * (1 - percentualMulta / 100)
}
