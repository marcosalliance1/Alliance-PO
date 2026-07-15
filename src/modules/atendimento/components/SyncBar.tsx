import { useState } from 'react'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import type { SincronizarResult } from '../../../hooks/useRifas'

export function SyncBar() {
  const {
    spreadsheetId, googleAccessToken, googleConectado, googleLogando, conectarGoogle,
    sincronizando, sincronizar, ultimoSync, desconectarGoogle,
  } = useAtendimento()
  const [resultado, setResultado] = useState<SincronizarResult | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [avisosAbertos, setAvisosAbertos] = useState(false)

  async function handleSincronizar() {
    setResultado(null)
    setErro(null)
    if (!googleAccessToken) return
    try {
      const r = await sincronizar(spreadsheetId, googleAccessToken)
      setResultado(r)
    } catch (e) {
      const tipo = (e as Error & { tipo?: string }).tipo
      if (tipo === 'TOKEN_EXPIRADO') desconectarGoogle()
      setErro((e as Error).message)
    }
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-text-muted">
          {ultimoSync ? `Última sincronização: ${new Date(ultimoSync).toLocaleString('pt-BR')}` : 'Ainda não sincronizado'}
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

      {erro && <div className="text-danger text-sm mt-3">{erro}</div>}

      {resultado && (
        <div className="mt-3 pt-3 border-t border-white/10 text-sm">
          <div className="grid grid-cols-3 gap-3 text-text-muted">
            <div><span className="text-text-main font-semibold">Informações:</span> {resultado.porTabela.rifas.criados} criado(s) · {resultado.porTabela.rifas.atualizados} atualizado(s)</div>
            <div><span className="text-text-main font-semibold">Ganhadores:</span> {resultado.porTabela.ganhadores.criados} criado(s) · {resultado.porTabela.ganhadores.atualizados} atualizado(s)</div>
            <div><span className="text-text-main font-semibold">Compras:</span> {resultado.porTabela.compras.criados} criado(s) · {resultado.porTabela.compras.atualizados} atualizado(s)</div>
          </div>
          {resultado.conflitos > 0 && (
            <div className="text-warning mt-2">{resultado.conflitos} conflito(s) detectado(s) — veja "Conflitos de Sync".</div>
          )}
          {resultado.erros.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setAvisosAbertos(a => !a)}
                className="flex items-center gap-1 text-danger font-semibold"
              >
                {avisosAbertos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {resultado.erros.length} aviso(s) da sincronização
              </button>
              {avisosAbertos && (
                <ul className="mt-2 space-y-1 text-text-muted list-disc list-inside">
                  {resultado.erros.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
