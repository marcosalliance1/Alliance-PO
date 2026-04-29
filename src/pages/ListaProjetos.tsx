import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Projeto, TipoEscola } from '../types'
import { Header } from '../components/layout/Header'
import { BadgeEscola } from '../components/ui/Badge'
import { ImportadorPO } from '../components/projeto/ImportadorPO'
import { AtualizadorPO } from '../components/projeto/AtualizadorPO'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { calcResumoProjeto, calcPercentFechados } from '../utils/calculos'
import { formatBRL, formatPercent, formatDate } from '../utils/formatters'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Plus, Upload, Trash2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

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
}

export function ListaProjetos({ projetos, onImportar, onAtualizar, onExcluir }: ListaProjetosProps) {
  const navigate = useNavigate()
  const [showImportar, setShowImportar] = useState(false)
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null)
  const [deletando, setDeletando] = useState<string | null>(null)
  const [filtroAno, setFiltroAno] = useState<number | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<TipoEscola | ''>('')
  const [anosAbertos, setAnosAbertos] = useState<Set<number>>(new Set())

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

  const porAno = useMemo(() => {
    const map = new Map<number, Projeto[]>()
    for (const p of filtrados) {
      const ano = p.tap.anoRealizacao
      if (!map.has(ano)) map.set(ano, [])
      map.get(ano)!.push(p)
    }
    // Ordena dentro de cada ano por atualizadoEm crescente (mais antigos primeiro)
    for (const lista of map.values()) {
      lista.sort((a, b) => {
        const ta = a.atualizadoEm ? new Date(a.atualizadoEm).getTime() : 0
        const tb = b.atualizadoEm ? new Date(b.atualizadoEm).getTime() : 0
        return ta - tb
      })
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
          {porAno.map(([ano, lista]) => (
            <div key={ano} className="card p-0 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-3 border-b border-white/10 hover:bg-white/5 transition-colors"
                onClick={() => toggleAno(ano)}
              >
                <div className="flex items-center gap-2">
                  {isOpen(ano) ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
                  <span className="text-text-main font-semibold">{ano}</span>
                  <span className="text-text-muted text-xs">{lista.length} projeto{lista.length !== 1 ? 's' : ''}</span>
                </div>
              </button>

              {isOpen(ano) && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 divide-y divide-white/5">
                  {lista.map((p) => {
                    const resumo = calcResumoProjeto(p)
                    const pct = calcPercentFechados(p)
                    return (
                      <div
                        key={p.id}
                        className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => navigate(`/projetos/${p.id}`)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-text-main text-sm leading-tight">{p.tap.turma || '—'}</p>
                            <p className="text-text-muted text-xs mt-0.5">{p.tap.instituicao || '—'}</p>
                          </div>
                          <BadgeEscola tipo={p.tap.tipoEscola} />
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                          <div>
                            <span className="text-text-muted">Orçado:</span>{' '}
                            <span className="text-text-main font-medium">{formatBRL(resumo.custoTotal.orcado)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Receita:</span>{' '}
                            <span className="text-text-main font-medium">{formatBRL(resumo.receitaBaile.vendido)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Margem:</span>{' '}
                            <span className={`font-medium ${resumo.margem.vendido >= 0 ? 'text-success' : 'text-danger'}`}>
                              {formatBRL(resumo.margem.vendido)}
                            </span>
                          </div>
                          {p.tap.dataEvento && (
                            <div>
                              <span className="text-text-muted">Data:</span>{' '}
                              <span className="text-text-main">{formatDate(p.tap.dataEvento)}</span>
                            </div>
                          )}
                        </div>

                        <ProgressBar value={pct * 100} label={`Fechados: ${formatPercent(pct)}`} color="#00b894" />

                        {/* Badge de frescor */}
                        {(() => {
                          const f = calcFrescor(p.atualizadoEm)
                          return (
                            <div className="flex items-center gap-1.5 mt-2">
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.cor, display: 'inline-block', flexShrink: 0 }} />
                              <span className="text-[10px]" style={{ color: f.cor }}>{f.texto}</span>
                            </div>
                          )
                        })()}

                        <div className="flex items-center gap-3 mt-2">
                          <button
                            className="text-primary/60 hover:text-primary text-xs flex items-center gap-1 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setAtualizandoId(p.id) }}
                          >
                            <RefreshCw size={11} /> Atualizar P.O.
                          </button>
                          <button
                            className="text-danger/60 hover:text-danger text-xs flex items-center gap-1 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setDeletando(p.id) }}
                          >
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
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
    </div>
  )
}
