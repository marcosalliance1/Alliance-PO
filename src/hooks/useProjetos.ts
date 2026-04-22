import { useState, useEffect, useCallback } from 'react'
import type { Projeto, SecaoCusto, ItemCusto, TAP, Receitas } from '../types'
import { v4 as uuid } from '../utils/uuid'
import { getSecoesPorTipo } from '../data/secoesPorTipo'
import { calcItemTotais } from '../utils/calculos'
import { supabase } from '../lib/supabase'

function rowToProjeto(row: Record<string, unknown>): Projeto {
  return {
    id: row.id as string,
    tap: row.tap as TAP,
    secoes: row.secoes as SecaoCusto[],
    receitas: row.receitas as Receitas,
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    importadoDe: (row.importado_de as string) ?? undefined,
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
  const criarProjeto = useCallback(async (tap: TAP): Promise<Projeto> => {
    const secoes: SecaoCusto[] = getSecoesPorTipo(tap.tipoEscola).map((def) => ({
      id: uuid(), numero: def.numero, nome: def.nome, itens: [],
    }))
    const receitas: Receitas = {
      faturamentoAdesoes: 0, vendasConvitesExtras: 0, vendasMesasExtras: 0,
      arrecadacaoExtra: 0, receitaVendasBaile: 0, outros: 0, receitaRescisoes: 0,
    }
    const id = uuid()
    const { data, error: err } = await supabase
      .from('projetos')
      .insert({ id, tap, secoes, receitas })
      .select()
      .single()
    if (err) throw new Error(err.message)
    const projeto = rowToProjeto(data)
    setProjetos((prev) => [projeto, ...prev])
    return projeto
  }, [])

  // ── Salvar / upsert ─────────────────────────────────────────────────────────
  const salvarProjeto = useCallback(async (projeto: Projeto) => {
    const { error: err } = await supabase
      .from('projetos')
      .upsert({
        id: projeto.id,
        tap: projeto.tap,
        secoes: projeto.secoes,
        receitas: projeto.receitas,
        importado_de: projeto.importadoDe ?? null,
      })
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) => p.id === projeto.id ? projeto : p))
  }, [])

  // ── Importar (upsert completo) ──────────────────────────────────────────────
  const importarProjeto = useCallback(async (projeto: Projeto) => {
    const { error: err } = await supabase
      .from('projetos')
      .upsert({
        id: projeto.id,
        tap: projeto.tap,
        secoes: projeto.secoes,
        receitas: projeto.receitas,
        importado_de: projeto.importadoDe ?? null,
      })
    if (err) throw new Error(err.message)
    setProjetos((prev) => {
      const existe = prev.find((p) => p.id === projeto.id)
      return existe ? prev.map((p) => p.id === projeto.id ? projeto : p) : [projeto, ...prev]
    })
  }, [])

  // ── Excluir ─────────────────────────────────────────────────────────────────
  const excluirProjeto = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('projetos').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // ── Helpers internos para salvar seções ────────────────────────────────────
  async function patchProjeto(id: string, patch: Partial<{ tap: TAP; secoes: SecaoCusto[]; receitas: Receitas }>) {
    const { error: err } = await supabase.from('projetos').update(patch).eq('id', id)
    if (err) throw new Error(err.message)
    setProjetos((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p))
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

  const getProjeto = useCallback(
    (id: string) => projetos.find((p) => p.id === id),
    [projetos],
  )

  return {
    projetos, loading, error,
    carregar, criarProjeto, salvarProjeto, importarProjeto, excluirProjeto,
    atualizarTAP, atualizarReceitas, adicionarItem, atualizarItem, excluirItem,
    getProjeto,
  }
}
