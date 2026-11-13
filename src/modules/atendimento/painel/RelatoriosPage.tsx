import { useMemo } from 'react'
import { nomeTurma, useProjetosOpcoes, useVariasCategorias, type Registro } from './useRegistros'

// Relatórios — mesmos indicadores do painel original, calculados dos dados do Atendimento.
// Ficam para a Fase 3 (dependem de abas que ainda não existem aqui): "Pagamentos pendentes",
// "Rifas vendidas (total / por turma)" e o tempo médio de Pagamento e Contratos.

function mediaDias(rows: Registro[]): { media: number; n: number } | null {
  const com = rows.filter(r => r.criado_em && r.concluido_em)
  if (!com.length) return null
  const total = com.reduce((s, r) => s + Math.max(0, (Date.parse(r.concluido_em!) - Date.parse(r.criado_em)) / 86400000), 0)
  return { media: total / com.length, n: com.length }
}

const Card = ({ titulo, desc, children }: { titulo: string; desc?: string; children: React.ReactNode }) => (
  <div className="bg-surface rounded-[12px] border border-white/10 p-5">
    <div className="font-semibold text-text-main">{titulo}</div>
    {desc && <div className="text-sm text-text-muted mt-1 mb-4 leading-relaxed">{desc}</div>}
    {!desc && <div className="mb-4" />}
    {children}
  </div>
)

const Numero = ({ valor, rotulo }: { valor: string | number; rotulo: string }) => (
  <div className="bg-bg/60 border border-white/10 rounded-lg px-4 py-3">
    <div className="text-2xl font-bold text-text-main leading-tight">{valor}</div>
    <div className="text-xs text-text-muted mt-1">{rotulo}</div>
  </div>
)

export function RelatoriosPage() {
  const { porCategoria, carregando, erro } = useVariasCategorias(['demandas', 'rescisao', 'alteracaoplano'])
  const projetos = useProjetosOpcoes()

  const r = useMemo(() => {
    const demandas = porCategoria.demandas ?? []
    const rescisoes = porCategoria.rescisao ?? []
    const finalizadas = demandas.filter(d => d.status === 'Finalizado').length
    const ignoradas = demandas.filter(d => d.status === 'Ignorado').length
    const porTurma = new Map<string, { total: number; finalizadas: number }>()
    for (const d of demandas) {
      const t = nomeTurma(d, projetos) || 'Geral'
      const x = porTurma.get(t) ?? { total: 0, finalizadas: 0 }
      x.total++
      if (d.status === 'Finalizado') x.finalizadas++
      porTurma.set(t, x)
    }
    return {
      demandasAbertas: demandas.filter(d => !['Finalizado', 'Ignorado'].includes(d.status ?? '')).length,
      rescisoesAndamento: rescisoes.filter(x => x.status && x.status !== 'Concluído').length,
      total: demandas.length,
      finalizadas, ignoradas,
      emAberto: demandas.length - finalizadas - ignoradas,
      taxa: demandas.length ? Math.round((finalizadas / demandas.length) * 100) : 0,
      porTurma: [...porTurma.entries()]
        .map(([turma, x]) => ({ turma, ...x, taxa: x.total ? Math.round((x.finalizadas / x.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total),
      tempos: [
        { aba: 'Rescisão', s: mediaDias(rescisoes) },
        { aba: 'Alteração de Plano', s: mediaDias(porCategoria.alteracaoplano ?? []) },
      ],
    }
  }, [porCategoria, projetos])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-text-main">Relatórios</h1>
        <p className="text-sm text-text-muted mt-1">Indicadores simples calculados a partir dos dados já cadastrados no painel.</p>
      </div>

      {erro && <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">{erro}</div>}

      {carregando ? (
        <div className="p-10 text-center text-sm text-text-muted">Carregando…</div>
      ) : (
        <div className="space-y-4">
          <Card titulo="Visão geral">
            <div className="grid grid-cols-2 gap-3">
              <Numero valor={r.demandasAbertas} rotulo="Demandas em aberto" />
              <Numero valor={r.rescisoesAndamento} rotulo="Rescisões em andamento" />
            </div>
          </Card>

          <Card titulo="Taxa de conclusão de Demandas"
            desc={`${r.finalizadas} finalizada(s) de ${r.total} demanda(s) no total — ${r.ignoradas} ignorada(s), ${r.emAberto} em aberto.`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <Numero valor={`${r.taxa}%`} rotulo="Taxa de conclusão geral" />
            </div>
            {r.porTurma.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-text-muted border-b border-white/10">
                      <th className="text-left font-semibold py-2 pr-3">Turma / Projeto</th>
                      <th className="text-right font-semibold py-2 px-3">Total</th>
                      <th className="text-right font-semibold py-2 px-3">Finalizadas</th>
                      <th className="text-right font-semibold py-2 pl-3">% conclusão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.porTurma.map(t => (
                      <tr key={t.turma} className="border-b border-white/5 last:border-0 text-text-main">
                        <td className="py-2 pr-3">{t.turma}</td>
                        <td className="py-2 px-3 text-right">{t.total}</td>
                        <td className="py-2 px-3 text-right">{t.finalizadas}</td>
                        <td className="py-2 pl-3 text-right">{t.taxa}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-text-muted">Nenhuma demanda cadastrada ainda.</p>}
          </Card>

          <Card titulo="Tempo médio até resolver"
            desc="Da data de criação até a data em que o registro foi marcado como concluído.">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-text-muted border-b border-white/10">
                  <th className="text-left font-semibold py-2 pr-3">Aba</th>
                  <th className="text-right font-semibold py-2 px-3">Tempo médio</th>
                  <th className="text-right font-semibold py-2 pl-3">Registros</th>
                </tr>
              </thead>
              <tbody>
                {r.tempos.map(t => (
                  <tr key={t.aba} className="border-b border-white/5 last:border-0 text-text-main">
                    <td className="py-2 pr-3">{t.aba}</td>
                    <td className="py-2 px-3 text-right">
                      {t.s ? `${t.s.media.toFixed(1).replace('.', ',')} dias` : <span className="text-text-muted">Sem dados suficientes</span>}
                    </td>
                    <td className="py-2 pl-3 text-right">{t.s?.n ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}
