import { Document, Paragraph, TextRun, AlignmentType, Packer } from 'docx'
import { supabaseComercial } from './supabase'
import type { ProjetoData, PacoteData } from './gerarContratos'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// converte 'YYYY-MM-DD' para "DD de mês de YYYY"
function dataExtensoBR(iso: string | null): string | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.split('-')
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`
}

function moeda(valor: number | null): string | undefined {
  if (valor == null) return undefined
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

interface DadosContrato {
  nome_instituicao_turma: string
  percentual_piso_fixo?: string
  pacote_base?: string
  meta_adesoes?: string
  percentual_acrescimo_variavel?: string
  numero_parcelas?: string
  datas_vencimento_parcelas?: string
  valor_gatilho_irregularidade?: string
  data_assinatura?: string
}

export function montarDadosContratoComissao(
  projeto: ProjetoData,
  pacotes: PacoteData[],
): DadosContrato {
  const pacoteBase = pacotes.find(p => p.is_base)
  return {
    nome_instituicao_turma: `${projeto.instituicao} — Turma ${projeto.turma || projeto.nome}`,
    percentual_piso_fixo: projeto.fee_percentual != null ? `${projeto.fee_percentual}%` : undefined,
    pacote_base: pacoteBase ? moeda(pacoteBase.valor) : undefined,
    meta_adesoes: projeto.formandos_minimo != null ? String(projeto.formandos_minimo) : undefined,
    percentual_acrescimo_variavel: projeto.fee_acrescimo_percentual != null
      ? `${projeto.fee_acrescimo_percentual}%`
      : undefined,
    numero_parcelas: projeto.fee_parcelas != null ? String(projeto.fee_parcelas) : undefined,
    datas_vencimento_parcelas: projeto.datas_vencimento_parcelas ?? undefined,
    valor_gatilho_irregularidade: moeda(projeto.valor_gatilho_irregularidade),
    data_assinatura: dataExtensoBR(projeto.data_assinatura),
  }
}

export class CamposPendentesError extends Error {
  campos: string[]
  constructor(campos: string[]) {
    super(`Campos pendentes no contrato: ${campos.join(', ')}`)
    this.name = 'CamposPendentesError'
    this.campos = campos
  }
}

// chama a Edge Function `gerar-contrato-comissao`, que por sua vez chama a
// API da Anthropic com o contrato-modelo fixo (PROMPT_1.MD) como system prompt.
export async function gerarTextoContratoComissao(dados: DadosContrato): Promise<string> {
  const { data, error } = await supabaseComercial.functions.invoke<{ texto?: string; error?: string }>(
    'gerar-contrato-comissao',
    { body: dados },
  )
  if (error) throw new Error(`Falha ao gerar contrato: ${error.message}`)
  if (!data?.texto) throw new Error(data?.error ?? 'Resposta vazia do gerador de contrato.')

  const pendentes = [...data.texto.matchAll(/\[PENDENTE: ([^\]]+)\]/g)].map(m => m[1])
  if (pendentes.length > 0) {
    throw new CamposPendentesError([...new Set(pendentes)])
  }
  return data.texto
}

const TITULO_LINHAS = 2 // as duas primeiras linhas do contrato-modelo são o título (centralizado, negrito)

// só considera título de cláusula/anexo (ex: "CLÁUSULA 1 — DO OBJETO",
// "ANEXO I — CRONOGRAMA...") — não qualquer parágrafo que apenas comece
// com a palavra "Anexo" em uma frase comum.
function ehTituloClausula(linha: string): boolean {
  return /^(CLÁUSULA|ANEXO)\s+\S+\s+—/.test(linha.trim())
}

export async function textoParaDocx(texto: string): Promise<Blob> {
  const paragrafos = texto
    .split(/\r?\n\s*\r?\n/)
    .map(p => p.trim())
    .filter(Boolean)

  const children = paragrafos.map((paragrafo, idx) => {
    const negrito = idx < TITULO_LINHAS || ehTituloClausula(paragrafo)
    const centralizado = idx < TITULO_LINHAS
    return new Paragraph({
      alignment: centralizado ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [new TextRun({ text: paragrafo, bold: negrito })],
    })
  })

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBlob(doc)
}
