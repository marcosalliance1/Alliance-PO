import React from 'react'
import { X, Calendar, Loader2, AlertTriangle, Sparkles, Download } from 'lucide-react'
import type { InfoEvento } from '../../types'
import { useEventoOperacional } from '../../hooks/useEventoOperacional'

interface Props {
  turma: string
  onImportar: (info: InfoEvento) => void
  onFechar: () => void
}

export const ModalImportarEvento: React.FC<Props> = ({ turma, onImportar, onFechar }) => {
  const { conectado, logando, conectar, abas, abaSelecionada, setAbaSelecionada, detalhes, carregando, erro, autoCasou } =
    useEventoOperacional(turma, true)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-surface border border-bordercol rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-bordercol shrink-0">
          <h2 className="text-white font-semibold flex items-center gap-2"><Download className="w-5 h-5 text-accent" /> Importar da planilha</h2>
          <button onClick={onFechar} className="text-muted hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {!conectado ? (
            <div className="text-center py-8">
              <Calendar className="w-8 h-8 text-accent mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Conectar ao Google</p>
              <p className="text-xs text-muted mb-4">Pra ler a planilha "Operacional" do Drive.</p>
              <button onClick={conectar} disabled={logando}
                className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors">
                {logando ? 'Conectando...' : 'Conectar Google'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted shrink-0">Aba:</span>
                <select value={abaSelecionada} onChange={e => setAbaSelecionada(e.target.value)}
                  className="flex-1 min-w-[180px] bg-surface-2 border border-bordercol rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent">
                  <option value="">— escolher a aba —</option>
                  {abas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {autoCasou && abaSelecionada && <span className="inline-flex items-center gap-1 text-[11px] text-success shrink-0"><Sparkles className="w-3 h-3" /> casou</span>}
                {carregando && <Loader2 className="w-4 h-4 animate-spin text-muted shrink-0" />}
              </div>

              {erro && (
                <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{erro}</span>
                </div>
              )}

              {detalhes && (
                <div className="bg-surface-2 border border-bordercol/50 rounded-lg p-3 text-xs text-muted space-y-1">
                  <p className="text-white font-medium text-sm">{detalhes.nomeEvento || abaSelecionada}</p>
                  {detalhes.data && <p>📅 {detalhes.data} {detalhes.diaSemana && `· ${detalhes.diaSemana}`}</p>}
                  {detalhes.local && <p>📍 {detalhes.local}</p>}
                  <p>🎵 {detalhes.lineup.length} atração(ões) · 👥 {detalhes.fornecedores.filter(f => f.fornecedor).length} fornecedor(es)</p>
                  <p className="text-warning mt-1">Isso vai substituir a Info do Evento atual deste orçamento.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-bordercol shrink-0">
          <button onClick={onFechar} className="text-sm text-muted hover:text-white transition-colors">Cancelar</button>
          <button onClick={() => detalhes && onImportar(detalhes)} disabled={!detalhes}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors">
            Usar esses dados
          </button>
        </div>
      </div>
    </div>
  )
}
