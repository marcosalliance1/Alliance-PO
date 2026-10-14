import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Projeto } from '../../types'
import { calcResumoProjeto } from '../../utils/calculos'
import { padronizarCaixa } from '../../utils/caixa'

// Tela inicial dos projetos como painel de carteira: uma linha por turma, agrupada por
// "ano de realização · ensino" (igual ao seletor), com totais do recorte e saúde do sync.
// Somente leitura — gerenciar (importar, vincular planilha, excluir) fica em ações separadas.

const brl = (n: number) => {
  if (!n || Math.abs(n) < 0.005) return '—'
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `R$ (${s})` : `R$ ${s}`
}
const brlCurto = (n: number) => {
  if (!n) return '—'
  const a = Math.abs(n)
  const t = a >= 1e6 ? `${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi` : a >= 1e3 ? `${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : a.toFixed(0)
  return `${n < 0 ? '-' : ''}R$ ${t}`
}
const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`)

const ENSINO: Record<string, string> = { SUPERIOR: 'Superior', MEDIO: 'Médio', FUNDAMENTAL: 'Fundamental' }
const ORDEM_ENSINO = ['Superior', 'Médio', 'Fundamental']

type Nivel = 'ok' | 'atencao' | 'erro'
interface Saude { nivel: Nivel; motivos: string[]; idade: string }

function diasDesde(iso?: string): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

interface Linha {
  p: Projeto
  turma: string
  instituicao: string
  receitaOrc: number
  custoOrc: number
  margemOrc: number | null
  pctContratado: number | null
  pctPago: number | null
  margemReal: number | null
  falta: number
  custoContratado: number
  custoPago: number
  saude: Saude
}

function montarLinha(p: Projeto): Linha {
  const r = calcResumoProjeto(p)
  const receitaOrc = r.receitaBaile.orcado
  const custoOrc = r.custoTotal.orcado
  const margemOrc = receitaOrc > 0 ? ((receitaOrc - custoOrc) / receitaOrc) * 100 : null
  const pctContratado = custoOrc > 0 ? (r.custoTotal.contratado / custoOrc) * 100 : null
  const pctPago = r.custoTotal.contratado > 0 ? (r.custoTotal.pago / r.custoTotal.contratado) * 100 : null
  const margemReal = r.receitaBaile.pago > 0 ? ((r.receitaBaile.pago - r.custoTotal.pago) / r.receitaBaile.pago) * 100 : null

  const motivos: string[] = []
  let nivel: Nivel = 'ok'
  const sobe = (n: Nivel) => { if (n === 'erro' || (n === 'atencao' && nivel === 'ok')) nivel = n }
  const dias = diasDesde(p.atualizadoEm)
  let idade = 'nunca atualizado'
  if (dias !== null) {
    idade = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`
    if (dias > 7) { motivos.push(`Sem atualizar há ${dias} dias`); sobe('erro') }
    else if (dias > 1) { motivos.push(`Última atualização há ${dias} dias`); sobe('atencao') }
  } else { motivos.push('Nunca sincronizado'); sobe('erro') }
  if (!p.sheetsUrl) { motivos.push('Sem planilha vinculada'); sobe('atencao') }
  if (receitaOrc === 0) { motivos.push('Receita orçada = R$ 0,00 (receita não lida ou não lançada)'); sobe('atencao') }
  else if (margemOrc !== null && margemOrc < -50) { motivos.push(`Margem orçada ${pct(margemOrc)} — conferir a receita lida`); sobe('atencao') }
  if (pctPago !== null && pctPago > 100.5) { motivos.push(`Pago (${pct(pctPago)}) maior que o contratado — falta contratado lançado ou pagamento alocado a mais`); sobe('atencao') }
  const diverg = p.secoes.reduce((s, sec) => s + sec.itens.filter(i => i.divergenciaTotais).length, 0)
  if (diverg > 0) { motivos.push(`${diverg} ${diverg === 1 ? 'item' : 'itens'} com total diferente de qtde × valor unitário`); sobe('atencao') }

  return {
    p,
    turma: padronizarCaixa(p.tap.turma || `Projeto ${p.id.slice(0, 6)}`),
    instituicao: padronizarCaixa(p.tap.instituicao || ''),
    receitaOrc, custoOrc, margemOrc, pctContratado, pctPago, margemReal,
    falta: r.custoTotal.faltaPagar,
    custoContratado: r.custoTotal.contratado,
    custoPago: r.custoTotal.pago,
    saude: { nivel, motivos, idade },
  }
}

const TH = 'px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-[#ffffff] whitespace-nowrap'
const TD = 'px-3 py-2 text-left text-[11px] tabular-nums whitespace-nowrap'
const COR_NIVEL: Record<Nivel, string> = { ok: '#16a34a', atencao: '#e6a100', erro: '#c0392b' }
const ROT_NIVEL: Record<Nivel, string> = { ok: 'em dia', atencao: 'atenção', erro: 'desatualizado' }

function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-md border border-[#e2e6ec] bg-white px-3 py-2.5" style={{ borderLeft: '4px solid #ef3935' }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64707f]">{rotulo}</div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums text-[#1e2430]">{valor}</div>
      {sub && <div className="text-[10px] text-[#64707f]">{sub}</div>}
    </div>
  )
}

export function ListaProjetosPainel({ projetos, hrefProjeto, renderAcoes }: {
  projetos: Projeto[]
  hrefProjeto: (p: Projeto) => string
  /** Ações por projeto (sincronizar, planilha, realizado, excluir). Omitir = somente leitura. */
  renderAcoes?: (p: Projeto) => ReactNode
}) {
  const [aba, setAba] = useState<'andamento' | 'realizados'>('andamento')
  const [ano, setAno] = useState('')
  const [ensino, setEnsino] = useState('')
  const [busca, setBusca] = useState('')
  const [soAtencao, setSoAtencao] = useState(false)

  const todas = useMemo(() => projetos.map(montarLinha), [projetos])
  const doStatus = todas.filter(l => (aba === 'realizados') === (l.p.status === 'realizado'))
  const nAndamento = todas.filter(l => l.p.status !== 'realizado').length
  const nRealizados = todas.length - nAndamento

  const anos = useMemo(() => [...new Set(doStatus.map(l => String(l.p.tap.anoRealizacao || '')).filter(Boolean))].sort(), [doStatus])
  const ensinos = useMemo(() => [...new Set(doStatus.map(l => ENSINO[String(l.p.tap.tipoEscola || '').toUpperCase()] ?? String(l.p.tap.tipoEscola || '')).filter(Boolean))], [doStatus])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return doStatus.filter(l => {
      if (ano && String(l.p.tap.anoRealizacao) !== ano) return false
      const ens = ENSINO[String(l.p.tap.tipoEscola || '').toUpperCase()] ?? String(l.p.tap.tipoEscola || '')
      if (ensino && ens !== ensino) return false
      if (q && !`${l.turma} ${l.instituicao} ${l.p.tap.curso ?? ''}`.toLowerCase().includes(q)) return false
      if (soAtencao && l.saude.nivel === 'ok') return false
      return true
    })
  }, [doStatus, ano, ensino, busca, soAtencao])

  const grupos = useMemo(() => {
    const m = new Map<string, { ano: number; ens: string; rotulo: string; itens: Linha[] }>()
    for (const l of filtradas) {
      const a = Number(l.p.tap.anoRealizacao) || 0
      const e = ENSINO[String(l.p.tap.tipoEscola || '').toUpperCase()] ?? String(l.p.tap.tipoEscola || 'Outros')
      const k = `${a}|${e}`
      if (!m.has(k)) m.set(k, { ano: a, ens: e, rotulo: `${a || 'Sem ano'} · ${e}`, itens: [] })
      m.get(k)!.itens.push(l)
    }
    for (const g of m.values()) g.itens.sort((x, y) => x.turma.localeCompare(y.turma))
    return [...m.values()].sort((a, b) => a.ano - b.ano || ORDEM_ENSINO.indexOf(a.ens) - ORDEM_ENSINO.indexOf(b.ens))
  }, [filtradas])

  const soma = (ls: Linha[]) => {
    const receita = ls.reduce((s, l) => s + l.receitaOrc, 0)
    const custo = ls.reduce((s, l) => s + l.custoOrc, 0)
    // margem do conjunto só considera turmas com receita lida (senão distorce)
    const comReceita = ls.filter(l => l.receitaOrc > 0)
    const r2 = comReceita.reduce((s, l) => s + l.receitaOrc, 0)
    const c2 = comReceita.reduce((s, l) => s + l.custoOrc, 0)
    return { receita, custo, margem: r2 > 0 ? ((r2 - c2) / r2) * 100 : null, falta: ls.reduce((s, l) => s + l.falta, 0), semReceita: ls.length - comReceita.length }
  }
  const tot = soma(filtradas)
  const nAtencao = filtradas.filter(l => l.saude.nivel !== 'ok').length

  const pill = (ativo: boolean) =>
    `rounded-md px-3 py-1.5 text-[12px] font-semibold border ${ativo ? 'bg-[#ef3935] text-[#ffffff] border-[#ef3935]' : 'bg-white text-[#1e2430] border-[#cfd5df]'}`
  const campo = 'rounded-md border border-[#cfd5df] bg-white px-2.5 py-1.5 text-[12px] text-[#1e2430]'

  return (
    <div className="space-y-6" style={{ fontFamily: "'Montserrat', ui-sans-serif, system-ui, sans-serif", color: '#1e2430' }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold">Projetos</h1>
          <p className="text-[12px] text-[#64707f]">{todas.length} projetos cadastrados · {nAndamento} em andamento · {nRealizados} realizados</p>
        </div>
        <div className="flex gap-2">
          <button className={pill(aba === 'andamento')} onClick={() => setAba('andamento')}>Em andamento · {nAndamento}</button>
          <button className={pill(aba === 'realizados')} onClick={() => setAba('realizados')}>Realizados · {nRealizados}</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={campo} value={ano} onChange={e => setAno(e.target.value)}>
          <option value="">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={campo} value={ensino} onChange={e => setEnsino(e.target.value)}>
          <option value="">Todos os ensinos</option>
          {ensinos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input className={`${campo} w-full min-w-[220px] sm:w-auto`} placeholder="Buscar turma, instituição ou curso…" value={busca} onChange={e => setBusca(e.target.value)} />
        <label className="ml-1 flex cursor-pointer items-center gap-2 text-[12px]">
          <input type="checkbox" checked={soAtencao} onChange={e => setSoAtencao(e.target.checked)} />
          só com atenção ({nAtencao})
        </label>
      </div>

      {/* Totais do recorte */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi rotulo="Projetos no recorte" valor={String(filtradas.length)} sub={tot.semReceita ? `${tot.semReceita} sem receita lida` : undefined} />
        <Kpi rotulo="Receita orçada" valor={brlCurto(tot.receita)} />
        <Kpi rotulo="Custo orçado" valor={brlCurto(tot.custo)} />
        <Kpi rotulo="Margem orçada" valor={pct(tot.margem)} sub="só turmas com receita lida" />
        <Kpi rotulo="Falta pagar" valor={brlCurto(tot.falta)} />
      </div>

      {/* Celular: um cartão por turma (a tabela larga escondia margem e sync fora da tela) */}
      <div className="space-y-6 md:hidden">
        {grupos.length === 0 && <p className="py-6 text-center text-[12px] text-[#64707f]">Nenhum projeto neste recorte.</p>}
        {grupos.map(g => {
          const s = soma(g.itens)
          return (
            <section key={g.rotulo}>
              <div className="rounded-t-md bg-[#e4e9f1] px-3 py-2.5" style={{ borderLeft: '4px solid #ef3935' }}>
                <div className="text-[14px] font-extrabold">{g.rotulo} <span className="ml-1 text-[11px] font-medium text-[#64707f]">{g.itens.length}</span></div>
                <div className="text-[10px] tabular-nums text-[#64707f]">receita {brlCurto(s.receita)} · custo {brlCurto(s.custo)} · margem {pct(s.margem)}</div>
              </div>
              <div className="divide-y divide-[#e2e6ec] overflow-hidden rounded-b-md border border-[#e2e6ec] bg-white">
                {g.itens.map(l => (
                  <div key={l.p.id} className="px-3 py-3">
                    <a href={hrefProjeto(l.p)} className="block active:bg-[#fff5f4]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold">{l.turma}</div>
                        <div className="truncate text-[10px] text-[#64707f]">{l.instituicao}{l.p.tap.curso ? ` · ${padronizarCaixa(l.p.tap.curso)}` : ''}</div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px]">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COR_NIVEL[l.saude.nivel] }} />
                        <span style={{ color: l.saude.nivel === 'ok' ? '#64707f' : COR_NIVEL[l.saude.nivel], fontWeight: l.saude.nivel === 'ok' ? 400 : 600 }}>
                          {l.saude.nivel === 'ok' ? l.saude.idade : `${ROT_NIVEL[l.saude.nivel]} · ${l.saude.motivos.length}`}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                      <div><div className="text-[9px] uppercase tracking-wide text-[#64707f]">Receita orç.</div><div className="font-medium">{brlCurto(l.receitaOrc)}</div></div>
                      <div><div className="text-[9px] uppercase tracking-wide text-[#64707f]">Margem orç.</div><div className="font-bold" style={{ color: l.margemOrc === null ? '#9aa3b0' : l.margemOrc < 0 ? '#c0392b' : '#137333' }}>{pct(l.margemOrc)}</div></div>
                      <div><div className="text-[9px] uppercase tracking-wide text-[#64707f]">% pago</div><div className="font-medium">{pct(l.pctPago)}</div></div>
                    </div>
                    {l.saude.nivel !== 'ok' && <div className="mt-1.5 text-[10px]" style={{ color: COR_NIVEL[l.saude.nivel] }}>{l.saude.motivos[0]}</div>}
                    </a>
                    {renderAcoes && <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px]">{renderAcoes(l.p)}</div>}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Desktop: tabela agrupada */}
      <div className="hidden overflow-x-auto rounded-md border border-[#e2e6ec] bg-white md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: '#ef3935' }}>
              <th className={TH} style={{ textAlign: 'left', minWidth: 230 }}>Turma</th>
              <th className={TH}>Receita orç.</th>
              <th className={TH}>Custo orç.</th>
              <th className={TH}>Margem orç.</th>
              <th className={TH}>% contratado</th>
              <th className={TH}>% pago</th>
              <th className={TH}>Margem real</th>
              <th className={TH}>Sync</th>
              {renderAcoes && <th className={TH}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr><td colSpan={renderAcoes ? 9 : 8} className="px-3 py-8 text-center text-[12px] text-[#64707f]">Nenhum projeto neste recorte.</td></tr>
            )}
            {grupos.map((g, gi) => {
              const s = soma(g.itens)
              return [
                gi > 0 && <tr key={`sp-${g.rotulo}`}><td colSpan={renderAcoes ? 9 : 8} className="h-8 bg-[#eceff3] p-0" /></tr>,
                <tr key={`g-${g.rotulo}`} className="bg-[#e4e9f1]">
                  <td className="px-3 py-2.5 text-left text-[14px] font-extrabold" style={{ borderLeft: '4px solid #ef3935' }}>
                    {g.rotulo} <span className="ml-2 text-[11px] font-medium text-[#64707f]">{g.itens.length} {g.itens.length === 1 ? 'projeto' : 'projetos'}</span>
                  </td>
                  <td className={`${TD} font-bold`}>{brlCurto(s.receita)}</td>
                  <td className={`${TD} font-bold`}>{brlCurto(s.custo)}</td>
                  <td className={`${TD} font-bold`}>{pct(s.margem)}</td>
                  <td colSpan={renderAcoes ? 5 : 4} />
                </tr>,
                ...g.itens.map((l, n) => {
                  const href = hrefProjeto(l.p)
                  const margemRuim = l.margemOrc !== null && l.margemOrc < 0
                  return (
                    <tr key={l.p.id} className={`cursor-pointer border-t border-[#e2e6ec] hover:bg-[#fff5f4] ${n % 2 ? 'bg-[#fafbfc]' : 'bg-white'}`}
                        onClick={() => { window.location.href = href }}>
                      <td className={`${TD} bg-[#f5f7fa]`}>
                        <a href={href} className="text-[13px] font-semibold hover:underline" onClick={e => e.stopPropagation()}>{l.turma}</a>
                        <div className="text-[10px] text-[#64707f]">{l.instituicao}{l.p.tap.curso ? ` · ${padronizarCaixa(l.p.tap.curso)}` : ''}</div>
                      </td>
                      <td className={TD}>{brl(l.receitaOrc)}</td>
                      <td className={TD}>{brl(l.custoOrc)}</td>
                      <td className={TD} style={{ color: l.margemOrc === null ? '#9aa3b0' : margemRuim ? '#c0392b' : '#137333', fontWeight: 700 }}>{pct(l.margemOrc)}</td>
                      <td className={TD}>
                        <Barra v={l.pctContratado} cor="#137333" />
                      </td>
                      <td className={TD}>
                        <Barra v={l.pctPago} cor="#4a72b0" />
                      </td>
                      <td className={TD} style={{ color: l.margemReal === null ? '#9aa3b0' : l.margemReal < 0 ? '#c0392b' : undefined }}>{pct(l.margemReal)}</td>
                      <td className={TD} title={l.saude.motivos.length ? l.saude.motivos.join('\n') : 'Sem alertas'}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COR_NIVEL[l.saude.nivel] }} />
                          <span style={{ color: l.saude.nivel === 'ok' ? undefined : COR_NIVEL[l.saude.nivel], fontWeight: l.saude.nivel === 'ok' ? 400 : 600 }}>
                            {l.saude.nivel === 'ok' ? l.saude.idade : `${ROT_NIVEL[l.saude.nivel]} · ${l.saude.motivos.length}`}
                          </span>
                        </span>
                      </td>
                      {renderAcoes && (
                        <td className={TD} onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-3 text-[11px]">{renderAcoes(l.p)}</div>
                        </td>
                      )}
                    </tr>
                  )
                }),
              ]
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[#64707f]">
        Passe o mouse na coluna Sync para ver os motivos do alerta. % contratado = custo contratado ÷ custo orçado; % pago = pago ÷ contratado.
      </p>
    </div>
  )
}

function Barra({ v, cor }: { v: number | null; cor: string }) {
  if (v === null) return <span className="text-[#9aa3b0]">—</span>
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-2 w-16 overflow-hidden rounded-full bg-[#eceff3]">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(v, 100))}%`, background: cor }} />
      </span>
      <span>{pct(v)}</span>
    </span>
  )
}
