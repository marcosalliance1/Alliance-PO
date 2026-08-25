import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

const VIEWER_KEY = 'alliance_viewer_auth'

// Domínio corporativo — só e-mails daqui entram no sistema interno.
const DOMINIO = 'alliancebh.com.br'

// Semente do modelo de papéis (Fase 2 vira tabela no banco). Admin = acesso total,
// inclusive telas destrutivas/sensíveis. Demais @alliance entram no nível "equipe".
const ADMIN_EMAILS = ['marcos@alliancebh.com.br']

type AuthLevel = 'admin' | 'viewer' | null

export interface UsuarioAuth {
  email: string
  nome: string
  avatar: string | null
}

interface AuthContextValue {
  level: AuthLevel
  isAdmin: boolean
  isViewer: boolean
  isAuthenticated: boolean
  loading: boolean
  usuario: UsuarioAuth | null
  signInAdmin: (email: string, password: string) => Promise<void>
  signInViewer: (password: string) => boolean
  signInGoogle: () => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [viewerAuth, setViewerAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  // Aplica a sessão barrando quem não é do domínio corporativo (defesa extra —
  // a tela de consentimento "Interna" do Google já bloqueia, isto é reforço).
  const aplicarSessao = useCallback((s: Session | null) => {
    const em = (s?.user?.email ?? '').toLowerCase()
    if (s && em && !em.endsWith(`@${DOMINIO}`)) {
      supabase.auth.signOut()
      setSession(null)
      return
    }
    setSession(s)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      aplicarSessao(data.session)
      setLoading(false)
    })

    if (sessionStorage.getItem(VIEWER_KEY) === 'true') setViewerAuth(true)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      aplicarSessao(s)
    })
    return () => subscription.unsubscribe()
  }, [aplicarSessao])

  const signInAdmin = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signInViewer = useCallback((password: string): boolean => {
    const correct = import.meta.env.VITE_VIEWER_PASSWORD
    if (password === correct) {
      sessionStorage.setItem(VIEWER_KEY, 'true')
      setViewerAuth(true)
      return true
    }
    return false
  }, [])

  const signInGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/modulos`,
        // hd = dica de domínio pro Google; prompt = deixa escolher a conta.
        queryParams: { hd: DOMINIO, prompt: 'select_account' },
      },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(() => {
    supabase.auth.signOut()
    sessionStorage.removeItem(VIEWER_KEY)
    setViewerAuth(false)
  }, [])

  const email = (session?.user?.email ?? '').toLowerCase()
  const meta = session?.user?.user_metadata as Record<string, unknown> | undefined
  const usuario: UsuarioAuth | null = session?.user
    ? {
        email,
        nome: (meta?.full_name as string) || (meta?.name as string) || email,
        avatar: (meta?.avatar_url as string) || (meta?.picture as string) || null,
      }
    : null

  const temSessao = !!session
  const isAdmin = temSessao && ADMIN_EMAILS.includes(email)
  const isViewer = (temSessao && !isAdmin) || (!temSessao && viewerAuth)
  const isAuthenticated = temSessao || viewerAuth
  const level: AuthLevel = isAdmin ? 'admin' : isAuthenticated ? 'viewer' : null

  return (
    <AuthContext.Provider value={{ level, isAdmin, isViewer, isAuthenticated, loading, usuario, signInAdmin, signInViewer, signInGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
