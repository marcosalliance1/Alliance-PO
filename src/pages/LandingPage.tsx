import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, GraduationCap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePortalAuth } from '../contexts/PortalAuthContext'
import allianceLogo from '../assets/alliance-logo.png'

export function LandingPage() {
  const { isAuthenticated } = useAuth()
  const { isAuthenticated: isPortalAuth } = usePortalAuth()
  const navigate = useNavigate()

  // Auto-redirect se já autenticado
  useEffect(() => {
    if (isAuthenticated) navigate('/modulos', { replace: true })
    else if (isPortalAuth) navigate('/portal/dashboard', { replace: true })
  }, [isAuthenticated, isPortalAuth, navigate])

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-12 flex flex-col items-center gap-2">
        <img src={allianceLogo} alt="Alliance" className="h-16 w-auto" style={{ mixBlendMode: 'screen' }} />
        <p className="text-text-muted text-sm">Selecione seu acesso</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={() => navigate('/access')}
          className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/10 bg-surface hover:border-primary/40 hover:bg-surface/80 transition-all text-center group"
        >
          <div className="p-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Building2 size={28} className="text-primary" />
          </div>
          <div>
            <div className="text-text-main font-bold text-base">Acesso Alliance</div>
            <div className="text-text-muted text-xs mt-1 leading-relaxed">Time interno e gestores</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/portal')}
          className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/10 bg-surface hover:border-primary/40 hover:bg-surface/80 transition-all text-center group"
        >
          <div className="p-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <GraduationCap size={28} className="text-primary" />
          </div>
          <div>
            <div className="text-text-main font-bold text-base">Acesso Comissão</div>
            <div className="text-text-muted text-xs mt-1 leading-relaxed">Comissões de formatura</div>
          </div>
        </button>
      </div>
    </div>
  )
}
