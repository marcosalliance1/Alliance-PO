import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Tipos do banco ────────────────────────────────────────────────────────────

export interface ProjetoRow {
  id: string
  tap: Record<string, unknown>
  secoes: unknown[]
  receitas: Record<string, unknown>
  criado_em: string
  atualizado_em: string
  importado_de: string | null
}

export interface BancoItemRow {
  id: string
  data: Record<string, unknown>
}

export interface ConfiguracaoRow {
  id: string
  data: Record<string, unknown>
}
