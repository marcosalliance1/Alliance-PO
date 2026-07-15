import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Gift, Users, ShoppingBag, Link2, AlertTriangle, ArrowLeft } from 'lucide-react'
import allianceLogo from '../../../../assets/alliance-logo.png'
import { useAtendimento } from '../../contexts/AtendimentoContext'
import { classificarPremioEntregue } from '../../lib/rifaPipeline'

export const Sidebar: React.FC = () => {
  const navigate = useNavigate()
  const { rifas, ganhadores, compras, overrides, conflitos } = useAtendimento()

  const turmasPendentes = new Set(
    rifas.filter(r => !r.match_manual && (r.dimensao_projeto_id === null || (r.match_confianca ?? 0) < 0.75))
      .map(r => r.turma)
      .filter(turma => !overrides.some(o => o.turma === turma)),
  ).size
  const conflitosPendentes = conflitos.filter(c => !c.resolvido).length
  const ganhadoresPendentes = ganhadores.filter(g => !g.contato_feito || classificarPremioEntregue(g.premio_entregue) !== 'sim').length
  const comprasPendentes = compras.filter(c => c.status !== 'Comprado').length

  const NAV = [
    { to: '/atendimento/rifas', icon: <Gift className="w-5 h-5" />, label: 'Rifas', badge: null as number | null },
    { to: '/atendimento/rifas/ganhadores', icon: <Users className="w-5 h-5" />, label: 'Ganhadores', badge: ganhadoresPendentes || null },
    { to: '/atendimento/rifas/compras', icon: <ShoppingBag className="w-5 h-5" />, label: 'Acompanhamento de Compra', badge: comprasPendentes || null },
    { to: '/atendimento/rifas/vinculos-pendentes', icon: <Link2 className="w-5 h-5" />, label: 'Vínculos Pendentes', badge: turmasPendentes || null },
    { to: '/atendimento/rifas/conflitos', icon: <AlertTriangle className="w-5 h-5" />, label: 'Conflitos de Sync', badge: conflitosPendentes || null },
  ]

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
            <span className="flex-1">{item.label}</span>
            {!!item.badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{item.badge}</span>
            )}
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
