import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { AtendimentoProvider } from '../../contexts/AtendimentoContext'
import { useTemaClaro } from '../../../../hooks/useTemaClaro'

export const Layout: React.FC = () => {
  const [temaClaro] = useTemaClaro()
  return (
    <AtendimentoProvider>
      <div className="flex min-h-screen bg-bg text-text-main">
        <Sidebar />
        <main className={`flex-1 overflow-auto p-6 ${temaClaro ? 'tema-claro' : ''}`}>
          <Outlet />
        </main>
      </div>
    </AtendimentoProvider>
  )
}
