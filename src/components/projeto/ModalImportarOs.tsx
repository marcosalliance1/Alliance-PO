import React, { useMemo, useRef, useState } from 'react'
import { FileUp, X, AlertTriangle, Loader2 } from 'lucide-react'
import type { Projeto, InfoEvento } from '../../types'
import type { OsLida } from '../../lib/lerOsPdf'
import { lerOsPdf, OsInvalidaErro } from '../../lib/lerOsPdfNavegador'
import { propostaCampos, mesclarFornecedores, mesclarLineup, divergencias, type CampoOs } from '../../lib/aplicarOsInfoEvento'

interface Props {
  projeto: Projeto
  info: InfoEvento
  onAplicar: (info: InfoEvento) => void
  onFechar: () => void
}

type Modo = 'mesclar' | 'substituir'
const MAX_BYTES = 15 * 1024 * 1024

export const ModalImportarOs: React.FC<Props> = ({ projeto, info, onAplicar, onFechar }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState('')
  const [os, setOs] = useState<OsLida | null>(null)
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  const [modoForn, setModoForn] = useState<Modo>('mesclar')
  const [modoLine, setModoLine] = useState<Modo>('mesclar')
  const [usarForn, setUsarForn] = useState(true)
  const [usarLine, setUsarLine] = useState(true)

  const campos = useMemo(() => (os ? propostaCampos(info, os) : []), [os, info])
  const forn = useMemo(() => (os ? mesclarFornecedores(info.fornecedores, os.fornecedores, modoForn) : null), [os, info, modoForn])
  const line = useMemo(() => (os ? mesclarLineup(info.lineup, os.lineup, modoLine) : null), [os, info, modoLine])
  const diverge = useMemo(() => (os ? divergencias(os, { convidadosSistema: projeto.totalConvidadosAtual, dataEventoIso: projeto.tap.dataEvento }) : []), [os, projeto])

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErro(''); setOs(null)
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { setErro('Escolha um arquivo PDF.'); return }
    if (file.size > MAX_BYTES) { setErro('PDF muito grande (máx. 15 MB).'); return }
    setLendo(true)
    try {
      const lida = await lerOsPdf(await file.arrayBuffer())
      setOs(lida)
      const m: Record<string, boolean> = {}
      for (const c of propostaCampos(info, lida)) m[c.campo] = c.aplicarPadrao
      setMarcados(m)
    } catch (err) {
      setErro(err instanceof OsInvalidaErro ? err.message : 'Não consegui ler este PDF.')
    } finally {
      setLendo(false)
    }
  }

  function aplicar() {
    if (!os) return
    const patch: Partial<InfoEvento> = {}
    for (const c of campos) if (marcados[c.campo]) patch[c.campo as CampoOs] = c.novo
    if (usarForn && forn) patch.fornecedores = forn.lista
    if (usarLine && line) patch.lineup = line.lista
    onAplicar({ ...info, ...patch })
  }

  const btn = 'px-3 py-2 rounded-lg text-sm font-medium transition-colors'
  const selCls = 'bg-surface border border-bordercol rounded px-2 py-1 text-xs text-white outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div className="bg-surface-2 border border-bordercol rounded-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-white font-semibold text-sm flex items-center gap-2"><FileUp className="w-4 h-4 text-accent" /> Importar OS (PDF)</h3>
            <p className="text-xs text-muted mt-1">Lê o PDF da Ordem de Serviço neste computador. Nada é gravado até você confirmar.</p>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-white shrink-0" title="Fechar"><X className="w-4 h-4" /></button>
        </div>

        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={escolher} />
        {!os && (
          <button onClick={() => inputRef.current?.click()} disabled={lendo}
            className={`${btn} w-full border border-dashed border-bordercol text-muted hover:text-accent hover:border-accent/50 py-6 flex items-center justify-center gap-2`}>
            {lendo ? <><Loader2 className="w-4 h-4 animate-spin" /> Lendo o PDF…</> : <><FileUp className="w-4 h-4" /> Escolher o PDF da OS</>}
          </button>
        )}
        {erro && <p className="mt-3 text-xs text-danger flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{erro}</p>}

        {os && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              OS <b className="text-white">{os.numeroOs || '—'}</b>{os.versao ? ` · v${os.versao}` : ''} — {os.fornecedores.length} fornecedores, {os.lineup.length} atrações
              {os.mesas != null ? `, ${os.mesas} mesas` : ''}.{' '}
              <button onClick={() => { setOs(null); setErro('') }} className="text-accent hover:underline">trocar arquivo</button>
            </p>

            {(os.avisos.length > 0 || diverge.length > 0) && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-1">
                {[...os.avisos, ...diverge].map((a, i) => (
                  <p key={i} className="text-xs text-warning flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{a}</p>
                ))}
              </div>
            )}

            {/* campos */}
            <div>
              <h4 className="text-white text-xs font-semibold mb-2">Dados do evento</h4>
              {campos.length === 0 ? <p className="text-xs text-muted">Os campos da aba já estão iguais à OS.</p> : (
                <div className="space-y-1.5">
                  {campos.map((c) => (
                    <label key={c.campo} className="flex items-start gap-2 text-xs cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={!!marcados[c.campo]} onChange={(e) => setMarcados({ ...marcados, [c.campo]: e.target.checked })} />
                      <span className="text-muted w-28 shrink-0">{c.rotulo}</span>
                      <span className="text-white">{c.novo}</span>
                      {c.atual && <span className="text-warning">(hoje: {c.atual} — será trocado se marcar)</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* fornecedores */}
            <div>
              <label className="flex items-center gap-2 text-xs text-white font-semibold cursor-pointer">
                <input type="checkbox" checked={usarForn} onChange={(e) => setUsarForn(e.target.checked)} /> Fornecedores ({os.fornecedores.length} na OS)
              </label>
              {usarForn && forn && (
                <div className="mt-1.5 ml-5 space-y-1.5">
                  <select className={selCls} value={modoForn} onChange={(e) => setModoForn(e.target.value as Modo)}>
                    <option value="mesclar">Mesclar: manter os que já existem e acrescentar os que faltam</option>
                    <option value="substituir">Substituir a lista inteira pela da OS</option>
                  </select>
                  <p className="text-[11px] text-muted">
                    {modoForn === 'mesclar' ? `${forn.resumo.novos} novo(s), ${forn.resumo.atualizados} corrigido(s), ${info.fornecedores.length - forn.resumo.atualizados} mantido(s) como estão.` : `A lista atual (${info.fornecedores.length}) será trocada.`}
                    {' '}Entram como "fechado".
                  </p>
                </div>
              )}
            </div>

            {/* lineup */}
            <div>
              <label className="flex items-center gap-2 text-xs text-white font-semibold cursor-pointer">
                <input type="checkbox" checked={usarLine} onChange={(e) => setUsarLine(e.target.checked)} /> Lineup ({os.lineup.length} na OS)
              </label>
              {usarLine && line && (
                <div className="mt-1.5 ml-5 space-y-1.5">
                  <select className={selCls} value={modoLine} onChange={(e) => setModoLine(e.target.value as Modo)}>
                    <option value="mesclar">Mesclar: manter as atrações existentes (rider e situação) e ajustar horários</option>
                    <option value="substituir">Substituir o lineup inteiro pelo da OS</option>
                  </select>
                  <p className="text-[11px] text-muted">
                    {modoLine === 'mesclar' ? `${line.resumo.novos} novas, ${line.resumo.atualizados} com horário ajustado.` : `O lineup atual (${info.lineup.length}) será trocado (anexos de rider serão perdidos).`}
                  </p>
                  <div className="text-[11px] text-muted">{os.lineup.map((l) => `${l.inicio}–${l.fim} ${l.atracao}`).join(' · ')}</div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted">Pagantes, Bolsa Folia, Adimplência, Venda de Convite e Link de venda não vêm da OS e continuam como estão.</p>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onFechar} className={`${btn} text-muted hover:text-white`}>Cancelar</button>
              <button onClick={aplicar} className={`${btn} bg-accent text-white hover:opacity-90`}>Aplicar na aba</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
