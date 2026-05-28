import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PlusCircle, Menu } from 'lucide-react'

const TITLES: Record<string, string> = {
  '/pre-eventos':     'Dashboard',
  '/pre-eventos/orcamentos':      'Orçamentos',
  '/pre-eventos/orcamentos/novo': 'Novo Orçamento',
  '/pre-eventos/configuracoes':   'Configurações',
}

function getTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname]
  if (pathname.startsWith('/pre-eventos/orcamentos/')) return 'Detalhes'
  return 'Alliance'
}

interface Props {
  onMenuClick: () => void
}

export const Topbar: React.FC<Props> = ({ onMenuClick }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const title = getTitle(pathname)

  return (
    <header className="h-14 md:h-16 bg-surface border-b border-bordercol flex items-center justify-between px-3 md:px-6 shrink-0">
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2.5 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-white font-semibold text-base md:text-lg">{title}</h1>
      </div>

      {/* Desktop: full button with text */}
      <button
        onClick={() => navigate('/pre-eventos/orcamentos/novo')}
        className="hidden md:flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        Novo Orçamento
      </button>

      {/* Mobile: icon-only button */}
      <button
        onClick={() => navigate('/pre-eventos/orcamentos/novo')}
        className="md:hidden p-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Novo Orçamento"
      >
        <PlusCircle className="w-5 h-5" />
      </button>
    </header>
  )
}
