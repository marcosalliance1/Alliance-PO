import { useState, useEffect, useCallback } from 'react'
import type { Projeto, SecaoCusto, ItemCusto, TAP, Receitas, ConciliacaoEverest } from '../types'
import type { SyncResult } from '../utils/sheetsSync'
import { v4 as uuid } from '../utils/uuid'
import { getSecoesPorTipo } from '../data/secoesPorTipo'
import { calcItemTotais, migrateReceitas, emptyReceitas } from '../utils/calculos'
import { supabase } from '../lib/supabase'

function rowToProjeto(row: Record<string, unknown>): Projeto {
  return {
    id: row.id as string,
    tap: row.tap as TAP,
    secoes: row.secoes as SecaoCusto[],
    receitas: migrateReceitas(row.receitas),
    conciliacaoEverest: (row.conciliacao_everest as ConciliacaoEverest) ?? undefined,
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    importadoDe: (row.importado_de as string) ?? undefined,
    sheetsUrl: (row.sheets_url as string) ?? undefined,
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
    setProjetos((data ?? []).map(rowToProjeto))
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
        conciliacao_everest: projeto.conciliacaoEverest ?? null,
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
        conciliacao_everest: projeto.conciliacaoEverest ?? null,
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
        importado_de: novosProjeto.importadoDe ?? null,
        atualizado_em: now,
      })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) =>
      p.id === id
        ? { ...p, tap: novosProjeto.tap, secoes: novosProjeto.secoes, importadoDe: novosProjeto.importadoDe, atualizadoEm: now }
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
  async function patchProjeto(id: string, patch: Partial<{ tap: TAP; secoes: SecaoCusto[]; receitas: Receitas; conciliacao_everest: unknown }>) {
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
    const novasReceitas = { ...projeto.receitas, ...result.receitas }

    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('projetos')
      .update({ secoes: result.secoes, tap: novoTAP, receitas: novasReceitas, atualizado_em: now })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) =>
      p.id === id ? { ...p, secoes: result.secoes, tap: novoTAP, receitas: novasReceitas, atualizadoEm: now } : p
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

  return {
    projetos, loading, error,
    carregar, criarProjeto, salvarProjeto, importarProjeto, reimportarProjeto, excluirProjeto,
    atualizarTAP, atualizarReceitas, atualizarConciliacao, adicionarItem, atualizarItem, excluirItem,
    getProjeto, sincronizarSecoes, atualizarSheetsUrl,
  }
}
