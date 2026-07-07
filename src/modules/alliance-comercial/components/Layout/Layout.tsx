import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export const Layout: React.FC = () => (
  <div className="flex min-h-screen bg-bg text-text-main">
    <Sidebar />
    <main className="flex-1 overflow-auto p-6">
      <Outlet />
    </main>
  </div>
)
