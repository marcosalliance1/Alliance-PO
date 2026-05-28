import React, { useState } from 'react'
import { Save, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { useAppContext } from '../../contexts/AppContext'
import type { ConfiguracaoAutomacoes, LinhaTabelaQtde, TipoEvento } from '../../types'

const TIPO_EVENTOS: TipoEvento[] = ['MICRO EVENTO', 'PRE-EVENTO', 'PEQUENO BAILE', 'GRANDE BAILE']

const inputCls = 'w-full bg-surface border border-bordercol rounded px-2 py-1 text-white text-xs outline-none focus:border-accent transition-colors text-right'

// ─── Tabela de qtde convidados → quantidade ───────────────────────────────────
const TabelaQtde: React.FC<{
  title: string
  rows: LinhaTabelaQtde[]
  custo?: number
  onChangeRows: (rows: LinhaTabelaQtde[]) => void
  onChangeCusto?: (v: number) => void
}> = ({ title, rows, custo, onChangeRows, onChangeCusto }) => (
  <div className="bg-surface2/30 border border-bordercol/50 rounded-lg p-4">
    <h4 className="text-white text-sm font-semibold mb-3">{title}</h4>
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted">
          <th className="text-left pb-2">Convidados</th>
          <th className="text-right pb-2">Quantidade</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-bordercol/30">
            <td className="py-1 pr-2">
              <input type="number" className={inputCls + ' text-left'}
                value={r.convidados}
                onChange={e => { const n = [...rows]; n[i] = { ...r, convidados: Number(e.target.value) }; onChangeRows(n) }}
              />
            </td>
            <td className="py-1">
              <input type="number" className={inputCls}
                value={r.quantidade}
                onChange={e => { const n = [...rows]; n[i] = { ...r, quantidade: Number(e.target.value) }; onChangeRows(n) }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {onChangeCusto !== undefined && (
      <div className="mt-3 pt-3 border-t border-bordercol/30 flex items-center justify-between">
        <span className="text-muted text-xs">Custo Unitário (R$)</span>
        <input type="number" min={0} step="0.01" className={`${inputCls} w-28`}
          value={custo ?? 0}
          onChange={e => onChangeCusto(Number(e.target.value))}
        />
      </div>
    )}
  </div>
)

// ─── Seção Fornecedores ───────────────────────────────────────────────────────
const SecaoFornecedores: React.FC = () => {
  const { fornecedores, adicionarFornecedor, removerFornecedor, addToast, confirm } = useAppContext()
  const [novoNome, setNovoNome] = useState('')

  function handleAdicionar() {
    const nome = novoNome.trim()
    if (!nome) return
    adicionarFornecedor(nome)
    setNovoNome('')
    addToast(`Fornecedor "${nome}" adicionado.`, 'success')
  }

  function handleRemover(nome: string) {
    confirm(`Remover "${nome}" da lista de fornecedores?`, () => {
      removerFornecedor(nome)
      addToast(`Fornecedor "${nome}" removido.`, 'info')
    })
  }

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-1 h-6 bg-accent rounded-full" />
        <h3 className="text-white font-semibold">Fornecedores</h3>
        <span className="text-muted text-xs ml-auto">{fornecedores.length} cadastrado(s)</span>
      </div>

      {/* Add new */}
      <div className="flex gap-2 mb-4">
        <input
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
          placeholder="Nome do fornecedor..."
          className="flex-1 bg-surface border border-bordercol rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={handleAdicionar}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      {/* List */}
      {fornecedores.length === 0 ? (
        <p className="text-muted text-sm text-center py-6">Nenhum fornecedor cadastrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
          {fornecedores.map(f => (
            <div key={f} className="flex items-center justify-between bg-surface2/40 border border-bordercol/40 rounded-lg px-3 py-2 group">
              <span className="text-white text-sm truncate">{f}</span>
              <button
                onClick={() => handleRemover(f)}
                className="text-muted hover:text-danger transition-colors ml-2 shrink-0 opacity-0 group-hover:opacity-100"
                title="Remover"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export const ConfiguracoesPage: React.FC = () => {
  const { config, salvarConfig, resetarConfig, addToast, confirm } = useAppContext()
  const [local, setLocal] = useState<ConfiguracaoAutomacoes>({ ...config })

  function update<K extends keyof ConfiguracaoAutomacoes>(key: K, val: ConfiguracaoAutomacoes[K]) {
    setLocal(prev => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    salvarConfig(local)
    addToast('Configurações salvas!', 'success')
  }

  function handleReset() {
    confirm('Restaurar todas as configurações para os valores padrão?', () => {
      resetarConfig()
      setLocal({ ...config })
      addToast('Configurações restauradas.', 'info')
    })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-lg">Configurações</h2>
          <p className="text-muted text-sm">Tabelas base para automações de equipe e cadastro de fornecedores</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Restaurar Padrão
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>

      {/* Fornecedores */}
      <SecaoFornecedores />

      {/* Tabelas de qtde */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1 h-6 bg-accent rounded-full" />
          <h3 className="text-white font-semibold">Automações por Quantidade de Convidados</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TabelaQtde title="Segurança"  rows={local.seguranca}  custo={local.custoSeguranca}
            onChangeRows={rows => update('seguranca', rows)}  onChangeCusto={v => update('custoSeguranca', v)} />
          <TabelaQtde title="Brigadista" rows={local.brigadista} custo={local.custoBrigadista}
            onChangeRows={rows => update('brigadista', rows)} onChangeCusto={v => update('custoBrigadista', v)} />
          <TabelaQtde title="Limpeza"    rows={local.limpeza}    custo={local.custoLimpeza}
            onChangeRows={rows => update('limpeza', rows)}    onChangeCusto={v => update('custoLimpeza', v)} />
          <TabelaQtde title="Hostess"    rows={local.hostess}    custo={local.custoHostess}
            onChangeRows={rows => update('hostess', rows)}    onChangeCusto={v => update('custoHostess', v)} />
          {/* Carregador: sempre 2, só custo */}
          <div className="bg-surface2/30 border border-bordercol/50 rounded-lg p-4">
            <h4 className="text-white text-sm font-semibold mb-3">Carregador</h4>
            <p className="text-muted text-xs mb-2">Quantidade fixa: 2 por evento</p>
            <div className="flex items-center justify-between">
              <span className="text-muted text-xs">Custo Unitário (R$)</span>
              <input type="number" min={0} step="0.01" className={`${inputCls} w-28`}
                value={local.custoCarregador}
                onChange={e => update('custoCarregador', Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Equipe por tipo de evento */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-1 h-6 bg-accent rounded-full" />
          <h3 className="text-white font-semibold">Equipe por Tipo de Evento</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TIPO_EVENTOS.map(tipo => (
            <div key={tipo} className="bg-surface2/30 border border-bordercol/50 rounded-lg p-4">
              <h4 className="text-white text-sm font-semibold mb-3">{tipo}</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left pb-2">Cargo</th>
                    <th className="text-right pb-2 w-12">Qtde</th>
                    <th className="text-right pb-2 w-24">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {(local.equipeEvento[tipo] ?? []).map((e, i) => (
                    <tr key={i} className="border-t border-bordercol/30">
                      <td className="py-1 pr-2">
                        <input className={`${inputCls} text-left`} value={e.cargo}
                          onChange={ev => {
                            const next = [...(local.equipeEvento[tipo] ?? [])]
                            next[i] = { ...e, cargo: ev.target.value }
                            update('equipeEvento', { ...local.equipeEvento, [tipo]: next })
                          }} />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" min={0} className={inputCls} value={e.qtde}
                          onChange={ev => {
                            const next = [...(local.equipeEvento[tipo] ?? [])]
                            next[i] = { ...e, qtde: Number(ev.target.value) }
                            update('equipeEvento', { ...local.equipeEvento, [tipo]: next })
                          }} />
                      </td>
                      <td className="py-1">
                        <input type="number" min={0} step="0.01" className={inputCls} value={e.valor}
                          onChange={ev => {
                            const next = [...(local.equipeEvento[tipo] ?? [])]
                            next[i] = { ...e, valor: Number(ev.target.value) }
                            update('equipeEvento', { ...local.equipeEvento, [tipo]: next })
                          }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
