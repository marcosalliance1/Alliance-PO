import { useNavigate } from 'react-router-dom'
import { ClipboardList, CalendarCheck, Clock, Users, Percent, Megaphone } from 'lucide-react'
import allianceLogo from '../assets/alliance-logo.png'
import { useAuth } from '../contexts/AuthContext'

const MODULES = [
  {
    icon: ClipboardList,
    title: 'P.O. Alliance',
    description: 'Planejamento e orçamento dos projetos de formatura',
    to: '/projetos',
    disabled: false,
  },
  {
    icon: CalendarCheck,
    title: 'Pré-Eventos',
    description: 'Orçamentos e gestão de pré-eventos Alliance',
    to: '/pre-eventos',
    disabled: false,
  },
  {
    icon: Clock,
    title: 'Follow-up',
    description: 'Acompanhamento de propostas e clientes',
    to: '/followup',
    disabled: true,
  },
  {
    icon: Percent,
    title: 'Alliance Comercial',
    description: 'Controle de FEE e indicadores comerciais',
    to: '/comercial',
    disabled: false,
  },
  {
    icon: Megaphone,
    title: 'Marketing',
    description: 'Demandas e indicadores do board Marketing',
    to: '/marketing',
    disabled: false,
  },
]

export function HomeScreen() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const modules = [
    ...MODULES,
    ...(isAdmin ? [{
      icon: Users,
      title: 'Portal Clientes',
      description: 'Gerenciar acessos das comissões',
      to: '/portal-admin',
      disabled: false,
    }] : []),
  ]

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="mb-10 text-center flex flex-col items-center gap-3">
        <img src={allianceLogo} alt="Alliance" className="h-20 w-auto" style={{ mixBlendMode: 'screen' }} />
        <div className="text-text-muted text-sm">Selecione o módulo</div>
      </div>

      <div className={`grid gap-5 w-full ${isAdmin ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 max-w-5xl' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 max-w-4xl'}`}>
        {modules.map(({ icon: Icon, title, description, to, disabled }) => (
          <button
            key={to}
            onClick={() => !disabled && navigate(to)}
            disabled={disabled}
            className={`relative flex flex-col items-center gap-4 p-7 rounded-xl border transition-all text-center
              ${disabled
                ? 'border-white/5 opacity-40 cursor-not-allowed bg-surface'
                : 'border-white/10 bg-surface hover:border-primary/40 hover:bg-surface/80 cursor-pointer'
              }`}
          >
            {disabled && (
              <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-text-muted">
                Em breve
              </span>
            )}
            <div className={`p-3 rounded-lg ${disabled ? 'bg-white/5' : 'bg-primary/10'}`}>
              <Icon size={26} className={disabled ? 'text-text-muted' : 'text-primary'} />
            </div>
            <div>
              <div className="text-text-main font-semibold text-sm">{title}</div>
              <div className="text-text-muted text-xs mt-1 leading-relaxed">{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
