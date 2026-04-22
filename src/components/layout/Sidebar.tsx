import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, BookOpen, Settings } from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projetos', icon: FolderOpen, label: 'Projetos' },
  { to: '/banco-de-itens', icon: BookOpen, label: 'Banco de Itens' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-surface border-r border-white/10 flex flex-col z-30">
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-primary font-bold text-lg leading-tight">Alliance</div>
        <div className="text-text-muted text-xs">P.O. System</div>
      </div>
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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
      <div className="px-6 py-4 border-t border-white/10">
        <div className="text-text-muted text-xs">Alliance Cerimonial</div>
      </div>
    </aside>
  )
}
