import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function LoginAdmin() {
  const { signInAdmin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInAdmin(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-primary font-bold text-2xl">Alliance</div>
          <div className="text-text-muted text-sm mt-1">P.O. System — Admin</div>
        </div>
        <div className="card">
          <h1 className="text-text-main font-semibold text-lg mb-6">Entrar como Admin</h1>
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
