import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, BookOpen, BarChart2, DollarSign, Settings, Globe, CheckCircle, LogOut, Loader } from 'lucide-react'
import allianceLogo from '../../assets/alliance-logo.png'
import { useGoogleAuth } from '../../contexts/GoogleAuthContext'
import { useAuth } from '../../contexts/AuthContext'

const links = [
  { to: '/projetos/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projetos', icon: FolderOpen, label: 'Projetos' },
  { to: '/banco-de-itens', icon: BookOpen, label: 'Banco de Itens' },
  { to: '/verbas', icon: BarChart2, label: 'Verbas' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
]

export function Sidebar() {
  const { conectado, conectar, desconectar, logando } = useGoogleAuth()
  const { isAdmin, signOut } = useAuth()

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-surface border-r border-white/10 flex flex-col z-30">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-center">
        <div className="rounded-xl px-4 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <img
            src={allianceLogo}
            alt="Alliance"
            className="h-10 w-auto"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:text-text-main hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Google Drive Auth */}
      <div className="px-3 py-3 border-t border-white/10 space-y-1.5">
        {conectado ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle size={13} className="text-success flex-shrink-0" />
              <span className="text-xs text-success font-medium truncate">Google conectado</span>
            </div>
            <button
              onClick={desconectar}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
            >
              <LogOut size={13} /> Desconectar
            </button>
          </>
        ) : (
          <button
            onClick={conectar}
            disabled={logando}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-main hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {logando ? <Loader size={13} className="animate-spin" /> : <Globe size={13} />}
            {logando ? 'Conectando...' : 'Conectar Google Drive'}
          </button>
        )}
      </div>

      <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
        <div className="text-text-muted text-xs">Alliance Cerimonial</div>
        {isAdmin && (
          <button
            onClick={signOut}
            title="Sair"
            className="text-text-muted/50 hover:text-danger transition-colors"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  )
}
