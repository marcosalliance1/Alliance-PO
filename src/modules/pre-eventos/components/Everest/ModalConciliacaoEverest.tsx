import React, { useMemo, useState, useEffect } from 'react'
import { X, AlertTriangle, Database, Loader2, HelpCircle, Search, Sparkles, Plus, Trash2, Scissors } from 'lucide-react'
import type { Orcamento, ItemOrcamento } from '../../types'
import { formatBRL, formatDate } from '../../utils/formatters'
import CampoMoeda from '../UI/CampoMoeda'
import { useCapEverest } from '../../hooks/useCapEverest'
import {
  agruparPorFornecedor, sugerirItemPara, dividirProporcional, SECOES,
  type DestinoEverest, type FornecedorEverest, type SecaoKeyEverest,
} from '../../utils/matchEverest'
import { carregarDepara, type DeparaEntry } from '../../utils/deparaEverest'

interface Props {
  orc: Orcamento
  onAplicar: (grupos: FornecedorEverest[], destinos: Record<string, DestinoEverest>) => void
  onFechar: () => void
}

const round2 = (n: number) => Math.round(n * 100) / 100

export const ModalConciliacaoEverest: React.FC<Props> = ({ orc, onAplicar, onFechar }) => {
  const { titulos, loading, erro, contaAlvo, semConta } = useCapEverest(orc.turma, orc.tipo, true)
  const grupos = useMemo(() => agruparPorFornecedor(titulos), [titulos])
  const [destinos, setDestinos] = useState<Record<string, DestinoEverest>>({})
  const [autoSet, setAutoSet] = useState<Set<string>>(new Set())
  const [depara, setDepara] = useState<Map<string, DeparaEntry>>(new Map())

  useEffect(() => { carregarDepara().then(setDepara) }, [])

  const itensDoOrcamento = useMemo(
    () => SECOES.map(s => ({ label: s.label, itens: orc[s.key] as ItemOrcamento[] })),
    [orc],
  )
  const itemById = useMemo(() => {
    const m = new Map<string, ItemOrcamento>()
    for (const s of SECOES) for (const it of orc[s.key]) m.set(it.id, it)
    return m
  }, [orc])

  // Pré-preenche: 1º pela memória (de-para fornecedor→item), 2º casando por
  // fornecedor já anotado no item.
  useEffect(() => {
    const inicial: Record<string, DestinoEverest> = {}
    const autos = new Set<string>()
    const idPorNome = new Map<string, string>()
    for (const s of SECOES) for (const it of orc[s.key]) {
      const k = it.item.trim().toLowerCase()
      if (k && !idPorNome.has(k)) idPorNome.set(k, it.id)
    }
    for (const g of grupos) {
      const dp = depara.get(g.fornecedor)
      const viaNome = dp ? idPorNome.get(dp.itemNome.trim().toLowerCase()) : undefined
      const viaFornecedor = sugerirItemPara(g.fornecedor, orc)
      if (viaNome) { inicial[g.fornecedor] = { tipo: 'item', itemId: viaNome }; autos.add(g.fornecedor) }
      else if (dp?.secao) { inicial[g.fornecedor] = { tipo: 'novo', nome: dp.itemNome, secao: dp.secao }; autos.add(g.fornecedor) }
      else if (viaFornecedor) { inicial[g.fornecedor] = { tipo: 'item', itemId: viaFornecedor }; autos.add(g.fornecedor) }
      else inicial[g.fornecedor] = { tipo: 'ignorar' }
    }
    setDestinos(inicial)
    setAutoSet(autos)
  }, [grupos, orc, depara])

  const setDestino = (fornecedor: string, d: DestinoEverest) => setDestinos(prev => ({ ...prev, [fornecedor]: d }))

  const totalEverest = grupos.reduce((s, g) => s + g.total, 0)
  const destinoAtivo = (d: DestinoEverest | undefined) =>
    !!d && d.tipo !== 'ignorar' && (d.tipo !== 'dividir' || d.partes.some(p => p.itemId && p.valor))
  const nAssociar = grupos.filter(g => destinoAtivo(destinos[g.fornecedor])).length
  const nAuto = grupos.filter(g => autoSet.has(g.fornecedor) && destinoAtivo(destinos[g.fornecedor])).length

  // ── Handlers de divisão ──
  const setPartes = (fornecedor: string, partes: { itemId: string; valor: number }[]) =>
    setDestino(fornecedor, { tipo: 'dividir', partes })
  const dividirAuto = (g: FornecedorEverest, partes: { itemId: string; valor: number }[]) => {
    const comItem = partes.filter(p => p.itemId)
    if (comItem.length === 0) return
    const distrib = dividirProporcional(g.total, comItem.map(p => ({ itemId: p.itemId, peso: itemById.get(p.itemId)?.totalOrcado ?? 0 })))
    setPartes(g.fornecedor, distrib)
  }

  const pronto = !loading && !erro && !semConta && grupos.length > 0

  const seletorItens = (value: string, onChange: (id: string) => void) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs bg-surface border border-bordercol rounded px-2 py-1.5 text-white outline-none focus:border-accent transition-colors"
    >
      <option value="">— item —</option>
      {itensDoOrcamento.map(secao => (
        <optgroup key={secao.label} label={secao.label}>
          {secao.itens.map(it => <option key={it.id} value={it.id}>{it.item || '(sem nome)'}</option>)}
        </optgroup>
      ))}
    </select>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-surface border border-bordercol rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bordercol shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Database className="w-5 h-5 text-accent shrink-0" />
            <div className="min-w-0">
              <h2 className="text-white font-semibold truncate">Associar custos do Everest</h2>
              <p className="text-[11px] text-muted">
                Centro de custo: <span className="text-gray-300">{orc.turma || '—'}</span>
                {contaAlvo && <> · Conta: <span className="text-gray-300">{contaAlvo}</span></>}
              </p>
            </div>
          </div>
          <button onClick={onFechar} className="text-muted hover:text-white transition-colors shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {semConta && (
            <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg p-3">
              <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>O tipo <b>Festa de Integração</b> não tem conta gerencial no Everest — nada a associar.</span>
            </div>
          )}
          {erro && (
            <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{erro}</span>
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-3 text-muted py-12">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Buscando lançamentos no Everest...</span>
            </div>
          )}
          {!loading && !erro && !semConta && grupos.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 text-muted py-12">
              <Search className="w-6 h-6" />
              <p className="text-sm">Nenhum título encontrado no Everest para <b>{orc.turma}</b> / {contaAlvo}.</p>
              <p className="text-xs">Confira se a turma está escrita como no Everest.</p>
            </div>
          )}

          {pronto && (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
                <p className="text-muted"><b className="text-white">{grupos.length}</b> fornecedores · <b className="text-white">{formatBRL(totalEverest)}</b> no Everest</p>
                {nAuto > 0 && (
                  <p className="flex items-center gap-1.5 text-success"><Sparkles className="w-3.5 h-3.5" /> {nAuto} pré-associado{nAuto !== 1 ? 's' : ''}</p>
                )}
              </div>

              <div className="space-y-2">
                {grupos.map(g => {
                  const d = destinos[g.fornecedor] ?? { tipo: 'ignorar' as const }
                  const foiAuto = autoSet.has(g.fornecedor) && destinoAtivo(d)
                  return (
                    <div key={g.fornecedor} className="bg-surface2/40 border border-bordercol/50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">{g.fornecedor}</span>
                            {foiAuto && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-success border border-success/30 bg-success/10 rounded px-1.5 py-0.5"><Sparkles className="w-2.5 h-2.5" /> auto</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted mt-0.5">
                            <span className="text-gray-300 font-medium">{formatBRL(g.total)}</span>
                            {' · '}{g.titulos.length} título{g.titulos.length !== 1 ? 's' : ''}
                            {g.ultimoVencimento && <> · venc. {formatDate(g.ultimoVencimento)}</>}
                            {' · '}{g.situacao === 'PAGO' ? 'pago' : 'em aberto'}
                          </p>
                        </div>
                        <select
                          value={d.tipo}
                          onChange={e => {
                            const modo = e.target.value as DestinoEverest['tipo']
                            if (modo === 'ignorar') setDestino(g.fornecedor, { tipo: 'ignorar' })
                            else if (modo === 'item') setDestino(g.fornecedor, { tipo: 'item', itemId: '' })
                            else if (modo === 'novo') setDestino(g.fornecedor, { tipo: 'novo', nome: g.fornecedor, secao: 'operacaoEstrutura' })
                            else setDestino(g.fornecedor, { tipo: 'dividir', partes: [{ itemId: '', valor: 0 }] })
                          }}
                          className="text-xs bg-surface border border-bordercol rounded px-2 py-1.5 text-white outline-none focus:border-accent transition-colors shrink-0"
                        >
                          <option value="ignorar">Ignorar</option>
                          <option value="item">Associar a item</option>
                          <option value="novo">Criar novo item</option>
                          <option value="dividir">Dividir entre itens</option>
                        </select>
                      </div>

                      {d.tipo === 'item' && (
                        <div className="mt-2">{seletorItens(d.itemId, id => setDestino(g.fornecedor, { tipo: 'item', itemId: id }))}<span className="sr-only">item</span></div>
                      )}

                      {d.tipo === 'novo' && (
                        <div className="flex gap-2 mt-2">
                          <input value={d.nome} onChange={e => setDestino(g.fornecedor, { ...d, nome: e.target.value })} placeholder="Nome do item"
                            className="flex-1 text-xs bg-surface border border-bordercol rounded px-2 py-1.5 text-white outline-none focus:border-accent transition-colors" />
                          <select value={d.secao} onChange={e => setDestino(g.fornecedor, { ...d, secao: e.target.value as SecaoKeyEverest })}
                            className="text-xs bg-surface border border-bordercol rounded px-2 py-1.5 text-white outline-none focus:border-accent transition-colors shrink-0">
                            {SECOES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </div>
                      )}

                      {d.tipo === 'dividir' && (() => {
                        const soma = d.partes.reduce((s, p) => s + (p.valor || 0), 0)
                        const resto = round2(g.total - soma)
                        return (
                          <div className="mt-2 space-y-2 border-t border-bordercol/40 pt-2">
                            {d.partes.map((p, i) => (
                              <div key={i} className="flex items-center gap-2">
                                {seletorItens(p.itemId, id => {
                                  const partes = d.partes.map((x, j) => j === i ? { ...x, itemId: id } : x)
                                  setPartes(g.fornecedor, partes)
                                })}
                                <div className="w-32">
                                  <CampoMoeda value={p.valor} onChange={v => setPartes(g.fornecedor, d.partes.map((x, j) => j === i ? { ...x, valor: v } : x))}
                                    className="w-full bg-surface border border-bordercol rounded px-2 py-1.5 text-xs text-white text-right outline-none focus:border-accent" />
                                </div>
                                <button onClick={() => setPartes(g.fornecedor, d.partes.filter((_, j) => j !== i))}
                                  className="text-muted hover:text-danger transition-colors shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <button onClick={() => setPartes(g.fornecedor, [...d.partes, { itemId: '', valor: 0 }])}
                                  className="flex items-center gap-1 text-[11px] text-muted hover:text-white border border-bordercol rounded px-2 py-1 transition-colors"><Plus className="w-3 h-3" /> item</button>
                                <button onClick={() => dividirAuto(g, d.partes)}
                                  className="flex items-center gap-1 text-[11px] text-accent hover:text-white border border-accent/30 rounded px-2 py-1 transition-colors"><Scissors className="w-3 h-3" /> dividir proporcional</button>
                              </div>
                              <span className={`text-[11px] font-medium ${Math.abs(resto) < 0.01 ? 'text-success' : 'text-warning'}`}>
                                {Math.abs(resto) < 0.01 ? 'fecha o total ✓' : `resta ${formatBRL(resto)}`}
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-bordercol shrink-0 gap-3">
          <p className="text-[11px] text-muted">Preenche <span className="text-gray-300">Total Pago + Vencimento + Fornecedor</span> nos itens associados.</p>
          <div className="flex items-center gap-3">
            <button onClick={onFechar} className="text-sm text-muted hover:text-white transition-colors">Cancelar</button>
            <button onClick={() => onAplicar(grupos, destinos)} disabled={!pronto || nAssociar === 0}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold py-2 px-5 rounded-lg transition-colors">
              Associar ({nAssociar})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
