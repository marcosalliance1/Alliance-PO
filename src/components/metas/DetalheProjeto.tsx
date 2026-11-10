import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { COR_LOCAL, type DetalheItem, type ResultadoProjeto } from '../../lib/economiaFechados'
import { padronizarCaixa } from '../../utils/caixa'
import { corMargem } from '../../utils/metasMargem'
import { COR_ECONOMIA, COR_FALTA, COR_POTENCIAL, TEXTO_AVISO, ensinoCurto, num2, pct0, pct1, reais } from './formato'

interface Props {
  r: ResultadoProjeto
  onFechar: () => void
}

function Mini({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface-2 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{rotulo}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums text-text-main" style={cor ? { color: cor } : undefined}>{valor}</div>
    </div>
  )
}

type Modo = 'dif' | 'orcado' | 'zero'

function Lista({ titulo, subtitulo, itens, cor, vazio, modo = 'dif', max }: {
  titulo: string
  subtitulo?: string
  itens: DetalheItem[]
  cor: string
  vazio: string
  modo?: Modo
  max?: number
}) {
  return (
    <section>
      <h4 className="flex flex-wrap items-baseline gap-x-2 text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>
        {titulo}
        {subtitulo && <span className="text-[11px] font-normal normal-case tracking-normal text-text-muted">{subtitulo}</span>}
      </h4>
      {itens.length === 0 ? (
        <p className="mt-1.5 text-xs text-text-muted">{vazio}</p>
      ) : (
        <div className={`mt-1.5 overflow-hidden rounded-lg border border-white/10 ${max ? 'max-h-72 overflow-y-auto' : ''}`}>
          {/* cabeçalho (só desktop) */}
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:grid">
            <span>Item</span><span>Aba</span><span>Bloco</span>
            <span className="text-right">Orçado</span><span className="text-right">{modo === 'dif' ? 'Contratado' : modo === 'zero' ? 'Consumido' : ''}</span><span className="text-right">{modo === 'dif' ? 'Diferença' : modo === 'zero' ? 'Sobra' : ''}</span>
          </div>
          <ul className="divide-y divide-white/5">
            {itens.map((d, i) => (
              <li key={`${d.aba}|${d.item}|${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-2 text-xs sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] sm:items-center sm:gap-2">
                <span className="min-w-0 truncate font-medium text-text-main" title={d.item}>{padronizarCaixa(d.item)}</span>
                <span className="hidden truncate text-text-muted sm:block" title={d.aba}>{padronizarCaixa(d.aba)}</span>
                <span className="hidden truncate text-text-muted sm:block" title={d.bloco}>{padronizarCaixa(d.bloco)}</span>
                <span className="order-last col-span-2 text-[11px] text-text-muted sm:hidden">{padronizarCaixa(d.aba)} · {padronizarCaixa(d.bloco)}</span>
                <span className="hidden text-right tabular-nums text-text-main sm:block">{num2(d.orcado)}</span>
                <span className="hidden text-right tabular-nums text-text-main sm:block">{modo === 'dif' ? num2(d.contratado) : modo === 'zero' ? num2(d.consumido) : ''}</span>
                <span className="text-right font-semibold tabular-nums" style={{ color: modo === 'dif' ? (d.difAjustada > 0 ? COR_ECONOMIA : d.difAjustada < 0 ? COR_FALTA : undefined) : undefined }}>
                  {modo === 'dif' ? `${d.difAjustada > 0 ? '+' : ''}${num2(d.difAjustada)}` : modo === 'zero' ? num2(d.orcado - d.consumido) : <span className="sm:hidden">{num2(d.orcado)}</span>}
                </span>
                {modo === 'dif' && <span className="col-span-2 text-[11px] tabular-nums text-text-muted sm:hidden">orçado {num2(d.orcado)} · contratado {num2(d.contratado)}</span>}
                {modo === 'zero' && <span className="col-span-2 text-[11px] tabular-nums text-text-muted sm:hidden">orçado {num2(d.orcado)} · consumido {num2(d.consumido)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export function DetalheProjeto({ r, onFechar }: Props) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', esc)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes }
  }, [onFechar])

  const { economias, estouros, zeros } = useMemo(() => ({
    economias: r.detalhe.filter((d) => d.difAjustada > 0.005).sort((a, b) => b.difAjustada - a.difAjustada).slice(0, 10),
    estouros: r.detalhe.filter((d) => d.difAjustada < -0.005).sort((a, b) => a.difAjustada - b.difAjustada).slice(0, 10),
    zeros: r.detalhe.filter((d) => d.contratado === 0 && d.orcado > 0).sort((a, b) => b.orcado - a.orcado),
  }), [r.detalhe])
  const nEcon = r.detalhe.filter((d) => d.difAjustada > 0.005).length
  const nEst = r.detalhe.filter((d) => d.difAjustada < -0.005).length
  const cor = COR_LOCAL[r.local] ?? '#1F2A44'

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${padronizarCaixa(r.turma)}`}
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-white/15"
        style={{ borderTop: `4px solid ${cor}` }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-text-main">{padronizarCaixa(r.turma)}</h3>
            <p className="text-xs text-text-muted">
              {r.local} · {ensinoCurto(r)}
              {r.margemPct !== null && r.metaPct !== null && (
                <> · margem <b style={{ color: corMargem(r.margemPct, r.metaPct) }}>{pct1(r.margemPct)}</b> (meta {pct1(r.metaPct)})</>
              )}
            </p>
          </div>
          <button type="button" onClick={onFechar} className="shrink-0 rounded-lg p-2 text-text-muted hover:bg-white/10 hover:text-text-main" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini rotulo="FALTA p/ meta" valor={reais(r.falta)} cor={r.falta > 0 ? COR_FALTA : COR_ECONOMIA} />
            <Mini rotulo="Economia líquida" valor={reais(r.liquida)} cor={r.liquida >= 0 ? COR_ECONOMIA : COR_FALTA} />
            <Mini rotulo="Cobertura da falta" valor={r.falta > 0 ? pct0(r.cobertura) : 'meta atingida'} />
            <Mini rotulo="AINDA FALTA" valor={r.falta > 0 ? reais(r.aindaFalta) : '—'} cor={r.falta > 0 ? (r.aindaFalta > 0 ? COR_FALTA : COR_ECONOMIA) : undefined} />
            <Mini rotulo="Economias" valor={reais(r.economias)} cor={COR_ECONOMIA} />
            <Mini rotulo="Estouros" valor={reais(r.estouros)} cor={r.estouros > 0 ? COR_FALTA : undefined} />
            <Mini rotulo="Fechados a zero" valor={reais(r.fechadosZero)} />
            <Mini rotulo="Potencial (estimados)" valor={reais(r.estimadosOrcado)} cor={COR_POTENCIAL} />
          </div>

          {r.avisos.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-text-muted">
              {r.avisos.map((a) => <li key={a}>• {TEXTO_AVISO[a]}</li>)}
            </ul>
          )}

          {r.verbaConsumida > 0 && (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-text-muted">
              <b className="tabular-nums text-text-main">{reais(r.verbaConsumida)}</b> de itens fechados a zero foram <b className="text-text-main">consumidos por estouros do mesmo bloco</b>
              {' '}(verba “Geral” destrinchada em outras linhas, ou pacote fechado numa linha só). Esse valor já saiu das economias <i>e</i> dos estouros nas listas abaixo; a economia líquida não muda.
            </p>
          )}

          <Lista titulo="Maiores economias" subtitulo={`${economias.length} de ${nEcon} itens`} itens={economias} cor={COR_ECONOMIA} vazio="Nenhum item fechado abaixo do orçado." />
          <Lista titulo="Maiores estouros" subtitulo={`${estouros.length} de ${nEst} itens`} itens={estouros} cor={COR_FALTA} vazio="Nenhum item fechado acima do orçado." />
          <Lista
            titulo="Fechados a zero"
            subtitulo={`${zeros.length} ${zeros.length === 1 ? 'item' : 'itens'} · ${reais(r.fechadosZero)} sem estouro correspondente no bloco`}
            itens={zeros}
            cor="var(--pl-muted, #8892b0)"
            vazio="Nenhum item fechado com contratado R$ 0."
            modo="zero"
            max={288}
          />

          <Lista
            titulo="Potencial a economizar"
            subtitulo={`${r.nEstimados} ${r.nEstimados === 1 ? 'item estimado' : 'itens estimados'} · ${reais(r.estimadosOrcado)} de orçado ainda não contratado`}
            itens={r.estimados.slice(0, 15).map((e) => ({ aba: e.aba, bloco: e.bloco, item: e.item, orcado: e.orcado, contratado: 0, dif: 0, consumido: 0, difAjustada: 0 }))}
            cor={COR_POTENCIAL}
            vazio="Nenhum item com status estimado."
            modo="orcado"
          />
        </div>
      </div>
    </div>
  )
}
