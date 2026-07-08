import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, ShoppingCart, ArrowLeft } from 'lucide-react'
import allianceLogo from '../../../../assets/alliance-logo.png'

const NAV = [
  { to: '/comercial', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/comercial/contratos', icon: <FileText className="w-5 h-5" />, label: 'Contratos' },
  { to: '/comercial/compras', icon: <ShoppingCart className="w-5 h-5" />, label: 'Compras Comercial' },
]

export const Sidebar: React.FC = () => {
  const navigate = useNavigate()

  return (
    <aside className="w-60 bg-surface border-r border-white/10 flex flex-col shrink-0 min-h-screen">
      <div className="px-5 py-4 border-b border-white/10 shrink-0 flex items-center justify-center">
        <img src={allianceLogo} alt="Alliance" className="h-10 w-auto" style={{ mixBlendMode: 'screen' }} />
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                  : 'text-text-muted hover:text-text-main hover:bg-white/5'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={() => navigate('/modulos')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-main hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar à Home
        </button>
      </div>
    </aside>
  )
}
