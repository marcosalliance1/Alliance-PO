import { createContext, useContext, useState, type ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'

interface GoogleAuthContextValue {
  accessToken: string | null
  conectado: boolean
  logando: boolean
  conectar: () => void
  desconectar: () => void
  invalidarToken: () => void
}

const GoogleAuthContext = createContext<GoogleAuthContextValue | null>(null)

export function useGoogleAuth(): GoogleAuthContextValue {
  const ctx = useContext(GoogleAuthContext)
  if (!ctx) throw new Error('useGoogleAuth deve estar dentro de GoogleAuthProvider')
  return ctx
}

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [logando, setLogando] = useState(false)

  const _login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly',
    onSuccess: (resp) => {
      setAccessToken(resp.access_token)
      setLogando(false)
    },
    onError: () => setLogando(false),
  })

  function conectar() {
    setLogando(true)
    _login()
  }

  function desconectar() { setAccessToken(null) }
  function invalidarToken() { setAccessToken(null) }

  return (
    <GoogleAuthContext.Provider value={{ accessToken, conectado: !!accessToken, logando, conectar, desconectar, invalidarToken }}>
      {children}
    </GoogleAuthContext.Provider>
  )
}
