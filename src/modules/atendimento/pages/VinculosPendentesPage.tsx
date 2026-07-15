import { useMemo, useState } from 'react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { SyncBar } from '../components/SyncBar'

export function VinculosPendentesPage() {
  const { rifas, overrides, dimensaoProjetos, salvarOverride } = useAtendimento()
  const [selecionado, setSelecionado] = useState<Record<string, number>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  const pendentes = useMemo(() => {
    const jaTemOverride = new Set(overrides.map(o => o.turma))
    const porTurma = new Map<string, { turma: string; confianca: number | null; qtdRifas: number }>()
    for (const r of rifas) {
      if (r.match_manual) continue
      if (jaTemOverride.has(r.turma)) continue
      const semMatch = r.dimensao_projeto_id === null || (r.match_confianca ?? 0) < 0.75
      if (!semMatch) continue
      const atual = porTurma.get(r.turma)
      if (atual) atual.qtdRifas++
      else porTurma.set(r.turma, { turma: r.turma, confianca: r.match_confianca, qtdRifas: 1 })
    }
    return Array.from(porTurma.values()).sort((a, b) => a.turma.localeCompare(b.turma))
  }, [rifas, overrides])

  async function handleSalvar(turma: string) {
    const dimensaoProjetoId = selecionado[turma]
    if (!dimensaoProjetoId) return
    setSalvando(turma)
    try {
      await salvarOverride(turma, dimensaoProjetoId)
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-4">Vínculos Pendentes</h1>
      <SyncBar />

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3 font-semibold">Turma (planilha)</th>
                <th className="px-4 py-3 font-semibold">Rifas</th>
                <th className="px-4 py-3 font-semibold">Confiança do match automático</th>
                <th className="px-4 py-3 font-semibold">Vincular a</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {pendentes.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Nenhum vínculo pendente. 🎉</td></tr>
              )}
              {pendentes.map(p => (
                <tr key={p.turma} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2 text-text-main">{p.turma}</td>
                  <td className="px-4 py-2 text-text-muted">{p.qtdRifas}</td>
                  <td className="px-4 py-2 text-text-muted">{p.confianca !== null ? `${Math.round(p.confianca * 100)}%` : '—'}</td>
                  <td className="px-4 py-2">
                    <select
                      className="bg-bg border border-white/10 rounded-lg px-2 py-1 text-sm text-text-main"
                      value={selecionado[p.turma] ?? ''}
                      onChange={e => setSelecionado(s => ({ ...s, [p.turma]: Number(e.target.value) }))}
                    >
                      <option value="">Selecione o centro de custo...</option>
                      {dimensaoProjetos.map(dp => (
                        <option key={dp.id} value={dp.id}>{dp.nome_projeto} ({dp.instituicao})</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleSalvar(p.turma)}
                      disabled={!selecionado[p.turma] || salvando === p.turma}
                      className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors disabled:opacity-40"
                    >
                      {salvando === p.turma ? 'Salvando...' : 'Salvar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
