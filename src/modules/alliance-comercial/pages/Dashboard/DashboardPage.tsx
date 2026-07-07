import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useComercialContext } from '../../contexts/ComercialContext'
import { formatBRL } from '../../../../utils/formatters'

function fmtPct(v: number) {
  return `${v.toFixed(2)}%`
}

function tituloProjeto(p: { tap: { turma: string; instituicao: string; curso: string }; id: string }): string {
  return p.tap.turma || `${p.tap.instituicao} ${p.tap.curso}`.trim() || `Projeto #${p.id.slice(0, 6)}`
}

export const DashboardPage: React.FC = () => {
  const { projetos } = useComercialContext()
  const navigate = useNavigate()

  const linhas = useMemo(() => {
    return projetos
      .map(p => ({
        projeto: p,
        fee: (p.resumoComercial ?? []).find(l => l.descricao.toLowerCase().includes('fee alliance')),
      }))
      .sort((a, b) => (b.fee?.percentual ?? -1) - (a.fee?.percentual ?? -1))
  }, [projetos])

  const comFee = linhas.filter(l => l.fee)
  const mediaPct = comFee.length > 0
    ? comFee.reduce((s, l) => s + (l.fee?.percentual ?? 0), 0) / comFee.length
    : 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-text-main font-bold text-xl">Controle de FEE</h1>
        <p className="text-text-muted text-sm mt-1">
          % de FEE Alliance por projeto, importado da aba "1.1 Resumo Custos" de cada P.O.
        </p>
      </div>

      {comFee.length > 0 && (
        <div className="bg-surface rounded-xl px-4 py-4 border border-white/10 inline-block">
          <p className="text-text-muted text-xs mb-1">FEE Médio ({comFee.length} projeto{comFee.length !== 1 ? 's' : ''})</p>
          <p className="text-primary text-2xl font-bold">{fmtPct(mediaPct)}</p>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left px-4 py-3 text-text-muted font-medium">Projeto</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Ano</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">FEE %</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Valor Previsto Comercial</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Valor Real</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ projeto, fee }) => (
              <tr
                key={projeto.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/3 cursor-pointer transition-colors"
                onClick={() => navigate(`/projetos/${projeto.id}`)}
              >
                <td className="px-4 py-3 text-text-main font-medium">{tituloProjeto(projeto)}</td>
                <td className="px-4 py-3 text-text-muted">{projeto.tap.anoRealizacao || '—'}</td>
                {fee ? (
                  <>
                    <td className="px-4 py-3 text-right text-primary font-semibold">{fmtPct(fee.percentual)}</td>
                    <td className="px-4 py-3 text-right text-text-main">{formatBRL(fee.valorComercial)}</td>
                    <td className="px-4 py-3 text-right text-text-main">{formatBRL(fee.valorReal)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="px-4 py-3 text-right">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-text-muted">Não importado</span>
                  </td>
                )}
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted text-sm">Nenhum projeto encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
