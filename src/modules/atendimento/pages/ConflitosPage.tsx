import { useState } from 'react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { SyncBar } from '../components/SyncBar'

const NOME_TABELA: Record<string, string> = {
  rifas: 'Rifa (INFORMAÇÕES)',
  rifas_ganhadores: 'Ganhador (GANHADORES)',
  rifas_compras: 'Compra (ACOMPANHAMENTO)',
}

export function ConflitosPage() {
  const { conflitos, spreadsheetId, googleAccessToken, resolverConflito } = useAtendimento()
  const [resolvendo, setResolvendo] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const pendentes = conflitos.filter(c => !c.resolvido)

  async function handleResolver(id: number, manter: 'alliance' | 'sheet') {
    if (!googleAccessToken) { setErro('Conecte o Google antes de resolver conflitos.'); return }
    const conflito = pendentes.find(c => c.id === id)
    if (!conflito) return
    setErro(null)
    setResolvendo(id)
    try {
      await resolverConflito(conflito, manter, spreadsheetId, googleAccessToken)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setResolvendo(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-4">Conflitos de Sincronização</h1>
      <SyncBar />
      {erro && <div className="card mb-4 text-danger text-sm">{erro}</div>}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3 font-semibold">Registro</th>
                <th className="px-4 py-3 font-semibold">Campo</th>
                <th className="px-4 py-3 font-semibold">Valor no Alliance</th>
                <th className="px-4 py-3 font-semibold">Valor na Planilha</th>
                <th className="px-4 py-3 font-semibold">Detectado em</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {pendentes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Nenhum conflito pendente. 🎉</td></tr>
              )}
              {pendentes.map(c => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2 text-text-muted">{NOME_TABELA[c.tabela_origem] ?? c.tabela_origem}</td>
                  <td className="px-4 py-2 text-text-main">{c.campo}</td>
                  <td className="px-4 py-2 text-text-muted max-w-xs truncate" title={c.valor_alliance ?? ''}>{c.valor_alliance || '—'}</td>
                  <td className="px-4 py-2 text-text-muted max-w-xs truncate" title={c.valor_sheet ?? ''}>{c.valor_sheet || '—'}</td>
                  <td className="px-4 py-2 text-text-muted whitespace-nowrap">{new Date(c.detectado_em).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2 whitespace-nowrap flex gap-2">
                    <button
                      onClick={() => handleResolver(c.id, 'alliance')}
                      disabled={resolvendo === c.id}
                      className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors disabled:opacity-40"
                    >
                      Manter Alliance
                    </button>
                    <button
                      onClick={() => handleResolver(c.id, 'sheet')}
                      disabled={resolvendo === c.id}
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-text-main text-xs font-semibold hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                      Manter Planilha
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
