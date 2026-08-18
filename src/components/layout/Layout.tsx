import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import allianceLogo from '../../assets/alliance-logo.png'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Fundo escuro atrás da gaveta — só no celular, fecha ao tocar fora */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra com o botão de menu — só aparece no celular */}
        <header className="md:hidden h-14 bg-surface border-b border-white/10 flex items-center px-3 shrink-0 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src={allianceLogo} alt="Alliance" className="h-7 w-auto ml-1" style={{ mixBlendMode: 'screen' }} />
        </header>

        <main className="flex-1 p-4 md:p-6 min-h-screen overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
