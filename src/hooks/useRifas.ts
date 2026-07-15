import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  ABA_INFORMACOES, ABA_GANHADORES, ABA_COMPRAS,
  COLS_INFORMACOES, COLS_GANHADORES, COLS_COMPRAS,
  parseAbaInformacoes, parseAbaGanhadores, parseAbaCompras,
  lerAba, escreverLinha, escreverCelula, anexarLinha, listarAbas, encontrarAbaReal,
  formatarDataBR, hashLinha, construirLinhaArray, normalizarChave, mapearColunas,
  type RifaSheetRow, type GanhadorSheetRow, type CompraSheetRow,
} from '../lib/rifasSync'

async function fetchAll<T>(tabela: string): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase.from(tabela).select('*').range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return all
}

export interface Rifa {
  id: string
  turma: string
  dimensao_projeto_id: number | null
  match_confianca: number | null
  match_manual: boolean
  edicao: string | null
  formacao: string | null
  ano_formatura: number | null
  atribuido_raw: string | null
  dia_vencimento: string | null
  premio_descricao: string | null
  valor_boleto: number | null
  situacao: string | null
  sheet_row_number: number | null
  sheet_row_hash: string | null
  created_at: string
  updated_at: string
}

export interface RifaGanhador {
  id: string
  rifa_id: string | null
  turma: string
  responsavel: string | null
  tipo: string | null
  premio_descricao: string | null
  data_sorteio: string | null
  sorteado: boolean
  nome_ganhador: string | null
  contato: string | null
  contato_feito: boolean
  premio_entregue: string | null
  financeiro: string | null
  obs: string | null
  sheet_row_number: number | null
  sheet_row_hash: string | null
  created_at: string
  updated_at: string
}

export interface RifaCompra {
  id: string
  ganhador_id: string
  endereco: string | null
  informacoes: string | null
  site: string | null
  valor: number | null
  status: string | null
  data_compra: string | null
  data_entrega_raw: string | null
  nome_cartao: string | null
  preenchido_planilha: boolean
  sheet_row_number: number | null
  sheet_row_hash: string | null
  created_at: string
  updated_at: string
}

export interface RifaTurmaOverride {
  turma: string
  dimensao_projeto_id: number
  criado_em: string
}

export interface RifaSyncConflito {
  id: number
  tabela_origem: 'rifas' | 'rifas_ganhadores' | 'rifas_compras'
  registro_id: string
  campo: string
  valor_alliance: string | null
  valor_sheet: string | null
  resolvido: boolean
  detectado_em: string
}

export interface RifaSyncLog {
  id: number
  executado_em: string
  registros_criados: number
  registros_atualizados: number
  conflitos_detectados: number
  erro: string | null
}

export interface SincronizarResult {
  criados: number
  atualizados: number
  conflitos: number
  erros: string[]
}

// ── Motor de diff genérico (mesma lógica para as 3 tabelas) ──────────────────

interface DiffCampo<S, D> { campo: string; doSheet: (s: S) => unknown; doDb: (d: D) => unknown }

type LinhaBase = { linha: number; hash: string }
type RegistroBase = { id: string; sheet_row_number: number | null; sheet_row_hash: string | null; updated_at: string }

type AcaoDiff<S extends LinhaBase, D extends RegistroBase> =
  | { tipo: 'inserir'; sheetRow: S }
  | { tipo: 'atualizar_db'; sheetRow: S; dbRow: D }
  | { tipo: 'atualizar_sheet'; dbRow: D }
  | { tipo: 'anexar'; dbRow: D }
  | { tipo: 'conflito'; dbRow: D; campos: { campo: string; valorAlliance: string; valorSheet: string }[] }

function diffTabela<S extends LinhaBase, D extends RegistroBase>(
  sheetRows: S[],
  dbRows: D[],
  campos: DiffCampo<S, D>[],
  ultimaSyncEm: string | null,
): AcaoDiff<S, D>[] {
  const porLinha = new Map<number, D>()
  for (const d of dbRows) if (d.sheet_row_number != null) porLinha.set(d.sheet_row_number, d)

  const acoes: AcaoDiff<S, D>[] = []

  for (const s of sheetRows) {
    const d = porLinha.get(s.linha)
    if (!d) { acoes.push({ tipo: 'inserir', sheetRow: s }); continue }

    const sheetChanged = d.sheet_row_hash !== s.hash
    const allianceChanged = !!ultimaSyncEm && d.updated_at > ultimaSyncEm

    if (sheetChanged && !allianceChanged) { acoes.push({ tipo: 'atualizar_db', sheetRow: s, dbRow: d }); continue }
    if (!sheetChanged && allianceChanged) { acoes.push({ tipo: 'atualizar_sheet', dbRow: d }); continue }
    if (sheetChanged && allianceChanged) {
      const camposConflito = campos
        .map(c => ({ campo: c.campo, valorAlliance: String(c.doDb(d) ?? ''), valorSheet: String(c.doSheet(s) ?? '') }))
        .filter(c => c.valorAlliance !== c.valorSheet)
      if (camposConflito.length > 0) acoes.push({ tipo: 'conflito', dbRow: d, campos: camposConflito })
    }
    // nem sheet nem alliance mudaram → nada a fazer
  }

  for (const d of dbRows) {
    if (d.sheet_row_number == null) acoes.push({ tipo: 'anexar', dbRow: d })
  }

  return acoes
}

async function registrarConflitos(tabela: RifaSyncConflito['tabela_origem'], registroId: string, campos: { campo: string; valorAlliance: string; valorSheet: string }[]): Promise<number> {
  let n = 0
  for (const c of campos) {
    const { error } = await supabase.from('rifas_sync_conflitos').insert({
      tabela_origem: tabela, registro_id: registroId, campo: c.campo,
      valor_alliance: c.valorAlliance, valor_sheet: c.valorSheet,
    })
    if (!error) n++
  }
  return n
}

// ── 1) rifas (INFORMAÇÕES) ───────────────────────────────────────────────────

const CAMPOS_RIFAS: DiffCampo<RifaSheetRow, Rifa>[] = [
  { campo: 'edicao', doSheet: s => s.edicao, doDb: d => d.edicao },
  { campo: 'formacao', doSheet: s => s.formacao, doDb: d => d.formacao },
  { campo: 'ano_formatura', doSheet: s => s.ano_formatura, doDb: d => d.ano_formatura },
  { campo: 'atribuido_raw', doSheet: s => s.atribuido_raw, doDb: d => d.atribuido_raw },
  { campo: 'dia_vencimento', doSheet: s => s.dia_vencimento, doDb: d => d.dia_vencimento },
  { campo: 'premio_descricao', doSheet: s => s.premio_descricao, doDb: d => d.premio_descricao },
  { campo: 'valor_boleto', doSheet: s => s.valor_boleto, doDb: d => d.valor_boleto },
  { campo: 'situacao', doSheet: s => s.situacao, doDb: d => d.situacao },
]

async function sincronizarRifasTabela(
  linhas: RifaSheetRow[], colunas: Record<string, number>, atuais: Rifa[], abaReal: string,
  spreadsheetId: string, accessToken: string, ultimaSyncEm: string | null, erros: string[],
): Promise<{ criados: number; atualizados: number; conflitos: number }> {
  let criados = 0, atualizados = 0, conflitos = 0
  const acoes = diffTabela(linhas, atuais, CAMPOS_RIFAS, ultimaSyncEm)

  for (const acao of acoes) {
    if (acao.tipo === 'inserir') {
      const s = acao.sheetRow
      const { error } = await supabase.from('rifas').insert({
        turma: s.turma, edicao: s.edicao, formacao: s.formacao, ano_formatura: s.ano_formatura,
        atribuido_raw: s.atribuido_raw, dia_vencimento: s.dia_vencimento, premio_descricao: s.premio_descricao,
        valor_boleto: s.valor_boleto, situacao: s.situacao, sheet_row_number: s.linha, sheet_row_hash: s.hash,
      })
      if (error) erros.push(`Inserir rifa (linha ${s.linha}): ${error.message}`)
      else criados++
    } else if (acao.tipo === 'atualizar_db') {
      const s = acao.sheetRow
      const { error } = await supabase.from('rifas').update({
        turma: s.turma, edicao: s.edicao, formacao: s.formacao, ano_formatura: s.ano_formatura,
        atribuido_raw: s.atribuido_raw, dia_vencimento: s.dia_vencimento, premio_descricao: s.premio_descricao,
        valor_boleto: s.valor_boleto, situacao: s.situacao, sheet_row_hash: s.hash,
      }).eq('id', acao.dbRow.id)
      if (error) erros.push(`Atualizar rifa ${acao.dbRow.id}: ${error.message}`)
      else atualizados++
    } else if (acao.tipo === 'atualizar_sheet' || acao.tipo === 'anexar') {
      const d = acao.dbRow
      const valores: Record<string, unknown> = {
        turma: d.turma, formacao: d.formacao, ano_formatura: d.ano_formatura, atribuido_raw: d.atribuido_raw,
        dia_vencimento: formatarDataBR(d.dia_vencimento), premio_descricao: d.premio_descricao,
        valor_boleto: d.valor_boleto, situacao: d.situacao,
      }
      if (colunas.edicao !== undefined) valores.edicao = d.edicao
      try {
        const novoHash = hashLinha(construirLinhaArray(colunas, valores))
        if (acao.tipo === 'atualizar_sheet') {
          await escreverLinha(spreadsheetId, abaReal, d.sheet_row_number!, colunas, valores, accessToken)
          await supabase.from('rifas').update({ sheet_row_hash: novoHash }).eq('id', d.id)
        } else {
          const novaLinha = await anexarLinha(spreadsheetId, abaReal, colunas, valores, accessToken)
          await supabase.from('rifas').update({ sheet_row_number: novaLinha, sheet_row_hash: novoHash }).eq('id', d.id)
        }
        atualizados++
      } catch (e) {
        erros.push(`Escrever rifa ${d.id} na planilha: ${(e as Error).message}`)
      }
    } else if (acao.tipo === 'conflito') {
      conflitos += await registrarConflitos('rifas', acao.dbRow.id, acao.campos)
    }
  }

  return { criados, atualizados, conflitos }
}

// ── 2) rifas_ganhadores (GANHADORES) ─────────────────────────────────────────

const CAMPOS_GANHADORES: DiffCampo<GanhadorSheetRow, RifaGanhador>[] = [
  { campo: 'responsavel', doSheet: s => s.responsavel, doDb: d => d.responsavel },
  { campo: 'tipo', doSheet: s => s.tipo, doDb: d => d.tipo },
  { campo: 'premio_descricao', doSheet: s => s.premio_descricao, doDb: d => d.premio_descricao },
  { campo: 'data_sorteio', doSheet: s => s.data_sorteio, doDb: d => d.data_sorteio },
  { campo: 'sorteado', doSheet: s => s.sorteado, doDb: d => d.sorteado },
  { campo: 'nome_ganhador', doSheet: s => s.nome_ganhador, doDb: d => d.nome_ganhador },
  { campo: 'contato', doSheet: s => s.contato, doDb: d => d.contato },
  { campo: 'contato_feito', doSheet: s => s.contato_feito, doDb: d => d.contato_feito },
  { campo: 'premio_entregue', doSheet: s => s.premio_entregue, doDb: d => d.premio_entregue },
  { campo: 'financeiro', doSheet: s => s.financeiro, doDb: d => d.financeiro },
  { campo: 'obs', doSheet: s => s.obs, doDb: d => d.obs },
]

function resolverRifaId(s: GanhadorSheetRow, rifasAtuais: Rifa[]): string | null {
  if (normalizarChave(s.tipo) !== normalizarChave('Rifas do Projeto')) return null
  const turmaChave = normalizarChave(s.turma)
  const premioChave = normalizarChave(s.premio_descricao)
  const r = rifasAtuais.find(r => normalizarChave(r.turma) === turmaChave && normalizarChave(r.premio_descricao) === premioChave)
  return r?.id ?? null
}

async function sincronizarGanhadoresTabela(
  linhas: GanhadorSheetRow[], colunas: Record<string, number>, atuais: RifaGanhador[], rifasAtuais: Rifa[], abaReal: string,
  spreadsheetId: string, accessToken: string, ultimaSyncEm: string | null, erros: string[],
): Promise<{ criados: number; atualizados: number; conflitos: number }> {
  let criados = 0, atualizados = 0, conflitos = 0
  const acoes = diffTabela(linhas, atuais, CAMPOS_GANHADORES, ultimaSyncEm)

  for (const acao of acoes) {
    if (acao.tipo === 'inserir') {
      const s = acao.sheetRow
      const { error } = await supabase.from('rifas_ganhadores').insert({
        rifa_id: resolverRifaId(s, rifasAtuais), turma: s.turma, responsavel: s.responsavel, tipo: s.tipo,
        premio_descricao: s.premio_descricao, data_sorteio: s.data_sorteio, sorteado: s.sorteado,
        nome_ganhador: s.nome_ganhador, contato: s.contato, contato_feito: s.contato_feito,
        premio_entregue: s.premio_entregue, financeiro: s.financeiro, obs: s.obs,
        sheet_row_number: s.linha, sheet_row_hash: s.hash,
      })
      if (error) erros.push(`Inserir ganhador (linha ${s.linha}): ${error.message}`)
      else criados++
    } else if (acao.tipo === 'atualizar_db') {
      const s = acao.sheetRow
      const { error } = await supabase.from('rifas_ganhadores').update({
        rifa_id: resolverRifaId(s, rifasAtuais), turma: s.turma, responsavel: s.responsavel, tipo: s.tipo,
        premio_descricao: s.premio_descricao, data_sorteio: s.data_sorteio, sorteado: s.sorteado,
        nome_ganhador: s.nome_ganhador, contato: s.contato, contato_feito: s.contato_feito,
        premio_entregue: s.premio_entregue, financeiro: s.financeiro, obs: s.obs, sheet_row_hash: s.hash,
      }).eq('id', acao.dbRow.id)
      if (error) erros.push(`Atualizar ganhador ${acao.dbRow.id}: ${error.message}`)
      else atualizados++
    } else if (acao.tipo === 'atualizar_sheet' || acao.tipo === 'anexar') {
      const d = acao.dbRow
      const valores: Record<string, unknown> = {
        turma: d.turma, responsavel: d.responsavel, tipo: d.tipo, premio_descricao: d.premio_descricao,
        data_sorteio: formatarDataBR(d.data_sorteio), sorteado: d.sorteado ? 'SIM' : 'NÃO',
        nome_ganhador: d.nome_ganhador, contato: d.contato, contato_feito: d.contato_feito ? 'SIM' : 'NÃO',
        premio_entregue: d.premio_entregue, financeiro: d.financeiro, obs: d.obs,
      }
      try {
        const novoHash = hashLinha(construirLinhaArray(colunas, valores))
        if (acao.tipo === 'atualizar_sheet') {
          await escreverLinha(spreadsheetId, abaReal, d.sheet_row_number!, colunas, valores, accessToken)
          await supabase.from('rifas_ganhadores').update({ sheet_row_hash: novoHash }).eq('id', d.id)
        } else {
          const novaLinha = await anexarLinha(spreadsheetId, abaReal, colunas, valores, accessToken)
          await supabase.from('rifas_ganhadores').update({ sheet_row_number: novaLinha, sheet_row_hash: novoHash }).eq('id', d.id)
        }
        atualizados++
      } catch (e) {
        erros.push(`Escrever ganhador ${d.id} na planilha: ${(e as Error).message}`)
      }
    } else if (acao.tipo === 'conflito') {
      conflitos += await registrarConflitos('rifas_ganhadores', acao.dbRow.id, acao.campos)
    }
  }

  return { criados, atualizados, conflitos }
}

// ── 3) rifas_compras (ACOMPANHAMENTO DE COMPRA) ──────────────────────────────

const CAMPOS_COMPRAS: DiffCampo<CompraSheetRow, RifaCompra>[] = [
  { campo: 'endereco', doSheet: s => s.endereco, doDb: d => d.endereco },
  { campo: 'informacoes', doSheet: s => s.informacoes, doDb: d => d.informacoes },
  { campo: 'site', doSheet: s => s.site, doDb: d => d.site },
  { campo: 'valor', doSheet: s => s.valor, doDb: d => d.valor },
  { campo: 'status', doSheet: s => s.status, doDb: d => d.status },
  { campo: 'data_compra', doSheet: s => s.data_compra, doDb: d => d.data_compra },
  { campo: 'data_entrega_raw', doSheet: s => s.data_entrega_raw, doDb: d => d.data_entrega_raw },
  { campo: 'nome_cartao', doSheet: s => s.nome_cartao, doDb: d => d.nome_cartao },
  { campo: 'preenchido_planilha', doSheet: s => s.preenchido_planilha, doDb: d => d.preenchido_planilha },
]

function resolverGanhadorId(s: CompraSheetRow, ganhadoresAtuais: RifaGanhador[]): string | null {
  const turmaChave = normalizarChave(s.turma)
  const premioChave = normalizarChave(s.premio_descricao)
  const nomeChave = normalizarChave(s.nome_ganhador)
  const g = ganhadoresAtuais.find(g =>
    normalizarChave(g.turma) === turmaChave &&
    normalizarChave(g.premio_descricao) === premioChave &&
    normalizarChave(g.nome_ganhador) === nomeChave,
  )
  return g?.id ?? null
}

async function sincronizarComprasTabela(
  linhas: CompraSheetRow[], colunas: Record<string, number>, atuais: RifaCompra[], ganhadoresAtuais: RifaGanhador[], abaReal: string,
  spreadsheetId: string, accessToken: string, ultimaSyncEm: string | null, erros: string[],
): Promise<{ criados: number; atualizados: number; conflitos: number }> {
  let criados = 0, atualizados = 0, conflitos = 0
  const acoes = diffTabela(linhas, atuais, CAMPOS_COMPRAS, ultimaSyncEm)

  for (const acao of acoes) {
    if (acao.tipo === 'inserir') {
      const s = acao.sheetRow
      const ganhadorId = resolverGanhadorId(s, ganhadoresAtuais)
      if (!ganhadorId) {
        erros.push(`Compra (linha ${s.linha}): nenhum ganhador encontrado para TURMA "${s.turma}" + PRÊMIO "${s.premio_descricao}" + NOME "${s.nome_ganhador}" — linha ignorada.`)
        continue
      }
      const { error } = await supabase.from('rifas_compras').insert({
        ganhador_id: ganhadorId, endereco: s.endereco, informacoes: s.informacoes, site: s.site,
        valor: s.valor, status: s.status, data_compra: s.data_compra, data_entrega_raw: s.data_entrega_raw,
        nome_cartao: s.nome_cartao, preenchido_planilha: s.preenchido_planilha,
        sheet_row_number: s.linha, sheet_row_hash: s.hash,
      })
      if (error) erros.push(`Inserir compra (linha ${s.linha}): ${error.message}`)
      else criados++
    } else if (acao.tipo === 'atualizar_db') {
      const s = acao.sheetRow
      const { error } = await supabase.from('rifas_compras').update({
        endereco: s.endereco, informacoes: s.informacoes, site: s.site, valor: s.valor, status: s.status,
        data_compra: s.data_compra, data_entrega_raw: s.data_entrega_raw, nome_cartao: s.nome_cartao,
        preenchido_planilha: s.preenchido_planilha, sheet_row_hash: s.hash,
      }).eq('id', acao.dbRow.id)
      if (error) erros.push(`Atualizar compra ${acao.dbRow.id}: ${error.message}`)
      else atualizados++
    } else if (acao.tipo === 'atualizar_sheet' || acao.tipo === 'anexar') {
      const d = acao.dbRow
      const ganhador = ganhadoresAtuais.find(g => g.id === d.ganhador_id)
      const valores: Record<string, unknown> = {
        turma: ganhador?.turma ?? '', premio_descricao: ganhador?.premio_descricao ?? '', nome_ganhador: ganhador?.nome_ganhador ?? '',
        endereco: d.endereco, informacoes: d.informacoes, site: d.site, valor: d.valor, status: d.status,
        data_compra: formatarDataBR(d.data_compra), data_entrega_raw: d.data_entrega_raw, nome_cartao: d.nome_cartao,
        preenchido_planilha: d.preenchido_planilha ? 'SIM' : 'NÃO',
      }
      try {
        const novoHash = hashLinha(construirLinhaArray(colunas, valores))
        if (acao.tipo === 'atualizar_sheet') {
          await escreverLinha(spreadsheetId, abaReal, d.sheet_row_number!, colunas, valores, accessToken)
          await supabase.from('rifas_compras').update({ sheet_row_hash: novoHash }).eq('id', d.id)
        } else {
          const novaLinha = await anexarLinha(spreadsheetId, abaReal, colunas, valores, accessToken)
          await supabase.from('rifas_compras').update({ sheet_row_number: novaLinha, sheet_row_hash: novoHash }).eq('id', d.id)
        }
        atualizados++
      } catch (e) {
        erros.push(`Escrever compra ${d.id} na planilha: ${(e as Error).message}`)
      }
    } else if (acao.tipo === 'conflito') {
      conflitos += await registrarConflitos('rifas_compras', acao.dbRow.id, acao.campos)
    }
  }

  return { criados, atualizados, conflitos }
}

// ── Resolução manual de conflitos ────────────────────────────────────────────

const ABA_POR_TABELA: Record<RifaSyncConflito['tabela_origem'], string> = {
  rifas: ABA_INFORMACOES, rifas_ganhadores: ABA_GANHADORES, rifas_compras: ABA_COMPRAS,
}
const COLS_POR_TABELA: Record<RifaSyncConflito['tabela_origem'], Record<string, string[]>> = {
  rifas: COLS_INFORMACOES, rifas_ganhadores: COLS_GANHADORES, rifas_compras: COLS_COMPRAS,
}
const CAMPOS_BOOLEANOS: Record<string, boolean> = { sorteado: true, contato_feito: true, preenchido_planilha: true }
const CAMPOS_NUMERICOS: Record<string, boolean> = { ano_formatura: true, valor_boleto: true, valor: true }

function coagirValorSheet(campo: string, valor: string): unknown {
  if (CAMPOS_BOOLEANOS[campo]) return valor === 'true'
  if (CAMPOS_NUMERICOS[campo]) { const n = Number(valor); return isNaN(n) ? null : n }
  return valor || null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRifas() {
  const [rifas, setRifas] = useState<Rifa[]>([])
  const [ganhadores, setGanhadores] = useState<RifaGanhador[]>([])
  const [compras, setCompras] = useState<RifaCompra[]>([])
  const [overrides, setOverrides] = useState<RifaTurmaOverride[]>([])
  const [conflitos, setConflitos] = useState<RifaSyncConflito[]>([])
  const [syncLogs, setSyncLogs] = useState<RifaSyncLog[]>([])
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [r, g, c, o, cf, sl] = await Promise.all([
      fetchAll<Rifa>('rifas').catch(() => [] as Rifa[]),
      fetchAll<RifaGanhador>('rifas_ganhadores').catch(() => [] as RifaGanhador[]),
      fetchAll<RifaCompra>('rifas_compras').catch(() => [] as RifaCompra[]),
      fetchAll<RifaTurmaOverride>('rifas_turma_overrides').catch(() => [] as RifaTurmaOverride[]),
      fetchAll<RifaSyncConflito>('rifas_sync_conflitos').catch(() => [] as RifaSyncConflito[]),
      fetchAll<RifaSyncLog>('rifas_sync_log').catch(() => [] as RifaSyncLog[]),
    ])
    setRifas(r); setGanhadores(g); setCompras(c); setOverrides(o); setConflitos(cf); setSyncLogs(sl)
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const ultimoSync = syncLogs.reduce<string | null>((max, l) => (!max || l.executado_em > max ? l.executado_em : max), null)

  async function sincronizar(spreadsheetId: string, accessToken: string): Promise<SincronizarResult> {
    setSincronizando(true)
    const erros: string[] = []
    let criados = 0, atualizados = 0, conflitosDetectados = 0
    try {
      const ultimaSyncEm = ultimoSync

      const todasAbas = await listarAbas(spreadsheetId, accessToken)
      const abaInformacoesReal = encontrarAbaReal(ABA_INFORMACOES, todasAbas)
      const abaGanhadoresReal = encontrarAbaReal(ABA_GANHADORES, todasAbas)
      const abaComprasReal = encontrarAbaReal(ABA_COMPRAS, todasAbas)

      if (!abaInformacoesReal) erros.push(`Aba "${ABA_INFORMACOES}" não encontrada na planilha. Abas disponíveis: ${todasAbas.join(', ')}`)
      if (!abaGanhadoresReal) erros.push(`Aba "${ABA_GANHADORES}" não encontrada na planilha. Abas disponíveis: ${todasAbas.join(', ')}`)
      if (!abaComprasReal) erros.push(`Aba "${ABA_COMPRAS}" não encontrada na planilha. Abas disponíveis: ${todasAbas.join(', ')}`)

      const [valoresInformacoes, valoresGanhadores, valoresCompras] = await Promise.all([
        abaInformacoesReal ? lerAba(spreadsheetId, abaInformacoesReal, accessToken) : Promise.resolve([]),
        abaGanhadoresReal ? lerAba(spreadsheetId, abaGanhadoresReal, accessToken) : Promise.resolve([]),
        abaComprasReal ? lerAba(spreadsheetId, abaComprasReal, accessToken) : Promise.resolve([]),
      ])

      const infoParsed = parseAbaInformacoes(valoresInformacoes)
      const ganhParsed = parseAbaGanhadores(valoresGanhadores)
      const compParsed = parseAbaCompras(valoresCompras)
      erros.push(...infoParsed.avisos, ...ganhParsed.avisos, ...compParsed.avisos)

      let r1 = { criados: 0, atualizados: 0, conflitos: 0 }
      if (abaInformacoesReal) {
        r1 = await sincronizarRifasTabela(infoParsed.linhas, infoParsed.colunas, rifas, abaInformacoesReal, spreadsheetId, accessToken, ultimaSyncEm, erros)
      }
      criados += r1.criados; atualizados += r1.atualizados; conflitosDetectados += r1.conflitos

      const rifasAtualizadas = await fetchAll<Rifa>('rifas').catch(() => rifas)

      let r2 = { criados: 0, atualizados: 0, conflitos: 0 }
      if (abaGanhadoresReal) {
        r2 = await sincronizarGanhadoresTabela(ganhParsed.linhas, ganhParsed.colunas, ganhadores, rifasAtualizadas, abaGanhadoresReal, spreadsheetId, accessToken, ultimaSyncEm, erros)
      }
      criados += r2.criados; atualizados += r2.atualizados; conflitosDetectados += r2.conflitos

      const ganhadoresAtualizados = await fetchAll<RifaGanhador>('rifas_ganhadores').catch(() => ganhadores)

      let r3 = { criados: 0, atualizados: 0, conflitos: 0 }
      if (abaComprasReal) {
        r3 = await sincronizarComprasTabela(compParsed.linhas, compParsed.colunas, compras, ganhadoresAtualizados, abaComprasReal, spreadsheetId, accessToken, ultimaSyncEm, erros)
      }
      criados += r3.criados; atualizados += r3.atualizados; conflitosDetectados += r3.conflitos

      const { error: rpcError } = await supabase.rpc('rifas_recalcular_matches')
      if (rpcError) erros.push(`Recalcular matches: ${rpcError.message}`)

      await supabase.from('rifas_sync_log').insert({
        registros_criados: criados, registros_atualizados: atualizados,
        conflitos_detectados: conflitosDetectados, erro: erros.length > 0 ? erros.join(' | ') : null,
      })

      await carregar()
      return { criados, atualizados, conflitos: conflitosDetectados, erros }
    } catch (e) {
      const msg = (e as Error).message
      await supabase.from('rifas_sync_log').insert({
        registros_criados: criados, registros_atualizados: atualizados, conflitos_detectados: conflitosDetectados, erro: msg,
      })
      await carregar()
      throw e
    } finally {
      setSincronizando(false)
    }
  }

  async function salvarOverride(turma: string, dimensaoProjetoId: number) {
    const { error } = await supabase.from('rifas_turma_overrides').upsert({ turma, dimensao_projeto_id: dimensaoProjetoId })
    if (error) throw new Error(error.message)
    const { error: rpcError } = await supabase.rpc('rifas_recalcular_matches')
    if (rpcError) throw new Error(rpcError.message)
    await carregar()
  }

  async function resolverConflito(conflito: RifaSyncConflito, manter: 'alliance' | 'sheet', spreadsheetId: string, accessToken: string) {
    const nomeEsperado = ABA_POR_TABELA[conflito.tabela_origem]
    const todasAbas = await listarAbas(spreadsheetId, accessToken)
    const aba = encontrarAbaReal(nomeEsperado, todasAbas)
    if (!aba) throw new Error(`Aba "${nomeEsperado}" não encontrada na planilha. Abas disponíveis: ${todasAbas.join(', ')}`)

    const { data: registro, error: fetchError } = await supabase
      .from(conflito.tabela_origem).select('sheet_row_number').eq('id', conflito.registro_id).single()
    if (fetchError || !registro?.sheet_row_number) throw new Error(fetchError?.message ?? 'Linha da planilha não encontrada para este registro.')

    const headerValues = await lerAba(spreadsheetId, aba, accessToken)
    const colunas = mapearColunas((headerValues[0] as unknown[]) ?? [], COLS_POR_TABELA[conflito.tabela_origem])
    const colIdx = colunas[conflito.campo]
    if (colIdx === undefined) throw new Error(`Coluna "${conflito.campo}" não encontrada na aba "${aba}".`)

    if (manter === 'alliance') {
      await escreverCelula(spreadsheetId, aba, registro.sheet_row_number, colIdx, conflito.valor_alliance ?? '', accessToken)
    } else {
      const valor = coagirValorSheet(conflito.campo, conflito.valor_sheet ?? '')
      const { error } = await supabase.from(conflito.tabela_origem).update({ [conflito.campo]: valor }).eq('id', conflito.registro_id)
      if (error) throw new Error(error.message)
    }

    await supabase.from('rifas_sync_conflitos').update({ resolvido: true }).eq('id', conflito.id)
    await carregar()
  }

  return {
    rifas, ganhadores, compras, overrides, conflitos, syncLogs,
    carregando, sincronizando, ultimoSync,
    sincronizar, salvarOverride, resolverConflito, recarregar: carregar,
  }
}
