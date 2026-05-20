import { fetchAba, fetchSheetNames, extrairSpreadsheetId } from './sheetsSync'

export interface VerbasItem {
  projeto_id: string
  projeto_nome: string
  segmento: string
  categoria: string
  sub_categoria: string
  item: string
  valor_orcado: number
}

function normUpper(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function mapearCategoria(nomeAba: string): string | null {
  const n = normUpper(nomeAba)
  if (n.includes('PRODUCAO') || n.includes('PRODUCAO')) return 'Custo Produção'
  if (n.includes('ARTISTICO')) return 'Custo Artístico'
  if (n.includes('EQUIPE')) return 'Custo Equipe'
  if (n.includes('BAR')) return 'Bar & Food e Outros'
  if (n.includes('PRE-EVENTOS') || n.includes('PRE EVENTOS')) return 'Pré-Eventos'
  if (n.includes('CERIMONIA')) return 'Cerimônia Religiosa'
  if (n.includes('COLACAO')) return 'Colação de Grau'
  if (n.includes('ADMINISTRATIVOS') || n.includes('ADMINISTRATIVO')) return 'Custos Administrativos'
  if (n.includes('MEDICO')) return 'Meio Médico'
  return null
}

export function derivarSegmento(curso: string | undefined): string {
  const c = (curso ?? '').toLowerCase().trim()
  if (c === 'outro') return '9º Ano'
  if (c === '3º ano') return 'Ensino Médio'
  return 'Ensino Superior'
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (typeof val === 'string') {
    const cleaned = val
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function parseStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  const erros = ['#ref!', '#n/a', '#value!', '#div/0!']
  if (erros.some(e => s.toLowerCase().includes(e))) return ''
  return s
}

export async function sincronizarVerbas(
  projetoId: string,
  projetoNome: string,
  sheetsUrl: string,
  tapCurso: string | undefined,
  accessToken: string,
  onProgress: (msg: string) => void,
): Promise<VerbasItem[]> {
  const spreadsheetId = extrairSpreadsheetId(sheetsUrl)
  if (!spreadsheetId) throw new Error(`URL do Google Sheets inválida: ${sheetsUrl}`)

  const segmento = derivarSegmento(tapCurso)
  onProgress(`[${projetoNome}] Lendo estrutura...`)

  const sheetNames = await fetchSheetNames(spreadsheetId, accessToken)
  const abas2 = sheetNames.filter(name => name.startsWith('2.'))

  const itens: VerbasItem[] = []

  for (const nomeAba of abas2) {
    const categoria = mapearCategoria(nomeAba)
    if (!categoria) continue

    onProgress(`[${projetoNome}] Lendo ${nomeAba}...`)

    const values = await fetchAba(spreadsheetId, nomeAba, accessToken)
    if (!values) continue

    // Row 8 (index 7) = cabeçalho, dados a partir da linha 9 (index 8)
    const INICIO = 8
    for (let r = INICIO; r < values.length; r++) {
      const row = (values[r] as unknown[]) ?? []
      const sub_categoria = parseStr(row[4])  // Col E
      const item = parseStr(row[5])           // Col F
      const valor_orcado = parseNum(row[15])  // Col P

      if (valor_orcado <= 0) continue
      if (!sub_categoria && !item) continue

      itens.push({
        projeto_id: projetoId,
        projeto_nome: projetoNome,
        segmento,
        categoria,
        sub_categoria,
        item: item || sub_categoria,
        valor_orcado,
      })
    }
  }

  return itens
}
