import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { calcularDevolucao, type Campo, type Categoria } from './config'
import {
  enviarAnexo, removerAnexos, urlAnexo, valorTurma,
  type Dados, type ProjetoOpcao, type Registro,
} from './useRegistros'

interface Membro { nome: string; cargo: string; telefone: string; email: string }

interface Props {
  cat: Categoria
  registro: Registro | null           // null = novo
  prefill?: Dados
  projetos: ProjetoOpcao[]
  onFechar: () => void
  onSalvar: (dados: Dados, turma: string, fixado: boolean) => Promise<void>
}

const inputCls = 'w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary/60'
const labelCls = 'block text-xs font-semibold text-text-muted mb-1'

// ── Máscara e validação de telefone (regra do painel original) ───────────────
function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length > 10) return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
  if (d.length > 5) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  if (d.length > 2) return d.replace(/(\d{2})(\d{0,5})/, '($1) $2')
  return d
}
const ehTelefone = (c: Campo) => c.key.toLowerCase().includes('telefone')

function num(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function RegistroModal({ cat, registro, prefill, projetos, onFechar, onSalvar }: Props) {
  const [dados, setDados] = useState<Dados>(() => ({ ...(prefill ?? {}), ...(registro?.dados ?? {}) }))
  const [turma, setTurma] = useState(() => (registro ? valorTurma(registro) : String(prefill?.turma ?? '')))
  const [fixado, setFixado] = useState(registro?.fixado ?? false)
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({})
  const [removerImg, setRemoverImg] = useState<Record<string, boolean>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const camposImg = useMemo(() => cat.campos.filter(c => c.type === 'image'), [cat])

  // URLs assinadas para mostrar anexos já salvos
  useEffect(() => {
    let vivo = true
    camposImg.forEach(async c => {
      const p = registro?.dados[c.key]
      if (typeof p === 'string' && p) {
        const url = await urlAnexo(p)
        if (vivo && url) setPreviews(prev => ({ ...prev, [c.key]: url }))
      }
    })
    return () => { vivo = false }
  }, [camposImg, registro])

  // Calculadora de rescisão
  const devolucao = cat.calculadora ? calcularDevolucao(num(dados.valorPago), num(dados.percentualMulta)) : 0

  const set = (key: string, v: unknown) => setDados(d => ({ ...d, [key]: v }))

  function validar(): boolean {
    const e: Record<string, string> = {}
    cat.campos.filter(ehTelefone).forEach(c => {
      const d = String(dados[c.key] ?? '').replace(/\D/g, '')
      if (d && d.length < 10) e[c.key] = 'Telefone deve ter DDD + número (10 ou 11 dígitos).'
    })
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validar()) return
    setSalvando(true)
    setErroGeral(null)
    const novos: string[] = []
    try {
      const final: Dados = { ...dados }
      if (cat.calculadora) final.valorDevolver = brl(devolucao)
      const paraRemover: string[] = []
      for (const c of camposImg) {
        const atual = typeof registro?.dados[c.key] === 'string' ? (registro?.dados[c.key] as string) : ''
        const arq = arquivos[c.key]
        if (arq) {
          const path = await enviarAnexo(cat.id, arq)
          novos.push(path)
          final[c.key] = path
          if (atual) paraRemover.push(atual)
        } else if (removerImg[c.key]) {
          final[c.key] = ''
          if (atual) paraRemover.push(atual)
        }
      }
      await onSalvar(final, turma, fixado)
      // só apaga o anexo antigo depois que o registro novo foi gravado
      if (paraRemover.length) await removerAnexos(paraRemover)
      onFechar()
    } catch (e) {
      if (novos.length) await removerAnexos(novos) // não deixa arquivo órfão se o registro falhou
      setErroGeral(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  function renderCampo(c: Campo) {
    const v = dados[c.key]
    const s = v == null ? '' : String(v)
    switch (c.type) {
      case 'turma':
        return (
          <select className={inputCls} value={turma} onChange={e => setTurma(e.target.value)}>
            <option value="">—</option>
            {cat.id !== 'turmas' && <option value="Geral">Geral</option>}
            {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        )
      case 'select':
        return (
          <select className={inputCls} value={s} onChange={e => set(c.key, e.target.value)}>
            <option value="">—</option>
            {(c.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )
      case 'textarea':
        return <textarea className={`${inputCls} min-h-[90px] resize-y`} value={s} onChange={e => set(c.key, e.target.value)} />
      case 'date':
        return <input type="date" className={inputCls} value={s} onChange={e => set(c.key, e.target.value)} />
      case 'number':
        return <input type="number" step="any" inputMode="decimal" className={inputCls} value={s} onChange={e => set(c.key, e.target.value)} />
      case 'calculated':
        return <input readOnly className={`${inputCls} font-semibold opacity-90`} value={brl(devolucao)} />
      case 'image': {
        const arq = arquivos[c.key]
        return (
          <div className="space-y-2">
            {previews[c.key] && !removerImg[c.key] && !arq && (
              <a href={previews[c.key]} target="_blank" rel="noreferrer">
                <img src={previews[c.key]} alt={c.label} className="max-w-[140px] max-h-[140px] rounded-lg border border-white/10 object-cover" />
              </a>
            )}
            <input type="file" accept="image/*" className="block text-xs text-text-muted"
              onChange={e => setArquivos(a => ({ ...a, [c.key]: e.target.files?.[0] ?? null }))} />
            {previews[c.key] && (
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input type="checkbox" checked={!!removerImg[c.key]} onChange={e => setRemoverImg(r => ({ ...r, [c.key]: e.target.checked }))} />
                Remover imagem
              </label>
            )}
          </div>
        )
      }
      case 'memberList':
        return <ListaMembros membros={(Array.isArray(v) ? v : []) as Membro[]} onChange={m => set(c.key, m)} />
      default:
        return (
          <input className={inputCls} value={s}
            placeholder={ehTelefone(c) ? '(00) 00000-0000' : undefined}
            inputMode={ehTelefone(c) ? 'numeric' : undefined}
            onChange={e => set(c.key, ehTelefone(c) ? mascaraTelefone(e.target.value) : e.target.value)} />
        )
    }
  }

  return (
    <Modal open onClose={onFechar} title={registro ? `Editar — ${cat.label}` : `Novo — ${cat.label}`} width="max-w-xl">
      <form onSubmit={salvar} className="space-y-3">
        {cat.campos.map(c => (
          <div key={c.key}>
            {c.secao && (
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary pt-3 mt-1 mb-2 border-t border-white/10">{c.secao}</div>
            )}
            {c.type !== 'memberList' && <label className={labelCls}>{c.label}</label>}
            {renderCampo(c)}
            {erros[c.key] && <p className="text-xs text-danger mt-1">{erros[c.key]}</p>}
          </div>
        ))}

        {cat.fixavel && (
          <label className="flex items-center gap-2 text-sm text-text-main pt-1">
            <input type="checkbox" checked={fixado} onChange={e => setFixado(e.target.checked)} />
            📌 Fixar no topo
          </label>
        )}

        {erroGeral && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{erroGeral}</p>}

        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
          <button type="button" className="btn-secondary" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={salvando}>
            {salvando ? 'Salvando…' : registro ? 'Salvar' : 'Criar registro'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ListaMembros({ membros, onChange }: { membros: Membro[]; onChange: (m: Membro[]) => void }) {
  const upd = (i: number, k: keyof Membro, v: string) =>
    onChange(membros.map((m, j) => (j === i ? { ...m, [k]: k === 'telefone' ? mascaraTelefone(v) : v } : m)))
  return (
    <div className="space-y-2">
      {membros.length === 0 && <p className="text-xs text-text-muted">Nenhum membro cadastrado.</p>}
      {membros.map((m, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] gap-2 p-2 sm:p-0 border border-white/10 sm:border-0 rounded-lg">
          <input className={inputCls} placeholder="Nome" value={m.nome ?? ''} onChange={e => upd(i, 'nome', e.target.value)} />
          <input className={inputCls} placeholder="Cargo" value={m.cargo ?? ''} onChange={e => upd(i, 'cargo', e.target.value)} />
          <input className={inputCls} placeholder="Telefone" inputMode="numeric" value={m.telefone ?? ''} onChange={e => upd(i, 'telefone', e.target.value)} />
          <input className={inputCls} placeholder="E-mail" type="email" value={m.email ?? ''} onChange={e => upd(i, 'email', e.target.value)} />
          <button type="button" title="Remover membro" className="p-2 text-text-muted hover:text-danger justify-self-end"
            onClick={() => onChange(membros.filter((_, j) => j !== i))}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary !py-1.5 inline-flex items-center gap-1"
        onClick={() => onChange([...membros, { nome: '', cargo: '', telefone: '', email: '' }])}>
        <Plus size={14} /> Adicionar membro
      </button>
    </div>
  )
}
