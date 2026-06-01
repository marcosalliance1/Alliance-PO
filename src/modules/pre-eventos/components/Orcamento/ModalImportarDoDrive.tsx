import React, { useState, useEffect } from 'react'
import { X, LogIn, RefreshCw, AlertTriangle, Check, ExternalLink } from 'lucide-react'
import { useGoogleAuth } from '../../../../contexts/GoogleAuthContext'
import { fetchAba, extrairSpreadsheetId } from '../../../../utils/sheetsSync'
import { parsearAbaGoogle, SECAO_LABELS } from '../../utils/importarPlanilha'
import type { ItemImportado, ResultadoImportacao } from '../../utils/importarPlanilha'
import type { Orcamento, ItemOrcamento } from '../../types'
import { formatBRL } from '../../utils/formatters'

interface Props {
  orc: Orcamento
  onConfirmar: (
    reconhecidos: ItemImportado[],
    mapeados: { item: ItemImportado; alvoId: string }[],
  ) => void
  onFechar: () => void
}

export const ModalImportarDoDrive: React.FC<Props> = ({ orc, onConfirmar, onFechar }) => {
  const { accessToken, conectado, logando, conectar, invalidarToken } = useGoogleAuth()
  const [url, setUrl] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [decisoes, setDecisoes] = useState<Record<number, string>>({})
  const [pendingLoad, setPendingLoad] = useState(false)

  // After OAuth flow completes, trigger load automatically
  useEffect(() => {
    if (accessToken && pendingLoad) {
      setPendingLoad(false)
      void doCarregar(accessToken)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, pendingLoad])

  async function doCarregar(token: string) {
    const spreadsheetId = extrairSpreadsheetId(url)
    if (!spreadsheetId) {
      setErro('URL inválida. Cole o link completo da planilha do Google Sheets.')
      return
    }
    setCarregando(true)
    setErro('')
    try {
      const metaResp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (metaResp.status === 401) {
        invalidarToken()
        setErro('Token expirado. Reconecte ao Google e tente novamente.')
        return
      }
      if (metaResp.status === 403) {
        setErro('Sem permissão. Verifique se a planilha está compartilhada com sua conta Google.')
        return
      }
      if (!metaResp.ok) {
        const body = await metaResp.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body.error?.message ?? `Erro ao acessar planilha (HTTP ${metaResp.status})`)
      }

      const meta = await metaResp.json() as { sheets: { properties: { title: string } }[] }
      const firstSheet = meta.sheets[0]?.properties.title
      if (!firstSheet) throw new Error('Planilha vazia ou sem abas.')

      const values = await fetchAba(spreadsheetId, firstSheet, token)
      if (!values || values.length === 0) throw new Error('A primeira aba está vazia.')

      const r = parsearAbaGoogle(values, orc)
      if (r.reconhecidos.length === 0 && r.naoReconhecidos.length === 0) {
        setErro(
          'Nenhum item encontrado. Verifique se a planilha tem as colunas: ITEM, QTDE, CUSTO UNITÁRIO, STATUS, ESPECIFICAÇÕES — e linhas de seção como OPERAÇÃO/ESTRUTURA, EQUIPE, ATRAÇÃO.',
        )
        return
      }
      setResultado(r)
      const d: Record<number, string> = {}
      r.naoReconhecidos.forEach((_, i) => { d[i] = '' })
      setDecisoes(d)
    } catch (e) {
      const err = e as Error & { tipo?: string }
      if (err.tipo === 'TOKEN_EXPIRADO') {
        invalidarToken()
        setErro('Token expirado. Reconecte ao Google e tente novamente.')
      } else {
        setErro(err.message ?? 'Erro desconhecido ao ler a planilha.')
      }
    } finally {
      setCarregando(false)
    }
  }

  function handleCarregar() {
    if (!url.trim()) { setErro('Cole a URL da planilha primeiro.'); return }
    if (!accessToken) {
      setPendingLoad(true)
      conectar()
      return
    }
    void doCarregar(accessToken)
  }

  function handleConfirmar() {
    if (!resultado) return
    const mapeados = resultado.naoReconhecidos
      .map((item, i) => ({ item, alvoId: decisoes[i] ?? '' }))
      .filter(x => x.alvoId !== '')
    onConfirmar(resultado.reconhecidos, mapeados)
  }

  const totalImportando =
    (resultado?.reconhecidos.length ?? 0) +
    Object.values(decisoes).filter(v => v !== '').length

  const btnLabel = logando || (pendingLoad && !conectado)
    ? 'Conectando...'
    : carregando
      ? 'Carregando...'
      : conectado
        ? 'Carregar do Drive'
        : 'Conectar e Carregar'

  const btnIcon = logando || carregando || (pendingLoad && !conectado)
    ? <RefreshCw className="w-4 h-4 animate-spin" />
    : conectado
      ? <ExternalLink className="w-4 h-4" />
      : <LogIn className="w-4 h-4" />

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-surface border border-bordercol rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bordercol shrink-0">
          <h2 className="text-white font-semibold">Importar do Google Drive</h2>
          <button onClick={onFechar} className="text-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {!resultado ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Cole o link da planilha do Google Sheets. A primeira aba será lida automaticamente.
                Certifique-se de que a planilha está compartilhada com sua conta Google.
              </p>
              <div className="space-y-2">
                <input
                  className="w-full bg-surface border border-bordercol rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent transition-colors"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={url}
                  onChange={e => { setUrl(e.target.value); setErro('') }}
                  onKeyDown={e => e.key === 'Enter' && handleCarregar()}
                />
                <button
                  onClick={handleCarregar}
                  disabled={carregando || logando || (pendingLoad && !conectado)}
                  className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors"
                >
                  {btnIcon} {btnLabel}
                </button>
              </div>
              {erro && (
                <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">

              {/* Reconhecidos */}
              {resultado.reconhecidos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4 text-success" />
                    Reconhecidos ({resultado.reconhecidos.length}) — serão atualizados automaticamente
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-bordercol/50">
                    <table className="w-full text-xs min-w-[500px]">
                      <thead>
                        <tr className="bg-surface2/50 text-muted">
                          <th className="text-left px-2 py-1.5 font-medium">Item</th>
                          <th className="text-left px-2 py-1.5 font-medium">Seção</th>
                          <th className="text-right px-2 py-1.5 font-medium w-12">Qtde</th>
                          <th className="text-right px-2 py-1.5 font-medium w-28">Custo Unit.</th>
                          <th className="text-left px-2 py-1.5 font-medium w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.reconhecidos.map((item, i) => (
                          <tr key={i} className="border-t border-bordercol/50">
                            <td className="px-2 py-1.5 text-white">{item.nome}</td>
                            <td className="px-2 py-1.5 text-muted">{SECAO_LABELS[item.secao]}</td>
                            <td className="px-2 py-1.5 text-right text-gray-300">{item.qtde}</td>
                            <td className="px-2 py-1.5 text-right text-gray-300">{formatBRL(item.custoUnitario)}</td>
                            <td className="px-2 py-1.5 text-muted">{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Não reconhecidos */}
              {resultado.naoReconhecidos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Não reconhecidos ({resultado.naoReconhecidos.length}) — escolha o que fazer
                  </h3>
                  <div className="space-y-2">
                    {resultado.naoReconhecidos.map((item, i) => {
                      const sectionItems = orc[item.secao] as ItemOrcamento[]
                      return (
                        <div key={i} className="bg-surface2/40 border border-bordercol/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium truncate">{item.nome}</p>
                            <p className="text-muted text-[10px]">
                              {SECAO_LABELS[item.secao]} · Qtde: {item.qtde} · {formatBRL(item.custoUnitario)}
                            </p>
                          </div>
                          <select
                            value={decisoes[i] ?? ''}
                            onChange={e => setDecisoes(prev => ({ ...prev, [i]: e.target.value }))}
                            className="text-xs bg-surface border border-bordercol rounded px-2 py-1.5 text-white outline-none focus:border-accent transition-colors shrink-0"
                          >
                            <option value="">Ignorar (não importar)</option>
                            {sectionItems.length > 0 && (
                              <optgroup label="Mapear para...">
                                {sectionItems.map(si => (
                                  <option key={si.id} value={si.id}>{si.item || '(sem nome)'}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {resultado && (
          <div className="flex items-center justify-between p-4 border-t border-bordercol shrink-0">
            <button
              onClick={() => { setResultado(null); setErro('') }}
              className="text-sm text-muted hover:text-white transition-colors"
            >
              ← Trocar planilha
            </button>
            <div className="flex items-center gap-3">
              <button onClick={onFechar} className="text-sm text-muted hover:text-white transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={totalImportando === 0}
                className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors"
              >
                Importar ({totalImportando} {totalImportando === 1 ? 'item' : 'itens'})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
