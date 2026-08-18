import React from 'react'
import { Calendar, Music, Users, Link2, Loader2, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react'
import type { Orcamento } from '../../types'
import { useEventoOperacional } from '../../hooks/useEventoOperacional'

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) =>
  value ? (
    <div className="bg-surface border border-bordercol/50 rounded-lg px-3 py-2">
      <p className="text-[10px] text-muted uppercase tracking-wide">{label}</p>
      <p className="text-sm text-white font-medium leading-snug">{value}</p>
    </div>
  ) : null

export const PainelEventoOperacional: React.FC<{ orc: Orcamento }> = ({ orc }) => {
  const { conectado, logando, conectar, abas, abaSelecionada, setAbaSelecionada, detalhes, carregando, erro, autoCasou } =
    useEventoOperacional(orc.turma, true)

  if (!conectado) {
    return (
      <div className="bg-surface-2 border border-bordercol rounded-card p-10 text-center">
        <Calendar className="w-8 h-8 text-accent mx-auto mb-3" />
        <p className="text-white font-semibold mb-1">Conectar ao Google</p>
        <p className="text-xs text-muted mb-5">Pra puxar as informações do evento da planilha do Drive.</p>
        <button onClick={conectar} disabled={logando}
          className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors">
          {logando ? 'Conectando...' : 'Conectar Google'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Seletor de aba */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted shrink-0">Aba do evento:</span>
        <select value={abaSelecionada} onChange={e => setAbaSelecionada(e.target.value)}
          className="bg-surface border border-bordercol rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent transition-colors flex-1 min-w-[200px]">
          <option value="">— escolher a aba —</option>
          {abas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {autoCasou && abaSelecionada && (
          <span className="inline-flex items-center gap-1 text-[11px] text-success shrink-0">
            <Sparkles className="w-3 h-3" /> casou pela turma
          </span>
        )}
        {carregando && <Loader2 className="w-4 h-4 animate-spin text-muted shrink-0" />}
      </div>

      {erro && (
        <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{erro}</span>
        </div>
      )}

      {!abaSelecionada && !carregando && (
        <p className="text-sm text-muted text-center py-6">Selecione a aba do evento desta turma acima.</p>
      )}

      {detalhes && (
        <>
          {/* Dados gerais */}
          <div className="bg-surface-2 border border-bordercol rounded-card p-5">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" /> {detalhes.nomeEvento || 'Dados do Evento'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              <Info label="Data" value={detalhes.data} />
              <Info label="Dia" value={detalhes.diaSemana} />
              <Info label="Local" value={detalhes.local} />
              <Info label="Horário" value={detalhes.horario} />
              <Info label="Temática" value={detalhes.tematica} />
              <Info label="Convidados" value={detalhes.totalConvidados} />
              <Info label="Formandos" value={detalhes.formandos} />
              <Info label="Pagantes" value={detalhes.pagantes} />
              <Info label="Bolsa Folia" value={detalhes.bolsaFolia} />
              <Info label="Adimplência" value={detalhes.dataAdimplencia} />
              <Info label="Venda de Convite" value={detalhes.vendaDeConvite} />
            </div>
          </div>

          {/* Lineup */}
          {detalhes.lineup.length > 0 && (
            <div className="bg-surface-2 border border-bordercol rounded-card p-5">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><Music className="w-4 h-4 text-accent" /> Lineup Artístico</h3>
              <div className="space-y-1.5">
                {detalhes.lineup.map((l, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm border-b border-bordercol/40 last:border-0 py-1.5">
                    {l.horario && <span className="text-muted text-xs w-16 shrink-0">{l.horario}</span>}
                    <span className="text-white flex-1">{l.artista}</span>
                    {l.obs && <span className="text-muted text-xs">{l.obs}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fornecedores */}
          <div className="bg-surface-2 border border-bordercol rounded-card p-5">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Fornecedores</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {detalhes.fornecedores.map(f => (
                <div key={f.categoria} className="flex items-center justify-between gap-2 bg-surface border border-bordercol/50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted uppercase">{f.categoria}</p>
                    <p className="text-sm text-white truncate">{f.fornecedor || '—'}</p>
                  </div>
                  <span className={`text-[10px] font-medium border rounded px-1.5 py-0.5 shrink-0 ${f.fechado ? 'text-success border-success/30 bg-success/10' : 'text-muted border-bordercol'}`}>
                    {f.fechado ? 'fechado' : 'em aberto'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          {detalhes.linkVenda && (
            <a href={detalhes.linkVenda} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 bg-surface-2 border border-bordercol rounded-card p-4 text-sm text-accent hover:bg-white/5 transition-colors">
              <Link2 className="w-4 h-4" /> Link de venda de convite <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </>
      )}
    </div>
  )
}
