/**
 * validadorPO.js
 *
 * Executa o parse completo de um arquivo de orçamento (XLSX ou Google Sheets)
 * e retorna um relatório de validação — sem salvar nada no Supabase.
 *
 * Use antes de qualquer import para confirmar que o arquivo está correto.
 *
 * Retorno: RelatorioValidacao {
 *   valido: boolean          — true se ao menos TAP + 1 seção foram lidas sem erro
 *   tap: { encontrado, campos, avisos }
 *   secoes: { '2.1': { encontrado, nomeAba, totalItens, amostra[3], divergencias }, ... }
 *   secoesEncontradas: string[]
 *   secoesFaltando: string[]
 *   totalItens: number
 *   totalDivergencias: number
 *   avisos: string[]         — alertas não-fatais
 *   erros: string[]          — erros que impediram leitura de alguma parte
 * }
 */

import * as XLSX from 'xlsx'

// ─── Constantes compartilhadas ────────────────────────────────────

const ORDEM_SECOES = ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8']

const NOMES_SECOES = {
  '2.1': 'Custo Produção',
  '2.2': 'Custo Artístico',
  '2.3': 'Custo Equipe',
  '2.4': 'Custo Bar & Food',
  '2.5': 'Pré-Eventos / Cerimônia',
  '2.6': 'Cerimônia Religiosa',
  '2.7': 'Colação de Grau',
  '2.8': 'Custos Administrativos',
}

const MAPEAMENTO_ABAS = {
  '2.1': ['2.1 custo produção', '2.1 custo producao', '2.1 producao', '2.1 produção'],
  '2.2': ['2.2 custo artístico', '2.2 custo artistico', '2.2 artistico', '2.2 artístico'],
  '2.3': ['2.3 custo equipe', '2.3 equipe'],
  '2.4': ['2.4 custo bar', '2.4 custo bar&food', '2.4 bar', '2.4 bar&food'],
  '2.5': ['2.5 custo pré-eventos', '2.5 custo pre-eventos', '2.5 custo cerimônia', '2.5 custo cerimonia', '2.5 pré-eventos', '2.5 pre-eventos', '2.5 cerimônia', '2.5 cerimonia', '2.5 custos administrativos'],
  '2.6': ['2.6 custo cerimônia', '2.6 custo cerimonia', '2.6 custo colação', '2.6 custo colacao', '2.6 cerimônia', '2.6 colação'],
  '2.7': ['2.7 custo colação', '2.7 custo colacao', '2.7 colação'],
  '2.8': ['2.8 custos administrativos', '2.8 custo administrativo', '2.8 administrativo'],
}

// ─── Helpers de parse ─────────────────────────────────────────────

function encontrarSecao(nomeAba) {
  const nome = nomeAba.toLowerCase().trim()
  for (const [secao, nomes] of Object.entries(MAPEAMENTO_ABAS)) {
    if (nomes.some(n => nome.includes(n))) return secao
  }
  return null
}

function limparValor(val) {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const erros = ['#ref!', '#n/a', '#value!', '#div/0!', '#nome?', '#name?']
    if (erros.some(e => val.toLowerCase().includes(e))) return 0
    const num = parseFloat(val.replace(/[R$\s.]/g, '').replace(',', '.'))
    return isNaN(num) ? 0 : num
  }
  return 0
}

function limparTexto(val) {
  if (val === null || val === undefined) return ''
  const str = String(val).trim()
  const erros = ['#ref!', '#n/a', '#value!', '#div/0!']
  if (erros.some(e => str.toLowerCase().includes(e))) return ''
  return str
}

function tratarCodigo(val) {
  if (!val && val !== 0) return ''
  if (typeof val === 'number') {
    if (val > 40000 && val < 50000) return String(new Date((val - 25569) * 86400 * 1000).getFullYear())
    return String(Math.round(val))
  }
  return String(val).trim()
}

// ─── Parse TAP — a partir de array 2D (rows × cols) ──────────────

function parseTapValues(values) {
  const g = (r, c) => values[r]?.[c] ?? null
  return {
    tipoEnsino:     limparTexto(g(6, 1)),
    totalAlunos:    limparValor(g(6, 5)) || limparValor(g(6, 3)),
    curso:          limparTexto(g(7, 1)),
    instituicao:    limparTexto(g(8, 1)),
    turma:          limparTexto(g(9, 1)),
    anoOrcamento:   limparTexto(g(10, 1)),
    anoRealizacao:  limparTexto(g(11, 1)),
    semestre:       limparTexto(g(12, 1)),
    modeloContrato: limparTexto(g(13, 1)),
    ipcaAm:         limparValor(g(14, 1)) || limparValor(g(19, 5)),
    tempoContrato:  limparValor(g(8, 5)),
    tempoFesta:     limparValor(g(9, 5)),
    tempoPósBaile:  limparValor(g(10, 5)),
  }
}

// ─── Parse seção — a partir de array 2D ──────────────────────────

function parseSecaoValues(values, secao) {
  const LINHA_INICIO = 8
  const itens = []

  for (let r = LINHA_INICIO; r < values.length; r++) {
    const g = c => values[r]?.[c] ?? null
    const subCat   = limparTexto(g(4))
    const itemDesc = limparTexto(g(5))
    if (!subCat && !itemDesc) continue

    const qtde                   = limparValor(g(7))
    const valorUnitarioAtual     = limparValor(g(8))
    const totalAtualCelula       = limparValor(g(9))
    const valorProjetado         = limparValor(g(10))
    const totalProjetado         = limparValor(g(11))
    const qtdeOrcada             = limparValor(g(13))
    const valorUnitarioOrcado    = limparValor(g(14))
    const valorOrcadoCelula      = limparValor(g(15))
    const qtdeContratada         = limparValor(g(17))
    const valorUnitarioContratado = limparValor(g(18))
    const valorContratadoCelula  = limparValor(g(19))

    const divergencias = []
    const check = (label, q, u, total) => {
      const calc = (q || 0) * (u || 0)
      if (calc > 0 && Math.abs(calc - total) > 0.01)
        divergencias.push({ coluna: label, qtde: q, unitario: u, totalPlanilha: total, totalCalculado: calc })
    }
    if (g(9) !== null)  check('Vendido',    qtde,          valorUnitarioAtual,      totalAtualCelula)
    if (g(15) !== null) check('Orçado',     qtdeOrcada,    valorUnitarioOrcado,     valorOrcadoCelula)
    if (g(19) !== null) check('Contratado', qtdeContratada, valorUnitarioContratado, valorContratadoCelula)

    itens.push({
      secao,
      codigo:    tratarCodigo(g(0)),
      area:      limparTexto(g(1)),
      moscow:    limparTexto(g(2)),
      defCusto:  limparTexto(g(3)),
      subCategoria: subCat,
      item:      itemDesc,
      fornecedor: limparTexto(g(6)),
      qtde,
      valorUnitarioAtual,
      totalAtual:    g(9)  !== null ? totalAtualCelula  : qtde * valorUnitarioAtual,
      valorProjetado,
      totalProjetado,
      qtdeOrcada,
      valorUnitarioOrcado,
      valorOrcado:   g(15) !== null ? valorOrcadoCelula : qtdeOrcada * valorUnitarioOrcado,
      qtdeContratada,
      valorUnitarioContratado,
      valorContratado: g(19) !== null ? valorContratadoCelula : qtdeContratada * valorUnitarioContratado,
      responsavel: limparTexto(g(20)),
      status:      limparTexto(g(21)) || 'Em aberto',
      pgto:        limparTexto(g(24)),
      valorPago:   limparValor(g(27)),
      faltaPagar:  limparValor(g(28)),
      divergencias,
    })
  }

  return itens
}

// ─── Conversão XLSX sheet → array 2D ─────────────────────────────

function sheetParaValues(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
}

// ─── Montagem do relatório ────────────────────────────────────────

function montarRelatorio(sheetNames, getTapValues, getSecaoValues) {
  const avisos = []
  const erros  = []
  const secoes = {}

  // TAP
  const tapName = sheetNames.find(n => {
    const nl = n.toLowerCase()
    return nl.includes('tap') || nl.includes('termo abertura') || nl.includes('termo de abertura')
  })

  let tap = null
  if (!tapName) {
    avisos.push('Aba TAP não encontrada. Dados de cabeçalho do projeto não serão preenchidos automaticamente.')
  } else {
    try {
      const values = getTapValues(tapName)
      tap = parseTapValues(values)
      const camposFaltando = []
      if (!tap.instituicao)  camposFaltando.push('Instituição')
      if (!tap.curso)        camposFaltando.push('Curso')
      if (!tap.anoRealizacao) camposFaltando.push('Ano Realização')
      if (!tap.totalAlunos)  camposFaltando.push('Total de Alunos')
      if (camposFaltando.length)
        avisos.push(`TAP com campos vazios: ${camposFaltando.join(', ')}`)
    } catch (e) {
      erros.push(`Erro ao ler TAP ("${tapName}"): ${e.message}`)
    }
  }

  // Seções
  for (const nomeAba of sheetNames) {
    const secao = encontrarSecao(nomeAba)
    if (!secao || secoes[secao]) continue

    try {
      const values = getSecaoValues(nomeAba)
      const itens  = parseSecaoValues(values, secao)
      const divergencias = itens.filter(i => i.divergencias.length > 0)

      secoes[secao] = {
        encontrado:    true,
        nomeAba,
        totalItens:    itens.length,
        amostra:       itens.slice(0, 3).map(i => ({ subCategoria: i.subCategoria, item: i.item })),
        totalDivergencias: divergencias.length,
        itens,
      }

      if (itens.length === 0)
        avisos.push(`Seção ${secao} (${NOMES_SECOES[secao]}) encontrada mas sem itens.`)
      if (divergencias.length > 0)
        avisos.push(`Seção ${secao}: ${divergencias.length} item(ns) com divergência entre Qtde × Unitário e Total da planilha.`)
    } catch (e) {
      erros.push(`Erro ao ler seção ${secao} ("${nomeAba}"): ${e.message}`)
      secoes[secao] = { encontrado: false, nomeAba, totalItens: 0, amostra: [], totalDivergencias: 0, itens: [] }
    }
  }

  // Preencher seções ausentes
  for (const s of ORDEM_SECOES) {
    if (!secoes[s]) {
      secoes[s] = { encontrado: false, nomeAba: null, totalItens: 0, amostra: [], totalDivergencias: 0, itens: [] }
    }
  }

  const secoesEncontradas = ORDEM_SECOES.filter(s => secoes[s].encontrado)
  const secoesFaltando    = ORDEM_SECOES.filter(s => !secoes[s].encontrado)
  const totalItens        = secoesEncontradas.reduce((acc, s) => acc + secoes[s].totalItens, 0)
  const totalDivergencias = secoesEncontradas.reduce((acc, s) => acc + secoes[s].totalDivergencias, 0)

  if (secoesFaltando.length > 0 && secoesFaltando.length < ORDEM_SECOES.length)
    avisos.push(`Seções não encontradas no arquivo: ${secoesFaltando.map(s => `${s} (${NOMES_SECOES[s]})`).join(', ')}`)

  if (secoesEncontradas.length === 0 && !erros.length)
    erros.push('Nenhuma aba de seção (2.1 a 2.8) foi identificada no arquivo. Verifique os nomes das abas.')

  return {
    valido: secoesEncontradas.length > 0 && erros.length === 0,
    tap: {
      encontrado: !!tapName && !!tap,
      nomeAba:    tapName || null,
      campos:     tap,
    },
    secoes,
    secoesEncontradas,
    secoesFaltando,
    totalItens,
    totalDivergencias,
    avisos,
    erros,
    // Dados completos prontos para uso imediato no import (sem re-parse)
    dadosParaImport: {
      tap:    tap || {},
      secoes: Object.fromEntries(ORDEM_SECOES.map(s => [s, secoes[s].itens])),
    },
  }
}

// ─── API pública ──────────────────────────────────────────────────

/**
 * Valida um arquivo XLSX sem salvar nada.
 * @param {File} arquivo — objeto File do input
 * @returns {Promise<RelatorioValidacao>}
 */
export async function validarXLSX(arquivo) {
  const buffer   = await arquivo.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  return montarRelatorio(
    workbook.SheetNames,
    nomeAba => sheetParaValues(workbook.Sheets[nomeAba]),
    nomeAba => sheetParaValues(workbook.Sheets[nomeAba]),
  )
}

/**
 * Valida uma planilha Google Sheets sem salvar nada.
 * @param {string} spreadsheetId
 * @param {string} accessToken
 * @returns {Promise<RelatorioValidacao>}
 */
export async function validarSheets(spreadsheetId, accessToken) {
  const metaUrl  = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`
  const metaResp = await fetch(metaUrl, { headers: { Authorization: `Bearer ${accessToken}` } })

  if (metaResp.status === 401) {
    const err = new Error('Token do Google expirado. Reconecte e tente novamente.')
    err.tipo = 'TOKEN_EXPIRADO'
    throw err
  }
  if (!metaResp.ok) {
    const body = await metaResp.json().catch(() => ({}))
    throw new Error(body.error?.message || 'Não foi possível acessar a planilha. Verifique a URL e as permissões.')
  }

  const meta       = await metaResp.json()
  const sheetNames = (meta.sheets || []).map(s => s.properties.title)

  // Cache de abas já buscadas para não re-fetch
  const cache = {}
  const fetchAba = async (nomeAba) => {
    if (cache[nomeAba]) return cache[nomeAba]
    const url  = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(nomeAba)}?valueRenderOption=UNFORMATTED_VALUE`
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (resp.status === 401) { const e = new Error('Token do Google expirado.'); e.tipo = 'TOKEN_EXPIRADO'; throw e }
    if (resp.status === 404) return []
    if (!resp.ok) { const b = await resp.json().catch(() => ({})); throw new Error(b.error?.message || `HTTP ${resp.status}`) }
    const data = await resp.json()
    cache[nomeAba] = data.values || []
    return cache[nomeAba]
  }

  // Pré-carrega todas as abas relevantes antes de montar o relatório
  const abasRelevantes = sheetNames.filter(n => {
    const nl = n.toLowerCase()
    return nl.includes('tap') || nl.includes('termo abertura') || encontrarSecao(n) !== null
  })
  await Promise.all(abasRelevantes.map(fetchAba))

  return montarRelatorio(
    sheetNames,
    nomeAba => cache[nomeAba] || [],
    nomeAba => cache[nomeAba] || [],
  )
}

// ─── Helpers para exibição ────────────────────────────────────────

/** Formata o relatório para exibição em console (debug). */
export function formatarRelatorio(r) {
  const linhas = []
  linhas.push(`Válido: ${r.valido ? '✅ SIM' : '❌ NÃO'}`)
  linhas.push(`TAP: ${r.tap.encontrado ? `✅ "${r.tap.nomeAba}"` : '⚠️ não encontrado'}`)
  if (r.tap.campos) {
    const t = r.tap.campos
    linhas.push(`  Instituição: ${t.instituicao || '—'}`)
    linhas.push(`  Curso: ${t.curso || '—'} | Turma: ${t.turma || '—'} | Alunos: ${t.totalAlunos || '—'}`)
    linhas.push(`  Ano Realização: ${t.anoRealizacao || '—'} | Modelo: ${t.modeloContrato || '—'}`)
  }
  linhas.push(`\nSeções (${r.secoesEncontradas.length}/8):`)
  for (const s of ORDEM_SECOES) {
    const sec = r.secoes[s]
    const icone = sec.encontrado ? '✅' : '—'
    const div   = sec.totalDivergencias > 0 ? ` ⚠️ ${sec.totalDivergencias} divergência(s)` : ''
    linhas.push(`  ${icone} ${s} ${NOMES_SECOES[s]}: ${sec.totalItens} itens${div}`)
  }
  linhas.push(`\nTotal: ${r.totalItens} itens | ${r.totalDivergencias} divergências`)
  if (r.avisos.length)  linhas.push(`\nAvisos:\n${r.avisos.map(a => `  ⚠️ ${a}`).join('\n')}`)
  if (r.erros.length)   linhas.push(`\nErros:\n${r.erros.map(e => `  ❌ ${e}`).join('\n')}`)
  return linhas.join('\n')
}

export { ORDEM_SECOES, NOMES_SECOES }
