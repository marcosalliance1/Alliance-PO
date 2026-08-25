import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import allianceLogo from '../assets/alliance-logo.png'

// Ícone "G" do Google (inline pra não depender de asset externo).
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function LoginViewer() {
  const { signInViewer, signInGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [erroGoogle, setErroGoogle] = useState('')

  // Preserva destino se veio de rota protegida; caso contrário, vai para módulos
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/modulos'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (signInViewer(password)) {
      navigate(from, { replace: true })
    } else {
      setError(true)
      setPassword('')
    }
  }

  async function handleGoogle() {
    setErroGoogle('')
    try {
      await signInGoogle() // redireciona pro Google e volta autenticado
    } catch {
      setErroGoogle('Não foi possível iniciar o login com Google. Tente de novo.')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src={allianceLogo} alt="Alliance" className="h-12 w-auto" style={{ mixBlendMode: 'screen' }} />
          <p className="text-text-muted text-sm">Time interno e gestores</p>
        </div>

        <div className="card">
          <h1 className="text-text-main font-semibold text-lg mb-1">Acesso Alliance</h1>
          <p className="text-text-muted text-xs mb-6">Entre com sua conta @alliancebh.com.br.</p>

          {/* Login principal — Google corporativo */}
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 font-medium rounded-lg px-3 py-2.5 text-sm hover:bg-gray-100 transition-colors"
          >
            <GoogleIcon /> Entrar com Google
          </button>
          {erroGoogle && <p className="text-danger text-xs mt-2">{erroGoogle}</p>}

          {/* Separador */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] uppercase tracking-wide text-text-muted/60">ou senha da equipe</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Fallback — senha compartilhada (será desativada após a transição) */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false) }}
                className={`w-full bg-bg border rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none ${
                  error ? 'border-danger focus:border-danger' : 'border-white/10 focus:border-primary'
                }`}
              />
              {error && <p className="text-danger text-xs mt-1">Senha incorreta</p>}
            </div>
            <button type="submit" className="w-full btn-primary">
              Acessar
            </button>
          </form>
        </div>

        {/* Link discreto para admin */}
        <div className="text-center mt-6">
          <Link to="/login" className="text-xs text-text-muted/50 hover:text-text-muted transition-colors">
            Acesso Administrativo
          </Link>
        </div>
      </div>
    </div>
  )
}
