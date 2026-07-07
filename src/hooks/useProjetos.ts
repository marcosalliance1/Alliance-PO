import { useState, useEffect, useCallback } from 'react'
import type { Projeto, SecaoCusto, ItemCusto, TAP, Receitas, ConciliacaoEverest, CustoAdicional, LinhaResumoComercial } from '../types'
import type { SyncResult } from '../utils/sheetsSync'
import { v4 as uuid } from '../utils/uuid'
import { getSecoesPorTipo } from '../data/secoesPorTipo'
import { calcItemTotais, filtrarItensCalculo, migrateReceitas, emptyReceitas } from '../utils/calculos'
import { supabase } from '../lib/supabase'

function rowToProjeto(row: Record<string, unknown>): Projeto {
  return {
    id: row.id as string,
    tap: row.tap as TAP,
    secoes: row.secoes as SecaoCusto[],
    receitas: migrateReceitas(row.receitas),
    custosAdicionais: (row.custos_adicionais as CustoAdicional[]) ?? [],
    conciliacaoEverest: (row.conciliacao_everest as ConciliacaoEverest) ?? undefined,
    resumoComercial: (row.resumo_comercial as LinhaResumoComercial[]) ?? [],
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    importadoDe: (row.importado_de as string) ?? undefined,
    sheetsUrl: (row.sheets_url as string) ?? undefined,
    sheetLayout: ((row.sheet_layout as string) === 'B' ? 'B' : undefined),
    status: (row.status as string) === 'realizado' ? 'realizado' : 'em_andamento',
    totalConvidadosAtual: (row.total_convidados_atual as number) ?? undefined,
  }
}

export function useProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Carregar todos ──────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('projetos')
      .select('*')
      .order('criado_em', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    const mapped = (data ?? []).map(rowToProjeto)

    // Auto-marcar como realizado projetos cuja data de evento já passou
    const hoje = new Date().toISOString().slice(0, 10)
    const paraAtualizar = mapped.filter(
      (p) => p.status === 'em_andamento' && p.tap.dataEvento && p.tap.dataEvento.slice(0, 10) <= hoje,
    )
    if (paraAtualizar.length > 0) {
      await supabase.from('projetos').update({ status: 'realizado' }).in('id', paraAtualizar.map((p) => p.id))
      setProjetos(mapped.map((p) => paraAtualizar.some((a) => a.id === p.id) ? { ...p, status: 'realizado' } : p))
    } else {
      setProjetos(mapped)
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Criar ───────────────────────────────────────────────────────────────────
  const criarProjeto = useCallback(async (tap: TAP, sheetsUrl?: string): Promise<Projeto> => {
    const secoes: SecaoCusto[] = getSecoesPorTipo(tap.tipoEscola).map((def) => ({
      id: uuid(), numero: def.numero, nome: def.nome, itens: [],
    }))
    const receitas: Receitas = emptyReceitas()
    const id = uuid()
    const { data, error: err } = await supabase
      .from('projetos')
      .insert({ id, tap, secoes, receitas, sheets_url: sheetsUrl || null })
      .select()
      .single()
    if (err) throw new Error(err.message)
    const projeto = rowToProjeto(data)
    setProjetos((prev) => [projeto, ...prev])
    return projeto
  }, [])

  // ── Salvar / upsert ─────────────────────────────────────────────────────────
  const salvarProjeto = useCallback(async (projeto: Projeto) => {
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('projetos')
      .upsert({
        id: projeto.id,
        tap: projeto.tap,
        secoes: projeto.secoes,
        receitas: projeto.receitas,
        custos_adicionais: projeto.custosAdicionais ?? [],
        conciliacao_everest: projeto.conciliacaoEverest ?? null,
        resumo_comercial: projeto.resumoComercial ?? [],
        importado_de: projeto.importadoDe ?? null,
        atualizado_em: now,
      })
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) => p.id === projeto.id ? { ...projeto, atualizadoEm: now } : p))
  }, [])

  // ── Importar (upsert completo — novo projeto) ───────────────────────────────
  const importarProjeto = useCallback(async (projeto: Projeto) => {
    const { error: err } = await supabase
      .from('projetos')
      .upsert({
        id: projeto.id,
        tap: projeto.tap,
        secoes: projeto.secoes,
        receitas: projeto.receitas,
        custos_adicionais: projeto.custosAdicionais ?? [],
        conciliacao_everest: projeto.conciliacaoEverest ?? null,
        resumo_comercial: projeto.resumoComercial ?? [],
        importado_de: projeto.importadoDe ?? null,
        atualizado_em: new Date().toISOString(),
      })
    if (err) throw new Error(err.message)
    setProjetos((prev) => {
      const existe = prev.find((p) => p.id === projeto.id)
      return existe ? prev.map((p) => p.id === projeto.id ? projeto : p) : [projeto, ...prev]
    })
  }, [])

  // ── Reimportar (atualizar projeto existente a partir de novo xlsx) ──────────
  const reimportarProjeto = useCallback(async (id: string, novosProjeto: Projeto) => {
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('projetos')
      .update({
        tap: novosProjeto.tap,
        secoes: novosProjeto.secoes,
        resumo_comercial: novosProjeto.resumoComercial ?? [],
        importado_de: novosProjeto.importadoDe ?? null,
        atualizado_em: now,
      })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) =>
      p.id === id
        ? { ...p, tap: novosProjeto.tap, secoes: novosProjeto.secoes, resumoComercial: novosProjeto.resumoComercial, importadoDe: novosProjeto.importadoDe, atualizadoEm: now }
        : p,
    ))
  }, [])

  // ── Excluir ─────────────────────────────────────────────────────────────────
  const excluirProjeto = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('projetos').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // ── Helpers internos para salvar seções ────────────────────────────────────
  async function patchProjeto(id: string, patch: Partial<{ tap: TAP; secoes: SecaoCusto[]; receitas: Receitas; conciliacao_everest: unknown; custos_adicionais: CustoAdicional[] }>) {
    const now = new Date().toISOString()
    const { error: err } = await supabase.from('projetos').update({ ...patch, atualizado_em: now }).eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) => p.id === id ? { ...p, ...patch, atualizadoEm: now } : p))
  }

  // ── TAP ─────────────────────────────────────────────────────────────────────
  const atualizarTAP = useCallback(async (projetoId: string, tap: TAP) => {
    const projeto = projetos.find((p) => p.id === projetoId)
    if (!projeto) return
    let secoes = projeto.secoes
    if (tap.tipoEscola !== projeto.tap.tipoEscola) {
      const novasDefs = getSecoesPorTipo(tap.tipoEscola)
      secoes = novasDefs.map((def) =>
        projeto.secoes.find((s) => s.numero === def.numero)
        ?? { id: uuid(), numero: def.numero, nome: def.nome, itens: [] }
      )
    }
    // Recalcular projetados de todos os itens quando IPCA ou parcelas mudam
    if (tap.ipca !== projeto.tap.ipca || tap.parcelas !== projeto.tap.parcelas) {
      secoes = secoes.map((s) => ({
        ...s,
        itens: s.itens.map((it) => ({ ...it, ...calcItemTotais(it, tap.ipca, tap.parcelas) })),
      }))
    }
    await patchProjeto(projetoId, { tap, secoes })
  }, [projetos])

  // ── Receitas ────────────────────────────────────────────────────────────────
  const atualizarReceitas = useCallback(async (projetoId: string, receitas: Receitas) => {
    await patchProjeto(projetoId, { receitas })
  }, [])

  // ── Item: adicionar ─────────────────────────────────────────────────────────
  const adicionarItem = useCallback(async (projetoId: string, secaoId: string, partial: Partial<ItemCusto>) => {
    const projeto = projetos.find((p) => p.id === projetoId)
    if (!projeto) return
    const novoItem: ItemCusto = {
      id: uuid(), codigo: '', area: '', subcategoria: '', item: '', fornecedor: '',
      tipoCusto: 'Custo Fixo', moscow: '', qtdeVendida: 0, valorUnitarioAtual: 0,
      totalAtual: 0, valorProjetado: 0, totalProjetado: 0, qtdeOrcada: 0,
      valorUnitarioOrcado: 0, valorOrcado: 0, qtdeContratada: 0,
      valorUnitarioContratado: 0, valorContratado: 0, responsavel: '', status: 'orçar',
      statusPagamento: 'N/A', valorFinal: 0, valorPago: 0, faltaPagar: 0,
      totalProgramado: 0, emAberto: 0, jotform: [], ...partial,
    }
    const secoes = projeto.secoes.map((s) =>
      s.id === secaoId ? { ...s, itens: [...s.itens, novoItem] } : s
    )
    await patchProjeto(projetoId, { secoes })
  }, [projetos])

  // ── Item: atualizar ─────────────────────────────────────────────────────────
  const atualizarItem = useCallback(async (
    projetoId: string, secaoId: string, itemId: string, changes: Partial<ItemCusto>
  ) => {
    const projeto = projetos.find((p) => p.id === projetoId)
    if (!projeto) return
    const { ipca, parcelas } = projeto.tap
    const secoes = projeto.secoes.map((s) => {
      if (s.id !== secaoId) return s
      return {
        ...s,
        itens: s.itens.map((it) => {
          if (it.id !== itemId) return it
          const merged = { ...it, ...changes }
          return { ...merged, ...calcItemTotais(merged, ipca, parcelas) }
        }),
      }
    })
    await patchProjeto(projetoId, { secoes })
  }, [projetos])

  // ── Item: excluir ───────────────────────────────────────────────────────────
  const excluirItem = useCallback(async (projetoId: string, secaoId: string, itemId: string) => {
    const projeto = projetos.find((p) => p.id === projetoId)
    if (!projeto) return
    const secoes = projeto.secoes.map((s) =>
      s.id === secaoId ? { ...s, itens: s.itens.filter((i) => i.id !== itemId) } : s
    )
    await patchProjeto(projetoId, { secoes })
  }, [projetos])

  // ── Conciliação Everest ──────────────────────────────────────────────────────
  const atualizarConciliacao = useCallback(async (projetoId: string, conciliacaoEverest: ConciliacaoEverest) => {
    await patchProjeto(projetoId, { conciliacao_everest: conciliacaoEverest })
  }, [projetos]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Custos Adicionais ────────────────────────────────────────────────────────
  const atualizarCustosAdicionais = useCallback(async (projetoId: string, custosAdicionais: CustoAdicional[]) => {
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('projetos')
      .update({ custos_adicionais: custosAdicionais, atualizado_em: now })
      .eq('id', projetoId)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) =>
      p.id === projetoId ? { ...p, custosAdicionais, atualizadoEm: now } : p
    ))
  }, [])

  const getProjeto = useCallback(
    (id: string) => projetos.find((p) => p.id === id),
    [projetos],
  )

  // ── Sincronização Google Sheets ─────────────────────────────────────────────
  const sincronizarSecoes = useCallback(async (id: string, result: SyncResult) => {
    const projeto = projetos.find(p => p.id === id)
    if (!projeto) return

    const novoTAP = Object.keys(result.tap).length > 0
      ? { ...projeto.tap, ...result.tap }
      : projeto.tap
    const novasReceitas = Object.keys(result.receitas).length > 0 ? result.receitas : projeto.receitas

    // Auto-fill Conciliação Everest: preserva valor já digitado; preenche seções novas
    // usando a mesma filtragem do Sistema (filtrarItensCalculo) para garantir consistência
    const linhasEverest = result.secoes.map(secao => {
      const existing = projeto.conciliacaoEverest?.linhas.find(l => l.secaoId === secao.id)
      return {
        secaoId: secao.id,
        secaoNome: secao.nome,
        valorEverest: existing !== undefined
          ? existing.valorEverest
          : filtrarItensCalculo(secao.itens).reduce((s, i) => s + (i.valorPago || 0), 0),
        observacao: existing?.observacao ?? '',
      }
    })
    const novaConciliacao = {
      linhas: linhasEverest,
      observacaoGeral: projeto.conciliacaoEverest?.observacaoGeral ?? '',
    }

    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('projetos')
      .update({ secoes: result.secoes, tap: novoTAP, receitas: novasReceitas, conciliacao_everest: novaConciliacao, total_convidados_atual: result.totalConvidadosAtual ?? null, atualizado_em: now })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) =>
      p.id === id
        ? { ...p, secoes: result.secoes, tap: novoTAP, receitas: novasReceitas, conciliacaoEverest: novaConciliacao, totalConvidadosAtual: result.totalConvidadosAtual ?? undefined, atualizadoEm: now }
        : p
    ))
  }, [projetos])

  const atualizarSheetsUrl = useCallback(async (id: string, url: string) => {
    const { error: err } = await supabase
      .from('projetos')
      .update({ sheets_url: url || null })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) => p.id === id ? { ...p, sheetsUrl: url || undefined } : p))
  }, [])

  const atualizarSheetLayout = useCallback(async (id: string, layout: 'A' | 'B') => {
    const { error: err } = await supabase
      .from('projetos')
      .update({ sheet_layout: layout })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) => p.id === id ? { ...p, sheetLayout: layout } : p))
  }, [])

  // ── Marcar como realizado ────────────────────────────────────────────────────
  const marcarRealizado = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('projetos').update({ status: 'realizado' }).eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) => p.id === id ? { ...p, status: 'realizado' } : p))
  }, [])

  return {
    projetos, loading, error,
    carregar, criarProjeto, salvarProjeto, importarProjeto, reimportarProjeto, excluirProjeto,
    atualizarTAP, atualizarReceitas, atualizarConciliacao, atualizarCustosAdicionais,
    adicionarItem, atualizarItem, excluirItem,
    getProjeto, sincronizarSecoes, atualizarSheetsUrl, atualizarSheetLayout, marcarRealizado,
  }
}
