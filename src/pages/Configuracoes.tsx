import { useState } from 'react'
import type { ConfiguracaoGlobal } from '../types'
import { Header } from '../components/layout/Header'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Plus, Trash2, Download, Upload } from 'lucide-react'

interface ConfiguracoesProps {
  config: ConfiguracaoGlobal
  onSalvar: (c: ConfiguracaoGlobal) => Promise<void>
  onExportar: () => Promise<void>
  onImportar: (json: string) => Promise<void>
  onLimpar: () => Promise<void>
}

const INPUT = 'w-full bg-surface border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary'

export function Configuracoes({ config, onSalvar, onExportar, onImportar, onLimpar }: ConfiguracoesProps) {
  const [c, setC] = useState(config)
  const [novoForn, setNovoForn] = useState('')
  const [confirmLimpar, setConfirmLimpar] = useState(false)
  const [confirmLimpar2, setConfirmLimpar2] = useState(false)

  function addForn() {
    const v = novoForn.trim()
    if (!v || c.fornecedoresFavoritos.includes(v)) return
    setC({ ...c, fornecedoresFavoritos: [...c.fornecedoresFavoritos, v] })
    setNovoForn('')
  }

  function removeForn(nome: string) {
    setC({ ...c, fornecedoresFavoritos: c.fornecedoresFavoritos.filter((f) => f !== nome) })
  }

  function handleImportarJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onImportar(ev.target?.result as string)
    reader.readAsText(file)
  }

  return (
    <div>
      <Header
        title="Configurações"
        actions={
          <button className="btn-primary" onClick={() => onSalvar(c)}>Salvar</button>
        }
      />

      <div className="space-y-5 max-w-2xl">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-main mb-4">Valores Padrão</h3>
          <div>
            <label className="block text-xs text-text-muted mb-1">IPCA Padrão (ex: 0.0594)</label>
            <input
              type="number"
              step="0.001"
              className={`${INPUT} max-w-xs`}
              value={c.ipcaPadrao}
              onChange={(e) => setC({ ...c, ipcaPadrao: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-text-muted text-xs mt-1">Utilizado como valor inicial ao criar novos projetos.</p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-main mb-4">Fornecedores Favoritos</h3>
          <div className="flex gap-2 mb-3">
            <input
              className={`${INPUT} flex-1`}
              placeholder="Nome do fornecedor"
              value={novoForn}
              onChange={(e) => setNovoForn(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addForn() }}
            />
            <button className="btn-primary px-3" onClick={addForn}>
              <Plus size={15} />
            </button>
          </div>
          <div className="space-y-1">
            {c.fornecedoresFavoritos.length === 0 && (
              <p className="text-text-muted text-sm">Nenhum fornecedor cadastrado.</p>
            )}
            {c.fornecedoresFavoritos.map((f) => (
              <div key={f} className="flex items-center justify-between bg-surface-2 rounded-inner px-3 py-2">
                <span className="text-text-main text-sm">{f}</span>
                <button className="text-danger/60 hover:text-danger" onClick={() => removeForn(f)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-main mb-4">Backup de Dados</h3>
          <div className="flex gap-3 flex-wrap">
            <button className="btn-secondary flex items-center gap-2" onClick={onExportar}>
              <Download size={15} /> Exportar JSON
            </button>
            <label className="btn-secondary flex items-center gap-2 cursor-pointer">
              <Upload size={15} /> Importar JSON
              <input type="file" accept=".json" className="hidden" onChange={handleImportarJSON} />
            </label>
          </div>
        </div>

        <div className="card border border-danger/30">
          <h3 className="text-sm font-semibold text-danger mb-2">Zona de Perigo</h3>
          <p className="text-text-muted text-xs mb-4">Limpar todos os dados remove permanentemente todos os projetos e itens do banco.</p>
          <button
            className="bg-danger/10 text-danger border border-danger/30 px-4 py-2 rounded-inner text-sm font-medium hover:bg-danger/20 transition-colors"
            onClick={() => setConfirmLimpar(true)}
          >
            Limpar Todos os Dados
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLimpar}
        title="Limpar todos os dados?"
        message="Esta ação é irreversível. Todos os projetos e itens do banco serão apagados. Confirma?"
        confirmLabel="Sim, limpar"
        danger
        onConfirm={() => { setConfirmLimpar(false); setConfirmLimpar2(true) }}
        onCancel={() => setConfirmLimpar(false)}
      />
      <ConfirmDialog
        open={confirmLimpar2}
        title="Tem certeza absoluta?"
        message="Última confirmação. Não há como desfazer esta ação."
        confirmLabel="Apagar Tudo"
        danger
        onConfirm={() => { setConfirmLimpar2(false); onLimpar() }}
        onCancel={() => setConfirmLimpar2(false)}
      />
    </div>
  )
}
