import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { useRifas } from '../../../hooks/useRifas'
import { supabase } from '../../../lib/supabase'

export interface DimensaoProjeto {
  id: number
  nome_projeto: string
  ensino: string
  instituicao: string
}

// Escopo próprio (leitura+escrita), independente do GoogleAuthContext global (que é
// somente-leitura e usado por P.O./Verbas/Pré-Eventos/Comercial) — a sincronização de
// Rifas precisa escrever na planilha, então pede um token separado com escopo maior,
// em vez de ampliar o consentimento pedido para o resto do app.
interface AtendimentoContextValue extends ReturnType<typeof useRifas> {
  spreadsheetId: string
  googleAccessToken: string | null
  googleConectado: boolean
  googleLogando: boolean
  conectarGoogle: () => void
  desconectarGoogle: () => void
  dimensaoProjetos: DimensaoProjeto[]
}

const AtendimentoContext = createContext<AtendimentoContextValue | null>(null)

export function useAtendimento(): AtendimentoContextValue {
  const ctx = useContext(AtendimentoContext)
  if (!ctx) throw new Error('useAtendimento deve estar dentro de AtendimentoProvider')
  return ctx
}

export function AtendimentoProvider({ children }: { children: ReactNode }) {
  const rifas = useRifas()
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)
  const [googleLogando, setGoogleLogando] = useState(false)
  const [dimensaoProjetos, setDimensaoProjetos] = useState<DimensaoProjeto[]>([])

  useEffect(() => {
    supabase.from('dimensao_projetos').select('*').order('nome_projeto').then(({ data }) => {
      if (data) setDimensaoProjetos(data as DimensaoProjeto[])
    })
  }, [])

  const _login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    onSuccess: (resp) => { setGoogleAccessToken(resp.access_token); setGoogleLogando(false) },
    onError: () => setGoogleLogando(false),
  })

  function conectarGoogle() { setGoogleLogando(true); _login() }
  function desconectarGoogle() { setGoogleAccessToken(null) }

  const spreadsheetId = import.meta.env.VITE_RIFAS_SPREADSHEET_ID ?? ''

  return (
    <AtendimentoContext.Provider value={{
      ...rifas,
      spreadsheetId,
      googleAccessToken,
      googleConectado: !!googleAccessToken,
      googleLogando,
      conectarGoogle,
      desconectarGoogle,
      dimensaoProjetos,
    }}>
      {children}
    </AtendimentoContext.Provider>
  )
}
