import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Download } from 'lucide-react'
import { exportarRadarXlsx } from '../../lib/exportarRadarExcel'
import { supabase } from '../../lib/supabase'
import type { MetasPct, ProjetoBruto } from '../../lib/economiaFechados'
import { montarCarteira, REGRAS, type CorRadar, type LinhaRadar, type SgeLinha } from '../../lib/radarMargem'
import { COR_ECONOMIA, COR_FALTA, COR_NEUTRA, pct1, reais } from './formato'
import { padronizarCaixa } from '../../utils/caixa'

// Aba "Radar" do Metas de margem. SOMENTE LEITURA: lê a posição do SGE (view sge_receita_portal) e calcula tudo no navegador.

const COR_AMARELO = '#d9a406'
const COR: Record<CorRadar, string> = { vermelho: COR_FALTA, amarelo: COR_AMARELO, verde: COR_ECONOMIA, cinza: COR_NEUTRA }
const ROTULO: Record<CorRadar, string> = { vermelho: 'Vermelho', amarelo: 'Amarelo', verde: 'Verde', cinza: 'Sem dado' }
const COR_NIVEL = { alta: COR_FALTA, media: COR_AMARELO, baixa: COR_NEUTRA } as const
const ROTULO_NIVEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const

const dataBr = (iso: string | null) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '—')
const prazo = (d: number | null) => (d === null ? '' : d < 0 ? `há ${-d} dia${d === -1 ? '' : 's'}` : d === 0 ? 'hoje' : `em ${d} dia${d === 1 ? '' : 's'}`)

function Kpi({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub: string; cor?: string }) {
  return (
    <div className="card !p-3.5" style={cor ? { borderTop: `3px solid ${cor}` } : undefined}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{rotulo}</div>
      <div className="mt-1 break-words text-lg font-bold tabular-nums leading-tight" style={cor ? { color: cor } : undefined}>{valor}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-text-muted">{sub}</div>
    </div>
  )
}

function Mini({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{rotulo}</div>
      <div className="break-words text-sm font-semibold tabular-nums text-text-main" style={cor ? { color: cor } : undefined}>{valor}</div>
      {sub && <div className="text-[11px] leading-snug text-text-muted">{sub}</div>}
    </div>
  )
}

function Lista({ titulo, itens, cor, rotuloValor }: { titulo: string; itens: { item: string; aba: string; valor: number }[]; cor: string; rotuloValor: string }) {
  if (itens.length === 0) return null
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: cor }}>{titulo}</div>
      <ul className="space-y-1 text-xs text-text-main">
        {itens.map((i, k) => (
          <li key={k} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 break-words">{i.item} <span className="text-text-muted">· {i.aba}</span></span>
            <span className="shrink-0 tabular-nums" style={{ color: cor }}>{reais(i.valor)} <span className="text-text-muted">{rotuloValor}</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CartaoProjeto({ l }: { l: LinhaRadar }) {
  const [aberto, setAberto] = useState(false)
  const cor = COR[l.cor]
  const temBase = l.receita != null && l.receita > 0 && l.custo != null
  return (
    <div className="card !p-0 overflow-hidden" style={{ borderLeft: `4px solid ${cor}` }}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: cor }} title={ROTULO[l.cor]} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-base font-bold text-text-main">{padronizarCaixa(l.turma)}</span>
            <span className="text-xs text-text-muted">{l.local}{l.dataEvento ? ` · ${dataBr(l.dataEvento)} (${prazo(l.dias)})` : ''}</span>
          </span>
          <span className="mt-0.5 block text-xs" style={{ color: cor }}>{ROTULO[l.cor]} — {l.motivo}</span>
          {l.alertas.length > 0 && (
            <span className="mt-1 flex items-start gap-1.5 text-[11px] text-text-muted"><AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: COR_AMARELO }} />{l.alertas.join(' · ')}</span>
          )}
        </span>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-text-muted transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
        <Mini rotulo="Margem projetada" valor={temBase ? pct1(l.projPct) : '—'} sub={temBase ? `meta ${l.meta ?? '—'}% · orçada ${pct1(l.margemPct)}` : undefined} cor={temBase ? cor : undefined} />
        <Mini rotulo="Cenário pessimista" valor={temBase ? pct1(l.pessPct) : '—'} sub="se o que falta fechar estourar" />
        <Mini rotulo="Ainda falta p/ meta" valor={l.aindaFalta > 0 ? reais(l.aindaFalta) : '—'} sub={`economia líquida ${reais(l.liquida)}`} cor={l.aindaFalta > 0 ? COR_FALTA : COR_ECONOMIA} />
        <Mini rotulo="Sem fechar" valor={reais(l.exposicao)} sub={l.expPct != null ? `${l.expPct.toFixed(0)}% do custo` : undefined} />
        <Mini rotulo="SGE recebido" valor={l.sge ? reais(l.sge.recebido) : '—'} sub={l.sge ? `de ${reais(l.sge.previsto)} previstos${l.sge.vencido > 0 ? ` · ${reais(l.sge.vencido)} vencido` : ''}` : 'sem posição do SGE'} cor={l.sge && l.sge.vencidoPct != null && l.sge.vencidoPct >= REGRAS.vencidoAlertaPct ? COR_FALTA : undefined} />
        <Mini rotulo="Caixa (rec − pago)" valor={l.caixa != null ? reais(l.caixa) : '—'} sub={`pago ${reais(l.pago)}`} cor={l.caixa != null && l.caixa < 0 ? COR_FALTA : undefined} />
      </div>

      {aberto && (
        <div className="space-y-4 border-t border-white/10 bg-white/[0.02] px-4 py-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">O que fazer</div>
            <ul className="space-y-2">
              {l.acoes.length === 0 && <li className="text-xs text-text-muted">Sem ação sugerida.</li>}
              {l.acoes.map((a, k) => (
                <li key={k} className="flex items-start gap-2 text-sm text-text-main">
                  <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: COR_NIVEL[a.nivel] }}>{ROTULO_NIVEL[a.nivel]}</span>
                  <span className="min-w-0 break-words">{a.texto}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Lista titulo="Maiores itens ainda estimados" itens={l.topEstimados.map((x) => ({ item: x.item, aba: x.aba, valor: x.orcado }))} cor="#3b82c4" rotuloValor="orçado" />
            <Lista titulo="Maiores estouros" itens={l.topEstouros} cor={COR_FALTA} rotuloValor="acima" />
            <Lista titulo="Maiores economias" itens={l.topEconomias} cor={COR_ECONOMIA} rotuloValor="abaixo" />
          </div>
          <div className="text-[11px] text-text-muted">
            Receita orçada {l.receita != null ? reais(l.receita) : '—'} · custo orçado {l.custo != null ? reais(l.custo) : '—'} · contratado {reais(l.contratado)} · {l.nFechados} fechados / {l.nAbertos} em aberto
            {l.sge?.atualizadoEm ? ` · SGE de ${new Date(l.sge.atualizadoEm).toLocaleDateString('pt-BR')}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

export function RadarMargem({ projetos, metas }: { projetos: ProjetoBruto[]; metas: MetasPct }) {
  const [sge, setSge] = useState<SgeLinha[]>([])
  const [erroSge, setErroSge] = useState<string | null>(null)
  const [carregandoSge, setCarregandoSge] = useState(true)

  useEffect(() => {
    let vivo = true
    supabase
      .from('sge_receita_portal')
      .select('*')
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) setErroSge(error.message)
        setSge((data as SgeLinha[] | null) ?? [])
        setCarregandoSge(false)
      })
    return () => { vivo = false }
  }, [])

  const { taxa, linhas } = useMemo(() => montarCarteira(projetos, sge, metas), [projetos, sge, metas])
  const cont = useMemo(() => {
    const c: Record<CorRadar, number> = { vermelho: 0, amarelo: 0, verde: 0, cinza: 0 }
    for (const l of linhas) c[l.cor]++
    return c
  }, [linhas])
  const caixaTotal = useMemo(() => linhas.reduce((s, l) => s + (l.caixa ?? 0), 0), [linhas])
  const sgeEm = useMemo(() => {
    const t = sge.map((s) => s.sge_atualizado_em).filter((x): x is string => !!x).sort()
    return t.length ? new Date(t[t.length - 1]) : null
  }, [sge])

  if (linhas.length === 0) return <p className="card py-12 text-center text-sm text-text-muted">Nenhum projeto com esses filtros.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="min-w-0 flex-1 text-sm text-text-muted">
        Semáforo por projeto: a <b className="text-text-main">margem projetada</b> (orçada + economia líquida dos itens fechados) contra a meta, o risco do que ainda falta fechar e a posição do SGE.
        Clique num projeto para ver as ações.
      </p>
      <button type="button" onClick={() => exportarRadarXlsx(linhas, taxa, metas, sgeEm)} className="btn-primary flex items-center gap-2" title="Baixa o Radar (o que está na tela) em Excel">
        <Download size={16} /> Exportar Excel
      </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Vermelho" valor={String(cont.vermelho)} cor={COR.vermelho} sub={`mais de ${REGRAS.toleranciaAmarelo} p.p. abaixo da meta`} />
        <Kpi rotulo="Amarelo" valor={String(cont.amarelo)} cor={COR.amarelo} sub="perto da meta ou frágil" />
        <Kpi rotulo="Verde" valor={String(cont.verde)} cor={COR.verde} sub="na meta ou acima" />
        <Kpi rotulo="Sem dado" valor={String(cont.cinza)} cor={COR.cinza} sub="sem receita/custo no Resumo Geral" />
        <Kpi rotulo="Taxa de estouro" valor={`${(taxa * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`} sub="estouros ÷ orçado dos fechados (base do pessimista)" />
        <Kpi rotulo="Caixa total" valor={reais(caixaTotal)} cor={caixaTotal < 0 ? COR_FALTA : COR_ECONOMIA} sub="SGE recebido − pago nas P.O.s" />
      </div>

      {erroSge && <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-text-main">Não consegui ler o SGE ({erroSge}). O semáforo funciona, mas sem caixa e sem atraso de recebimento.</p>}
      {carregandoSge && <p className="text-xs text-text-muted">Carregando posição do SGE…</p>}

      <div className="space-y-3">
        {linhas.map((l) => <CartaoProjeto key={l.id} l={l} />)}
      </div>

      <footer className="pb-4 text-[11px] text-text-muted">
        <p>
          SGE de <b className="text-text-main">{sgeEm ? sgeEm.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</b>.
          Pessimista = margem projetada − (itens ainda em aberto × taxa de estouro da carteira). Alertas: atraso no SGE ≥ {REGRAS.vencidoAlertaPct}% do previsto, exposição ≥ {REGRAS.exposicaoAlertaPct}% do custo com evento em até {REGRAS.diasUrgente} dias,
          receita da P.O. {REGRAS.receitaSemSgePct}% acima do previsto no SGE.
        </p>
      </footer>
    </div>
  )
}
