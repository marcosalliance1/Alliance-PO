import { useState, useEffect, useCallback } from 'react'
import type { Orcamento, EventType } from '../types'
import { newItemId } from '../utils/formatters'
import {
  ITENS_OPERACAO_ESTRUTURA,
  ITENS_AB,
  ITENS_EXTRAS,
} from '../data/defaults'
import { gerarEquipeAutomatica, recalcularItem } from '../utils/automacoes'
import type { ConfiguracaoAutomacoes, ItemOrcamento } from '../types'
import { supabase, hasSupabase } from '../lib/supabase'

const LS_KEY = 'alliance_orcamentos'

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadFromLS(): Orcamento[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as Orcamento[]
  } catch {
    console.warn('[Alliance] localStorage parse error — resetting orcamentos')
    localStorage.removeItem(LS_KEY)
  }
  return []
}

function persistToLS(list: Orcamento[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {
    console.warn('[Alliance] localStorage write error (quota exceeded?)')
  }
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function loadFromSupabase(): Promise<Orcamento[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('orcamentos')
    .select('dados')
    .order('atualizado_em', { ascending: false })
  if (error) { console.error('[Supabase] load error:', error.message); return [] }
  return (data ?? []).map((row: { dados: Orcamento }) => row.dados)
}

async function upsertToSupabase(orc: Orcamento): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('orcamentos')
    .upsert({ id: orc.id, dados: orc, atualizado_em: orc.atualizadoEm }, { onConflict: 'id' })
  if (error) console.error('[Supabase] upsert error:', error.message)
}

async function deleteFromSupabase(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('orcamentos').delete().eq('id', id)
  if (error) console.error('[Supabase] delete error:', error.message)
}

// ─── Factory ─────────────────────────────────────────────────────────────────

function makeItemFixo(nome: string): ItemOrcamento {
  return {
    id: newItemId(),
    item: nome,
    fornecedor: '',
    qtde: 1,
    custoUnitario: 0,
    totalOrcado: 0,
    totalPagoReal: 0,
    valorPassadoCliente: 0,
    bvAbsoluto: 0,
    bvPercentual: 0,
    status: 'PENDENTE',
    notas: '',
    automatico: false,
    fixo: true,
  }
}

export function criarOrcamentoVazio(
  tipo: EventType,
  config: ConfiguracaoAutomacoes,
): Orcamento {
  const now = new Date().toISOString()
  const qtde = 200
  return {
    id: newItemId(),
    tipo,
    instituicao: '',
    turma: '',
    data: '',
    quantidadeConvidados: qtde,
    status: 'RASCUNHO',
    criadoEm: now,
    atualizadoEm: now,
    bolsaFolia: 0,
    receitasSympla: [],
    operacaoEstrutura: ITENS_OPERACAO_ESTRUTURA.map(makeItemFixo),
    equipe: gerarEquipeAutomatica(tipo, qtde, config),
    atracao: [],
    abBebidas: ITENS_AB.map(makeItemFixo),
    extras: ITENS_EXTRAS.map(makeItemFixo),
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useOrcamentos() {
  // Start with localStorage data immediately (no flicker)
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(loadFromLS)
  const [loading, setLoading] = useState(hasSupabase)

  // If Supabase is configured, hydrate from the database on mount
  useEffect(() => {
    if (!hasSupabase) return
    setLoading(true)
    loadFromSupabase().then(data => {
      if (data.length > 0) {
        setOrcamentos(data)
        persistToLS(data) // keep LS in sync as cache
      }
      setLoading(false)
    })
  }, [])

  const salvar = useCallback((orc: Orcamento) => {
    const updated = { ...orc, atualizadoEm: new Date().toISOString() }
    setOrcamentos(prev => {
      const exists = prev.find(o => o.id === orc.id)
      const next = exists
        ? prev.map(o => o.id === orc.id ? updated : o)
        : [...prev, updated]
      persistToLS(next)
      return next
    })
    upsertToSupabase(updated) // fire-and-forget
    return updated
  }, [])

  const excluir = useCallback((id: string) => {
    setOrcamentos(prev => {
      const next = prev.filter(o => o.id !== id)
      persistToLS(next)
      return next
    })
    deleteFromSupabase(id) // fire-and-forget
  }, [])

  const buscarPorId = useCallback(
    (id: string) => orcamentos.find(o => o.id === id),
    [orcamentos],
  )

  const atualizarEquipe = useCallback(
    (orc: Orcamento, config: ConfiguracaoAutomacoes): Orcamento => {
      const equipeAuto = gerarEquipeAutomatica(orc.tipo, orc.quantidadeConvidados, config)
      const manuais = orc.equipe.filter(e => !e.automatico && !e.fixo)
      return { ...orc, equipe: [...equipeAuto, ...manuais] }
    },
    [],
  )

  const recalcularSecao = useCallback(
    (items: ItemOrcamento[]) => items.map(recalcularItem),
    [],
  )

  return {
    orcamentos,
    loading,
    salvar,
    excluir,
    buscarPorId,
    atualizarEquipe,
    recalcularSecao,
  }
}
