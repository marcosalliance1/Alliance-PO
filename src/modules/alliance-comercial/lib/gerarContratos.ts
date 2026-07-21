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
  fee_valor_minimo: number | null
  fee_valor_minimo_extenso: string | null
  fee_parcelas: number | null
  fee_valor_parcela: number | null
  fee_valor_parcela_extenso: string | null
  fee_acrescimo_percentual: number | null
  formandos_minimo: number | null
  local_data_extenso: string | null
  prazo_arrependimento: string | null
  vigencia_meses: number | null
  vigencia_meses_extenso: string | null
  retencao_faixa1_inicio: string | null
  retencao_faixa1_fim: string | null
  retencao_faixa1_percentual: number | null
  retencao_faixa2_inicio: string | null
  retencao_faixa2_fim: string | null
  retencao_faixa2_percentual: number | null
  retencao_faixa3_inicio: string | null
  retencao_faixa3_fim: string | null
  retencao_faixa3_percentual: number | null
  retencao_faixa4_inicio: string | null
  retencao_faixa4_fim: string | null
  retencao_faixa4_percentual: number | null
  retencao_faixa5_inicio: string | null
  retencao_faixa5_fim: string | null
  retencao_faixa5_percentual: number | null
  retencao_faixa6_inicio: string | null
  retencao_faixa6_fim: string | null
  retencao_faixa6_percentual: number | null
  retencao_faixa_final_inicio: string | null
  datas_vencimento_parcelas: string | null
  valor_gatilho_irregularidade: number | null
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
    'projeto.prazo.arrependimento': dataBR(projeto.prazo_arrependimento),
    'contrato.vigencia.meses': `${str(projeto.vigencia_meses)} (${projeto.vigencia_meses_extenso ?? ''})`,
    'contrato.vigencia.fator': projeto.vigencia_meses
      ? pct(100 / projeto.vigencia_meses, 4)
      : '',
    'retencao.faixa1.inicio':     dataBR(projeto.retencao_faixa1_inicio),
    'retencao.faixa1.fim':        dataBR(projeto.retencao_faixa1_fim),
    'retencao.faixa1.percentual': pct(projeto.retencao_faixa1_percentual, 2),
    'retencao.faixa2.inicio':     dataBR(projeto.retencao_faixa2_inicio),
    'retencao.faixa2.fim':        dataBR(projeto.retencao_faixa2_fim),
    'retencao.faixa2.percentual': pct(projeto.retencao_faixa2_percentual, 2),
    'retencao.faixa3.inicio':     dataBR(projeto.retencao_faixa3_inicio),
    'retencao.faixa3.fim':        dataBR(projeto.retencao_faixa3_fim),
    'retencao.faixa3.percentual': pct(projeto.retencao_faixa3_percentual, 2),
    'retencao.faixa4.inicio':     dataBR(projeto.retencao_faixa4_inicio),
    'retencao.faixa4.fim':        dataBR(projeto.retencao_faixa4_fim),
    'retencao.faixa4.percentual': pct(projeto.retencao_faixa4_percentual, 2),
    'retencao.faixa5.inicio':     dataBR(projeto.retencao_faixa5_inicio),
    'retencao.faixa5.fim':        dataBR(projeto.retencao_faixa5_fim),
    'retencao.faixa5.percentual': pct(projeto.retencao_faixa5_percentual, 2),
    'retencao.faixa6.inicio':     dataBR(projeto.retencao_faixa6_inicio),
    'retencao.faixa6.fim':        dataBR(projeto.retencao_faixa6_fim),
    'retencao.faixa6.percentual': pct(projeto.retencao_faixa6_percentual, 2),
    'retencao.faixaFinal.inicio': dataBR(projeto.retencao_faixa_final_inicio),

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

export async function gerarContratoComissao(projeto: ProjetoData): Promise<Blob> {
  // parcelas 1–9 têm data+percentual+valor; parcela 10 só tem percentual+valor
  const parcelasFixas: Record<string, string> = {}
  for (let i = 1; i <= 10; i++) {
    if (i < 10) parcelasFixas[`contrato.parcela_${i}_data`] = '[A DEFINIR]'
    parcelasFixas[`contrato.parcela_${i}_percentual`] = '[A DEFINIR]'
    parcelasFixas[`contrato.parcela_${i}_valor`]      = '[A DEFINIR]'
  }

  const dados: Record<string, string> = {
    'comissao.nome':         `${projeto.nome} — ${projeto.instituicao}`,
    'comissao.cnpj':         '[CNPJ DA COMISSÃO DE FORMATURA]',
    'comissao.end':          '[ENDEREÇO DA COMISSÃO]',
    'comissao.cidade':       '[CIDADE/DATA]',
    'comissao.tel':          '[TELEFONE DA COMISSÃO]',
    'comissao.contatos':     '[CONTATOS DA COMISSÃO]',
    'comissao.representante':'[NOME DO REPRESENTANTE]',

    'contrato.fee_percentual':           str(projeto.fee_percentual),
    'contrato.fee_valor_minimo':         str(projeto.fee_valor_minimo),
    'contrato.fee_valor_minimo_extenso': projeto.fee_valor_minimo_extenso ?? '',
    'contrato.fee_parcelas':             str(projeto.fee_parcelas),
    'contrato.fee_valor_parcela':        str(projeto.fee_valor_parcela),
    'contrato.fee_valor_parcela_extenso':projeto.fee_valor_parcela_extenso ?? '',
    'contrato.fee_acrescimo_percentual': str(projeto.fee_acrescimo_percentual),
    'contrato.formandos_minimo':         str(projeto.formandos_minimo),
    'contrato.local_data_extenso':
      projeto.local_data_extenso ?? dataHojeExtenso(),

    ...parcelasFixas,
  }

  return gerarDocumentoDocx('/templates/Contrato_Comissao_Assessoria_TEMPLATE.docx', dados)
}
