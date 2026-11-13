import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { AtendimentoProvider } from '../../contexts/AtendimentoContext'
import { useTemaClaro } from '../../../../hooks/useTemaClaro'

export const Layout: React.FC = () => {
  const [temaClaro] = useTemaClaro()
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <AtendimentoProvider>
      <div className="flex min-h-screen bg-bg text-text-main">
        {/* PC: menu fixo */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Celular: gaveta */}
        {menuAberto && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuAberto(false)} />
            {/* No celular o menu é uma gaveta: fecha ao tocar num link. */}
            <div className="relative z-10 flex max-w-[85vw] overflow-y-auto"
              onClick={e => { if ((e.target as HTMLElement).closest('a')) setMenuAberto(false) }}>
              <Sidebar />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-surface border-b border-white/10">
            <button onClick={() => setMenuAberto(true)} className="p-1.5 -ml-1.5 rounded-md text-text-main hover:bg-white/5" title="Menu">
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold">Atendimento</span>
          </div>
          <main className={`flex-1 overflow-auto p-4 md:p-6 ${temaClaro ? 'tema-claro' : ''}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </AtendimentoProvider>
  )
}
