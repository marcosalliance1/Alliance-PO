import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea,
} from 'recharts'
import { useComercialContext } from '../../contexts/ComercialContext'
import { formatBRL } from '../../../../utils/formatters'
import { calcResumoProjeto } from '../../../../utils/calculos'
import { getMetaFee, statusMetaFee, FAIXA_SUPERIOR_ENVELOPE, type StatusMetaFee } from '../../../../lib/metasFee'
import { ENSINO_LABEL, ENSINO_ORDEM, ENSINO_COLOR } from '../../constants/ensino'
import type { Projeto, LinhaResumoComercial, TipoEscola } from '../../../../types'

function fmtPct(v: number) {
  return `${v.toFixed(2)}%`
}

function tituloProjeto(p: Projeto): string {
  return p.tap.turma || `${p.tap.instituicao} ${p.tap.curso}`.trim() || `Projeto #${p.id.slice(0, 6)}`
}

function mediaFeeTotal(itens: { feeTotal?: LinhaResumoComercial }[]): { media: number; count: number } {
  const comFee = itens.filter((i) => i.feeTotal)
  const media = comFee.length > 0 ? comFee.reduce((s, i) => s + (i.feeTotal?.percentual ?? 0), 0) / comFee.length : 0
  return { media, count: comFee.length }
}

const COR_FINANCEIRO = '#c98500'

const META_FEE_LABEL: Record<StatusMetaFee, string> = {
  dentro: 'Dentro da meta',
  abaixo: 'Abaixo da meta',
  acima: 'Acima da meta',
}
const META_FEE_CLASS: Record<StatusMetaFee, string> = {
  dentro: 'bg-success/15 text-success',
  abaixo: 'bg-warning/15 text-warning',
  acima: 'bg-danger/15 text-danger',
}

function BadgeMetaFee({ status, min, max }: { status: StatusMetaFee; min: number; max: number }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${META_FEE_CLASS[status]}`}
      title={`Meta: ${min}%–${max}%`}
    >
      {META_FEE_LABEL[status]}
    </span>
  )
}

export const DashboardPage: React.FC = () => {
  const { projetos } = useComercialContext()
  const navigate = useNavigate()
  const [anosAbertos, setAnosAbertos] = useState<Record<string, boolean>>({})
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({})

  const linhas = useMemo(() =>
    projetos.map((p) => {
      const resumo = p.resumoComercial ?? []
      const feeTotal = resumo.find((l) => l.descricao.toLowerCase().includes('custo cerimonial'))
      const tipo = p.tap.tipoEscola ?? 'MEDIO'
      // Faturamento só importa pro Superior (faixa varia por receita) — evita
      // calcular o resumo financeiro inteiro do projeto à toa pros outros segmentos.
      const faturamento = tipo === 'SUPERIOR' ? calcResumoProjeto(p).receitaBaile.orcado : 0
      const faixaMeta = getMetaFee(tipo, faturamento)
      const statusMeta = feeTotal ? statusMetaFee(feeTotal.percentual, faixaMeta) : null
      return {
        projeto: p,
        feeAlliance: resumo.find((l) => l.descricao.toLowerCase().includes('fee alliance')),
        impostoFee: resumo.find((l) => l.descricao.toLowerCase().includes('imposto fee')),
        feeTotal,
        faixaMeta,
        statusMeta,
        faturamento,
      }
    }),
  [projetos])

  const statsPorEnsino = useMemo(() => {
    const map = new Map<TipoEscola, typeof linhas>()
    for (const l of linhas) {
      const tipo = l.projeto.tap.tipoEscola ?? 'MEDIO'
      if (!map.has(tipo)) map.set(tipo, [])
      map.get(tipo)!.push(l)
    }
    return ENSINO_ORDEM.map((tipo) => {
      const itens = map.get(tipo) ?? []
      const dentro = itens.filter((i) => i.statusMeta === 'dentro').length
      const { media, count } = mediaFeeTotal(itens)

      // Projeção "próximo projeto": assume só mais 1 projeto fechando no segmento,
      // com o porte médio (faturamento e base de receita) dos já sincronizados —
      // não é o número real de projetos restantes no ano, é uma estimativa simples.
      const avgFaturamento = itens.length > 0 ? itens.reduce((s, i) => s + i.faturamento, 0) / itens.length : 0
      const faixa = getMetaFee(tipo, avgFaturamento)
      const feeNecessario = Math.max(0, faixa.min * (count + 1) - media * count)
      const comFeeTotal = itens.filter((i) => i.feeTotal && i.feeTotal.percentual > 0)
      const avgBaseReceita = comFeeTotal.length > 0
        ? comFeeTotal.reduce((s, i) => s + i.feeTotal!.valorComercial / (i.feeTotal!.percentual / 100), 0) / comFeeTotal.length
        : 0
      const valorNecessario = (feeNecessario / 100) * avgBaseReceita
      const jaDentroDaMeta = count > 0 && media >= faixa.min
      const impossivel = feeNecessario > 100

      return {
        tipo, dentro, media, count, faixa, feeNecessario, valorNecessario, jaDentroDaMeta, impossivel,
        temHistoricoValor: avgBaseReceita > 0,
      }
    })
  }, [linhas])

  const { soma: somaFinanceira, count: countFinanceiro } = useMemo(() => {
    const comFee = linhas.filter((l) => l.feeAlliance || l.impostoFee)
    const soma = comFee.reduce((s, l) => s + (l.feeAlliance?.valorComercial ?? 0) + (l.impostoFee?.valorComercial ?? 0), 0)
    return { soma, count: comFee.length }
  }, [linhas])

  const porAno = useMemo(() => {
    const map = new Map<number, typeof linhas>()
    for (const l of linhas) {
      const ano = l.projeto.tap.anoRealizacao || 0
      if (!map.has(ano)) map.set(ano, [])
      map.get(ano)!.push(l)
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([ano, itens]) => {
        const porEnsino = new Map<TipoEscola, typeof linhas>()
        for (const it of itens) {
          const tipo = it.projeto.tap.tipoEscola ?? 'MEDIO'
          if (!porEnsino.has(tipo)) porEnsino.set(tipo, [])
          porEnsino.get(tipo)!.push(it)
        }
        const grupos = ENSINO_ORDEM
          .filter((t) => porEnsino.has(t))
          .map((tipo) => {
            const itensGrupo = porEnsino.get(tipo)!
            return { tipo, itens: itensGrupo, ...mediaFeeTotal(itensGrupo) }
          })
        return { ano, itens, grupos, ...mediaFeeTotal(itens) }
      })
  }, [linhas])

  const chartData = useMemo(() =>
    [...porAno]
      .sort((a, b) => a.ano - b.ano)
      .map(({ ano, grupos }) => {
        const row: Record<string, number | string> = { ano: ano || 'Sem ano' }
        for (const g of grupos) {
          if (g.count > 0) row[g.tipo] = Number(g.media.toFixed(2))
        }
        return row
      }),
  [porAno])

  function toggleAno(ano: number) {
    setAnosAbertos((p) => ({ ...p, [ano]: !p[ano] }))
  }
  function toggleGrupo(key: string) {
    setGruposAbertos((p) => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-text-main font-bold text-xl">Controle de FEE</h1>
        <p className="text-text-muted text-sm mt-1">
          FEE Alliance, Imposto FEE e FEE Total por projeto, agrupado por ano e tipo de ensino.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div
          className="bg-surface rounded-xl px-4 py-4 border-l-4 border border-white/10 flex-1 min-w-[220px]"
          style={{ borderLeftColor: COR_FINANCEIRO }}
        >
          <p className="text-text-muted text-xs mb-1">Somatório Financeiro dos Fees ({countFinanceiro} projeto{countFinanceiro !== 1 ? 's' : ''})</p>
          <p className="text-2xl font-bold" style={{ color: COR_FINANCEIRO }}>{formatBRL(somaFinanceira)}</p>
        </div>
        {statsPorEnsino.map(({ tipo, media, count, dentro }) => (
          <div
            key={tipo}
            className="bg-surface rounded-xl px-4 py-4 border-l-4 border border-white/10 flex-1 min-w-[220px]"
            style={{ borderLeftColor: ENSINO_COLOR[tipo] }}
          >
            <p className="text-text-muted text-xs mb-1">FEE Médio {ENSINO_LABEL[tipo]} ({count} projeto{count !== 1 ? 's' : ''})</p>
            <p className="text-2xl font-bold" style={{ color: ENSINO_COLOR[tipo] }}>{count > 0 ? fmtPct(media) : '—'}</p>
            {count > 0 && (
              <p className="text-text-muted text-[11px] mt-1">{dentro} de {count} projeto{count !== 1 ? 's' : ''} dentro da meta</p>
            )}
          </div>
        ))}
      </div>

      <div>
        <p className="text-text-main font-semibold text-sm mb-1">Meta do Próximo Projeto</p>
        <p className="text-text-muted text-[11px] mb-3">
          Estimativa considerando só mais 1 projeto fechando no segmento, com o porte médio dos projetos já sincronizados — não é a contagem real de projetos restantes no ano.
        </p>
        <div className="flex flex-wrap gap-3">
          {statsPorEnsino.map(({ tipo, faixa, feeNecessario, valorNecessario, jaDentroDaMeta, impossivel, temHistoricoValor }) => (
            <div
              key={tipo}
              className="bg-surface rounded-xl px-4 py-4 border-l-4 border border-white/10 flex-1 min-w-[240px]"
              style={{ borderLeftColor: ENSINO_COLOR[tipo] }}
            >
              <p className="text-text-main font-semibold text-sm mb-2">{ENSINO_LABEL[tipo]}</p>
              {jaDentroDaMeta ? (
                <p className="text-success text-sm font-semibold">Média já dentro da meta — qualquer FEE mantém a faixa.</p>
              ) : (
                <>
                  <p className={`text-2xl font-bold ${impossivel ? 'text-danger' : ''}`} style={impossivel ? undefined : { color: ENSINO_COLOR[tipo] }}>
                    FEE ≥ {fmtPct(feeNecessario)}
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    {temHistoricoValor ? `≈ ${formatBRL(valorNecessario)} em FEE` : 'Sem histórico de valor pra estimar R$'}
                  </p>
                  {impossivel && (
                    <p className="text-danger text-[11px] mt-1">Meta não alcançável com só +1 projeto — precisa de mais volume.</p>
                  )}
                </>
              )}
              <p className="text-text-muted text-[10px] mt-2">Meta do segmento: {fmtPct(faixa.min)}–{fmtPct(faixa.max)}</p>
            </div>
          ))}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-surface rounded-xl border border-white/10 px-4 py-4">
          <p className="text-text-main font-semibold text-sm mb-3">Evolução do FEE Total médio por ano</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="ano" tick={{ fill: '#8892b0', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(v) => `${v}%`}
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f0f0f0' }}
                itemStyle={{ color: '#8892b0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
              {ENSINO_ORDEM.map((tipo) => {
                const faixa = tipo === 'SUPERIOR' ? FAIXA_SUPERIOR_ENVELOPE : getMetaFee(tipo)
                return (
                  <ReferenceArea
                    key={`meta-${tipo}`}
                    y1={faixa.min}
                    y2={faixa.max}
                    ifOverflow="extendDomain"
                    stroke={ENSINO_COLOR[tipo]}
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    fill={ENSINO_COLOR[tipo]}
                    fillOpacity={0.06}
                  />
                )
              })}
              {ENSINO_ORDEM.map((tipo) => (
                <Line
                  key={tipo}
                  type="monotone"
                  dataKey={tipo}
                  name={ENSINO_LABEL[tipo]}
                  stroke={ENSINO_COLOR[tipo]}
                  strokeWidth={2}
                  dot={{ fill: ENSINO_COLOR[tipo] }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-text-muted text-[11px] mt-2">
            Faixas tracejadas = meta de FEE Total por segmento. A faixa do Superior ({fmtPct(FAIXA_SUPERIOR_ENVELOPE.min)}–{fmtPct(FAIXA_SUPERIOR_ENVELOPE.max)}) é ampla porque varia por faturamento do projeto — veja o badge "Meta FEE" na tabela abaixo para o alvo específico de cada projeto.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {porAno.map(({ ano, itens, grupos, media: mediaAno, count: countAno }) => {
          const anoOpen = anosAbertos[ano] ?? false
          return (
            <div key={ano} className="bg-surface rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleAno(ano)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
              >
                {anoOpen ? <ChevronDown className="w-4 h-4 text-text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />}
                <span className="flex-1 text-text-main font-semibold">{ano || 'Sem ano'}</span>
                <span className="text-text-muted text-xs">{itens.length} projeto{itens.length !== 1 ? 's' : ''}</span>
                {countAno > 0 && (
                  <span className="text-primary font-semibold text-sm">FEE médio {fmtPct(mediaAno)}</span>
                )}
              </button>

              {anoOpen && (
                <div className="border-t border-white/10">
                  {grupos.map(({ tipo, itens: itensGrupo, media: mediaGrupo, count: countGrupo }) => {
                    const key = `${ano}-${tipo}`
                    const grupoOpen = gruposAbertos[key] ?? false
                    return (
                      <div key={key} className="border-b border-white/5 last:border-0">
                        <button
                          onClick={() => toggleGrupo(key)}
                          className="w-full flex items-center gap-3 px-4 pl-9 py-2.5 text-left hover:bg-white/3 transition-colors bg-black/10"
                        >
                          {grupoOpen ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />}
                          <span className="flex-1 text-text-main text-sm font-medium">{ENSINO_LABEL[tipo]}</span>
                          <span className="text-text-muted text-xs">{itensGrupo.length} projeto{itensGrupo.length !== 1 ? 's' : ''}</span>
                          {countGrupo > 0 && (
                            <span className="text-primary text-xs font-semibold">{fmtPct(mediaGrupo)}</span>
                          )}
                        </button>

                        {grupoOpen && (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-black/10">
                                <th className="text-left px-4 pl-16 py-2 text-text-muted font-medium text-xs">Projeto</th>
                                <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-48">FEE Alliance</th>
                                <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-48">Imposto FEE</th>
                                <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-24">FEE Total</th>
                                <th className="text-right px-4 py-2 text-text-muted font-medium text-xs w-36">Meta FEE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itensGrupo.map(({ projeto, feeAlliance, impostoFee, feeTotal, faixaMeta, statusMeta }) => (
                                <tr
                                  key={projeto.id}
                                  className="border-t border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
                                  onClick={() => navigate(`/projetos/${projeto.id}`)}
                                >
                                  <td className="px-4 pl-16 py-2.5 text-text-main">{tituloProjeto(projeto)}</td>
                                  {feeAlliance || impostoFee || feeTotal ? (
                                    <>
                                      <td className="px-4 py-2.5 text-right text-text-main w-48">
                                        {feeAlliance ? (
                                          <>{formatBRL(feeAlliance.valorComercial)} <span className="text-primary font-semibold">({fmtPct(feeAlliance.percentual)})</span></>
                                        ) : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-text-main w-48">
                                        {impostoFee ? (
                                          <>{formatBRL(impostoFee.valorComercial)} <span className="text-primary font-semibold">({fmtPct(impostoFee.percentual)})</span></>
                                        ) : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-primary font-semibold w-24">
                                        {feeTotal ? fmtPct(feeTotal.percentual) : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right w-36">
                                        {statusMeta ? (
                                          <BadgeMetaFee status={statusMeta} min={faixaMeta.min} max={faixaMeta.max} />
                                        ) : '—'}
                                      </td>
                                    </>
                                  ) : (
                                    <td colSpan={4} className="px-4 py-2.5 text-right">
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-text-muted">Não importado</span>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {porAno.length === 0 && (
          <div className="bg-surface rounded-xl border border-white/10 px-4 py-8 text-center text-text-muted text-sm">
            Nenhum projeto encontrado.
          </div>
        )}
      </div>
    </div>
  )
}
