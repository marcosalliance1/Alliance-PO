import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout/Layout'
import ProjetosPage from './pages/Projetos/ProjetosPage'
import OrcamentoPage from './pages/Orcamento/OrcamentoPage'
import DashboardProjetoPage from './pages/Dashboard/DashboardProjetoPage'
import DashboardGeralPage from './pages/DashboardGeral/DashboardGeralPage'
import BancoItensPage from './pages/BancoItens/BancoItensPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/projetos" replace />} />
          <Route path="projetos" element={<ProjetosPage />} />
          <Route path="orcamento/:id" element={<OrcamentoPage />} />
          <Route path="dashboard/:id" element={<DashboardProjetoPage />} />
          <Route path="dashboard-geral" element={<DashboardGeralPage />} />
          <Route path="banco-itens" element={<BancoItensPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
