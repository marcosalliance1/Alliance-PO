import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ToggleLeft, ToggleRight, KeyRound, Loader, X, ExternalLink } from 'lucide-react'
import bcrypt from 'bcryptjs'
import { supabase } from '../../lib/supabase'
import { usePortalAuth } from '../../contexts/PortalAuthContext'
import type { Projeto, TAP, SecaoCusto, Receitas } from '../../types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalCliente {
  id: string
  email: string
  projeto_id: string
  nome_contato: string | null
  ativo: boolean
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nomeProjeto(tap: TAP) {
  return [tap.instituicao, tap.turma, tap.curso].filter(Boolean).join(' — ')
}

function rowToProjeto(row: Record<string, unknown>): Projeto {
  return {
    id: row.id as string,
    tap: row.tap as TAP,
    secoes: (row.secoes as SecaoCusto[]) ?? [],
    receitas: (row.receitas as Receitas) ?? {},
    criadoEm: row.criado_em as string,
    atualizadoEm: row.atualizado_em as string,
    status: (row.status as string) === 'realizado' ? 'realizado' : 'em_andamento',
  }
}

// ─── Modal Novo / Editar Acesso ───────────────────────────────────────────────

interface ModalProps {
  projetos: Projeto[]
  onClose: () => void
  onSaved: () => void
  editando?: PortalCliente
}

function ModalAcesso({ projetos, onClose, onSaved, editando }: ModalProps) {
  const [email, setEmail] = useState(editando?.email ?? '')
  const [senha, setSenha] = useState('')
  const [projetoId, setProjetoId] = useState(editando?.projeto_id ?? '')
  const [nomeContato, setNomeContato] = useState(editando?.nome_contato ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projetoId) { setError('Selecione um projeto'); return }
    if (!editando && !senha) { setError('Informe uma senha'); return }
    setSaving(true)
    setError('')
    try {
      if (editando) {
        const updates: Record<string, unknown> = { email, projeto_id: projetoId, nome_contato: nomeContato || null }
        if (senha) updates.senha_hash = await bcrypt.hash(senha, 10)
        const { error: err } = await supabase.from('portal_clientes').update(updates).eq('id', editando.id)
        if (err) throw err
      } else {
        const senha_hash = await bcrypt.hash(senha, 10)
        const { error: err } = await supabase.from('portal_clientes').insert({
          email: email.toLowerCase().trim(),
          senha_hash,
          projeto_id: projetoId,
          nome_contato: nomeContato || null,
          ativo: true,
        })
        if (err) throw err
      }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface rounded-xl border border-white/10 w-full max-w-md shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-text-main font-semibold">{editando ? 'Editar Acesso' : 'Novo Acesso'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">
              {editando ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
            </label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required={!editando}
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Projeto</label>
            <select
              value={projetoId}
              onChange={e => setProjetoId(e.target.value)}
              required
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
            >
              <option value="">Selecione o projeto…</option>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>{nomeProjeto(p.tap)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Nome do Contato</label>
            <input
              type="text"
              value={nomeContato}
              onChange={e => setNomeContato(e.target.value)}
              placeholder="Nome da pessoa responsável"
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-danger text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
              {saving ? <Loader size={14} className="animate-spin mx-auto" /> : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Reset Senha ────────────────────────────────────────────────────────

function ModalResetSenha({ cliente, onClose, onSaved }: { cliente: PortalCliente; onClose: () => void; onSaved: () => void }) {
  const [senha, setSenha] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const senha_hash = await bcrypt.hash(senha, 10)
      const { error: err } = await supabase.from('portal_clientes').update({ senha_hash }).eq('id', cliente.id)
      if (err) throw err
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface rounded-xl border border-white/10 w-full max-w-sm shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-text-main font-semibold">Redefinir Senha</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-text-muted text-sm">{cliente.email}</p>
          <div>
            <label className="block text-xs text-text-muted mb-1">Nova Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              autoFocus
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-danger text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
              {saving ? <Loader size={14} className="animate-spin mx-auto" /> : 'Redefinir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function AdminPortal() {
  const { previewAs } = usePortalAuth()
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<PortalCliente[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [editando, setEditando] = useState<PortalCliente | undefined>()
  const [resetando, setResetando] = useState<PortalCliente | undefined>()

  function verDashboard(c: PortalCliente) {
    previewAs({ clienteId: c.id, projetoId: c.projeto_id, email: c.email, nomeContato: c.nome_contato })
    navigate('/portal/dashboard')
  }

  async function carregar() {
    const [{ data: cl }, { data: pr }] = await Promise.all([
      supabase.from('portal_clientes').select('*').order('created_at', { ascending: false }),
      supabase.from('projetos').select('id, tap, criado_em, atualizado_em').order('criado_em', { ascending: false }),
    ])
    setClientes((cl ?? []) as PortalCliente[])
    setProjetos(((pr ?? []) as Record<string, unknown>[]).map(rowToProjeto))
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function toggleAtivo(cliente: PortalCliente) {
    await supabase.from('portal_clientes').update({ ativo: !cliente.ativo }).eq('id', cliente.id)
    setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, ativo: !c.ativo } : c))
  }

  function projetoNome(id: string) {
    const p = projetos.find(x => x.id === id)
    return p ? nomeProjeto(p.tap) : id
  }

  function afterSave() {
    setModalNovo(false)
    setEditando(undefined)
    setResetando(undefined)
    carregar()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted text-sm gap-2">
        <Loader size={16} className="animate-spin" /> Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-text-main font-bold text-xl">Portal Clientes</h1>
          <p className="text-text-muted text-sm mt-1">Gerencie os acessos das comissões de formatura</p>
        </div>
        <button onClick={() => setModalNovo(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Novo acesso
        </button>
      </div>

      {clientes.length === 0 ? (
        <div className="card text-center py-12 text-text-muted text-sm">
          Nenhum acesso cadastrado ainda.
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-text-muted text-xs font-medium">Email</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-medium">Contato</th>
                <th className="text-left px-5 py-3 text-text-muted text-xs font-medium">Projeto</th>
                <th className="text-center px-5 py-3 text-text-muted text-xs font-medium">Status</th>
                <th className="text-right px-5 py-3 text-text-muted text-xs font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                  <td className="px-5 py-3 text-text-main">{c.email}</td>
                  <td className="px-5 py-3 text-text-muted">{c.nome_contato || '—'}</td>
                  <td className="px-5 py-3 text-text-muted text-xs max-w-xs truncate">{projetoNome(c.projeto_id)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.ativo ? 'bg-success/20 text-success' : 'bg-white/10 text-text-muted'}`}>
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => verDashboard(c)}
                        title="Ver dashboard do cliente"
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                      >
                        <ExternalLink size={13} /> Ver
                      </button>
                      <button
                        onClick={() => toggleAtivo(c)}
                        title={c.ativo ? 'Desativar' : 'Ativar'}
                        className="text-text-muted hover:text-primary transition-colors"
                      >
                        {c.ativo ? <ToggleRight size={18} className="text-success" /> : <ToggleLeft size={18} />}
                      </button>
                      <button
                        onClick={() => setResetando(c)}
                        title="Redefinir senha"
                        className="text-text-muted hover:text-warning transition-colors"
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => setEditando(c)}
                        className="text-xs text-text-muted hover:text-text-main transition-colors"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modalNovo || editando) && (
        <ModalAcesso
          projetos={projetos}
          onClose={() => { setModalNovo(false); setEditando(undefined) }}
          onSaved={afterSave}
          editando={editando}
        />
      )}

      {resetando && (
        <ModalResetSenha
          cliente={resetando}
          onClose={() => setResetando(undefined)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}
