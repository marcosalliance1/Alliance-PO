import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ToastContainer } from '../UI/Toast'
import { ConfirmDialog } from '../UI/ConfirmDialog'
import { useAppContext } from '../../contexts/AppContext'

export const Layout: React.FC = () => {
  const { toasts, removeToast, confirmState, acceptConfirm, cancelConfirm } = useAppContext()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-surface text-white font-sans">
      {/* Overlay — mobile only, behind drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <ToastContainer toasts={toasts} remove={removeToast} />
      <ConfirmDialog
        open={confirmState.open}
        message={confirmState.message}
        onConfirm={acceptConfirm}
        onCancel={cancelConfirm}
      />
    </div>
  )
}
