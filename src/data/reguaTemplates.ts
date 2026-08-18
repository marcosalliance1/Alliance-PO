// Templates de régua (cronograma de pré-evento), transcritos da planilha-modelo da
// Julia. Cada tarefa tem `dias` = dias em relação ao evento (positivo = antes,
// negativo = depois). A data prevista é calculada na hora: data do evento − dias.
// Os status válidos batem com a planilha.

export const STATUS_REGUA = ['Pendente', 'A iniciar', 'Em andamento', 'Concluído', 'Cancelado'] as const
export type StatusRegua = typeof STATUS_REGUA[number]

// Time Alliance (responsáveis). Marcos complementa depois.
export const RESPONSAVEIS_ALLIANCE = ['Julia Soares', 'Luna Amorim', 'Pedro Peixoto', 'Bernardo Colen'] as const

export interface TarefaTemplate {
  tarefa: string
  momento: string
  dias: number
}

export type ReguaTipo = 'padrao_90d' | 'meio_medico'

// ── Régua padrão ~90 dias (pré-eventos menores) ──────────────────────────────
export const REGUA_PADRAO_90D: TarefaTemplate[] = [
  { tarefa: 'Reunião de briefing', momento: '90 dias antes', dias: 90 },
  { tarefa: 'Definir data do evento', momento: '80 dias antes', dias: 75 },
  { tarefa: 'Reunião de conceituação', momento: '75 dias antes', dias: 75 },
  { tarefa: 'Envio da planilha financeira', momento: '75 dias antes', dias: 75 },
  { tarefa: 'Fechar / definir o local', momento: '75 dias antes', dias: 75 },
  { tarefa: 'Alinhamento com fotografia e vídeo', momento: '75 dias antes', dias: 75 },
  { tarefa: 'Definir se a turma terá produtos', momento: '75 dias antes', dias: 75 },
  { tarefa: 'Fechar identidade visual', momento: '65 dias antes', dias: 65 },
  { tarefa: 'Planejamento de marketing finalizado', momento: '65 dias antes', dias: 65 },
  { tarefa: 'Fechar buffet', momento: '60 dias antes', dias: 60 },
  { tarefa: 'Fechar bar', momento: '60 dias antes', dias: 60 },
  { tarefa: 'Estabelecer data-limite de adesão (mín. 30 dias antes do evento)', momento: '60 dias antes', dias: 60 },
  { tarefa: 'Início do planejamento de vendas', momento: '50 dias antes', dias: 50 },
  { tarefa: 'Definir cenografia', momento: '40 dias antes', dias: 40 },
  { tarefa: 'Definir experiência / ativações', momento: '40 dias antes', dias: 40 },
  { tarefa: 'Definir line-up', momento: '40 dias antes', dias: 40 },
  { tarefa: 'Encerramento das vendas', momento: '10 dias antes', dias: 10 },
  { tarefa: 'Aditivo contratual', momento: '7 dias antes', dias: 7 },
  { tarefa: 'Pente-fino financeiro', momento: '7 dias antes', dias: 7 },
  { tarefa: 'Envio dos convites', momento: '7 dias antes', dias: 7 },
  { tarefa: 'Escala Team Alliance', momento: '3 a 5 dias antes', dias: 5 },
  { tarefa: 'Checklist final do evento', momento: '3 dias antes', dias: 3 },
  { tarefa: 'Realização do evento', momento: 'Dia do evento', dias: 0 },
  { tarefa: 'Reunião de fechamento financeiro (receitas, despesas, saldo, pendências, fornecedores)', momento: 'até 30 dias depois', dias: -30 },
]

// ── Régua Meio Médico (Meio Curso) — cronograma próprio ───────────────────────
export const REGUA_MEIO_MEDICO: TarefaTemplate[] = [
  { tarefa: 'Definir data do evento', momento: '180 dias antes', dias: 180 },
  { tarefa: 'Definir identidade visual (marketing)', momento: '85 dias antes', dias: 85 },
  { tarefa: 'Verificar produtos: turma vai querer? Se sim, quais', momento: '85 dias antes', dias: 85 },
  { tarefa: 'Definir conceituação, local e data', momento: '80 dias antes', dias: 80 },
  { tarefa: 'Estabelecer data-limite de adesão ao evento (formandos que vão participar)', momento: '75 dias antes', dias: 75 },
  { tarefa: 'Montar planilha base (financeira / operacional)', momento: '75 dias antes', dias: 75 },
  { tarefa: 'Elaborar planejamento de marketing: posts, stories, estratégias de venda', momento: '70 dias antes', dias: 70 },
  { tarefa: 'Solicitar orçamentos de bar e buffet', momento: '70 dias antes', dias: 70 },
  { tarefa: 'Finalizar projeto cenográfico', momento: '65 dias antes', dias: 65 },
  { tarefa: 'Levantar orçamento da cenografia', momento: '65 dias antes', dias: 65 },
  { tarefa: 'Definir opções de line-up', momento: '60 dias antes', dias: 60 },
  { tarefa: 'Definir opções de extras (atrações adicionais, ativações, etc.)', momento: '60 dias antes', dias: 60 },
  { tarefa: 'Planejamento de vendas: ingressos, lotes, valores, datas', momento: '55 dias antes', dias: 55 },
  { tarefa: 'Abertura da venda de convites', momento: '50 dias antes', dias: 50 },
  { tarefa: 'Fechamento do line-up', momento: '45 dias antes', dias: 45 },
  { tarefa: 'Contratação de fornecedores com base no número de convidados atuais', momento: '40 dias antes', dias: 40 },
  { tarefa: 'Alinhamento com fotografia / vídeo', momento: '40 dias antes', dias: 40 },
  { tarefa: 'Atualização constante da planilha do evento conforme as vendas', momento: '35 dias antes', dias: 35 },
  { tarefa: 'Ajustes na planilha / produtos conforme verba disponível', momento: '30 dias antes', dias: 30 },
  { tarefa: 'Eventuais aditivos contratuais com fornecedores', momento: '25 dias antes', dias: 25 },
  { tarefa: 'Aprovação e início da produção da cenografia', momento: '25 dias antes', dias: 25 },
  { tarefa: 'Validar plano de comunicação final', momento: '20 dias antes', dias: 20 },
  { tarefa: 'Pente-fino financeiro', momento: '15 dias antes', dias: 15 },
  { tarefa: 'Contratação de extras (atrações adicionais, ativações de marca, brindes)', momento: '15 dias antes', dias: 15 },
  { tarefa: 'Envio dos produtos para a comissão (se aplicável)', momento: '12 dias antes', dias: 12 },
  { tarefa: 'Reunião de produção final com equipe interna e comissão', momento: '10 dias antes', dias: 10 },
  { tarefa: 'Encerramento oficial das vendas de ingressos', momento: '10 dias antes', dias: 10 },
  { tarefa: 'Confirmar com todos os fornecedores o número de convidados', momento: '7 dias antes', dias: 7 },
  { tarefa: 'Escala time Alliance', momento: '5 dias antes', dias: 5 },
  { tarefa: 'Checklist final do evento', momento: '3 dias antes', dias: 3 },
  { tarefa: 'Realização do evento', momento: 'Dia do evento', dias: 0 },
]

export const TEMPLATES_REGUA: Record<ReguaTipo, { nome: string; tarefas: TarefaTemplate[] }> = {
  padrao_90d:  { nome: 'Régua padrão ~90 dias', tarefas: REGUA_PADRAO_90D },
  meio_medico: { nome: 'Régua Meio Médico',     tarefas: REGUA_MEIO_MEDICO },
}

// Mapeia o tipo do pré-evento (orçamento) para o template de régua.
// Meio Curso usa a régua Meio Médico; os demais pré-eventos, a padrão ~90d.
// Baile (evento principal) e Trote entram quando tiverem template próprio.
export function templateParaTipo(tipoPreEvento: string): ReguaTipo {
  const t = (tipoPreEvento ?? '').toUpperCase()
  if (t.includes('MEIO_CURSO') || t.includes('MEIO CURSO') || t.includes('MEIO_MEDICO')) return 'meio_medico'
  return 'padrao_90d'
}
