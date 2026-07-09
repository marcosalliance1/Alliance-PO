import { useState } from 'react'
import type { FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { useComprasComercial } from '../../hooks/useComprasComercial'

const base = 'border border-white/10 bg-bg text-text-main placeholder:text-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const label = 'text-sm font-medium text-text-muted'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function Lancamentos() {
  const { compras, contasGerenciais, projetos, carregando, erro, criar, remover } = useComprasComercial()

  const [data, setData]                 = useState(hoje())
  const [contaGerencial, setConta]      = useState('')
  const [projeto, setProjeto]           = useState('')
  const [fornecedor, setFornecedor]     = useState('')
  const [valor, setValor]               = useState('')
  const [descricao, setDescricao]       = useState('')
  const [salvando, setSalvando]         = useState(false)
  const [erroForm, setErroForm]         = useState<string | null>(null)
  const [removendoId, setRemovendoId]   = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErroForm(null)
    if (!data || !contaGerencial || !valor.trim() || !descricao.trim()) {
      setErroForm('Preencha Data, Conta Gerencial, Valor e Descrição.')
      return
    }
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      setErroForm('Valor inválido.')
      return
    }
    setSalvando(true)
    try {
      await criar({
        data,
        desc_conta_gerencial: contaGerencial,
        projeto: projeto || null,
        fornecedor: fornecedor.trim() || null,
        valor: valorNum,
        descricao: descricao.trim(),
      })
      setData(hoje()); setConta(''); setProjeto(''); setFornecedor(''); setValor(''); setDescricao('')
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : 'Erro ao salvar lançamento.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id: string) {
    setRemovendoId(id)
    try {
      await remover(id)
    } finally {
      setRemovendoId(null)
    }
  }

  const totalLista = compras.reduce((s, c) => s + c.valor, 0)

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-white/10 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Novo Lançamento</h2>
        <p className="text-xs text-text-muted -mt-2">Centro de Custo é sempre <strong className="text-text-main">COMERCIAL</strong> (cartão do time).</p>

        {erroForm && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-md px-4 py-3 text-sm">
            {erroForm}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className={label}>Data <span className="text-primary">*</span></label>
            <input type="date" className={base} value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Conta Gerencial <span className="text-primary">*</span></label>
            <select className={base} value={contaGerencial} onChange={e => setConta(e.target.value)}>
              <option value="">Selecione…</option>
              {contasGerenciais.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Valor (R$) <span className="text-primary">*</span></label>
            <input type="number" step="0.01" min="0" className={base} value={valor}
              onChange={e => setValor(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Projeto / Finalidade</label>
            <select className={base} value={projeto} onChange={e => setProjeto(e.target.value)}>
              <option value="">— Geral (não vinculado) —</option>
              {projetos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Fornecedor</label>
            <input className={base} value={fornecedor} onChange={e => setFornecedor(e.target.value)}
              placeholder="Ex: Padaria do Zé" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Descrição <span className="text-primary">*</span></label>
            <input className={base} value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Lanche reunião comercial" />
          </div>
        </div>

        <button type="submit" disabled={salvando}
          className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-medium rounded-md text-sm transition-colors">
          {salvando ? 'Salvando…' : 'Adicionar Lançamento'}
        </button>
      </form>

      {erro && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-md px-4 py-3 text-sm">
          Erro ao carregar lançamentos: {erro}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-text-main">Lançamentos</h3>
          <span className="text-xs text-text-muted">
            {compras.length} lançamento{compras.length !== 1 ? 's' : ''} · Total {totalLista.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        {carregando ? (
          <div className="py-16 text-center text-text-muted text-sm">Carregando…</div>
        ) : compras.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm">Nenhum lançamento cadastrado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Conta Gerencial</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Projeto</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted whitespace-nowrap">Fornecedor</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted whitespace-nowrap">Valor</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted">Descrição</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {compras.map(c => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-text-main whitespace-nowrap">{new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-2 text-text-main max-w-[200px] truncate" title={c.desc_conta_gerencial}>{c.desc_conta_gerencial}</td>
                    <td className="px-4 py-2 text-text-main max-w-[180px] truncate" title={c.projeto ?? ''}>{c.projeto ?? <span className="text-text-muted">—</span>}</td>
                    <td className="px-4 py-2 text-text-muted max-w-[160px] truncate" title={c.fornecedor ?? ''}>{c.fornecedor ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-text-main whitespace-nowrap">{c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-4 py-2 text-text-muted max-w-[220px] truncate" title={c.descricao}>{c.descricao}</td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => handleRemover(c.id)} disabled={removendoId === c.id}
                        className="text-text-muted hover:text-danger transition-colors disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
