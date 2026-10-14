import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { ExternalLink } from 'lucide-react'
import { montarEspelho, linkPlanilha, type GradeAcomp, type EspelhoBloco } from '../../utils/espelhoAcomp'

export type TemaEspelho = 'claro' | 'escuro'

// Tokens por tema (CSS variables no wrapper — o componente não depende do tema global do app)
const TEMAS: Record<TemaEspelho, Record<string, string>> = {
  claro: {
    '--e-pagina': '#f3f4f6', '--e-card': '#ffffff', '--e-borda': '#e2e5ea', '--e-texto': '#1c2330',
    '--e-muted': '#6b7380', '--e-zebra': '#f3f4f6', '--e-total': '#e4e7ec', '--e-neg': '#c0392b',
    '--e-barra': '#ef3935', '--e-barra-texto': '#ffffff',
  },
  escuro: {
    '--e-pagina': '#0f0f1a', '--e-card': '#1a1a2e', '--e-borda': '#2a2a4a', '--e-texto': '#f0f0f0',
    '--e-muted': '#8892a4', '--e-zebra': 'rgba(255,255,255,0.03)', '--e-total': 'rgba(255,255,255,0.08)', '--e-neg': '#e17055',
    '--e-barra': '#c62f32', '--e-barra-texto': '#ffffff',
  },
}

function Cartao({ bloco, grade }: { bloco: EspelhoBloco; grade: GradeAcomp }) {
  if (bloco.banner) {
    return (
      <div
        className="rounded-md px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[color:var(--e-barra-texto)] bg-[color:var(--e-barra)]"
      >
        {bloco.titulo}
      </div>
    )
  }
  const link = (
    <a
      href={linkPlanilha(grade, bloco.ancora)}
      target="_blank"
      rel="noreferrer"
      title="Abrir este bloco na planilha para editar"
      className="ml-2 inline-block align-middle opacity-80 hover:opacity-100"
    >
      <ExternalLink size={12} />
    </a>
  )
  return (
    <section className="overflow-hidden rounded-md border border-[color:var(--e-borda)] bg-[color:var(--e-card)]">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] tabular-nums text-left">
          {bloco.cabecalhos ? (
            <thead>
              <tr className="bg-[color:var(--e-barra)] text-[color:var(--e-barra-texto)] text-[11px] font-bold uppercase tracking-wide">
                {bloco.cabecalhos.map((h, i) => (
                  <th key={i} className={`px-3 py-1.5 font-bold whitespace-nowrap ${i === 0 ? "text-left" : "text-center"}`}>
                    {i === 0 ? <>{bloco.titulo}{link}</> : h}
                  </th>
                ))}
              </tr>
            </thead>
          ) : (
            <thead>
              <tr className="bg-[color:var(--e-barra)] text-[color:var(--e-barra-texto)] text-[11px] font-bold uppercase tracking-wide">
                <th colSpan={Math.max(1, bloco.ncols)} className="px-3 py-1.5 text-left font-bold">{bloco.titulo}{link}</th>
              </tr>
            </thead>
          )}
          <tbody>
            {bloco.linhas.map((l, n) => (
              <tr
                key={l.linha}
                className={l.total ? 'bg-[color:var(--e-total)] font-bold' : n % 2 === 1 ? 'bg-[color:var(--e-zebra)]' : ''}
              >
                {l.celulas.map((c, i) => (
                  <td
                    key={i}
                    style={c.tint ? { background: `${c.tint}33` } : undefined}
                    className={`px-3 py-1.5 text-left ${i === 0 ? 'whitespace-normal min-w-[150px] break-words' : 'whitespace-nowrap text-[11px]'} ${
                      c.neg ? 'text-[color:var(--e-neg)]' : c.texto === '—' ? 'text-[color:var(--e-muted)]' : 'text-[color:var(--e-texto)]'
                    } ${c.negrito && !l.total ? 'font-semibold' : ''}`}
                  >
                    {c.texto}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function EspelhoAcomp({ grade, tema = 'claro' }: { grade: GradeAcomp; tema?: TemaEspelho }) {
  const esp = useMemo(() => montarEspelho(grade), [grade])
  return (
    <div
      style={{ ...(TEMAS[tema] as CSSProperties), fontFamily: "'Montserrat', ui-sans-serif, system-ui, sans-serif" }}
      className="space-y-4 rounded-xl bg-[color:var(--e-pagina)] p-4 text-[color:var(--e-texto)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{esp.titulo ?? 'Acompanhamento de Atendimento'}</h2>
          <p className="text-xs text-[color:var(--e-muted)]">Espelho da planilha — para editar, use o ícone de link em cada bloco.</p>
        </div>
        <a
          href={linkPlanilha(grade)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--e-borda)] bg-[color:var(--e-card)] px-3 py-1.5 text-xs font-medium hover:opacity-80"
        >
          <ExternalLink size={13} /> Abrir aba na planilha
        </a>
      </div>

      {esp.destaques.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {esp.destaques.map((d, i) => (
            <div key={i} className="rounded-md border border-[color:var(--e-borda)] bg-[color:var(--e-card)] px-3 py-2">
              <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-[color:var(--e-muted)]" title={`${d.bloco} · ${d.rotulo}`}>{d.rotulo}</div>
              <div className={`text-lg font-bold tabular-nums ${d.neg ? 'text-[color:var(--e-neg)]' : ''}`}>{d.valor}</div>
            </div>
          ))}
        </div>
      )}

      {esp.avisos.map((a, i) => (
        <div key={i} className="rounded-md border border-amber-400/50 bg-amber-100/60 px-3 py-2 text-xs text-amber-800">{a}</div>
      ))}

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start">
        {esp.pilhas.map((pilha, i) => {
          const larg = Math.max(...pilha.map(b => b.ncols))
          return (
            <div key={i} className="min-w-0 space-y-6" style={{ flex: `${Math.max(1, larg)} 1 ${larg >= 3 ? 420 : 300}px` }}>
              {pilha.map(b => <Cartao key={b.id} bloco={b} grade={grade} />)}
            </div>
          )
        })}
      </div>

      {esp.outros.length > 0 && (
        <section className="overflow-hidden rounded-md border border-dashed border-[color:var(--e-borda)] bg-[color:var(--e-card)]">
          <header className="border-b border-[color:var(--e-borda)] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--e-muted)]">
            Outras anotações da aba (fora dos blocos)
          </header>
          <ul className="text-[12.5px]">
            {esp.outros.map((o, n) => (
              <li key={o.linha} className={`flex items-baseline justify-between gap-3 px-3 py-1.5 ${n % 2 === 1 ? 'bg-[color:var(--e-zebra)]' : ''}`}>
                <span>{o.textos.join('  ·  ')}</span>
                <a href={linkPlanilha(grade, o.ref)} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] text-[color:var(--e-muted)] hover:underline">{o.ref}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
