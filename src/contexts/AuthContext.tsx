import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

const VIEWER_KEY = 'alliance_viewer_auth'

type AuthLevel = 'admin' | 'viewer' | null

interface AuthContextValue {
  level: AuthLevel
  isAdmin: boolean
  isViewer: boolean
  isAuthenticated: boolean
  loading: boolean
  signInAdmin: (email: string, password: string) => Promise<void>
  signInViewer: (password: string) => boolean
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [viewerAuth, setViewerAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    if (sessionStorage.getItem(VIEWER_KEY) === 'true') setViewerAuth(true)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

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

  const signOut = useCallback(() => {
    supabase.auth.signOut()
    sessionStorage.removeItem(VIEWER_KEY)
    setViewerAuth(false)
  }, [])

  const isAdmin = !!session
  const isViewer = !isAdmin && viewerAuth
  const isAuthenticated = isAdmin || isViewer
  const level: AuthLevel = isAdmin ? 'admin' : isViewer ? 'viewer' : null

  return (
    <AuthContext.Provider value={{ level, isAdmin, isViewer, isAuthenticated, loading, signInAdmin, signInViewer, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
