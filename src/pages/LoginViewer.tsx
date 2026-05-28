import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function LoginViewer() {
  const { signInViewer } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/'

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
        <div className="text-center mb-8">
          <div className="text-primary font-bold text-2xl">Alliance</div>
          <div className="text-text-muted text-sm mt-1">P.O. System</div>
        </div>
        <div className="card">
          <h1 className="text-text-main font-semibold text-lg mb-2">Acesso Restrito</h1>
          <p className="text-text-muted text-xs mb-6">Insira a senha para visualizar o sistema.</p>
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
            <div className="text-center">
              <a href="/login" className="text-xs text-text-muted hover:text-primary transition-colors">
                Login Admin
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
