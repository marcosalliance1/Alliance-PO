import { gerarDocumentoDocx } from './gerarDocumento'

// ─── Dados fixos da empresa ───────────────────────────────────────────────
// Atualize com os valores reais da Alliance antes de usar em produção.
// (razão social/CNPJ/endereço/telefone deixaram de ser placeholders no novo
// Termo de Adesão — agora estão fixos no texto do próprio template)
const EMPRESA = {
  portal: '',          // link do Portal do Aluno
  logoAssinatura: '',  // logo/assinatura da CONTRATADA no bloco de assinaturas
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function dataHojeExtenso(): string {
  const d = new Date()
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function gerarNumContrato(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const seq = Math.floor(Math.random() * 9000 + 1000)
  return `AC-${d.getFullYear()}${mes}-${seq}`
}

// converte 'YYYY-MM-DD' (formato de <input type="date"> / Supabase) para 'DD/MM/YYYY'
function dataBR(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// converte 'YYYY-MM-DD' para "DD de mês de YYYY"
function dataExtenso(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`
}

// valor com fallback em colchetes quando ausente
function valOrBracket(v: string | null | undefined, rotulo: string): string {
  return v && v.trim() ? v : `[${rotulo}]`
}

// soma N meses a uma data 'YYYY-MM-DD' (aritmética em UTC p/ evitar problema de fuso)
function adicionarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCMonth(dt.getUTCMonth() + meses)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// junta itens em lista por extenso: "a, b e c"
function listaExtenso(itens: string[]): string {
  if (itens.length === 0) return ''
  if (itens.length === 1) return itens[0]
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

// data de hoje em 'YYYY-MM-DD' (fuso local)
function hojeISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// soma N dias a uma data 'YYYY-MM-DD' (aritmética em UTC p/ evitar problema de fuso)
function adicionarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

interface Faixa {
  inicio: string
  fim: string
}

interface EscalaRetencao {
  prazoArrependimento: string
  faixas: Faixa[]
  faixaFinalInicio: string
}

// calcula o prazo de arrependimento (hoje + 90 dias) e as 6 faixas de
// retenção como blocos de 12 meses corridos a partir do fim do arrependimento.
// Os percentuais de cada faixa continuam vindo do cadastro do projeto
// (editáveis manualmente); apenas as datas são calculadas.
function calcularEscalaRetencao(): EscalaRetencao {
  const prazoArrependimento = adicionarDias(hojeISO(), 90)
  const faixas: Faixa[] = []
  let cursor = adicionarDias(prazoArrependimento, 1)
  for (let i = 0; i < 6; i++) {
    const inicio = cursor
    const fim = adicionarDias(adicionarMeses(inicio, 12), -1)
    faixas.push({ inicio, fim })
    cursor = adicionarDias(fim, 1)
  }
  return { prazoArrependimento, faixas, faixaFinalInicio: cursor }
}

// calcula as datas de vencimento das parcelas semestrais do Piso Fixo: a
// primeira é a própria data de assinatura do contrato, as seguintes a cada
// 6 meses, até completar o total de parcelas.
function datasParcelasSemestrais(dataAssinatura: string | null, qtdParcelas: number | null): string {
  if (!dataAssinatura || !qtdParcelas || qtdParcelas < 1) {
    return '[DATAS DE VENCIMENTO DAS PARCELAS]'
  }
  const datas: string[] = []
  for (let i = 0; i < qtdParcelas; i++) {
    datas.push(dataExtenso(adicionarMeses(dataAssinatura, i * 6)))
  }
  return listaExtenso(datas)
}

// formata número decimal como percentual pt-BR, ex: 0.95 → "0,95%"
function pct(n: number | null, casas: number): string {
  if (n == null) return ''
  return n.toFixed(casas).replace('.', ',') + '%'
}

const str = (v: number | null): string => (v != null ? String(v) : '')

// ─── Tipos exportados ─────────────────────────────────────────────────────

export interface ProjetoData {
  id: string
  nome: string
  instituicao: string
  turma: string | null
  semestre: string | null
  fee_percentual: number | null
  fee_percentual_extenso: string | null
  fee_valor_minimo: number | null
  fee_valor_minimo_extenso: string | null
  fee_parcelas: number | null
  fee_valor_parcela: number | null
  fee_valor_parcela_extenso: string | null
  fee_acrescimo_percentual: number | null
  fee_acrescimo_percentual_extenso: string | null
  formandos_minimo: number | null
  local_data_extenso: string | null
  vigencia_meses: number | null
  vigencia_meses_extenso: string | null
  retencao_faixa1_percentual: number | null
  retencao_faixa2_percentual: number | null
  retencao_faixa3_percentual: number | null
  retencao_faixa4_percentual: number | null
  retencao_faixa5_percentual: number | null
  retencao_faixa6_percentual: number | null
  valor_gatilho_irregularidade: number | null
  valor_gatilho_irregularidade_extenso: string | null
  data_assinatura: string | null
}

export interface PacoteData {
  id: string
  nome: string
  eventos_inclusos: string | null
  valor: number
  valor_extenso: string | null
  qtd_parcelas: number | null
  is_base: boolean
}

// ─── Utilitário de download ───────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Geração do Termo de Adesão ───────────────────────────────────────────

export async function gerarTermoAdesao(
  projeto: ProjetoData,
  pacotes: PacoteData[],
): Promise<Blob> {
  const listaPacotes = pacotes
    .map(p => {
      const valor = p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      const parcelas = p.qtd_parcelas ? ` (${p.qtd_parcelas}x)` : ''
      return `${p.nome} — R$ ${valor}${parcelas}`
    })
    .join('\n')

  const escala = calcularEscalaRetencao()

  const dados: Record<string, string> = {
    // ── Cliente/formando — sem cadastro individual no sistema, preenchimento manual ──
    'cliente.nome':                      '[NOME DO FORMANDO]',
    'cliente.cpf':                       '[CPF]',
    'cliente.end':                       '[ENDEREÇO COMPLETO]',
    'cliente.tel.cel':                   '[TELEFONE CELULAR]',
    'cliente.email':                     '[E-MAIL]',
    'cliente.inst':                      projeto.instituicao,
    'cliente.pacote':                    listaPacotes,
    'cliente.pacote.eventos':            '[EVENTOS CONFORME PACOTE ESCOLHIDO]',
    'cliente.pacote.valor':              '[VALOR DO PACOTE]',
    'cliente.pacote.valor.extenso':      '[VALOR DO PACOTE POR EXTENSO]',
    'cliente.adesao.parcelas.qt':        '[QTD DE PARCELAS]',
    'cliente.adesao.valor':              '[VALOR DA ADESÃO]',
    'cliente.adesao.valor.extenso':      '[VALOR DA ADESÃO POR EXTENSO]',
    'cliente.adesao.fopag':              '[FORMA DE PAGAMENTO]',
    'cliente.dia.pref.pag':              '[DIA PREFERENCIAL DE PAGAMENTO]',
    'cliente.dat.aceite.termos.extenso': '[DATA DO ACEITE]',
    'cliente.ip.aceite.termos':          '',
    'cliente.assinatura.aceite.termos.pq': '',
    'cliente.assinatura.aceite.termos':  '',

    // ── Responsável financeiro (facultativo) — preenchimento manual ──
    'financeiro.nome':        '[NOME DO RESPONSÁVEL FINANCEIRO]',
    'financeiro.cpf':         '[CPF DO RESPONSÁVEL FINANCEIRO]',
    'financeiro.end':         '[ENDEREÇO DO RESPONSÁVEL FINANCEIRO]',
    'financeiro.tel':         '[TELEFONE DO RESPONSÁVEL FINANCEIRO]',
    'financeiro.email':       '[E-MAIL DO RESPONSÁVEL FINANCEIRO]',
    'financeiro.assinatura':  '',

    // ── Projeto/contrato — dados reais do cadastro do projeto ──
    'contrato.num':      gerarNumContrato(),
    'contrato.semestre': projeto.semestre ?? '',
    'projeto.meta':       str(projeto.formandos_minimo),
    'projeto.turma.nome': projeto.turma ?? '',
    'projeto.data.apresentacao': '[DATA DE APRESENTAÇÃO DO PROJETO]',
    'empresa.portal':          EMPRESA.portal,
    'empresa.logo.assinatura': EMPRESA.logoAssinatura,

    // ── Prazo de arrependimento / vigência / escala de retenção (Cláusula 10) ──
    // Calculados em tempo real a partir da data de hoje (momento da geração):
    // arrependimento = hoje + 90 dias; as 6 faixas de retenção são blocos de
    // 12 meses corridos a partir do fim do arrependimento. Os percentuais de
    // cada faixa continuam vindo do cadastro do projeto (editáveis).
    'projeto.prazo.arrependimento': dataBR(escala.prazoArrependimento),
    'contrato.vigencia.meses': `${str(projeto.vigencia_meses)} (${projeto.vigencia_meses_extenso ?? ''})`,
    'contrato.vigencia.fator': projeto.vigencia_meses
      ? pct(100 / projeto.vigencia_meses, 4)
      : '',
    'retencao.faixa1.inicio':     dataBR(escala.faixas[0].inicio),
    'retencao.faixa1.fim':        dataBR(escala.faixas[0].fim),
    'retencao.faixa1.percentual': pct(projeto.retencao_faixa1_percentual, 2),
    'retencao.faixa2.inicio':     dataBR(escala.faixas[1].inicio),
    'retencao.faixa2.fim':        dataBR(escala.faixas[1].fim),
    'retencao.faixa2.percentual': pct(projeto.retencao_faixa2_percentual, 2),
    'retencao.faixa3.inicio':     dataBR(escala.faixas[2].inicio),
    'retencao.faixa3.fim':        dataBR(escala.faixas[2].fim),
    'retencao.faixa3.percentual': pct(projeto.retencao_faixa3_percentual, 2),
    'retencao.faixa4.inicio':     dataBR(escala.faixas[3].inicio),
    'retencao.faixa4.fim':        dataBR(escala.faixas[3].fim),
    'retencao.faixa4.percentual': pct(projeto.retencao_faixa4_percentual, 2),
    'retencao.faixa5.inicio':     dataBR(escala.faixas[4].inicio),
    'retencao.faixa5.fim':        dataBR(escala.faixas[4].fim),
    'retencao.faixa5.percentual': pct(projeto.retencao_faixa5_percentual, 2),
    'retencao.faixa6.inicio':     dataBR(escala.faixas[5].inicio),
    'retencao.faixa6.fim':        dataBR(escala.faixas[5].fim),
    'retencao.faixa6.percentual': pct(projeto.retencao_faixa6_percentual, 2),
    'retencao.faixaFinal.inicio': dataBR(escala.faixaFinalInicio),

    // ── Pacotes/parcelamento por nº de convites, arrecadação e adesão social ──
    // Sem fonte de dado ainda (não há cadastro por nº de convites/arrecadação/social) —
    // preenchimento manual até criarmos os campos correspondentes.
    'parcelas.qt':        '[QTD DE PARCELAS DO PACOTE]',
    'pacote5.parcela':    '[VALOR PARCELA — 5 CONVITES]',
    'pacote5.total':      '[VALOR TOTAL — 5 CONVITES]',
    'pacote10.parcela':   '[VALOR PARCELA — 10 CONVITES]',
    'pacote10.total':     '[VALOR TOTAL — 10 CONVITES]',
    'pacote15.parcela':   '[VALOR PARCELA — 15 CONVITES]',
    'pacote15.total':     '[VALOR TOTAL — 15 CONVITES]',
    'pacote20.parcela':   '[VALOR PARCELA — 20 CONVITES]',
    'pacote20.total':     '[VALOR TOTAL — 20 CONVITES]',
    'social.total':       '[VALOR TOTAL — ADESÃO SOCIAL]',
    'social.parcela':     '[VALOR PARCELA — ADESÃO SOCIAL]',
    'arrecadacao.qt':     '[QTD DE BOLETOS DE ARRECADAÇÃO]',
    'arrecadacao.valor':  '[VALOR DE CADA ARRECADAÇÃO]',
    'arrecadacao.total':  '[VALOR TOTAL DE ARRECADAÇÃO]',

    // ── Anexo-Orçamentário (verbas dos eventos) — sem fonte de dado ainda ──
    'verba.cerimonia':      '[VERBA CERIMÔNIA RELIGIOSA]',
    'verba.colacao':        '[VERBA COLAÇÃO DE GRAU]',
    'colacao.convites':     '[QTD CONVITES COLAÇÃO]',
    'colacao.convites.pf':  '[CONVITES POR FORMANDO — COLAÇÃO]',
    'jantar.horas':         '[HORAS DE EVENTO — JANTAR]',
    'jantar.convites':      '[QTD CONVITES — JANTAR]',
    'jantar.convites.pf':   '[CONVITES POR FORMANDO — JANTAR]',
    'jantar.buffet.pc':     '[VERBA BUFFET P/ CONVIDADO — JANTAR]',
    'jantar.drinks.pc':     '[VERBA DRINKS P/ CONVIDADO — JANTAR]',
    'baile.horas':          '[HORAS DE EVENTO — BAILE]',
    'baile.horario':        '[HORÁRIO — BAILE]',
    'posbaile.horas':       '[HORAS DE EVENTO — PÓS-BAILE]',
    'posbaile.horario':     '[HORÁRIO — PÓS-BAILE]',
    'baile.local':          '[LOCAL DO BAILE]',
    'verba.atracoes':       '[VERBA ATRAÇÕES]',
    'verba.buffet.pc':      '[VERBA BUFFET P/ CONVIDADO — BAILE]',
    'verba.bebidas.pc':     '[VERBA BEBIDAS P/ CONVIDADO — BAILE]',
    'posbaile.choperia':    '[CHOPERIA — PÓS-BAILE]',

    // ── Bolsa Folia / Pré-Eventos (até 5 itens) — sem fonte de dado ainda ──
    'preevento1.nome':       '[NOME PRÉ-EVENTO 1]',
    'preevento1.verba.pa':   '[VERBA POR ADESÃO — PRÉ-EVENTO 1]',
    'preevento1.verba.meta': '[VERBA TOTAL NA META — PRÉ-EVENTO 1]',
    'preevento2.nome':       '[NOME PRÉ-EVENTO 2]',
    'preevento2.verba.pa':   '[VERBA POR ADESÃO — PRÉ-EVENTO 2]',
    'preevento2.verba.meta': '[VERBA TOTAL NA META — PRÉ-EVENTO 2]',
    'preevento3.nome':       '[NOME PRÉ-EVENTO 3]',
    'preevento3.verba.pa':   '[VERBA POR ADESÃO — PRÉ-EVENTO 3]',
    'preevento3.verba.meta': '[VERBA TOTAL NA META — PRÉ-EVENTO 3]',
    'preevento4.nome':       '[NOME PRÉ-EVENTO 4]',
    'preevento4.verba.pa':   '[VERBA POR ADESÃO — PRÉ-EVENTO 4]',
    'preevento4.verba.meta': '[VERBA TOTAL NA META — PRÉ-EVENTO 4]',
    'preevento5.nome':       '[NOME PRÉ-EVENTO 5]',
  }

  return gerarDocumentoDocx('/templates/Termo_Adesao_Assessoria_TEMPLATE.docx', dados)
}

// ─── Geração do Contrato Comissão ─────────────────────────────────────────
// Contrato Alliance × Comissão de Formatura (modelo Produção). Mesmo
// mecanismo do Termo de Adesão — merge de placeholders via docxtemplater,
// sem chamada a API externa. Percentuais e valores em R$ que aparecem por
// extenso no texto usam campos de cadastro manual (mesmo padrão já usado em
// fee_valor_minimo_extenso / fee_valor_parcela_extenso).

export async function gerarContratoComissao(
  projeto: ProjetoData,
  pacotes: PacoteData[],
): Promise<Blob> {
  const pacoteBase = pacotes.find(p => p.is_base)

  const dados: Record<string, string> = {
    'comissao.nome': `${projeto.instituicao} — Turma ${projeto.turma || projeto.nome}`,

    'contrato.piso_fixo.percentual':         str(projeto.fee_percentual),
    'contrato.piso_fixo.percentual.extenso': valOrBracket(projeto.fee_percentual_extenso, 'FEE % POR EXTENSO'),

    'contrato.pacote_base.valor': pacoteBase
      ? pacoteBase.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : '[VALOR DO PACOTE BASE]',
    'contrato.pacote_base.valor.extenso': valOrBracket(pacoteBase?.valor_extenso, 'VALOR DO PACOTE BASE POR EXTENSO'),

    'contrato.meta_adesoes': str(projeto.formandos_minimo),

    'contrato.acrescimo_variavel.percentual':         str(projeto.fee_acrescimo_percentual),
    'contrato.acrescimo_variavel.percentual.extenso': valOrBracket(projeto.fee_acrescimo_percentual_extenso, 'ACRÉSCIMO VARIÁVEL % POR EXTENSO'),

    'contrato.parcelas.qt':    str(projeto.fee_parcelas),
    'contrato.parcelas.datas': datasParcelasSemestrais(projeto.data_assinatura, projeto.fee_parcelas),

    'contrato.gatilho_irregularidade.valor': projeto.valor_gatilho_irregularidade != null
      ? projeto.valor_gatilho_irregularidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : '[VALOR GATILHO DE IRREGULARIDADE]',
    'contrato.gatilho_irregularidade.valor.extenso': valOrBracket(projeto.valor_gatilho_irregularidade_extenso, 'VALOR GATILHO DE IRREGULARIDADE POR EXTENSO'),

    'contrato.data_assinatura': projeto.data_assinatura ? dataExtenso(projeto.data_assinatura) : dataHojeExtenso(),
  }

  return gerarDocumentoDocx('/templates/Contrato_Comissao_Assessoria_TEMPLATE.docx', dados)
}
