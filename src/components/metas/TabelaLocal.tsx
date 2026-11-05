import type { KeyboardEvent } from 'react'
import { COR_LOCAL, type ResultadoProjeto, type Totais } from '../../lib/economiaFechados'
import { corMargem } from '../../utils/metasMargem'
import { padronizarCaixa } from '../../utils/caixa'
import {
  COR_ECONOMIA, COR_FALTA, COR_POTENCIAL, TEXTO_AVISO, corCobertura, ensinoCurto, num2, num2OuTraco, pct0, pct1, reais,
} from './formato'

interface Props {
  local: string
  projetos: ResultadoProjeto[]
  totais: Totais
  onAbrir: (id: string) => void
}

const TH = 'px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted whitespace-nowrap'
const TD = 'px-2 py-2 text-right text-[11.5px] tabular-nums whitespace-nowrap'

function Cobertura({ r }: { r: Pick<ResultadoProjeto, 'cobertura' | 'falta'> }) {
  if (r.falta <= 0) return <span className="text-[11px] text-text-muted">meta atingida</span>
  const c = r.cobertura ?? 0
  const cor = corCobertura(c)
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, c * 100))}%`, background: cor }} />
      </div>
      <span className="w-9 text-right font-semibold" style={{ color: cor }}>{pct0(c)}</span>
    </div>
  )
}

function Selos({ r }: { r: ResultadoProjeto }) {
  const mostrar = r.avisos.filter((a) => a === 'sem-receita' || a === 'sem-ensino' || a === 'sem-fechados' || a === 'fonte-itens' || a === 'local-corrigido')
  if (mostrar.length === 0) return null
  const rotulo: Record<string, string> = { 'sem-fechados': 'sem fechados', 'sem-receita': 'sem receita', 'sem-ensino': 'sem ensino', 'fonte-itens': 'soma dos itens', 'local-corrigido': 'local ajustado' }
  return (
    <>
      {mostrar.map((a) => (
        <span key={a} title={TEXTO_AVISO[a]} className="mt-0.5 rounded border border-white/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-text-muted">
          {rotulo[a]}
        </span>
      ))}
    </>
  )
}

function MargemVsMeta({ r }: { r: ResultadoProjeto }) {
  if (r.margemPct === null || r.metaPct === null) return <span className="text-text-muted">—</span>
  return (
    <span>
      <span className="font-semibold" style={{ color: corMargem(r.margemPct, r.metaPct) }}>{pct1(r.margemPct)}</span>
      <span className="text-text-muted"> / {pct1(r.metaPct)}</span>
    </span>
  )
}

const abrirTeclado = (e: KeyboardEvent, fn: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
}

export function TabelaLocal({ local, projetos, totais, onAbrir }: Props) {
  const cor = COR_LOCAL[local] ?? '#1F2A44'
  const saldo = totais.falta - totais.excedente
  const receitaLocal = projetos.reduce((s, r) => s + (r.receita ?? 0), 0)
  const margemLocal = projetos.reduce((s, r) => s + (r.margem ?? 0), 0)
  const nmLocal = projetos.reduce((s, r) => s + (r.margemNaMeta ?? 0), 0)
  const recCalc = projetos.reduce((s, r) => s + (r.margemNaMeta !== null ? (r.receita ?? 0) : 0), 0)
  const metaLocal = recCalc > 0 ? (nmLocal / recCalc) * 100 : null
  const margemPctLocal = receitaLocal > 0 ? (margemLocal / receitaLocal) * 100 : null

  return (
    <section className="card !p-0 overflow-hidden" style={{ borderTop: `4px solid ${cor}` }}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pb-2 pt-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-text-main">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
          {local}
          <span className="text-xs font-normal text-text-muted">· {projetos.length} {projetos.length === 1 ? 'projeto' : 'projetos'}</span>
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular-nums">
          <span className="text-text-muted">Falta <b style={{ color: totais.falta > 0 ? COR_FALTA : COR_ECONOMIA }}>{reais(totais.falta)}</b></span>
          <span className="text-text-muted">Líquida <b style={{ color: totais.liquida >= 0 ? COR_ECONOMIA : COR_FALTA }}>{reais(totais.liquida)}</b></span>
          <span className="text-text-muted">Ainda falta <b style={{ color: totais.aindaFalta > 0 ? COR_FALTA : COR_ECONOMIA }}>{reais(totais.aindaFalta)}</b></span>
          <span className="text-text-muted" title="Orçado dos itens estimados, ainda não contratados">Potencial <b style={{ color: COR_POTENCIAL }}>{reais(totais.estimadosOrcado)}</b></span>
        </div>
      </header>

      {/* Desktop / tablet: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-y border-white/10 bg-white/[0.03]">
              <th className={`${TH} !text-left`}>Projeto</th>
              <th className={`${TH} !text-left`}>Ensino</th>
              <th className={TH}>Receita orçada</th>
              <th className={TH}>Margem / meta</th>
              <th className={TH}>FALTA</th>
              <th className={TH}>Economias</th>
              <th className={TH}>Estouros</th>
              <th className={TH}>Líquida</th>
              <th className={TH} title="Soma do orçado dos itens fechados com contratado R$ 0">Fech. a zero</th>
              <th className={TH}>Cobertura</th>
              <th className={TH}>AINDA FALTA</th>
            </tr>
          </thead>
          <tbody>
            {projetos.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes de ${padronizarCaixa(r.turma)}`}
                onClick={() => onAbrir(r.id)}
                onKeyDown={(e) => abrirTeclado(e, () => onAbrir(r.id))}
                className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.05] focus:bg-white/[0.07] focus:outline-none"
              >
                <td className="min-w-[112px] px-2 py-2 text-left text-xs font-semibold text-text-main">
                  {padronizarCaixa(r.turma)}
                  <div className="flex flex-wrap gap-1 empty:hidden"><Selos r={r} /></div>
                </td>
                <td className="px-2 py-2 text-left text-xs text-text-muted">{ensinoCurto(r)}</td>
                <td className={`${TD} text-text-main`}>{r.receita === null ? '—' : num2(r.receita)}</td>
                <td className={TD}><MargemVsMeta r={r} /></td>
                <td className={`${TD} font-semibold`} style={{ color: r.falta > 0 ? COR_FALTA : undefined }}>{num2OuTraco(r.falta)}</td>
                <td className={TD} style={{ color: r.economias > 0 ? COR_ECONOMIA : undefined }}>{num2OuTraco(r.economias)}</td>
                <td className={TD} style={{ color: r.estouros > 0 ? COR_FALTA : undefined }}>{num2OuTraco(r.estouros)}</td>
                <td className={`${TD} font-semibold`} style={{ color: r.liquida > 0 ? COR_ECONOMIA : r.liquida < 0 ? COR_FALTA : undefined }}>{num2OuTraco(r.liquida)}</td>
                <td className={`${TD} text-text-muted`}>{num2OuTraco(r.fechadosZero)}</td>
                <td className={TD}><Cobertura r={r} /></td>
                <td className={`${TD} font-bold`} style={{ color: r.falta <= 0 ? undefined : r.aindaFalta > 0 ? COR_FALTA : COR_ECONOMIA }}>{r.falta <= 0 ? '—' : num2(r.aindaFalta)}
                  {r.estimadosOrcado > 0 && <div className="text-[10px] font-normal" style={{ color: COR_POTENCIAL }} title="Potencial a economizar: orçado dos itens estimados">pot. {num2(r.estimadosOrcado)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/15 bg-white/[0.04] font-bold">
              <td className="px-2 py-2 text-left text-xs text-text-main" colSpan={2}>Total {local}</td>
              <td className={`${TD} text-text-main`}>{num2(receitaLocal)}</td>
              <td className={TD}>
                {margemPctLocal === null || metaLocal === null
                  ? '—'
                  : <><span style={{ color: corMargem(margemPctLocal, metaLocal) }}>{pct1(margemPctLocal)}</span><span className="font-normal text-text-muted"> / {pct1(metaLocal)}</span></>}
              </td>
              <td className={TD} style={{ color: totais.falta > 0 ? COR_FALTA : undefined }}>{num2OuTraco(totais.falta)}</td>
              <td className={TD} style={{ color: COR_ECONOMIA }}>{num2OuTraco(totais.economias)}</td>
              <td className={TD} style={{ color: totais.estouros > 0 ? COR_FALTA : undefined }}>{num2OuTraco(totais.estouros)}</td>
              <td className={TD} style={{ color: totais.liquida >= 0 ? COR_ECONOMIA : COR_FALTA }}>{num2OuTraco(totais.liquida)}</td>
              <td className={`${TD} text-text-muted`}>{num2OuTraco(totais.fechadosZero)}</td>
              <td className={TD}><Cobertura r={totais} /></td>
              <td className={TD} style={{ color: totais.falta <= 0 ? undefined : totais.aindaFalta > 0 ? COR_FALTA : COR_ECONOMIA }}>{totais.falta <= 0 ? '—' : num2(totais.aindaFalta)}
                {totais.estimadosOrcado > 0 && <div className="text-[10px] font-normal" style={{ color: COR_POTENCIAL }}>pot. {num2(totais.estimadosOrcado)}</div>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Celular: um cartão por projeto */}
      <ul className="divide-y divide-white/5 md:hidden">
        {projetos.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onAbrir(r.id)} className="block w-full px-4 py-3 text-left transition-colors active:bg-white/[0.06]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-main">{padronizarCaixa(r.turma)}</div>
                  <div className="text-[11px] text-text-muted">{ensinoCurto(r)} · receita {r.receita === null ? '—' : num2(r.receita)}</div>
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums"><MargemVsMeta r={r} /></div>
              </div>
              {r.avisos.some((a) => a === 'sem-receita' || a === 'sem-ensino' || a === 'sem-fechados' || a === 'fonte-itens' || a === 'local-corrigido') && (
                <div className="mt-1"><Selos r={r} /></div>
              )}
              <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5 text-[11px]">
                {[
                  ['FALTA', r.falta, r.falta > 0 ? COR_FALTA : undefined],
                  ['Economias', r.economias, r.economias > 0 ? COR_ECONOMIA : undefined],
                  ['Estouros', r.estouros, r.estouros > 0 ? COR_FALTA : undefined],
                  ['Líquida', r.liquida, r.liquida > 0 ? COR_ECONOMIA : r.liquida < 0 ? COR_FALTA : undefined],
                  ['Fech. a zero', r.fechadosZero, undefined],
                  ['Ainda falta', r.falta <= 0 ? 0 : r.aindaFalta, r.falta <= 0 ? undefined : r.aindaFalta > 0 ? COR_FALTA : COR_ECONOMIA],
                ].map(([rot, val, cr]) => (
                  <div key={rot as string}>
                    <dt className="text-text-muted">{rot as string}</dt>
                    <dd className="font-semibold tabular-nums" style={{ color: cr as string | undefined }}>{num2OuTraco(val as number)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-text-muted">
                <span>Cobertura</span>
                <div className="ml-auto"><Cobertura r={r} /></div>
              </div>
              {r.estimadosOrcado > 0 && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                  <span>Potencial (estimados)</span>
                  <b className="tabular-nums" style={{ color: COR_POTENCIAL }}>{num2(r.estimadosOrcado)}</b>
                </div>
              )}
            </button>
          </li>
        ))}
        <li className="bg-white/[0.04] px-4 py-3 text-xs">
          <div className="flex items-center justify-between font-bold text-text-main">
            <span>Total {local}</span>
            <span className="tabular-nums" style={{ color: totais.falta > 0 ? COR_FALTA : COR_ECONOMIA }}>Falta {num2OuTraco(totais.falta)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between tabular-nums text-text-muted">
            <span>Líquida <b style={{ color: totais.liquida >= 0 ? COR_ECONOMIA : COR_FALTA }}>{num2OuTraco(totais.liquida)}</b></span>
            <span>Ainda falta <b style={{ color: totais.falta <= 0 ? undefined : totais.aindaFalta > 0 ? COR_FALTA : COR_ECONOMIA }}>{totais.falta <= 0 ? '—' : num2(totais.aindaFalta)}</b></span>
          </div>
        </li>
      </ul>

      <p className="border-t border-white/5 px-4 py-2 text-[11px] text-text-muted">
        Saldo líquido de {local} (compensando quem passou da meta):{' '}
        <b className="tabular-nums" style={{ color: saldo > 0 ? COR_FALTA : COR_ECONOMIA }}>
          {saldo > 0 ? `faltam ${reais(saldo)}` : `sobram ${reais(-saldo)}`}
        </b>
      </p>
    </section>
  )
}
