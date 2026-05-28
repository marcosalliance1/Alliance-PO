import { useState, useMemo } from 'react'
import type { ItemCatalogo, TipoEscola } from '../types'
import { Header } from '../components/layout/Header'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { formatBRL } from '../utils/formatters'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Pencil, EyeOff, Eye, Search } from 'lucide-react'

// -- Busca fuzzy ------------------------------------------------------------------

function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyMatch(query: string, item: ItemCatalogo): boolean {
  const alvo = normText(
    [item.item, item.subcategoria, item.area, item.fornecedorPadrao].join(' '),
  )
  const palavras = normText(query).split(' ').filter(Boolean)
  return palavras.every((p) => alvo.includes(p))
}

interface BancoDeItensProps {
  itens: ItemCatalogo[]
  onAdicionar: (item: Omit<ItemCatalogo, 'id'>) => void
  onAtualizar: (id: string, changes: Partial<ItemCatalogo>) => void
  onDesativar: (id: string) => void
  onReativar: (id: string) => void
}

const INPUT = 'w-full bg-surface border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary'

function ItemForm({ inicial, onSave, onCancel }: {
  inicial: Partial<ItemCatalogo>
  onSave: (d: Omit<ItemCatalogo, 'id'>) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<Omit<ItemCatalogo, 'id'>>({
    codigo: inicial.codigo ?? '',
    area: inicial.area ?? '',
    subcategoria: inicial.subcategoria ?? '',
    item: inicial.item ?? '',
    fornecedorPadrao: inicial.fornecedorPadrao ?? '',
    tipoCusto: inicial.tipoCusto ?? 'Custo Fixo',
    valorUnitarioReferencia: inicial.valorUnitarioReferencia ?? 0,
    secaoAplicavel: inicial.secaoAplicavel ?? [],
    tiposEscolaAplicavel: inicial.tiposEscolaAplicavel ?? ['FUNDAMENTAL', 'MEDIO', 'SUPERIOR'],
    ativo: inicial.ativo ?? true,
  })

  function toggleTipo(t: TipoEscola) {
    const cur = d.tiposEscolaAplicavel
    setD({ ...d, tiposEscolaAplicavel: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-muted mb-1 block">Area</label>
          <input className={INPUT} value={d.area} onChange={(e) => setD({ ...d, area: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Sub Categoria</label>
          <input className={INPUT} value={d.subcategoria} onChange={(e) => setD({ ...d, subcategoria: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-text-muted mb-1 block">Item</label>
          <input className={INPUT} value={d.item} onChange={(e) => setD({ ...d, item: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Fornecedor Padrao</label>
          <input className={INPUT} value={d.fornecedorPadrao} onChange={(e) => setD({ ...d, fornecedorPadrao: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Tipo de Custo</label>
          <select className={INPUT} value={d.tipoCusto} onChange={(e) => setD({ ...d, tipoCusto: e.target.value as ItemCatalogo['tipoCusto'] })}>
            <option>Custo Fixo</option>
            <option>Custo Variavel</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Valor Ref. (R$)</label>
          <input type="number" className={INPUT} value={d.valorUnitarioReferencia || ''} onChange={(e) => setD({ ...d, valorUnitarioReferencia: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Secoes (ex: 2.1, 2.3)</label>
          <input className={INPUT} value={d.secaoAplicavel.join(', ')} onChange={(e) => setD({ ...d, secaoAplicavel: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </div>
      </div>
      <div>
        <label className="text-xs text-text-muted mb-2 block">Tipos de Escola</label>
        <div className="flex gap-3">
          {(['FUNDAMENTAL', 'MEDIO', 'SUPERIOR'] as TipoEscola[]).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={d.tiposEscolaAplicavel.includes(t)}
                onChange={() => toggleTipo(t)}
                className="accent-primary"
              />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(d)}>Salvar</button>
      </div>
    </div>
  )
}

export function BancoDeItens({ itens, onAdicionar, onAtualizar, onDesativar, onReativar }: BancoDeItensProps) {
  const { isAdmin } = useAuth()
  const [filtroSecao, setFiltroSecao] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoEscola | ''>('')
  const [showInativos, setShowInativos] = useState(false)
  const [busca, setBusca] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [editando, setEditando] = useState<ItemCatalogo | null>(null)
  const [desativando, setDesativando] = useState<string | null>(null)

  const secoes = useMemo(() => {
    const set = new Set<string>()
    itens.forEach((i) => i.secaoAplicavel.forEach((s) => set.add(s)))
    return Array.from(set).sort()
  }, [itens])

  const filtrados = useMemo(() => {
    return itens.filter((i) => {
      if (!showInativos && !i.ativo) return false
      if (filtroSecao && !i.secaoAplicavel.includes(filtroSecao)) return false
      if (filtroTipo && !i.tiposEscolaAplicavel.includes(filtroTipo)) return false
      if (busca && !fuzzyMatch(busca, i)) return false
      return true
    })
  }, [itens, filtroSecao, filtroTipo, showInativos, busca])

  const SELECT = 'bg-surface border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary'

  return (
    <div>
      <Header
        title="Banco de Itens"
        subtitle={`${itens.filter((i) => i.ativo).length} itens ativos`}
        actions={
          isAdmin ? (
            <button className="btn-primary flex items-center gap-2" onClick={() => setModalNovo(true)}>
              <Plus size={15} /> Novo Item
            </button>
          ) : undefined
        }
      />

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar item, sub cat., area... (ignora acentos e hifens)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-inner pl-8 pr-3 py-2 text-sm text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-xs"
            >
              x
            </button>
          )}
        </div>

        <select className={SELECT} value={filtroSecao} onChange={(e) => setFiltroSecao(e.target.value)}>
          <option value="">Todas as secoes</option>
          {secoes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={SELECT} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as TipoEscola | '')}>
          <option value="">Todos os tipos</option>
          <option value="FUNDAMENTAL">Fundamental</option>
          <option value="MEDIO">Medio</option>
          <option value="SUPERIOR">Superior</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
          <input type="checkbox" checked={showInativos} onChange={(e) => setShowInativos(e.target.checked)} className="accent-primary" />
          Mostrar inativos
        </label>

        {busca && (
          <span className="text-xs text-text-muted">
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''} para <span className="text-primary">"{busca}"</span>
          </span>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-white/10">
              <th className="text-left px-4 py-2.5 text-text-muted font-medium text-xs">Area</th>
              <th className="text-left px-4 py-2.5 text-text-muted font-medium text-xs">Sub Cat.</th>
              <th className="text-left px-4 py-2.5 text-text-muted font-medium text-xs">Item</th>
              <th className="text-left px-4 py-2.5 text-text-muted font-medium text-xs">Fornecedor</th>
              <th className="text-left px-4 py-2.5 text-text-muted font-medium text-xs">Tipo</th>
              <th className="text-right px-4 py-2.5 text-text-muted font-medium text-xs">Vlr. Ref.</th>
              <th className="text-left px-4 py-2.5 text-text-muted font-medium text-xs">Secoes</th>
              <th className="text-center px-4 py-2.5 text-text-muted font-medium text-xs">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-white/5 hover:bg-white/5 ${!item.ativo ? 'opacity-40' : ''}`}
              >
                <td className="px-4 py-2 text-text-muted text-xs">{item.area}</td>
                <td className="px-4 py-2 text-text-muted text-xs">{item.subcategoria}</td>
                <td className="px-4 py-2 text-text-main">{item.item}</td>
                <td className="px-4 py-2 text-text-muted text-xs">{item.fornecedorPadrao || '-'}</td>
                <td className="px-4 py-2 text-xs text-text-muted">{item.tipoCusto}</td>
                <td className="px-4 py-2 text-right text-xs text-text-muted">
                  {item.valorUnitarioReferencia ? formatBRL(item.valorUnitarioReferencia) : '-'}
                </td>
                <td className="px-4 py-2 text-xs text-text-muted">{item.secaoAplicavel.join(', ')}</td>
                {isAdmin && (
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="text-text-muted hover:text-primary" onClick={() => setEditando(item)} title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button
                        className={`text-text-muted ${item.ativo ? 'hover:text-danger' : 'hover:text-success'}`}
                        onClick={() => item.ativo ? setDesativando(item.id) : onReativar(item.id)}
                        title={item.ativo ? 'Desativar' : 'Reativar'}
                      >
                        {item.ativo ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted text-sm">Nenhum item encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <Modal open={modalNovo} onClose={() => setModalNovo(false)} title="Novo Item">
          <ItemForm
            inicial={{}}
            onSave={(d) => { onAdicionar(d); setModalNovo(false) }}
            onCancel={() => setModalNovo(false)}
          />
        </Modal>
      )}

      {isAdmin && (
        <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar Item">
          {editando && (
            <ItemForm
              inicial={editando}
              onSave={(d) => { onAtualizar(editando.id, d); setEditando(null) }}
              onCancel={() => setEditando(null)}
            />
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={!!desativando}
        title="Desativar item"
        message="O item sera ocultado do banco. Voce pode reativa-lo depois."
        confirmLabel="Desativar"
        onConfirm={() => { if (desativando) { onDesativar(desativando); setDesativando(null) } }}
        onCancel={() => setDesativando(null)}
      />
    </div>
  )
}