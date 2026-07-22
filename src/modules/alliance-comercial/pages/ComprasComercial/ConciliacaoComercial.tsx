import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useConciliacaoCartao, type CartaoGastoComercialRow, type CartaoGastoGeralRow } from '../../hooks/useConciliacaoCartao'
import { useGoogleAuth } from '../../../../contexts/GoogleAuthContext'
import { formatBRL, formatDate } from '../../../../utils/formatters'
import type { StatusConciliacao } from '../../lib/conciliacaoCartao'

const STATUS_INFO: Record<StatusConciliacao | 'nao_processado', { label: string; badge: string; card: string }> = {
  conciliado:        { label: 'Conciliado',          badge: 'bg-success/15 text-success',  card: 'border-success/30' },
  divergencia_data:  { label: 'Divergência de data',  badge: 'bg-warning/15 text-warning',  card: 'border-warning/30' },
  cartao_divergente: { label: 'Cartão divergente',    badge: 'bg-orange-500/15 text-orange-400', card: 'border-orange-500/30' },
  nao_encontrado:    { label: 'Não encontrado',       badge: 'bg-danger/15 text-danger',    card: 'border-danger/30' },
  ambiguo:           { label: 'Match ambíguo',        badge: 'bg-purple-500/15 text-purple-400', card: 'border-purple-500/30' },
  fora_do_cartao:    { label: 'Fora do cartão',       badge: 'bg-white/10 text-text-muted', card: 'border-white/10' },
  nao_processado:    { label: 'Não processado',       badge: 'bg-white/10 text-text-muted', card: 'border-white/10' },
}

const ORDEM_STATUS: (StatusConciliacao | 'nao_processado')[] = [
  'conciliado', 'divergencia_data', 'cartao_divergente', 'nao_encontrado', 'ambiguo', 'fora_do_cartao',
]

const inputBase = 'flex-1 min-w-[240px] bg-bg border border-white/10 rounded-md px-3 py-2 text-sm text-text-main placeholder:text-text-muted'
const selectBase = 'bg-bg border border-white/10 rounded-md px-3 py-1.5 text-sm text-text-main'
const btnPrimary = 'px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-medium rounded-md text-sm shrink-0'

function mensagemErroAmigavel(msg: string): string {
  if (msg.includes('must not be an Office file')) {
    return 'Essa planilha é um arquivo Excel (.xlsx) salvo no Drive, não uma Planilha Google nativa — '
      + 'a API não consegue ler nesse formato. Abra o arquivo, vá em Arquivo → Salvar como Planilhas Google, '
      + 'e cole aqui o link da cópia convertida.'
  }
  return msg
}

export default function ConciliacaoComercial() {
  const {
    linhasGeral, linhasComercial, geralSemCorrespondencia, carregando, sincronizando, recalculando, erro, avisos,
    sincronizarGeral, sincronizarComercial, recalcular, marcarRevisado,
  } = useConciliacaoCartao()
  const { accessToken, conectar } = useGoogleAuth()

  const [linkGeral, setLinkGeral] = useState('')
  const [linkComercial, setLinkComercial] = useState('')
  const [erroSync, setErroSync] = useState<string | null>(null)
  const [filtroProjeto, setFiltroProjeto] = useState('')
  const [filtroPortador, setFiltroPortador] = useState('')
  const [linhaExpandida, setLinhaExpandida] = useState<string | null>(null)
  const [painelSemCorrespondenciaAberto, setPainelSemCorrespondenciaAberto] = useState(false)
  const [observacaoRascunho, setObservacaoRascunho] = useState<Record<string, string>>({})
  const [pendente, setPendente] = useState<'geral' | 'comercial' | null>(null)

  async function executarSincronizacao(tipo: 'geral' | 'comercial', token: string) {
    const link = tipo === 'geral' ? linkGeral : linkComercial
    if (!link.trim()) { setErroSync(`Cole o link da planilha ${tipo === 'geral' ? 'GERAL (Controle Financeiro do Cartão)' : 'COMERCIAL (Despesas Comerciais)'}.`); return }
    try {
      if (tipo === 'geral') await sincronizarGeral(link, token)
      else await sincronizarComercial(link, token)
    } catch (e) {
      setErroSync(mensagemErroAmigavel((e as Error).message))
    }
  }

  async function handleSincronizar(tipo: 'geral' | 'comercial') {
    setErroSync(null)
    // Clicar em "Conectar Google" só abre o popup de login e volta na hora — sem isso,
    // era preciso clicar de novo manualmente depois de conectar, e sem erro nenhum
    // aparecendo o clique único parecia "não fez nada".
    if (!accessToken) { setPendente(tipo); conectar(); return }
    await executarSincronizacao(tipo, accessToken)
  }

  useEffect(() => {
    if (accessToken && pendente) {
      const tipo = pendente
      setPendente(null)
      void executarSincronizacao(tipo, accessToken)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const projetos = useMemo(
    () => [...new Set(linhasComercial.map(l => l.projeto))].sort(),
    [linhasComercial],
  )
  const portadores = useMemo(
    () => [...new Set(linhasComercial.map(l => l.portador).filter((p): p is string => !!p))].sort(),
    [linhasComercial],
  )

  const linhasFiltradas = useMemo(() => linhasComercial.filter(l =>
    (!filtroProjeto || l.projeto === filtroProjeto) && (!filtroPortador || l.portador === filtroPortador),
  ), [linhasComercial, filtroProjeto, filtroPortador])

  const resumoPorStatus = useMemo(() => {
    const mapa = new Map<string, { qtd: number; total: number }>()
    for (const l of linhasComercial) {
      const atual = mapa.get(l.status_conciliacao) ?? { qtd: 0, total: 0 }
      atual.qtd += 1
      atual.total += l.valor
      mapa.set(l.status_conciliacao, atual)
    }
    return mapa
  }, [linhasComercial])

  const totalComercial = linhasComercial.reduce((s, l) => s + l.valor, 0)

  async function handleMarcarRevisado(linha: CartaoGastoComercialRow) {
    const observacao = observacaoRascunho[linha.id] ?? linha.observacao_revisao ?? ''
    await marcarRevisado(linha.id, !linha.revisado_manualmente, observacao || null)
  }

  return (
    <div className="space-y-5">
      <div className="bg-surface-2 border border-primary/20 rounded-lg p-4 space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={linkGeral}
            onChange={e => setLinkGeral(e.target.value)}
            placeholder='Link da planilha GERAL ("CARTÃO ALLIANCE - CONTROLE FINANCEIRO")'
            className={inputBase}
          />
          <button type="button" onClick={() => handleSincronizar('geral')} disabled={sincronizando} className={btnPrimary}>
            {sincronizando ? 'Sincronizando…' : !accessToken ? 'Conectar Google' : 'Sincronizar GERAL'}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={linkComercial}
            onChange={e => setLinkComercial(e.target.value)}
            placeholder='Link da planilha COMERCIAL ("Despesas Comerciais")'
            className={inputBase}
          />
          <button type="button" onClick={() => handleSincronizar('comercial')} disabled={sincronizando} className={btnPrimary}>
            {sincronizando ? 'Sincronizando…' : !accessToken ? 'Conectar Google' : 'Sincronizar COMERCIAL'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => recalcular()} disabled={recalculando}
            className="text-xs text-text-muted hover:text-text-main underline disabled:opacity-40">
            {recalculando ? 'Recalculando…' : 'Recalcular conciliação'}
          </button>
        </div>
        {(erroSync || erro) && <p className="text-danger text-xs">{erroSync ?? erro}</p>}
        {avisos.length > 0 && (
          <div className="bg-warning/10 border border-warning/20 rounded-md px-3 py-2 space-y-1">
            {avisos.map((a, i) => <p key={i} className="text-warning text-xs">{a}</p>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-surface rounded-xl border border-white/10 p-4">
          <p className="text-text-muted text-xs">Total Comercial</p>
          <p className="text-text-main font-semibold text-lg">{formatBRL(totalComercial)}</p>
          <p className="text-text-muted text-[11px]">{linhasComercial.length} lançamento{linhasComercial.length !== 1 ? 's' : ''}</p>
        </div>
        {ORDEM_STATUS.map(status => {
          const info = STATUS_INFO[status]
          const dados = resumoPorStatus.get(status) ?? { qtd: 0, total: 0 }
          return (
            <div key={status} className={`bg-surface rounded-xl border p-4 ${info.card}`}>
              <p className="text-text-muted text-xs">{info.label}</p>
              <p className="text-text-main font-semibold text-lg">{formatBRL(dados.total)}</p>
              <p className="text-text-muted text-[11px]">{dados.qtd} lançamento{dados.qtd !== 1 ? 's' : ''}</p>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <select value={filtroProjeto} onChange={e => setFiltroProjeto(e.target.value)} className={selectBase}>
          <option value="">Todos os projetos</option>
          {projetos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroPortador} onChange={e => setFiltroPortador(e.target.value)} className={selectBase}>
          <option value="">Todos os portadores</option>
          {portadores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="bg-surface rounded-xl border border-white/10 overflow-hidden">
        {carregando ? (
          <div className="py-16 text-center text-text-muted text-sm">Carregando…</div>
        ) : linhasFiltradas.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm">Nenhum lançamento comercial sincronizado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Projeto</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Categoria</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Fornecedor</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted whitespace-nowrap">Valor</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Cartão</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas.map(linha => {
                  const info = STATUS_INFO[linha.status_conciliacao]
                  const expandida = linhaExpandida === linha.id
                  return (
                    <Fragment key={linha.id}>
                      <tr className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => setLinhaExpandida(expandida ? null : linha.id)}>
                        <td className="px-4 py-2 text-text-main max-w-[160px] truncate" title={linha.projeto}>
                          <span className="inline-flex items-center gap-1">
                            {expandida ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {linha.projeto}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-text-main whitespace-nowrap">{formatDate(linha.data)}</td>
                        <td className="px-4 py-2 text-text-muted whitespace-nowrap">{linha.categoria ?? '—'}</td>
                        <td className="px-4 py-2 text-text-muted max-w-[160px] truncate" title={linha.fornecedor ?? ''}>{linha.fornecedor ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-text-main whitespace-nowrap">{formatBRL(linha.valor)}</td>
                        <td className="px-4 py-2 text-text-muted whitespace-nowrap">{linha.portador ?? '—'}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${info.badge}`}>
                            {info.label}{linha.dif_dias != null && linha.dif_dias > 0 ? ` (${linha.dif_dias}d)` : ''}
                          </span>
                          {linha.revisado_manualmente && (
                            <span className="ml-1 text-[10px] text-text-muted" title={linha.observacao_revisao ?? ''}>✓ revisado</span>
                          )}
                        </td>
                        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleMarcarRevisado(linha)}
                            className="text-[11px] text-text-muted hover:text-text-main underline whitespace-nowrap"
                          >
                            {linha.revisado_manualmente ? 'Desmarcar' : 'Marcar revisado'}
                          </button>
                        </td>
                      </tr>
                      {expandida && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={8} className="px-4 py-3">
                            <LinhaExpandidaDetalhe
                              linha={linha}
                              geralCorrespondente={linha.match_geral_id ? linhasGeral.find(g => g.id === linha.match_geral_id) ?? null : null}
                              observacaoRascunho={observacaoRascunho[linha.id] ?? linha.observacao_revisao ?? ''}
                              onObservacaoChange={v => setObservacaoRascunho(prev => ({ ...prev, [linha.id]: v }))}
                              onSalvarObservacao={async () => {
                                await marcarRevisado(linha.id, linha.revisado_manualmente, observacaoRascunho[linha.id] ?? linha.observacao_revisao ?? null)
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {geralSemCorrespondencia.length > 0 && (
        <div className="bg-surface rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setPainelSemCorrespondenciaAberto(a => !a)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
          >
            {painelSemCorrespondenciaAberto ? <ChevronDown className="w-4 h-4 text-text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />}
            <span className="flex-1 text-text-main font-semibold">Gastos do cartão marcados COMERCIAL sem correspondência</span>
            <span className="text-text-muted text-xs">{geralSemCorrespondencia.length} lançamento{geralSemCorrespondencia.length !== 1 ? 's' : ''}</span>
          </button>
          {painelSemCorrespondenciaAberto && (
            <div className="border-t border-white/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/10">
                    <th className="text-left px-4 py-2 text-text-muted font-medium text-xs">Item comprado</th>
                    <th className="text-left px-4 py-2 text-text-muted font-medium text-xs">Data</th>
                    <th className="text-right px-4 py-2 text-text-muted font-medium text-xs">Valor</th>
                    <th className="text-left px-4 py-2 text-text-muted font-medium text-xs">Portador</th>
                    <th className="text-left px-4 py-2 text-text-muted font-medium text-xs">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {geralSemCorrespondencia.map(g => (
                    <tr key={g.id} className="border-t border-white/5">
                      <td className="px-4 py-2 text-text-main">{g.item_comprado}</td>
                      <td className="px-4 py-2 text-text-muted whitespace-nowrap">{formatDate(g.data)}</td>
                      <td className="px-4 py-2 text-right text-text-main whitespace-nowrap">{formatBRL(g.valor)}</td>
                      <td className="px-4 py-2 text-text-muted">{g.portador}</td>
                      <td className="px-4 py-2 text-text-muted max-w-[260px] truncate" title={g.descricao ?? ''}>{g.descricao ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LinhaExpandidaDetalhe({
  linha, geralCorrespondente, observacaoRascunho, onObservacaoChange, onSalvarObservacao,
}: {
  linha: CartaoGastoComercialRow
  geralCorrespondente: CartaoGastoGeralRow | null
  observacaoRascunho: string
  onObservacaoChange: (v: string) => void
  onSalvarObservacao: () => Promise<void>
}) {
  return (
    <div className="space-y-3">
      {geralCorrespondente ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-text-muted mb-1">Lançamento na planilha COMERCIAL</p>
            <p className="text-text-main">{linha.fornecedor} · {formatBRL(linha.valor)} · {formatDate(linha.data)} · {linha.portador ?? '—'}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">Correspondência na planilha GERAL</p>
            <p className="text-text-main">{geralCorrespondente.item_comprado} · {formatBRL(geralCorrespondente.valor)} · {formatDate(geralCorrespondente.data)} · {geralCorrespondente.portador}</p>
          </div>
        </div>
      ) : (
        <p className="text-text-muted text-xs">Sem lançamento correspondente na planilha GERAL.</p>
      )}
      <div className="flex gap-2 items-start">
        <textarea
          value={observacaoRascunho}
          onChange={e => onObservacaoChange(e.target.value)}
          placeholder="Observação da revisão (opcional)"
          rows={2}
          className="flex-1 bg-bg border border-white/10 rounded-md px-2 py-1.5 text-xs text-text-main placeholder:text-text-muted"
        />
        <button onClick={onSalvarObservacao} className="text-xs px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-md shrink-0">
          Salvar observação
        </button>
      </div>
    </div>
  )
}
