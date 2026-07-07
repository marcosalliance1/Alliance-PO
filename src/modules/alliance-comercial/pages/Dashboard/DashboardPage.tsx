import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useComercialContext } from '../../contexts/ComercialContext'
import { formatBRL } from '../../../../utils/formatters'
import type { Projeto, LinhaResumoComercial, TipoEscola } from '../../../../types'

function fmtPct(v: number) {
  return `${v.toFixed(2)}%`
}

function tituloProjeto(p: Projeto): string {
  return p.tap.turma || `${p.tap.instituicao} ${p.tap.curso}`.trim() || `Projeto #${p.id.slice(0, 6)}`
}

function mediaFee(itens: { fee?: LinhaResumoComercial }[]): { media: number; count: number } {
  const comFee = itens.filter((i) => i.fee)
  const media = comFee.length > 0 ? comFee.reduce((s, i) => s + (i.fee?.percentual ?? 0), 0) / comFee.length : 0
  return { media, count: comFee.length }
}

const ENSINO_LABEL: Record<TipoEscola, string> = {
  SUPERIOR: 'Superior',
  MEDIO: 'Médio',
  FUNDAMENTAL: 'Fundamental',
}
const ENSINO_ORDEM: TipoEscola[] = ['SUPERIOR', 'MEDIO', 'FUNDAMENTAL']

export const DashboardPage: React.FC = () => {
  const { projetos } = useComercialContext()
  const navigate = useNavigate()
  const [anosAbertos, setAnosAbertos] = useState<Record<string, boolean>>({})
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({})

  const linhas = useMemo(() =>
    projetos.map((p) => ({
      projeto: p,
      fee: (p.resumoComercial ?? []).find((l) => l.descricao.toLowerCase().includes('fee alliance')),
    })),
  [projetos])

  const { media: mediaGeral, count: countGeral } = mediaFee(linhas)

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
            return { tipo, itens: itensGrupo, ...mediaFee(itensGrupo) }
          })
        return { ano, itens, grupos, ...mediaFee(itens) }
      })
  }, [linhas])

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
          % de FEE Alliance por projeto, agrupado por ano e tipo de ensino.
        </p>
      </div>

      {countGeral > 0 && (
        <div className="bg-surface rounded-xl px-4 py-4 border border-white/10 inline-block">
          <p className="text-text-muted text-xs mb-1">FEE Médio Geral ({countGeral} projeto{countGeral !== 1 ? 's' : ''})</p>
          <p className="text-primary text-2xl font-bold">{fmtPct(mediaGeral)}</p>
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
                            <tbody>
                              {itensGrupo.map(({ projeto, fee }) => (
                                <tr
                                  key={projeto.id}
                                  className="border-t border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
                                  onClick={() => navigate(`/projetos/${projeto.id}`)}
                                >
                                  <td className="px-4 pl-16 py-2.5 text-text-main">{tituloProjeto(projeto)}</td>
                                  {fee ? (
                                    <>
                                      <td className="px-4 py-2.5 text-right text-primary font-semibold w-24">{fmtPct(fee.percentual)}</td>
                                      <td className="px-4 py-2.5 text-right text-text-main w-44">{formatBRL(fee.valorComercial)}</td>
                                      <td className="px-4 py-2.5 text-right text-text-main w-44">{formatBRL(fee.valorReal)}</td>
                                    </>
                                  ) : (
                                    <td colSpan={3} className="px-4 py-2.5 text-right">
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
