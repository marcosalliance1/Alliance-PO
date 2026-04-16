import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0F1117' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
        <Outlet />
      </main>
    </div>
  )
}
