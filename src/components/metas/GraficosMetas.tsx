import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ROTULO_ENSINO, agruparPorEnsino, type ResultadoProjeto } from '../../lib/economiaFechados'
import { padronizarCaixa } from '../../utils/caixa'
import { corMargem } from '../../utils/metasMargem'
import { COR_ECONOMIA, COR_FALTA, COR_META, COR_NEUTRA, mil, pct1, reais } from './formato'

interface Props {
  resultados: ResultadoProjeto[]
  onAbrir: (id: string) => void
}

function useEstreito(limite = 640) {
  const [e, setE] = useState(() => typeof window !== 'undefined' && window.innerWidth < limite)
  useEffect(() => {
    const f = () => setE(window.innerWidth < limite)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [limite])
  return e
}

const curto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

const TOOLTIP_STYLE = {
  background: 'var(--color-surface, #1a1a2e)',
  border: '1px solid rgba(136,146,164,0.35)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--pl-ink, #f0f0f0)',
}

function Cartao({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card !p-4">
      <h3 className="text-sm font-bold text-text-main">{titulo}</h3>
      {sub && <p className="mb-2 text-[11px] text-text-muted">{sub}</p>}
      <div className="text-text-muted">{children}</div>
    </section>
  )
}

const eixo = { fill: 'currentColor', fontSize: 11 }

export function GraficosMetas({ resultados, onAbrir }: Props) {
  const estreito = useEstreito()

  // Largura do cartão do gráfico (b), medida direto: o gráfico ocupa a largura toda e rola na horizontal só se faltar espaço.
  const refB = useRef<HTMLDivElement>(null)
  const [larguraCartaoB, setLarguraCartaoB] = useState(0)
  const temB = resultados.some((r) => r.margemPct !== null && r.metaPct !== null)
  useEffect(() => {
    const el = refB.current
    if (!el) return
    setLarguraCartaoB(el.clientWidth)
    const ro = new ResizeObserver(() => setLarguraCartaoB(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [temB])

  // (a) por projeto, ordenado por "ainda falta" (os mais longe da meta primeiro) — só quem tem FALTA
  const porProjeto = useMemo(() =>
    resultados
      .filter((r) => r.falta > 0 || r.liquida !== 0)
      .map((r) => ({ id: r.id, nome: padronizarCaixa(r.turma), falta: r.falta, liquida: r.liquida, ainda: r.falta > 0 ? r.aindaFalta : 0 }))
      .sort((a, b) => b.ainda - a.ainda || b.falta - a.falta),
  [resultados])

  // (b) margem % × meta % (só quem tem receita)
  const margens = useMemo(() =>
    resultados
      .filter((r) => r.margemPct !== null && r.metaPct !== null)
      .map((r) => ({ id: r.id, nome: padronizarCaixa(r.turma), margem: r.margemPct as number, meta: r.metaPct as number }))
      .sort((a, b) => (a.margem - a.meta) - (b.margem - b.meta)),
  [resultados])

  // (c) resumo por ensino
  const porEnsino = useMemo(() =>
    agruparPorEnsino(resultados).map((e) => ({
      nome: e.ensino ? ROTULO_ENSINO[e.ensino] : 'Sem ensino',
      falta: e.totais.falta, liquida: e.totais.liquida, ainda: Math.max(0, e.totais.aindaFalta),
    })),
  [resultados])

  if (resultados.length === 0) return null

  const alturaA = Math.max(180, porProjeto.length * 34 + 70)
  const larguraB = Math.max(larguraCartaoB - 2, 320, margens.length * 42)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-3">
        <Cartao titulo="FALTA × Economia líquida por projeto" sub="Ordenado por quanto ainda falta (maior primeiro). Clique numa barra para ver os itens.">
          {porProjeto.length === 0 ? (
            <p className="py-8 text-center text-sm">Nada a mostrar com os filtros atuais.</p>
          ) : (
            <div style={{ height: alturaA }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porProjeto} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.12} />
                  <XAxis type="number" tick={eixo} tickFormatter={mil} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nome" width={estreito ? 92 : 150} tick={eixo} tickFormatter={(v: string) => curto(v, estreito ? 14 : 24)} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
                    formatter={(v, nome) => [reais(Number(v)), String(nome)]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="falta" name="FALTA p/ meta" fill={COR_FALTA} radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => onAbrir((d as unknown as { id: string }).id)} />
                  <Bar dataKey="liquida" name="Economia líquida" fill={COR_ECONOMIA} radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => onAbrir((d as unknown as { id: string }).id)}>
                    {porProjeto.map((p) => <Cell key={p.id} fill={p.liquida >= 0 ? COR_ECONOMIA : '#a5282c'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Cartao>
      </div>

      <div className="min-w-0 lg:col-span-2">
      <Cartao titulo="Margem % × meta %" sub="Verde = na meta ou acima · laranja = abaixo da meta · vermelho = margem negativa.">
        {margens.length === 0 ? (
          <p className="py-8 text-center text-sm">Nada a mostrar com os filtros atuais.</p>
        ) : (
          <div ref={refB} className="overflow-x-auto">
            <div style={{ height: 300, width: larguraB }}>
                <BarChart width={larguraB} height={300} data={margens} margin={{ left: 0, right: 8, top: 8, bottom: 4 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
                  <XAxis dataKey="nome" tick={{ ...eixo, fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={78} tickFormatter={(v: string) => curto(v, 16)} axisLine={false} tickLine={false} />
                  <YAxis tick={eixo} tickFormatter={(v: number) => `${v}%`} axisLine={false} tickLine={false} width={44} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} formatter={(v, nome) => [pct1(Number(v)), String(nome)]} />
                  <Legend
                    content={() => (
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-[11px]">
                        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: COR_META }} />Margem % (cor pelo status)</span>
                        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: COR_NEUTRA }} />Meta %</span>
                      </div>
                    )}
                  />
                  <Bar dataKey="margem" name="Margem %" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d) => onAbrir((d as unknown as { id: string }).id)}>
                    {margens.map((m) => <Cell key={m.id} fill={corMargem(m.margem, m.meta)} />)}
                  </Bar>
                  <Bar dataKey="meta" name="Meta %" fill={COR_NEUTRA} fillOpacity={0.55} radius={[4, 4, 0, 0]} />
                </BarChart>
            </div>
          </div>
        )}
      </Cartao>
      </div>

      <div className="min-w-0">
      <Cartao titulo="Resumo por ensino" sub="Soma dos projetos filtrados em cada tipo de ensino.">
        {porEnsino.length === 0 ? (
          <p className="py-8 text-center text-sm">Nada a mostrar com os filtros atuais.</p>
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porEnsino} margin={{ left: 0, right: 8, top: 8, bottom: 4 }} barGap={3}>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
                <XAxis dataKey="nome" tick={eixo} axisLine={false} tickLine={false} />
                <YAxis tick={eixo} tickFormatter={mil} axisLine={false} tickLine={false} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} formatter={(v, nome) => [reais(Number(v)), String(nome)]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="falta" name="FALTA p/ meta" fill={COR_FALTA} radius={[4, 4, 0, 0]} />
                <Bar dataKey="liquida" name="Economia líquida" fill={COR_ECONOMIA} radius={[4, 4, 0, 0]} />
                <Bar dataKey="ainda" name="Ainda falta" fill="#c2680a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Cartao>
      </div>
    </div>
  )
}
