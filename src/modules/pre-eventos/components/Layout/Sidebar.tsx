import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Settings,
  PlusCircle,
  ArrowLeft,
  Calculator,
} from 'lucide-react'
import allianceLogo from '../../../../assets/alliance-logo.png'

const NAV = [
  { to: '/pre-eventos',              icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/pre-eventos/orcamentos',   icon: <FileText        className="w-5 h-5" />, label: 'Orçamentos' },
  { to: '/pre-eventos/simulador',    icon: <Calculator      className="w-5 h-5" />, label: 'Simulador' },
  { to: '/pre-eventos/configuracoes',icon: <Settings        className="w-5 h-5" />, label: 'Configurações' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export const Sidebar: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate()

  return (
    <aside
      className={[
        // Base styles
        'w-60 bg-sidebar border-r border-bordercol flex flex-col shrink-0',
        // Mobile: fixed drawer that slides in/out
        'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full',
        // Desktop: always visible, part of normal flow
        'md:relative md:translate-x-0 md:z-auto',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-bordercol shrink-0 flex items-center justify-center">
        <img
          src={allianceLogo}
          alt="Alliance"
          className="h-10 w-auto"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      {/* Novo Orçamento */}
      <div className="px-4 py-4 border-b border-bordercol shrink-0">
        <button
          onClick={() => { navigate('/pre-eventos/orcamentos/novo'); onClose() }}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Novo Orçamento
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/pre-eventos'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all min-h-[44px] ${
                isActive
                  ? 'bg-accent/15 text-accent font-semibold border border-accent/20'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Voltar */}
      <div className="p-4 border-t border-bordercol shrink-0">
        <button
          onClick={() => { navigate('/'); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar à Home
        </button>
      </div>
    </aside>
  )
}
