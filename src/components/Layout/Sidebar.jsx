import { NavLink } from 'react-router-dom'
import { FolderOpen, BarChart2, Package, DollarSign, ChevronRight, Globe, CheckCircle, Loader, LogOut } from 'lucide-react'
import { useGoogleAuth } from '../../contexts/GoogleAuthContext'

const NAV_ITEMS = [
  { to: '/projetos', label: 'Projetos', icon: FolderOpen },
  { to: '/dashboard-geral', label: 'Dashboard Geral', icon: BarChart2 },
  { to: '/banco-itens', label: 'Banco de Itens', icon: Package },
  { to: '/financeiro', label: 'Financeiro', icon: DollarSign },
]

export default function Sidebar() {
  const { conectado, conectar, desconectar, logando } = useGoogleAuth()

  return (
    <aside style={{ background: '#0D0F1A', borderRight: '1px solid #2E3150', width: 220, minHeight: '100vh', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #2E3150' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #2563EB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>
            A
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#F1F5F9', lineHeight: 1.2 }}>Alliance</div>
            <div style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.05em' }}>P.O. SYSTEM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 8px' }}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 2,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              color: isActive ? '#F1F5F9' : '#94A3B8',
              background: isActive ? '#1E2235' : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            <Icon size={16} />
            <span style={{ flex: 1 }}>{label}</span>
            <ChevronRight size={12} style={{ opacity: 0.4 }} />
          </NavLink>
        ))}
      </nav>

      {/* Google Drive Auth */}
      <div style={{ marginTop: 'auto', padding: '12px 8px', borderTop: '1px solid #2E3150' }}>
        {conectado ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#14291A', border: '1px solid #22C55E30', marginBottom: 6 }}>
              <CheckCircle size={14} style={{ color: '#22C55E', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#86EFAC', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Google conectado</span>
            </div>
            <button
              onClick={desconectar}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 8, background: 'none', border: '1px solid #2E3150', color: '#64748B', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
            >
              <LogOut size={13} />
              Desconectar
            </button>
          </div>
        ) : (
          <button
            onClick={conectar}
            disabled={logando}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 8, background: '#1A1D2E', border: '1px solid #2E3150', color: logando ? '#64748B' : '#94A3B8', fontSize: 12, fontWeight: 500, cursor: logando ? 'default' : 'pointer', transition: 'all 0.15s' }}
          >
            {logando ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe size={13} />}
            {logando ? 'Conectando...' : 'Conectar Google Drive'}
          </button>
        )}
      </div>
    </aside>
  )
}
