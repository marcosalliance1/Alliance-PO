import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import allianceLogo from '../assets/alliance-logo.png'

export function LoginViewer() {
  const { signInViewer } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

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

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src={allianceLogo} alt="Alliance" className="h-12 w-auto" style={{ mixBlendMode: 'screen' }} />
          <p className="text-text-muted text-sm">Time interno e gestores</p>
        </div>

        <div className="card">
          <h1 className="text-text-main font-semibold text-lg mb-1">Acesso Alliance</h1>
          <p className="text-text-muted text-xs mb-6">Insira a senha para acessar o sistema.</p>
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
                required
                autoFocus
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
