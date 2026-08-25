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

export interface ResultadoSalvamento {
  ok: boolean
  conflito?: boolean
  servidor?: string // atualizado_em que está no servidor (quando há conflito)
}

// Gravação com trava otimista: só grava se ninguém salvou desde `base`. Se a
// versão do servidor mudou, devolve { conflito: true } em vez de sobrescrever —
// assim o trabalho da outra pessoa não é apagado silenciosamente.
async function upsertGuardado(orc: Orcamento, base: string | null): Promise<ResultadoSalvamento> {
  if (!supabase) return { ok: true }
  // UPDATE condicional (atômico): grava só se atualizado_em ainda é `base`.
  if (base) {
    const { data, error } = await supabase
      .from('orcamentos')
      .update({ dados: orc, atualizado_em: orc.atualizadoEm })
      .eq('id', orc.id)
      .eq('atualizado_em', base)
      .select('id')
    if (error) { console.error('[Supabase] update guardado error:', error.message); return { ok: false } }
    if (data && data.length > 0) return { ok: true } // gravou
  }
  // Não gravou (base não bateu) ou é a 1ª vez: confere o que está no servidor.
  const { data: atual, error: e2 } = await supabase
    .from('orcamentos').select('atualizado_em').eq('id', orc.id).maybeSingle()
  if (e2) { console.error('[Supabase] check error:', e2.message); return { ok: false } }
  if (!atual) {
    // Linha ainda não existe → insere (sem conflito possível).
    const { error: e3 } = await supabase.from('orcamentos')
      .insert({ id: orc.id, dados: orc, atualizado_em: orc.atualizadoEm })
    if (e3) { console.error('[Supabase] insert error:', e3.message); return { ok: false } }
    return { ok: true }
  }
  // Existe e a versão do servidor difere da minha base → alguém salvou no meio.
  if (atual.atualizado_em !== base) return { ok: false, conflito: true, servidor: atual.atualizado_em }
  // base bate mas o update não pegou (timing) — fallback upsert simples.
  await upsertToSupabase(orc)
  return { ok: true }
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

  // Igual ao salvar, mas com trava de concorrência: `base` = a versão que o
  // cliente tinha ao abrir. Atualiza local otimista e devolve o resultado da
  // gravação no servidor (ok | conflito). Usado pelo editor de orçamento.
  const salvarComGuarda = useCallback(async (orc: Orcamento, base: string | null) => {
    const updated = { ...orc, atualizadoEm: new Date().toISOString() }
    setOrcamentos(prev => {
      const exists = prev.find(o => o.id === orc.id)
      const next = exists
        ? prev.map(o => o.id === orc.id ? updated : o)
        : [...prev, updated]
      persistToLS(next)
      return next
    })
    const res = await upsertGuardado(updated, base)
    return { updated, ...res }
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
    salvarComGuarda,
    excluir,
    buscarPorId,
    atualizarEquipe,
    recalcularSecao,
  }
}
