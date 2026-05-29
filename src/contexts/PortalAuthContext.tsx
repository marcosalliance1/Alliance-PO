import { createContext, useContext, useState } from 'react'
import { supabase } from '../lib/supabase'
import bcrypt from 'bcryptjs'

const PORTAL_KEY = 'alliance_portal'

export interface PortalSession {
  clienteId: string
  projetoId: string
  email: string
  nomeContato: string | null
}

interface PortalAuthCtx {
  session: PortalSession | null
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  previewAs: (s: PortalSession) => void
}

const Ctx = createContext<PortalAuthCtx>(null!)

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PortalSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(PORTAL_KEY)
      return raw ? (JSON.parse(raw) as PortalSession) : null
    } catch { return null }
  })

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase
      .from('portal_clientes')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('ativo', true)
      .single()

    if (error || !data) throw new Error('Email não encontrado ou acesso inativo')

    const valid = await bcrypt.compare(password, data.senha_hash as string)
    if (!valid) throw new Error('Senha incorreta')

    const s: PortalSession = {
      clienteId: data.id as string,
      projetoId: data.projeto_id as string,
      email: data.email as string,
      nomeContato: (data.nome_contato as string) ?? null,
    }
    sessionStorage.setItem(PORTAL_KEY, JSON.stringify(s))
    setSession(s)
  }

  function signOut() {
    sessionStorage.removeItem(PORTAL_KEY)
    setSession(null)
  }

  function previewAs(s: PortalSession) {
    sessionStorage.setItem(PORTAL_KEY, JSON.stringify(s))
    setSession(s)
  }

  return (
    <Ctx.Provider value={{ session, isAuthenticated: !!session, signIn, signOut, previewAs }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePortalAuth() {
  return useContext(Ctx)
}
