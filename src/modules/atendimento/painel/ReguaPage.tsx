import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Plus, X } from 'lucide-react'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Toast } from '../../../components/ui/Toast'
import {
  atualizarRegistro, dataBR, dataDoMarco, excluirRegistro, hojeISO, inserirRegistros,
  nomeTurma, useProjetosOpcoes, useVariasCategorias, type Registro,
} from './useRegistros'

// Modelo padrão da Régua ao Contrário — o mesmo do painel original. É só ponto de
// partida: cada marco pode ser editado, apagado, e dá para adicionar quantos quiser.
const MODELO_REGUA = [
  { diasAntes: 180, marco: 'Contrato assinado / boas-vindas' },
  { diasAntes: 150, marco: 'Primeiro contato de relacionamento' },
  { diasAntes: 120, marco: 'Atualização de status e fotos' },
  { diasAntes: 90, marco: 'Confirmação de fornecedores' },
  { diasAntes: 60, marco: 'Envio de convites' },
  { diasAntes: 30, marco: 'Confirmação de presença' },
  { diasAntes: 15, marco: 'Últimos ajustes e ensaio' },
  { diasAntes: 7, marco: 'Checklist final' },
  { diasAntes: 1, marco: 'Contato de véspera' },
  { diasAntes: 0, marco: 'Acompanhamento no dia do evento' },
]

const inputCls = 'bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary/60'

export function ReguaPage() {
  const { porCategoria, carregando, erro, recarregar } = useVariasCategorias(['turmas', 'regua'])
  const projetos = useProjetosOpcoes()
  const [params, setParams] = useSearchParams()
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicao, setTextoEdicao] = useState('')
  const [apagando, setApagando] = useState<Registro | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [novoDias, setNovoDias] = useState('')
  const [novoMarco, setNovoMarco] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' } | null>(null)
  const fecharToast = useCallback(() => setToast(null), [])

  // Só turmas com perfil cadastrado e ligadas a uma P.O.
  const turmas = useMemo(() => (porCategoria.turmas ?? [])
    .filter(t => t.projeto_id)
    .map(t => ({ perfil: t, nome: nomeTurma(t, projetos) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [porCategoria, projetos])

  const selecionadaId = params.get('turma') && turmas.some(t => t.perfil.projeto_id === params.get('turma'))
    ? params.get('turma')!
    : turmas[0]?.perfil.projeto_id ?? null
  const turma = turmas.find(t => t.perfil.projeto_id === selecionadaId)
  const dataEvento = turma?.perfil.dados.dataEvento

  const marcos = useMemo(() => (porCategoria.regua ?? [])
    .filter(r => r.projeto_id === selecionadaId)
    .sort((a, b) => Number(b.dados.diasAntes ?? 0) - Number(a.dados.diasAntes ?? 0)), [porCategoria, selecionadaId])

  async function executar(acao: () => Promise<unknown>, ok?: string) {
    setOcupado(true)
    try {
      await acao()
      if (ok) setToast({ msg: ok, tipo: 'sucesso' })
      recarregar()
    } catch (e) {
      setToast({ msg: `Não salvei: ${e instanceof Error ? e.message : e}`, tipo: 'erro' })
    } finally {
      setOcupado(false)
    }
  }

  const usarModelo = () => executar(() => inserirRegistros(MODELO_REGUA.map(m => ({
    categoria: 'regua', projeto_id: selecionadaId, status: 'Pendente', dados: { ...m },
  }))), 'Régua criada com o modelo padrão.')

  const alternar = (m: Registro) => executar(() => atualizarRegistro(m.id, {
    status: m.status === 'Feito' ? 'Pendente' : 'Feito',
    concluido_em: m.status === 'Feito' ? null : new Date().toISOString(),
  }))

  function salvarEdicao(m: Registro) {
    const t = textoEdicao.trim()
    setEditandoId(null)
    if (!t || t === m.dados.marco) return
    executar(() => atualizarRegistro(m.id, { dados: { ...m.dados, marco: t } }))
  }

  function adicionar() {
    const marco = novoMarco.trim()
    if (!marco) { setToast({ msg: 'Dê um nome para o marco.', tipo: 'erro' }); return }
    const dias = Number(novoDias || 0)
    if (!Number.isFinite(dias) || dias < 0) { setToast({ msg: 'Dias antes deve ser um número a partir de 0.', tipo: 'erro' }); return }
    executar(async () => {
      await inserirRegistros([{ categoria: 'regua', projeto_id: selecionadaId, status: 'Pendente', dados: { diasAntes: dias, marco } }])
      setNovoDias(''); setNovoMarco(''); setNovoAberto(false)
    }, 'Marco adicionado.')
  }

  const hoje = hojeISO()

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-text-main">Régua ao Contrário</h1>
        <p className="text-sm text-text-muted mt-1 max-w-2xl">
          Sequência de ações e contatos organizada em contagem regressiva até a data da formatura/evento de cada turma.
        </p>
      </div>

      {erro && <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">{erro}</div>}

      {carregando && !turmas.length ? (
        <div className="p-10 text-center text-sm text-text-muted">Carregando…</div>
      ) : !turmas.length ? (
        <div className="bg-surface rounded-[12px] border border-white/10 p-10 text-center">
          <p className="text-text-main font-semibold">Nenhuma turma cadastrada ainda</p>
          <p className="text-sm text-text-muted mt-1">Cadastre o perfil da turma em "Turmas" para montar a régua dela.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-[12px] border border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-white/10">
            <select className={`${inputCls} sm:w-72`} value={selecionadaId ?? ''}
              onChange={e => setParams({ turma: e.target.value }, { replace: true })}>
              {turmas.map(t => <option key={t.perfil.id} value={t.perfil.projeto_id!}>{t.nome}</option>)}
            </select>
            {dataDoMarco(dataEvento, 0)
              ? <span className="text-sm text-text-muted">Evento em <strong className="text-text-main">{dataBR(dataEvento)}</strong></span>
              : <span className="text-sm text-warning">Defina a data da formatura/evento no perfil desta turma (aba Turmas) para ver as datas de cada marco.</span>}
          </div>

          {marcos.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-main font-semibold">Esta turma ainda não tem régua</p>
              <p className="text-sm text-text-muted mt-1 mb-4">Comece pelo modelo padrão (10 marcos, de 180 dias antes até o dia do evento) ou adicione marcos um a um.</p>
              <div className="flex justify-center gap-2">
                <button className="btn-primary disabled:opacity-50" disabled={ocupado} onClick={usarModelo}>Usar modelo padrão</button>
                <button className="btn-secondary" onClick={() => setNovoAberto(true)}>Adicionar marco</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start overflow-x-auto px-4 sm:px-6 pt-9 pb-6">
              {marcos.map((m, i) => {
                const feito = m.status === 'Feito'
                const data = dataDoMarco(dataEvento, m.dados.diasAntes)
                const atrasado = !feito && !!data && data < hoje
                return (
                  <div key={m.id} className="group relative flex flex-col items-center text-center w-[104px] sm:w-[132px] shrink-0">
                    {i > 0 && <div className="absolute top-[15px] right-1/2 w-full h-0.5 bg-white/10" />}
                    <button title="Remover marco" onClick={() => setApagando(m)}
                      className="absolute -top-6 right-3 p-1 text-text-muted/50 hover:text-danger sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={13} />
                    </button>
                    <button disabled={ocupado} onClick={() => alternar(m)} title={feito ? 'Marcar como pendente' : 'Marcar como feito'}
                      className={`relative z-10 w-[30px] h-[30px] rounded-full border-2 flex items-center justify-center transition-colors ${
                        feito ? 'bg-primary border-primary text-white' : atrasado ? 'bg-surface border-warning' : 'bg-surface border-white/20 hover:border-primary'}`}>
                      {feito && <Check size={15} />}
                    </button>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-2">D-{String(m.dados.diasAntes ?? 0)}</div>
                    {data && <div className={`text-[11.5px] ${atrasado ? 'text-warning' : 'text-text-muted'}`}>{dataBR(data)}</div>}
                    {editandoId === m.id ? (
                      <input autoFocus className={`${inputCls} mt-1.5 w-[96px] sm:w-[124px] !px-2 !py-1 text-xs`} value={textoEdicao}
                        onChange={e => setTextoEdicao(e.target.value)}
                        onBlur={() => salvarEdicao(m)}
                        onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(m); if (e.key === 'Escape') setEditandoId(null) }} />
                    ) : (
                      <button title="Clique para editar" onClick={() => { setEditandoId(m.id); setTextoEdicao(String(m.dados.marco ?? '')) }}
                        className={`mt-1.5 text-[12.5px] font-semibold leading-snug max-w-[100px] sm:max-w-[126px] hover:text-primary ${feito ? 'text-text-muted line-through' : 'text-text-main'}`}>
                        {String(m.dados.marco ?? '')}
                      </button>
                    )}
                  </div>
                )
              })}
              <div className="flex flex-col items-center w-[90px] shrink-0">
                <button onClick={() => setNovoAberto(a => !a)} title="Adicionar marco"
                  className="w-[30px] h-[30px] rounded-full border-2 border-dashed border-white/20 text-text-muted hover:border-primary hover:text-primary flex items-center justify-center">
                  <Plus size={15} />
                </button>
                <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-2">Novo marco</div>
              </div>
            </div>
          )}

          {novoAberto && (
            <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 pb-5">
              <input type="number" min={0} placeholder="Dias antes" className={`${inputCls} w-full sm:w-28`} value={novoDias} onChange={e => setNovoDias(e.target.value)} />
              <input placeholder="Nome do marco" className={`${inputCls} w-full sm:w-72`} value={novoMarco}
                onChange={e => setNovoMarco(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') adicionar() }} />
              <button className="btn-primary disabled:opacity-50" disabled={ocupado} onClick={adicionar}>Adicionar</button>
              <button className="btn-secondary" onClick={() => setNovoAberto(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!apagando}
        title="Remover marco"
        message="Remover este marco da régua desta turma?"
        confirmLabel="Remover"
        danger
        onConfirm={() => { const m = apagando; setApagando(null); if (m) executar(() => excluirRegistro(m.id), 'Marco removido.') }}
        onCancel={() => setApagando(null)}
      />
      {toast && <Toast mensagem={toast.msg} tipo={toast.tipo} onFechar={fecharToast} />}
    </div>
  )
}
