import { useMemo, useState, Fragment } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { SyncBar } from '../components/SyncBar'
import { pipelineDoGanhador, classificarPremioEntregue } from '../lib/rifaPipeline'
import { PipelineDots } from '../components/PipelineDots'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatarValor(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TIPO_COR: Record<string, string> = {
  'Rifas do Projeto': 'bg-primary/15 text-primary',
  'Sorteio Comissão': 'bg-warning/15 text-warning',
  'Sorteio Comercial': 'bg-success/15 text-success',
  'Torneio Personalidades': 'bg-danger/15 text-danger',
}

function Badge({ children, cor }: { children: React.ReactNode; cor: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cor}`}>{children}</span>
}

function BadgeSimNao({ valor }: { valor: boolean }) {
  return <Badge cor={valor ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}>{valor ? 'Sim' : 'Não'}</Badge>
}

function BadgePremioEntregue({ texto }: { texto: string | null }) {
  const classe = classificarPremioEntregue(texto)
  const cor = classe === 'sim' ? 'bg-success/15 text-success' : classe === 'nao' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'
  return <Badge cor={cor}>{texto || '—'}</Badge>
}

export function GanhadoresPage() {
  const { ganhadores, rifas, compras, carregando } = useAtendimento()
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroPendencia, setFiltroPendencia] = useState<'todos' | 'pendentes' | 'feitos'>('todos')
  const [expandido, setExpandido] = useState<string | null>(null)

  const tipos = useMemo(() => Array.from(new Set(ganhadores.map(g => g.tipo).filter((t): t is string => !!t))).sort(), [ganhadores])

  function ehPendente(g: typeof ganhadores[number]): boolean {
    return !g.contato_feito || classificarPremioEntregue(g.premio_entregue) !== 'sim'
  }

  const ganhadoresFiltrados = useMemo(() => {
    let arr = ganhadores
    if (filtroTipo) arr = arr.filter(g => g.tipo === filtroTipo)
    if (filtroPendencia === 'pendentes') arr = arr.filter(ehPendente)
    if (filtroPendencia === 'feitos') arr = arr.filter(g => !ehPendente(g))
    // Pendências primeiro, por data do sorteio mais antiga primeiro — são as mais urgentes.
    return [...arr].sort((a, b) => {
      const pa = ehPendente(a) ? 0 : 1
      const pb = ehPendente(b) ? 0 : 1
      if (pa !== pb) return pa - pb
      return (a.data_sorteio ?? '9999-99-99').localeCompare(b.data_sorteio ?? '9999-99-99')
    })
  }, [ganhadores, filtroTipo, filtroPendencia])

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-4">Ganhadores</h1>
      <SyncBar />

      <div className="flex gap-3 mb-4">
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
        >
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex gap-1 bg-surface border border-white/10 rounded-lg p-1">
          {(['todos', 'pendentes', 'feitos'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFiltroPendencia(v)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${filtroPendencia === v ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main'}`}
            >
              {v === 'todos' ? 'Todos' : v === 'pendentes' ? 'Pendentes' : 'Feitos'}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3 font-semibold"></th>
                <th className="px-4 py-3 font-semibold">Turma</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Prêmio</th>
                <th className="px-4 py-3 font-semibold">Data do Sorteio</th>
                <th className="px-4 py-3 font-semibold">Ganhador</th>
                <th className="px-4 py-3 font-semibold">Contato</th>
                <th className="px-4 py-3 font-semibold">Contato Feito</th>
                <th className="px-4 py-3 font-semibold">Prêmio Entregue</th>
                <th className="px-4 py-3 font-semibold">Financeiro</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Carregando...</td></tr>
              )}
              {!carregando && ganhadoresFiltrados.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-text-muted">Nenhum ganhador encontrado.</td></tr>
              )}
              {ganhadoresFiltrados.map(g => {
                const aberto = expandido === g.id
                const { rifa, compra, status } = pipelineDoGanhador(g, compras, rifas)
                return (
                  <Fragment key={g.id}>
                    <tr
                      onClick={() => setExpandido(aberto ? null : g.id)}
                      className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                    >
                      <td className="px-4 py-2 text-text-muted">{aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className="px-4 py-2 text-text-main">{g.turma}</td>
                      <td className="px-4 py-2"><Badge cor={TIPO_COR[g.tipo ?? ''] ?? 'bg-white/10 text-text-muted'}>{g.tipo ?? '—'}</Badge></td>
                      <td className="px-4 py-2 text-text-muted max-w-xs truncate" title={g.premio_descricao ?? ''}>{g.premio_descricao ?? '—'}</td>
                      <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatarData(g.data_sorteio)}</td>
                      <td className="px-4 py-2 text-text-main whitespace-nowrap">{g.nome_ganhador ?? '—'}</td>
                      <td className="px-4 py-2 text-text-muted whitespace-nowrap">{g.contato ?? '—'}</td>
                      <td className="px-4 py-2"><BadgeSimNao valor={g.contato_feito} /></td>
                      <td className="px-4 py-2"><BadgePremioEntregue texto={g.premio_entregue} /></td>
                      <td className="px-4 py-2 text-text-muted">{g.financeiro ?? '—'}</td>
                    </tr>
                    {aberto && (
                      <tr className="border-t border-white/5 bg-white/[0.02]">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Pipeline</span>
                            <PipelineDots status={status} />
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div className="card bg-bg">
                              <div className="text-text-muted uppercase text-[10px] font-semibold mb-1">Etapa 1 — Rifa</div>
                              {rifa
                                ? <div className="text-text-main">{rifa.turma} · {rifa.situacao} · vencimento {formatarData(rifa.dia_vencimento)}</div>
                                : <div className="text-text-muted">Sorteio avulso — sem rifa cadastrada.</div>}
                            </div>
                            <div className="card bg-bg">
                              <div className="text-text-muted uppercase text-[10px] font-semibold mb-1">Etapa 2 — Ganhador</div>
                              <div className="text-text-main">{g.nome_ganhador ?? '—'} · contato {g.contato_feito ? 'feito' : 'pendente'} · prêmio {g.premio_entregue ?? '—'}</div>
                            </div>
                            <div className="card bg-bg">
                              <div className="text-text-muted uppercase text-[10px] font-semibold mb-1">Etapa 3 — Compra</div>
                              {compra
                                ? <div className="text-text-main">{compra.status ?? '—'} · {formatarValor(compra.valor)} · compra em {formatarData(compra.data_compra)}</div>
                                : <div className="text-text-muted">Ainda sem registro de compra.</div>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
