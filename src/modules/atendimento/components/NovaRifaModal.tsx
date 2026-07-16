import { useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { useAtendimento } from '../contexts/AtendimentoContext'

const SITUACOES = ['EM ANDAMENTO', 'SORTEADA', 'FECHADA', 'NÃO VAI TER']

export function NovaRifaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { criarRifa } = useAtendimento()
  const [turma, setTurma] = useState('')
  const [edicao, setEdicao] = useState('')
  const [formacao, setFormacao] = useState('')
  const [anoFormatura, setAnoFormatura] = useState('')
  const [diaVencimento, setDiaVencimento] = useState('')
  const [premio, setPremio] = useState('')
  const [valor, setValor] = useState('')
  const [situacao, setSituacao] = useState('EM ANDAMENTO')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function limpar() {
    setTurma(''); setEdicao(''); setFormacao(''); setAnoFormatura(''); setDiaVencimento('')
    setPremio(''); setValor(''); setSituacao('EM ANDAMENTO'); setErro(null)
  }

  async function handleSalvar() {
    if (!turma.trim()) { setErro('Informe a turma.'); return }
    setSalvando(true)
    setErro(null)
    try {
      await criarRifa({
        turma: turma.trim(),
        edicao: edicao || null,
        formacao: formacao || null,
        ano_formatura: anoFormatura ? Number(anoFormatura) : null,
        dia_vencimento: diaVencimento || null,
        premio_descricao: premio || null,
        valor_boleto: valor ? Number(valor) : null,
        situacao,
      })
      limpar()
      onClose()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova Rifa" width="max-w-md">
      <div className="space-y-3 text-sm">
        <div>
          <label className="block text-xs text-text-muted mb-1">Turma *</label>
          <input value={turma} onChange={e => setTurma(e.target.value)} className="w-full bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-text-main" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Edição</label>
            <input value={edicao} onChange={e => setEdicao(e.target.value)} placeholder="ex: 3/7" className="w-full bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-text-main" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Formação</label>
            <input value={formacao} onChange={e => setFormacao(e.target.value)} placeholder="ex: ES" className="w-full bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-text-main" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Ano de formatura</label>
            <input type="number" value={anoFormatura} onChange={e => setAnoFormatura(e.target.value)} className="w-full bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-text-main" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Dia do sorteio</label>
            <input type="date" value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} className="w-full bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-text-main" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Prêmio</label>
          <input value={premio} onChange={e => setPremio(e.target.value)} className="w-full bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-text-main" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Valor do boleto (R$)</label>
            <input type="number" value={valor} onChange={e => setValor(e.target.value)} className="w-full bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-text-main" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Situação</label>
            <select value={situacao} onChange={e => setSituacao(e.target.value)} className="w-full bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-text-main">
              {SITUACOES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {erro && <div className="text-danger text-xs">{erro}</div>}
        <div className="text-[10px] text-text-muted">Essa rifa é enviada pra planilha na próxima sincronização.</div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-main transition-colors">Cancelar</button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Criar Rifa'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
