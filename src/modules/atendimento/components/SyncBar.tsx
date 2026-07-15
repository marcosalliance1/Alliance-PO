import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'

export function SyncBar() {
  const {
    spreadsheetId, googleAccessToken, googleConectado, googleLogando, conectarGoogle,
    sincronizando, sincronizar, ultimoSync, desconectarGoogle,
  } = useAtendimento()
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSincronizar() {
    setMensagem(null)
    setErro(null)
    if (!googleAccessToken) return
    try {
      const r = await sincronizar(spreadsheetId, googleAccessToken)
      const partes = [`${r.criados} criado(s)`, `${r.atualizados} atualizado(s)`]
      if (r.conflitos > 0) partes.push(`${r.conflitos} conflito(s)`)
      setMensagem(partes.join(', ') + (r.erros.length > 0 ? ` — ${r.erros.length} aviso(s), veja o console` : ''))
      if (r.erros.length > 0) console.warn('Avisos da sincronização de Rifas:', r.erros)
    } catch (e) {
      const tipo = (e as Error & { tipo?: string }).tipo
      if (tipo === 'TOKEN_EXPIRADO') desconectarGoogle()
      setErro((e as Error).message)
    }
  }

  return (
    <div className="card flex items-center justify-between gap-4 mb-6">
      <div className="text-sm text-text-muted">
        {ultimoSync ? `Última sincronização: ${new Date(ultimoSync).toLocaleString('pt-BR')}` : 'Ainda não sincronizado'}
        {mensagem && <div className="text-success mt-1">{mensagem}</div>}
        {erro && <div className="text-danger mt-1">{erro}</div>}
      </div>
      {!googleConectado ? (
        <button
          onClick={conectarGoogle}
          disabled={googleLogando}
          className="px-4 py-2 rounded-lg bg-primary/15 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors disabled:opacity-50"
        >
          {googleLogando ? 'Conectando...' : 'Conectar Google'}
        </button>
      ) : (
        <button
          onClick={handleSincronizar}
          disabled={sincronizando || !spreadsheetId}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
          {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      )}
    </div>
  )
}
