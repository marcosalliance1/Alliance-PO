import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar />
      <main className="flex-1 ml-56 p-6 min-h-screen overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
