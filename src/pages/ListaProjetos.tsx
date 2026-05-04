import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Projeto, TipoEscola } from '../types'
import type { SyncResult } from '../utils/sheetsSync'
import { Header } from '../components/layout/Header'
import { ImportadorPO } from '../components/projeto/ImportadorPO'
import { AtualizadorPO } from '../components/projeto/AtualizadorPO'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Toast } from '../components/ui/Toast'
import { calcResumoProjeto, calcPercentFechados } from '../utils/calculos'
import { formatBRL, formatPercent } from '../utils/formatters'
import { ProgressBar } from '../components/ui/ProgressBar'
import { sincronizarComSheets, extrairSpreadsheetId } from '../utils/sheetsSync'
import { useGoogleAuth } from '../contexts/GoogleAuthContext'
import { Plus, Upload, Trash2, ChevronDown, ChevronRight, RefreshCw, Cloud, Loader, Link } from 'lucide-react'

function calcFrescor(atualizadoEm: string): { texto: string; cor: string } {
  if (!atualizadoEm) return { texto: 'Nunca salvo', cor: '#e17055' }
  const agora = new Date()
  const atualizado = new Date(atualizadoEm)
  const diffMs = agora.getTime() - atualizado.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDias === 0) return { texto: 'Atualizado hoje', cor: '#00b894' }
  if (diffDias === 1) return { texto: 'Atualizado ontem', cor: '#fdcb6e' }
  if (diffDias <= 7) return { texto: `Atualizado há ${diffDias} dias`, cor: '#fdcb6e' }
  return { texto: `Atualizado há ${diffDias} dias`, cor: '#e17055' }
}

interface ListaProjetosProps {
  projetos: Projeto[]
  onImportar: (p: Projeto) => Promise<void>
  onAtualizar: (id: string, p: Projeto) => Promise<void>
  onExcluir: (id: string) => Promise<void>
  onSincronizar: (id: string, result: SyncResult) => Promise<void>
  onAtualizarSheetsUrl: (id: string, url: string) => Promise<void>
}

export function ListaProjetos({ projetos, onImportar, onAtualizar, onExcluir, onSincronizar, onAtualizarSheetsUrl }: ListaProjetosProps) {
  const navigate = useNavigate()
  const { accessToken, conectar, invalidarToken } = useGoogleAuth()

  const [showImportar, setShowImportar] = useState(false)
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null)
  const [deletando, setDeletando] = useState<string | null>(null)
  const [filtroAno, setFiltroAno] = useState<number | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<TipoEscola | ''>('')
  const [anosAbertos, setAnosAbertos] = useState<Set<number>>(new Set())

  // Sync state
  const [sincronizando, setSincronizando] = useState<Record<string, boolean>>({})
  const [progressoSync, setProgressoSync] = useState<string | null>(null)
  const [pendingSyncId, setPendingSyncId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'sucesso' | 'erro' } | null>(null)

  // Modal de URL do Sheets
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [urlModalId, setUrlModalId] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')

  const anos = useMemo(() => {
    const set = new Set(projetos.map((p) => p.tap.anoRealizacao))
    return Array.from(set).sort((a, b) => b - a)
  }, [projetos])

  const filtrados = useMemo(() => {
    return projetos.filter((p) => {
      if (filtroAno && p.tap.anoRealizacao !== filtroAno) return false
      if (filtroTipo && p.tap.tipoEscola !== filtroTipo) return false
      return true
    })
  }, [projetos, filtroAno, filtroTipo])

  const TIPO_ORDER: TipoEscola[] = ['SUPERIOR', 'MEDIO', 'FUNDAMENTAL']
  const TIPO_LABEL: Record<TipoEscola, string> = {
    SUPERIOR: 'Ensino Superior',
    MEDIO: 'Ensino Médio',
    FUNDAMENTAL: 'Ensino Fundamental',
  }
  const TIPO_COLOR: Record<TipoEscola, string> = {
    SUPERIOR: '#6366F1',
    MEDIO: '#0EA5E9',
    FUNDAMENTAL: '#10B981',
  }

  // porAno: Map<ano, Map<tipoEscola, Projeto[]>>
  const porAno = useMemo(() => {
    const map = new Map<number, Map<TipoEscola, Projeto[]>>()
    for (const p of filtrados) {
      const ano = p.tap.anoRealizacao
      if (!map.has(ano)) map.set(ano, new Map())
      const porTipo = map.get(ano)!
      const tipo = p.tap.tipoEscola
      if (!porTipo.has(tipo)) porTipo.set(tipo, [])
      porTipo.get(tipo)!.push(p)
    }
    for (const porTipo of map.values()) {
      for (const lista of porTipo.values()) {
        lista.sort((a, b) => (a.tap.turma ?? '').localeCompare(b.tap.turma ?? ''))
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [filtrados])

  function toggleAno(ano: number) {
    setAnosAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(ano)) next.delete(ano)
      else next.add(ano)
      return next
    })
  }

  function isOpen(ano: number) {
    return anosAbertos.size === 0 ? true : anosAbertos.has(ano)
  }

  // ── Sync logic ────────────────────────────────────────────────────────────
  const executarSync = useCallback(async (projeto: Projeto) => {
    const spreadsheetId = extrairSpreadsheetId(projeto.sheetsUrl ?? '')
    if (!spreadsheetId || !accessToken) return

    setSincronizando(prev => ({ ...prev, [projeto.id]: true }))
    setProgressoSync('Iniciando sincronização...')

    try {
      const resultado = await sincronizarComSheets(
        spreadsheetId,
        accessToken,
        projeto,
        (msg) => setProgressoSync(msg),
      )
      await onSincronizar(projeto.id, resultado)
      setToast({ mensagem: `Sincronizado com sucesso — TAP, receitas e custos atualizados`, tipo: 'sucesso' })
      if (resultado.avisos.length > 0) {
        setTimeout(() => setToast({ mensagem: resultado.avisos[0], tipo: 'erro' }), 3000)
      }
    } catch (err) {
      const e = err as Error & { tipo?: string }
      if (e.tipo === 'TOKEN_EXPIRADO') {
        invalidarToken()
        setToast({ mensagem: 'Token expirado. Reconecte o Google Drive e tente novamente.', tipo: 'erro' })
      } else {
        setToast({ mensagem: e.message ?? 'Erro na sincronização', tipo: 'erro' })
      }
    } finally {
      setSincronizando(prev => ({ ...prev, [projeto.id]: false }))
      setProgressoSync(null)
    }
  }, [accessToken, onSincronizar, invalidarToken])

  // Executar sync pendente após autenticação
  useEffect(() => {
    if (accessToken && pendingSyncId) {
      const projeto = projetos.find(p => p.id === pendingSyncId)
      setPendingSyncId(null)
      if (projeto) executarSync(projeto)
    }
  }, [accessToken, pendingSyncId, projetos, executarSync])

  function handleSincronizar(projeto: Projeto) {
    const spreadsheetId = extrairSpreadsheetId(projeto.sheetsUrl ?? '')
    if (!spreadsheetId) {
      // Abrir modal para configurar URL
      setUrlModalId(projeto.id)
      setUrlInput(projeto.sheetsUrl ?? '')
      setShowUrlModal(true)
      return
    }
    if (!accessToken) {
      setPendingSyncId(projeto.id)
      conectar()
      return
    }
    executarSync(projeto)
  }

  async function salvarUrlESync() {
    if (!urlModalId) return
    await onAtualizarSheetsUrl(urlModalId, urlInput)
    setShowUrlModal(false)
    const projeto = projetos.find(p => p.id === urlModalId)
    if (projeto && extrairSpreadsheetId(urlInput)) {
      const projetoAtualizado = { ...projeto, sheetsUrl: urlInput }
      if (!accessToken) {
        setPendingSyncId(urlModalId)
        conectar()
      } else {
        executarSync(projetoAtualizado)
      }
    }
    setUrlModalId(null)
    setUrlInput('')
  }

  return (
    <div>
      <Header
        title="Projetos"
        subtitle={`${projetos.length} projeto${projetos.length !== 1 ? 's' : ''} cadastrado${projetos.length !== 1 ? 's' : ''}`}
        actions={
          <>
            <button className="btn-secondary flex items-center gap-2" onClick={() => setShowImportar(true)}>
              <Upload size={15} /> Importar .xlsx
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/projetos/novo')}>
              <Plus size={15} /> Novo Projeto
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="flex gap-3 mb-5">
        <select
          className="bg-surface border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
          value={filtroAno ?? ''}
          onChange={(e) => setFiltroAno(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          className="bg-surface border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as TipoEscola | '')}
        >
          <option value="">Todos os tipos</option>
          <option value="FUNDAMENTAL">Fundamental</option>
          <option value="MEDIO">Médio</option>
          <option value="SUPERIOR">Superior</option>
        </select>
      </div>

      {/* Barra de progresso de sync */}
      {progressoSync && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">
          <Loader size={14} className="animate-spin flex-shrink-0" />
          {progressoSync}
        </div>
      )}

      {projetos.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-text-muted text-lg mb-2">Nenhum projeto ainda</p>
          <p className="text-text-muted text-sm mb-6">Crie um novo projeto manualmente ou importe um arquivo Excel.</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-secondary flex items-center gap-2" onClick={() => setShowImportar(true)}>
              <Upload size={15} /> Importar .xlsx
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/projetos/novo')}>
              <Plus size={15} /> Novo Projeto
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {porAno.map(([ano, porTipo]) => {
            const totalAno = Array.from(porTipo.values()).reduce((s, l) => s + l.length, 0)
            return (
            <div key={ano} className="card p-0 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-3 border-b border-white/10 hover:bg-white/5 transition-colors"
                onClick={() => toggleAno(ano)}
              >
                <div className="flex items-center gap-2">
                  {isOpen(ano) ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
                  <span className="text-text-main font-semibold">{ano}</span>
                  <span className="text-text-muted text-xs">{totalAno} projeto{totalAno !== 1 ? 's' : ''}</span>
                </div>
              </button>

              {isOpen(ano) && (
                <div>
                  {TIPO_ORDER.filter((tipo) => porTipo.has(tipo)).map((tipo) => {
                    const lista = porTipo.get(tipo)!
                    return (
                      <div key={tipo}>
                        {/* Cabeçalho do tipo de ensino */}
                        <div
                          className="flex items-center gap-2 px-5 py-2 border-b border-white/5"
                          style={{ borderLeft: `3px solid ${TIPO_COLOR[tipo]}` }}
                        >
                          <span className="text-xs font-semibold" style={{ color: TIPO_COLOR[tipo] }}>
                            {TIPO_LABEL[tipo]}
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {lista.length} projeto{lista.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Grid de cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 divide-y divide-white/5 border-b border-white/5">
                          {lista.map((p) => {
                            const resumo = calcResumoProjeto(p)
                            const pct = calcPercentFechados(p)
                            const temSheets = !!p.sheetsUrl && !!extrairSpreadsheetId(p.sheetsUrl)
                            const isSincronizando = !!sincronizando[p.id]
                            const margemPct = resumo.receitaBaile.vendido > 0
                              ? ((resumo.receitaBaile.vendido - resumo.custoTotal.orcado) / resumo.receitaBaile.vendido) * 100
                              : 0

                            return (
                              <div
                                key={p.id}
                                className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
                                onClick={() => navigate(`/projetos/${p.id}`)}
                              >
                                {/* Cabeçalho do card */}
                                <div className="flex items-start justify-between mb-2.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-text-main text-sm leading-tight">
                                      {p.tap.turma || '—'}
                                    </p>
                                    <p className="text-text-muted text-xs mt-0.5">{p.tap.instituicao || '—'}</p>
                                  </div>
                                  {temSheets && (
                                    <span className="text-[10px] text-success bg-success/10 border border-success/20 rounded-full px-1.5 py-0.5 flex items-center gap-1 ml-2 shrink-0">
                                      <Cloud size={8} /> Sheets
                                    </span>
                                  )}
                                </div>

                                {/* Dados financeiros — 3 campos, uma linha */}
                                <div className="flex items-center gap-4 text-xs mb-2.5">
                                  <div>
                                    <span className="text-text-muted">Receita</span>
                                    <p className="font-semibold text-text-main">{formatBRL(resumo.receitaBaile.vendido)}</p>
                                  </div>
                                  <div>
                                    <span className="text-text-muted">Custo Orç.</span>
                                    <p className="font-semibold text-text-main">{formatBRL(resumo.custoTotal.orcado)}</p>
                                  </div>
                                  <div>
                                    <span className="text-text-muted">Margem Orç.</span>
                                    <p className={`font-semibold ${margemPct >= 0 ? 'text-success' : 'text-danger'}`}>
                                      {margemPct.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>

                                <ProgressBar value={pct * 100} label={`Fechados: ${formatPercent(pct)}`} color="#00b894" />

                                {/* Frescor + ações */}
                                <div className="flex items-center justify-between mt-2" onClick={(e) => e.stopPropagation()}>
                                  {(() => {
                                    const f = calcFrescor(p.atualizadoEm)
                                    return (
                                      <div className="flex items-center gap-1.5">
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: f.cor, display: 'inline-block', flexShrink: 0 }} />
                                        <span className="text-[10px]" style={{ color: f.cor }}>{f.texto}</span>
                                      </div>
                                    )
                                  })()}
                                  <div className="flex items-center gap-2">
                                    {temSheets ? (
                                      <button
                                        className="text-primary/70 hover:text-primary text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                                        disabled={isSincronizando}
                                        onClick={() => handleSincronizar(p)}
                                      >
                                        {isSincronizando
                                          ? <><Loader size={11} className="animate-spin" /> Sinc...</>
                                          : <><Cloud size={11} /> Sincronizar</>}
                                      </button>
                                    ) : (
                                      <button
                                        className="text-primary/60 hover:text-primary text-xs flex items-center gap-1 transition-colors"
                                        onClick={() => setAtualizandoId(p.id)}
                                      >
                                        <RefreshCw size={11} /> Atualizar
                                      </button>
                                    )}
                                    <button
                                      className="text-text-muted/40 hover:text-text-muted text-xs transition-colors"
                                      title="Configurar URL Google Sheets"
                                      onClick={() => { setUrlModalId(p.id); setUrlInput(p.sheetsUrl ?? ''); setShowUrlModal(true) }}
                                    >
                                      <Link size={11} />
                                    </button>
                                    <button
                                      className="text-danger/50 hover:text-danger text-xs flex items-center gap-1 transition-colors"
                                      onClick={() => setDeletando(p.id)}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* Modal URL Sheets */}
      {showUrlModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowUrlModal(false)}
        >
          <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6">
            <h3 className="text-text-main font-semibold text-base mb-1">URL da Planilha Google Sheets</h3>
            <p className="text-text-muted text-xs mb-4">Cole o link completo da planilha para habilitar a sincronização automática.</p>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                className="btn-secondary text-sm"
                onClick={() => { setShowUrlModal(false); setUrlInput(''); setUrlModalId(null) }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary text-sm flex items-center gap-2"
                onClick={salvarUrlESync}
              >
                <Cloud size={14} /> Salvar e Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportadorPO
        open={showImportar}
        onClose={() => setShowImportar(false)}
        onImported={(p) => { onImportar(p); navigate(`/projetos/${p.id}`) }}
      />

      {atualizandoId && (
        <AtualizadorPO
          projetoAtual={projetos.find((p) => p.id === atualizandoId)!}
          onClose={() => setAtualizandoId(null)}
          onAtualizado={(p) => { onAtualizar(atualizandoId, p); setAtualizandoId(null) }}
        />
      )}

      <ConfirmDialog
        open={!!deletando}
        title="Excluir projeto"
        message="Esta ação não pode ser desfeita. Todos os dados do projeto serão removidos permanentemente."
        confirmLabel="Excluir"
        danger
        onConfirm={() => { if (deletando) { onExcluir(deletando); setDeletando(null) } }}
        onCancel={() => setDeletando(null)}
      />

      {toast && (
        <Toast
          mensagem={toast.mensagem}
          tipo={toast.tipo}
          onFechar={() => setToast(null)}
        />
      )}
    </div>
  )
}
