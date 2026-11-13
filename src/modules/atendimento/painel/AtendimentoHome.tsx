import { useNavigate } from 'react-router-dom'
import { ClipboardList, Users, Gift } from 'lucide-react'

const CARDS = [
  { to: '/atendimento/demandas', icon: ClipboardList, titulo: 'Atendimento Geral',
    desc: 'Demandas, Rescisão, Alteração de Plano, Cálculo, Achados & Perdidos, Aniversários e Calendário.' },
  { to: '/atendimento/turmas', icon: Users, titulo: 'Atendimento de Turmas',
    desc: 'Perfil de cada turma (ligado à P.O.), Demandas, Régua ao Contrário, Eventos e o Calendário.' },
  { to: '/atendimento/rifas', icon: Gift, titulo: 'Rifas',
    desc: 'Rifas, ganhadores e acompanhamento de compra dos prêmios.' },
]

export function AtendimentoHome() {
  const navigate = useNavigate()
  return (
    <div className="max-w-4xl mx-auto py-6">
      <h1 className="text-xl font-bold text-text-main">Atendimento</h1>
      <p className="text-sm text-text-muted mt-1 mb-6">Escolha uma área para começar.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(c => (
          <button key={c.to} onClick={() => navigate(c.to)}
            className="text-left bg-surface border border-white/10 rounded-[12px] p-6 hover:border-primary/50 hover:-translate-y-0.5 transition-all">
            <div className="w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center mb-4">
              <c.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="font-semibold text-text-main mb-1.5">{c.titulo}</div>
            <div className="text-sm text-text-muted leading-relaxed">{c.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
