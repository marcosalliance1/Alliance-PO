import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useParams, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { HomeScreen } from './pages/HomeScreen'
import { LandingPage } from './pages/LandingPage'
import { LoginPortal } from './pages/portal/LoginPortal'
import { DashboardPortal } from './pages/portal/DashboardPortal'
import { AdminPortal } from './pages/portal/AdminPortal'
import { PortalAuthProvider, usePortalAuth } from './contexts/PortalAuthContext'
import { DashboardGeral } from './pages/DashboardGeral'
import { ListaProjetos } from './pages/ListaProjetos'
import { NovoProjeto } from './pages/NovoProjeto'
import { ViewProjeto } from './pages/ViewProjeto'
import { BancoDeItens } from './pages/BancoDeItens'
import { Verbas } from './pages/Verbas'
import { Financeiro } from './pages/Financeiro'
import { Configuracoes } from './pages/Configuracoes'
import { LoginAdmin } from './pages/LoginAdmin'
import { LoginViewer } from './pages/LoginViewer'
import { useProjetos } from './hooks/useProjetos'
import { useBancoItens } from './hooks/useBancoItens'
import { useConfiguracoes } from './hooks/useConfiguracoes'
import type { ItemCusto, TAP, Receitas, ConciliacaoEverest, Projeto, ConfiguracaoGlobal, ItemCatalogo, CustoAdicional } from './types'
import { supabase } from './lib/supabase'
import { useAuth } from './contexts/AuthContext'
import { AppProvider as PreEventosProvider } from './modules/pre-eventos/contexts/AppContext'
import { Layout as PreEventosLayout } from './modules/pre-eventos/components/Layout/Layout'
import { DashboardPage } from './modules/pre-eventos/pages/Dashboard/DashboardPage'
import { ListaOrcamentosPage } from './modules/pre-eventos/pages/Orcamentos/ListaOrcamentosPage'
import { NovoOrcamentoPage } from './modules/pre-eventos/pages/Orcamentos/NovoOrcamentoPage'
import { OrcamentoPage } from './modules/pre-eventos/pages/Orcamentos/OrcamentoPage'
import { ConfiguracoesPage } from './modules/pre-eventos/pages/Configuracoes/ConfiguracoesPage'
import { Operacional } from './pages/Operacional'

// ── Spinner simples ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center h-40 text-text-muted text-sm gap-2">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Carregando...
    </div>
  )
}

// ── Guard de autenticação admin ───────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const { isAuthenticated: isPortalAuth } = usePortalAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!isAuthenticated) {
    if (isPortalAuth) return <Navigate to="/portal/dashboard" replace />
    return <Navigate to="/access" state={{ from: location }} replace />
  }
  // Viewer/admin na raiz → ir para módulos
  if (location.pathname === '/') return <Navigate to="/modulos" replace />
  return <>{children}</>
}

// ── Guard de autenticação portal ──────────────────────────────────────────────
function RequirePortalAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = usePortalAuth()
  if (!isAuthenticated) return <Navigate to="/portal" replace />
  return <>{children}</>
}

// ── ProjetoPage recebe tudo do pai — sem useProjetos próprio ─────────────────
interface ProjetoPageProps {
  projetos: Projeto[]
  loading: boolean
  bancoItens: ItemCatalogo[]
  config: ConfiguracaoGlobal
  atualizarTAP: (id: string, tap: TAP) => Promise<void>
  atualizarReceitas: (id: string, r: Receitas) => Promise<void>
  atualizarConciliacao: (id: string, c: ConciliacaoEverest) => Promise<void>
  atualizarCustosAdicionais: (id: string, items: CustoAdicional[]) => Promise<void>
  adicionarItem: (id: string, secaoId: string, partial: Partial<ItemCusto>) => Promise<void>
  atualizarItem: (id: string, secaoId: string, itemId: string, changes: Partial<ItemCusto>) => Promise<void>
  excluirItem: (id: string, secaoId: string, itemId: string) => Promise<void>
  salvarProjeto: (p: Projeto) => Promise<void>
}

function ProjetoPage({
  projetos, loading, bancoItens, config,
  atualizarTAP, atualizarReceitas, atualizarConciliacao, atualizarCustosAdicionais,
  adicionarItem, atualizarItem, excluirItem, salvarProjeto,
}: ProjetoPageProps) {
  const { id } = useParams<{ id: string }>()

  if (loading) return <Spinner />
  const projeto = projetos.find((p) => p.id === id)
  if (!projeto) return <Navigate to="/projetos" replace />

  return (
    <ViewProjeto
      projeto={projeto}
      bancoItens={bancoItens}
      onUpdateTAP={(tap: TAP) => atualizarTAP(projeto.id, tap)}
      onUpdateReceitas={(r: Receitas) => atualizarReceitas(projeto.id, r)}
      onUpdateConciliacao={(c) => atualizarConciliacao(projeto.id, c)}
      onUpdateCustosAdicionais={(items) => atualizarCustosAdicionais(projeto.id, items)}
      onAddItem={(secaoId: string) => adicionarItem(projeto.id, secaoId, {})}
      onAddItemFromBanco={(secaoId: string, partial: Partial<ItemCusto>) => adicionarItem(projeto.id, secaoId, partial)}
      onUpdateItem={(secaoId: string, itemId: string, changes: Partial<ItemCusto>) =>
        atualizarItem(projeto.id, secaoId, itemId, changes)
      }
      onDeleteItem={(secaoId: string, itemId: string) => excluirItem(projeto.id, secaoId, itemId)}
      onSalvar={() => salvarProjeto(projeto)}
      fornecedoresSugeridos={config.fornecedoresFavoritos}
    />
  )
}

// ── Rotas principais — única instância de useProjetos ────────────────────────
function AppRoutes() {
  const {
    projetos, loading: loadingProjetos, carregar,
    criarProjeto, importarProjeto, reimportarProjeto, excluirProjeto,
    atualizarTAP, atualizarReceitas, atualizarConciliacao, atualizarCustosAdicionais,
    adicionarItem, atualizarItem, excluirItem, salvarProjeto,
    sincronizarSecoes, atualizarSheetsUrl, atualizarSheetLayout, marcarRealizado,
  } = useProjetos()

  const { itens, itens: bancoItens, loading: loadingItens, adicionarItem: addBanco, atualizarItem: updBanco, desativarItem, reativarItem } = useBancoItens()
  const { config, salvarConfig } = useConfiguracoes()

  const location = useLocation()
  useEffect(() => {
    if (location.pathname === '/projetos' || location.pathname === '/projetos/dashboard') {
      carregar()
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export ──────────────────────────────────────────────────────────────────
  async function exportarJSON() {
    const [{ data: pRows }, { data: bRows }, { data: cRows }] = await Promise.all([
      supabase.from('projetos').select('*'),
      supabase.from('banco_itens').select('*'),
      supabase.from('configuracoes').select('*'),
    ])
    const blob = new Blob([JSON.stringify({ projetos: pRows, banco_itens: bRows, configuracoes: cRows }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alliance-po-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async function importarJSON(json: string) {
    try {
      const data = JSON.parse(json) as {
        projetos?: unknown[]; banco_itens?: unknown[]; configuracoes?: unknown[]
      }
      if (data.projetos?.length) await supabase.from('projetos').upsert(data.projetos as Record<string, unknown>[])
      if (data.banco_itens?.length) await supabase.from('banco_itens').upsert(data.banco_itens as Record<string, unknown>[])
      if (data.configuracoes?.length) await supabase.from('configuracoes').upsert(data.configuracoes as Record<string, unknown>[])
      window.location.reload()
    } catch {
      alert('Arquivo JSON inválido.')
    }
  }

  // ── Limpar ──────────────────────────────────────────────────────────────────
  async function limparDados() {
    await Promise.all([
      supabase.from('projetos').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('banco_itens').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ])
    window.location.reload()
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginAdmin />} />
      <Route path="/access" element={<LoginViewer />} />

      {/* Portal do Cliente — autenticação separada */}
      <Route path="/portal" element={<LoginPortal />} />
      <Route path="/portal/dashboard" element={<RequirePortalAuth><DashboardPortal /></RequirePortalAuth>} />

      {/* Tela de entrada pública */}
      <Route path="/" element={<LandingPage />} />

      {/* Tela de seleção de módulos (requer auth) */}
      <Route path="/modulos" element={<RequireAuth><HomeScreen /></RequireAuth>} />

      {/* Módulo P.O. Alliance */}
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route
          path="/projetos/dashboard"
          element={loadingProjetos ? <Spinner /> : <DashboardGeral projetos={projetos} />}
        />
        <Route
          path="/projetos"
          element={
            loadingProjetos ? <Spinner /> : (
              <ListaProjetos
                projetos={projetos}
                onImportar={(p) => importarProjeto(p)}
                onAtualizar={(id, p) => reimportarProjeto(id, p)}
                onExcluir={(id) => excluirProjeto(id)}
                onSincronizar={sincronizarSecoes}
                onAtualizarSheetsUrl={atualizarSheetsUrl}
                onAtualizarSheetLayout={atualizarSheetLayout}
                onMarcarRealizado={marcarRealizado}
              />
            )
          }
        />
        <Route
          path="/projetos/novo"
          element={
            <NovoProjeto
              onCriar={criarProjeto}
              ipcaPadrao={config.ipcaPadrao}
            />
          }
        />
        <Route
          path="/projetos/:id"
          element={
            <ProjetoPage
              projetos={projetos}
              loading={loadingProjetos}
              bancoItens={bancoItens}
              config={config}
              atualizarTAP={atualizarTAP}
              atualizarReceitas={atualizarReceitas}
              atualizarConciliacao={atualizarConciliacao}
              atualizarCustosAdicionais={atualizarCustosAdicionais}
              adicionarItem={adicionarItem}
              atualizarItem={atualizarItem}
              excluirItem={excluirItem}
              salvarProjeto={salvarProjeto}
            />
          }
        />
        <Route
          path="/banco-de-itens"
          element={
            loadingItens ? <Spinner /> : (
              <BancoDeItens
                itens={itens}
                onAdicionar={addBanco}
                onAtualizar={updBanco}
                onDesativar={desativarItem}
                onReativar={reativarItem}
              />
            )
          }
        />
        <Route path="/operacional" element={<Operacional />} />
        <Route path="/verbas" element={<Verbas />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/portal-admin" element={<AdminPortal />} />
        <Route
          path="/configuracoes"
          element={
            <Configuracoes
              config={config}
              onSalvar={salvarConfig}
              onExportar={exportarJSON}
              onImportar={importarJSON}
              onLimpar={limparDados}
            />
          }
        />
      </Route>

      {/* Módulo Pré-Eventos */}
      <Route
        path="/pre-eventos/*"
        element={
          <RequireAuth>
            <PreEventosProvider>
              <PreEventosLayout />
            </PreEventosProvider>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="orcamentos" element={<ListaOrcamentosPage />} />
        <Route path="orcamentos/novo" element={<NovoOrcamentoPage />} />
        <Route path="orcamentos/:id" element={<OrcamentoPage />} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PortalAuthProvider>
        <AppRoutes />
      </PortalAuthProvider>
    </BrowserRouter>
  )
}
