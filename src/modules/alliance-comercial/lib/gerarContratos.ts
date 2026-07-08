import { gerarDocumentoDocx } from './gerarDocumento'

// ─── Dados fixos da empresa ───────────────────────────────────────────────
// Atualize com os valores reais da Alliance antes de usar em produção.
const EMPRESA = {
  razao: 'Alliance Assessoria de Formaturas',
  cnpj: '',
  end: '',
  tel: '',
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

// ─── Tipos exportados ─────────────────────────────────────────────────────

export interface ProjetoData {
  id: string
  nome: string
  instituicao: string
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
}

export interface PacoteData {
  id: string
  nome: string
  eventos_inclusos: string | null
  valor: number
  valor_extenso: string | null
  qtd_parcelas: number | null
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
    'cliente.nome':                    '[NOME DO FORMANDO]',
    'cliente.cpf':                     '[CPF]',
    'cliente.end':                     '[ENDEREÇO COMPLETO]',
    'cliente.inst':                    projeto.instituicao,
    'cliente.tel.cel':                 '[TELEFONE CELULAR]',
    'cliente.tel.res':                 '[TELEFONE RESIDENCIAL]',
    'cliente.pacote':                  listaPacotes,
    'cliente.pacote.eventos':          '[EVENTOS CONFORME PACOTE ESCOLHIDO]',
    'cliente.pacote.valor':            '[VALOR DO PACOTE]',
    'cliente.pacote.valor.extenso':    '[VALOR DO PACOTE POR EXTENSO]',
    'cliente.adesao.parcelas.qt':      '[QTD DE PARCELAS]',
    'cliente.dat.adesao.extenso.2':    '[DATA DA ADESÃO]',
    'cliente.assinatura.aceite.termos': '',
    'cliente.ip.aceite.termos':        '',
    'contrato.num':                    gerarNumContrato(),
    'contrato.semestre':               projeto.semestre ?? '',
    'empresa.razao':                   EMPRESA.razao,
    'empresa.cnpj':                    EMPRESA.cnpj,
    'empresa.end':                     EMPRESA.end,
    'empresa.tel':                     EMPRESA.tel,
    'empresa.logo.pq':                 '',
  }

  return gerarDocumentoDocx('/templates/Termo_Adesao_Assessoria_TEMPLATE.docx', dados)
}

// ─── Geração do Contrato Comissão ─────────────────────────────────────────

export async function gerarContratoComissao(projeto: ProjetoData): Promise<Blob> {
  const str = (v: number | null): string => (v != null ? String(v) : '')

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
