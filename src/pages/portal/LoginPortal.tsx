import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { usePortalAuth } from '../../contexts/PortalAuthContext'
import allianceLogo from '../../assets/alliance-logo.png'

export function LoginPortal() {
  const { signIn, isAuthenticated } = usePortalAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    return <Navigate to="/portal/dashboard" replace />
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/portal/dashboard', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <img src={allianceLogo} alt="Alliance" className="h-14 w-auto" style={{ mixBlendMode: 'screen' }} />
          <div className="text-text-muted text-sm">Portal do Cliente</div>
        </div>
        <div className="card">
          <h1 className="text-text-main font-semibold text-lg mb-6">Acesso da Comissão</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary"
                required
              />
            </div>
            {error && <p className="text-danger text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
