import { useState, useMemo } from 'react'
import { useStorage } from '../../hooks/useStorage'
import { BANCO_ITENS_DEFAULT, NOMES_SECOES, ORDEM_SECOES } from '../../data/bancoItensDefault'
import { Plus, Search, Edit2, Trash2, RefreshCw } from 'lucide-react'
import Btn from '../../components/UI/Btn'
import { BadgeDefCusto } from '../../components/UI/Badge'
import Modal from '../../components/UI/Modal'
import { Input, Select } from '../../components/UI/Input'
import { uuidv4 } from '../../utils/uuid'

export default function BancoItensPage() {
  const [banco, setBanco] = useStorage('banco_itens', BANCO_ITENS_DEFAULT)
  const [busca, setBusca] = useState('')
  const [filtroSecao, setFiltroSecao] = useState('')
  const [modalItem, setModalItem] = useState(null)
  const [editandoItem, setEditandoItem] = useState(null)

  const itensFiltrados = useMemo(() => {
    const q = busca.toLowerCase()
    return banco.filter(item => {
      if (filtroSecao && item.secao !== filtroSecao) return false
      if (q && !`${item.item} ${item.subCategoria} ${item.area} ${item.secao}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [banco, busca, filtroSecao])

  function salvarItem(dados) {
    if (dados.id && banco.find(i => i.id === dados.id)) {
      setBanco(prev => prev.map(i => i.id === dados.id ? { ...i, ...dados } : i))
    } else {
      setBanco(prev => [...prev, { ...dados, id: uuidv4() }])
    }
    setModalItem(null)
    setEditandoItem(null)
  }

  function excluirItem(id) {
    if (!confirm('Excluir item do banco?')) return
    setBanco(prev => prev.filter(i => i.id !== id))
  }

  function restaurarPadrao() {
    if (!confirm('Restaurar o banco para os itens padrão? Isso removerá itens personalizados.')) return
    setBanco(BANCO_ITENS_DEFAULT)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>
            Banco de Itens
            <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 500, color: '#64748B', background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 20, padding: '2px 10px' }}>
              {banco.length}
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Catálogo de itens padrão para uso nos orçamentos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variante="ghost" onClick={restaurarPadrao}><RefreshCw size={14} /> Restaurar Padrão</Btn>
          <Btn onClick={() => { setEditandoItem(null); setModalItem(true) }}><Plus size={14} /> Novo Item</Btn>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar itens..."
            style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 6, padding: '8px 10px 8px 32px', color: '#F1F5F9', fontSize: 13, width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif' }}
          />
        </div>
        <select value={filtroSecao} onChange={e => setFiltroSecao(e.target.value)} style={selStyle}>
          <option value="">Todas as seções</option>
          {ORDEM_SECOES.map(s => <option key={s} value={s}>{s} — {NOMES_SECOES[s]}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#64748B' }}>{itensFiltrados.length} itens</span>
      </div>

      {/* Tabela */}
      <div style={{ background: '#1A1D2E', border: '1px solid #2E3150', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0F1117' }}>
                {['Seção', 'Área', 'Sub Categoria', 'Item', 'MoSCoW', 'Def. Custo', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', color: '#64748B', fontWeight: 600, fontSize: 11, textAlign: 'left', borderBottom: '1px solid #2E3150', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #2E3150', background: i % 2 === 0 ? '#1A1D2E' : '#1E2235' }}>
                  <td style={{ padding: '8px 14px', color: '#64748B', whiteSpace: 'nowrap' }}>
                    <span style={{ background: '#2E3150', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{item.secao}</span>
                  </td>
                  <td style={{ padding: '8px 14px', color: '#94A3B8' }}>{item.area || '—'}</td>
                  <td style={{ padding: '8px 14px', color: '#94A3B8' }}>{item.subCategoria || '—'}</td>
                  <td style={{ padding: '8px 14px', color: '#F1F5F9', fontWeight: 500 }}>{item.item}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: {M:'#EF4444',S:'#F59E0B',C:'#22C55E',W:'#94A3B8'}[item.moscow] || '#94A3B8' }}>
                      {item.moscow || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 14px' }}><BadgeDefCusto tipo={item.defCusto} /></td>
                  <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => { setEditandoItem(item); setModalItem(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px 6px', marginRight: 2 }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => excluirItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '2px 6px' }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {itensFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                    Nenhum item encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalItem && (
        <Modal titulo={editandoItem ? 'Editar Item' : 'Novo Item'} onClose={() => { setModalItem(null); setEditandoItem(null) }}>
          <FormItemBanco
            item={editandoItem}
            onSalvar={salvarItem}
            onCancelar={() => { setModalItem(null); setEditandoItem(null) }}
          />
        </Modal>
      )}
    </div>
  )
}

function FormItemBanco({ item, onSalvar, onCancelar }) {
  const [form, setForm] = useState({
    secao: item?.secao || '2.1',
    area: item?.area || '',
    subCategoria: item?.subCategoria || '',
    item: item?.item || '',
    moscow: item?.moscow || 'M',
    defCusto: item?.defCusto || 'Custo Variável',
  })

  function set(campo, valor) { setForm(p => ({ ...p, [campo]: valor })) }

  function handleSubmit(e) {
    e.preventDefault()
    onSalvar({ id: item?.id, ...form })
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Select
          label="Seção *"
          value={form.secao}
          onChange={v => set('secao', v)}
          options={ORDEM_SECOES.map(s => ({ value: s, label: `${s} — ${NOMES_SECOES[s]}` }))}
          required
        />
        <Input label="Área" value={form.area} onChange={v => set('area', v)} />
        <Input label="Sub Categoria" value={form.subCategoria} onChange={v => set('subCategoria', v)} />
        <Input label="Item *" value={form.item} onChange={v => set('item', v)} required />
        <Select label="MoSCoW" value={form.moscow} onChange={v => set('moscow', v)} options={['M', 'S', 'C', 'W']} />
        <Select label="Def. Custo" value={form.defCusto} onChange={v => set('defCusto', v)} options={['Custo Fixo', 'Custo Variável']} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #2E3150', paddingTop: 16 }}>
        <Btn variante="ghost" tipo="button" onClick={onCancelar}>Cancelar</Btn>
        <Btn tipo="submit">Salvar</Btn>
      </div>
    </form>
  )
}

const selStyle = {
  background: '#1A1D2E',
  border: '1px solid #2E3150',
  borderRadius: 6,
  padding: '8px 10px',
  color: '#F1F5F9',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  cursor: 'pointer',
}
