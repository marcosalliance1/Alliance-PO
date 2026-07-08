import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_COMERCIAL_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_COMERCIAL_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Variáveis VITE_COMERCIAL_SUPABASE_URL e VITE_COMERCIAL_SUPABASE_ANON_KEY não configuradas.')
}

export const supabaseComercial = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
