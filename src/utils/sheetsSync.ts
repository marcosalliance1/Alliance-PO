import type { Projeto, SecaoCusto, ItemCusto, StatusItem, StatusPagamento, TipoCusto } from '../types'
import { v4 as uuid } from './uuid'
import { calcValorProjetado } from './calculos'

// Mesmo mapeamento do importadorXlsx.ts
const MAPA_SECOES: Record<string, string> = {
  'custo producao': '2.1', 'custo produção': '2.1',
  'custo artistico': '2.2', 'custo artístico': '2.2',
  'custo equipe': '2.3',
  'custo bar': '2.4', 'custo bar&food': '2.4', 'custo bar food': '2.4', 'custo bar & food': '2.4',
  'custo pré-eventos': '2.5', 'custo pre-eventos': '2.5', 'custo pre eventos': '2.5',
  'cerimonia religiosa': 'cerimonia', 'cerimônia religiosa': 'cerimonia',
  'custo cerimonia': 'cerimonia', 'custo cerimônia': 'cerimonia',
  'colacao de grau': 'colacao', 'colação de grau': 'colacao',
  'custo colacao': 'colacao', 'custo colação': 'colacao',
  'custos administrativos': 'admin', 'custo administrativo': 'admin',
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function encontrarSecao(nomeAba: string): string | null {
  const n = norm(nomeAba)
  for (const [pattern, id] of Object.entries(MAPA_SECOES)) {
    if (n.includes(norm(pattern))) return id
  }
  return null
}

function getCell(values: unknown[][], row: number, col: number): unknown {
  return (values[row] as unknown[] | undefined)?.[col] ?? null
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(',', '.').replace(/[^\d.-]/g, ''))
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

function parseCodigo(val: unknown): string {
  if (!val && val !== 0) return ''
  if (typeof val === 'number') {
    if (val > 40000 && val < 50000) {
      const d = new Date((val - 25569) * 86400 * 1000)
      const s = d.getUTCFullYear() - 2008
      return `2.${s}.${d.getUTCMonth() + 1}.${d.getUTCDate()}`
    }
    return String(Math.round(val))
  }
  return String(val).trim()
}

function parseStatus(val: unknown): StatusItem {
  const s = String(val ?? '').toLowerCase().trim()
  if (s === 'orçar' || s === 'orcar') return 'orçar'
  if (s === 'orçando' || s === 'orcando') return 'orçando'
  if (s === 'estimado') return 'estimado'
  if (s === 'fechado') return 'fechado'
  return 'orçar'
}

function parsePgto(val: unknown): StatusPagamento {
  const s = String(val ?? '').toLowerCase().trim()
  if (s === 'pago') return 'pago'
  if (s === 'parcial') return 'parcial'
  if (s === 'em aberto') return 'em aberto'
  return 'N/A'
}

function parseTipoCusto(val: unknown): TipoCusto {
  const s = String(val ?? '').toLowerCase()
  if (s.includes('variável') || s.includes('variavel') || s.includes('var')) return 'Custo Variável'
  return 'Custo Fixo'
}

function parseItens(values: unknown[][], _secaoNumero: string, _secaoNome: string, ipca: number, parcelas: number): ItemCusto[] {
  const itens: ItemCusto[] = []
  const INICIO = 8 // linha 9 (0-based), igual ao importador xlsx

  for (let r = INICIO; r < values.length; r++) {
    const get = (c: number) => getCell(values, r, c)

    const subcategoria = parseStr(get(4)) // col E
    const item = parseStr(get(5))         // col F
    if (!subcategoria && !item) continue

    const codigo = parseCodigo(get(0))
    const area = parseStr(get(1))
    const moscow = parseStr(get(2))
    const tipoCusto = parseTipoCusto(get(3))
    const fornecedor = parseStr(get(6))

    const qtdeVendida = parseNum(get(7))
    const valorUnitarioAtual = parseNum(get(8))
    const totalAtual = qtdeVendida * valorUnitarioAtual
    const valorProjetado = calcValorProjetado(valorUnitarioAtual, ipca, parcelas)
    const totalProjetado = qtdeVendida * valorProjetado

    const qtdeOrcada = parseNum(get(13))
    const valorUnitarioOrcado = parseNum(get(14))
    const valorOrcado = qtdeOrcada * valorUnitarioOrcado

    const qtdeContratada = parseNum(get(17))
    const valorUnitarioContratado = parseNum(get(18))
    const valorContratado = qtdeContratada * valorUnitarioContratado

    const responsavel = parseStr(get(20))
    const status = parseStatus(get(21))
    const statusPagamento = parsePgto(get(24))
    const valorFinal = parseNum(get(26))
    const valorPago = parseNum(get(27))
    const faltaPagar = valorFinal > 0 ? valorFinal - valorPago : parseNum(get(28))

    itens.push({
      id: uuid(), codigo, area, subcategoria, item, fornecedor, tipoCusto, moscow,
      qtdeVendida, valorUnitarioAtual, totalAtual, valorProjetado, totalProjetado,
      qtdeOrcada, valorUnitarioOrcado, valorOrcado,
      qtdeContratada, valorUnitarioContratado, valorContratado,
      responsavel, status, statusPagamento,
      valorFinal, valorPago, faltaPagar,
      totalProgramado: 0, emAberto: 0, jotform: [],
    })
  }

  return itens
}

async function fetchAba(spreadsheetId: string, nomeAba: string, accessToken: string): Promise<unknown[][] | null> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(nomeAba)}?valueRenderOption=UNFORMATTED_VALUE`
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (resp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
    ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (resp.status === 403) throw new Error('Sem permissão para acessar esta planilha. Verifique se ela está compartilhada com sua conta.')
  if (resp.status === 404) return null

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Erro ao ler planilha (HTTP ${resp.status})`)
  }

  const data = await resp.json() as { values?: unknown[][] }
  return data.values ?? []
}

export async function sincronizarComSheets(
  spreadsheetId: string,
  accessToken: string,
  projeto: Projeto,
  onProgress: (msg: string) => void,
): Promise<SecaoCusto[]> {
  onProgress('Lendo estrutura da planilha...')

  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (metaResp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte o Google Drive e tente novamente.')
    ;(err as Error & { tipo?: string }).tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (!metaResp.ok) {
    const body = await metaResp.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? 'Não foi possível acessar a planilha. Verifique a URL e as permissões.')
  }

  const meta = await metaResp.json() as { sheets: { properties: { title: string } }[] }
  const sheetNames = meta.sheets.map(s => s.properties.title)

  // Montar mapa de seções por numero
  const novasSecoes = new Map<string, ItemCusto[]>()

  const ipca = projeto.tap.ipca
  const parcelas = projeto.tap.parcelas

  for (const nomeAba of sheetNames) {
    const secaoId = encontrarSecao(nomeAba)
    if (!secaoId) continue

    // Resolver o numero real da seção no projeto
    const secaoProjeto = projeto.secoes.find(s =>
      s.numero === secaoId ||
      (secaoId === 'cerimonia' && (s.nome.toLowerCase().includes('cerimônia') || s.nome.toLowerCase().includes('cerimonia'))) ||
      (secaoId === 'colacao' && (s.nome.toLowerCase().includes('colação') || s.nome.toLowerCase().includes('colacao'))) ||
      (secaoId === 'admin' && s.nome.toLowerCase().includes('admin'))
    )
    if (!secaoProjeto) continue

    onProgress(`Lendo ${secaoProjeto.nome} (${secaoProjeto.numero})...`)
    try {
      const values = await fetchAba(spreadsheetId, nomeAba, accessToken)
      if (values) {
        novasSecoes.set(secaoProjeto.numero, parseItens(values, secaoProjeto.numero, secaoProjeto.nome, ipca, parcelas))
      }
    } catch (e) {
      if ((e as Error & { tipo?: string }).tipo === 'TOKEN_EXPIRADO') throw e
      console.warn(`Erro ao ler aba "${nomeAba}":`, e)
    }
  }

  // Fazer merge: preservar valorPago e itens não encontrados na planilha
  const secoesAtualizadas = projeto.secoes.map(secao => {
    const novosItens = novasSecoes.get(secao.numero)
    if (!novosItens) return secao // seção não lida, manter como está

    const existingMap = new Map<string, ItemCusto>()
    for (const item of secao.itens) {
      existingMap.set(`${item.subcategoria}|${item.item}`, item)
    }

    const vistos = new Set<string>()
    const itensFinais: ItemCusto[] = []

    for (const novoItem of novosItens) {
      const chave = `${novoItem.subcategoria}|${novoItem.item}`
      vistos.add(chave)
      const existente = existingMap.get(chave)

      if (existente) {
        // Preservar valorPago manual e jotform
        itensFinais.push({
          ...novoItem,
          id: existente.id,
          valorPago: existente.valorPago > 0 ? existente.valorPago : novoItem.valorPago,
          jotform: existente.jotform,
        })
      } else {
        itensFinais.push(novoItem)
      }
    }

    // Manter itens que sumiram da planilha (não deletar)
    for (const [chave, item] of existingMap) {
      if (!vistos.has(chave)) itensFinais.push(item)
    }

    return { ...secao, itens: itensFinais }
  })

  return secoesAtualizadas
}

export function extrairSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? null
}
