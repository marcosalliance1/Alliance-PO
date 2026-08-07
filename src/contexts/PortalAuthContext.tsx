import { createContext, useContext, useState } from 'react'
import { supabase } from '../lib/supabase'

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
    // A validação da senha acontece no servidor (Edge Function `portal-login`,
    // service_role). O navegador nunca lê `portal_clientes` nem o `senha_hash`.
    const { data, error } = await supabase.functions.invoke('portal-login', {
      body: { email: email.toLowerCase().trim(), password },
    })

    if (error) {
      // Erros não-2xx da função vêm em error.context (Response). Extrai a mensagem.
      let msg = 'Falha ao entrar. Tente novamente.'
      try {
        const body = await (error as { context?: Response }).context?.json?.()
        if (body?.error) msg = body.error
      } catch { /* mantém msg padrão */ }
      throw new Error(msg)
    }

    const s: PortalSession = {
      clienteId: data.clienteId as string,
      projetoId: data.projetoId as string,
      email: data.email as string,
      nomeContato: (data.nomeContato as string) ?? null,
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
