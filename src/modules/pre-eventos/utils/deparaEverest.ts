// De-para aprendido: fornecedor do Everest → nome do item da P.O. Quando o
// usuário confirma uma associação, o par é salvo; na próxima turma o painel já
// pré-associa. Tabela `everest_depara` (dado não sensível — só nome↔nome).
import { supabase } from '../../../lib/supabase'
import type { SecaoKeyEverest } from './matchEverest'

export interface DeparaEntry {
  itemNome: string
  secao: SecaoKeyEverest | null
}

interface DeparaRow {
  fornecedor_everest: string
  item_nome: string
  secao: string | null
}

export async function carregarDepara(): Promise<Map<string, DeparaEntry>> {
  const map = new Map<string, DeparaEntry>()
  const { data, error } = await supabase
    .from('everest_depara')
    .select('fornecedor_everest,item_nome,secao')
  if (error || !data) return map
  for (const r of data as DeparaRow[]) {
    map.set(r.fornecedor_everest, { itemNome: r.item_nome, secao: (r.secao as SecaoKeyEverest) ?? null })
  }
  return map
}

export async function salvarDepara(
  pares: { fornecedor: string; itemNome: string; secao: SecaoKeyEverest }[],
): Promise<void> {
  if (pares.length === 0) return
  const rows = pares.map(p => ({
    fornecedor_everest: p.fornecedor,
    item_nome: p.itemNome,
    secao: p.secao,
    atualizado_em: new Date().toISOString(),
  }))
  const { error } = await supabase.from('everest_depara').upsert(rows, { onConflict: 'fornecedor_everest' })
  if (error) console.error('[everest_depara] upsert error:', error.message)
}
