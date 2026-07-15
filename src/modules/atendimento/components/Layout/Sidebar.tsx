import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Columns3, CalendarDays,
  Gift, Users, ShoppingBag, Link2, AlertTriangle,
  ArrowLeft, ChevronDown, ChevronRight,
} from 'lucide-react'
import allianceLogo from '../../../../assets/alliance-logo.png'
import { useAtendimento } from '../../contexts/AtendimentoContext'
import { classificarPremioEntregue } from '../../lib/rifaPipeline'

export const Sidebar: React.FC = () => {
  const navigate = useNavigate()
  const { rifas, ganhadores, compras, overrides, conflitos } = useAtendimento()
  const [configAberta, setConfigAberta] = useState(false)

  const turmasPendentes = new Set(
    rifas.filter(r => !r.match_manual && (r.dimensao_projeto_id === null || (r.match_confianca ?? 0) < 0.75))
      .map(r => r.turma)
      .filter(turma => !overrides.some(o => o.turma === turma)),
  ).size
  const conflitosPendentes = conflitos.filter(c => !c.resolvido).length
  const ganhadoresPendentes = ganhadores.filter(g => !g.contato_feito || classificarPremioEntregue(g.premio_entregue) !== 'sim').length
  const comprasPendentes = compras.filter(c => c.status !== 'Comprado').length
  const totalConfigPendencias = turmasPendentes + conflitosPendentes

  const NAV_OPERACAO = [
    { to: '/atendimento/rifas', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', fim: true },
    { to: '/atendimento/rifas/kanban', icon: <Columns3 className="w-5 h-5" />, label: 'Kanban', fim: false },
    { to: '/atendimento/rifas/calendario', icon: <CalendarDays className="w-5 h-5" />, label: 'Calendário', fim: false },
  ]

  const NAV_CONFIG = [
    { to: '/atendimento/rifas/todas', icon: <Gift className="w-5 h-5" />, label: 'Todas as Rifas', badge: null as number | null },
    { to: '/atendimento/rifas/ganhadores', icon: <Users className="w-5 h-5" />, label: 'Ganhadores', badge: ganhadoresPendentes || null },
    { to: '/atendimento/rifas/compras', icon: <ShoppingBag className="w-5 h-5" />, label: 'Acompanhamento de Compra', badge: comprasPendentes || null },
    { to: '/atendimento/rifas/vinculos-pendentes', icon: <Link2 className="w-5 h-5" />, label: 'Vínculos Pendentes', badge: turmasPendentes || null },
    { to: '/atendimento/rifas/conflitos', icon: <AlertTriangle className="w-5 h-5" />, label: 'Conflitos de Sync', badge: conflitosPendentes || null },
  ]

  return (
    <aside className="w-64 bg-surface border-r border-white/10 flex flex-col shrink-0 min-h-screen">
      <div className="px-5 py-4 border-b border-white/10 shrink-0 flex items-center justify-center">
        <img src={allianceLogo} alt="Alliance" className="h-10 w-auto" style={{ mixBlendMode: 'screen' }} />
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">Rifas</div>
        {NAV_OPERACAO.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.fim}
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
          </NavLink>
        ))}

        <button
          onClick={() => setConfigAberta(a => !a)}
          className="flex items-center gap-2 px-3 mt-4 mb-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-main transition-colors"
        >
          {configAberta ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Configurações
          {totalConfigPendencias > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{totalConfigPendencias}</span>
          )}
        </button>
        {configAberta && (
          <div className="border-t border-white/5 pt-1">
            {NAV_CONFIG.map(item => (
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
          </div>
        )}
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
