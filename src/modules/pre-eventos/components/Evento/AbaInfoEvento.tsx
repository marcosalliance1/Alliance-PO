import React, { useRef, useState } from 'react'
import { Calendar, Music, Users, Plus, Trash2, Download, Paperclip, X } from 'lucide-react'
import type { Orcamento, InfoEvento, FornecedorStatus, NotaFiscal } from '../../types'
import { statusFornecedor, lineupView } from '../../types'
import { ModalImportarEvento } from './ModalImportarEvento'

// Anexo de arquivo (rider) — mesma ideia da NF: guarda base64 no orçamento.
const RiderAnexo: React.FC<{ rider?: NotaFiscal; onChange: (nf?: NotaFiscal) => void }> = ({ rider, onChange }) => {
  const ref = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState('')
  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 4 * 1024 * 1024) { setErro('Máx 4MB'); setTimeout(() => setErro(''), 3000); return }
    const r = new FileReader()
    r.onload = () => onChange({ nome: file.name, tipo: file.type, dados: r.result as string, tamanho: file.size })
    r.readAsDataURL(file); e.target.value = ''
  }
  function ver() {
    if (!rider) return
    const w = window.open()
    if (w) w.document.write(rider.tipo === 'application/pdf'
      ? `<iframe src="${rider.dados}" width="100%" height="100%" style="border:none"></iframe>`
      : `<img src="${rider.dados}" style="max-width:100%" />`)
  }
  if (rider) return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-success truncate max-w-[110px] cursor-pointer hover:underline" title={rider.nome} onClick={ver}>{rider.nome}</span>
      <button onClick={() => onChange(undefined)} className="text-muted hover:text-danger shrink-0" title="Remover"><X className="w-3 h-3" /></button>
    </div>
  )
  return (
    <>
      <button onClick={() => ref.current?.click()} className="flex items-center gap-1 text-[10px] text-muted hover:text-accent border border-dashed border-bordercol hover:border-accent/50 rounded px-1.5 py-1 transition-colors">
        <Paperclip className="w-3 h-3" /> Rider{erro && <span className="text-danger ml-1">{erro}</span>}
      </button>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handle} />
    </>
  )
}

const STATUS_LABEL: Record<FornecedorStatus, string> = {
  aberto: 'em aberto', aguardando: 'aguardando assinatura', fechado: 'fechado',
}
const STATUS_COR: Record<FornecedorStatus, string> = {
  aberto: 'text-muted border-bordercol',
  aguardando: 'text-warning border-warning/30 bg-warning/10',
  fechado: 'text-success border-success/30 bg-success/10',
}

export const INFO_EVENTO_VAZIO: InfoEvento = {
  nomeEvento: '', tipo: '', data: '', diaSemana: '', local: '', horario: '', tematica: '',
  totalConvidados: '', formandos: '', pagantes: '', bolsaFolia: '', dataAdimplencia: '',
  vendaDeConvite: '', fornecedores: [], lineup: [], linkVenda: null,
}

interface Props {
  orc: Orcamento
  onChange: (info: InfoEvento) => void
}

const CAMPOS: [keyof InfoEvento, string][] = [
  ['data', 'Data'], ['diaSemana', 'Dia da semana'], ['local', 'Local'], ['horario', 'Horário'],
  ['tematica', 'Temática'], ['totalConvidados', 'Total de convidados'], ['formandos', 'Formandos'],
  ['pagantes', 'Pagantes'], ['bolsaFolia', 'Bolsa Folia'], ['dataAdimplencia', 'Adimplência'],
  ['vendaDeConvite', 'Venda de Convite'],
]

export const AbaInfoEvento: React.FC<Props> = ({ orc, onChange }) => {
  const [importar, setImportar] = useState(false)
  const info = orc.infoEvento ?? INFO_EVENTO_VAZIO
  const upd = (patch: Partial<InfoEvento>) => onChange({ ...info, ...patch })

  const inputCls = 'w-full bg-surface border border-bordercol rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent transition-colors'
  const labelCls = 'block text-[11px] text-muted mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted">Preencha as informações do evento — ou importe da planilha antiga.</p>
        <button onClick={() => setImportar(true)}
          className="flex items-center gap-2 border border-bordercol text-muted hover:text-white hover:bg-white/5 text-sm py-2 px-3 rounded-lg transition-colors">
          <Download className="w-4 h-4" /> Importar da planilha
        </button>
      </div>

      {/* Dados gerais */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-accent" /> Dados do Evento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CAMPOS.map(([campo, label]) => {
            // Data e Total de convidados vêm de "Informações Gerais" (cabeçalho) — não redigitar.
            const doCabecalho = campo === 'data'
              ? (orc.data ? orc.data.split('-').reverse().join('/') : '')
              : campo === 'totalConvidados' ? String(orc.quantidadeConvidados || '') : null
            if (doCabecalho !== null) return (
              <div key={campo}>
                <label className={labelCls}>{label} <span className="text-[9px] text-muted/50">· do cabeçalho</span></label>
                <input className={`${inputCls} opacity-60 cursor-not-allowed`} value={doCabecalho} readOnly title="Vem de Informações Gerais (edite lá em cima)" />
              </div>
            )
            return (
              <div key={campo}>
                <label className={labelCls}>{label}</label>
                <input className={inputCls} value={String(info[campo] ?? '')} onChange={e => upd({ [campo]: e.target.value } as Partial<InfoEvento>)} />
              </div>
            )
          })}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Link de venda</label>
            <input className={inputCls} value={info.linkVenda ?? ''} onChange={e => upd({ linkVenda: e.target.value || null })} placeholder="https://..." />
          </div>
        </div>
      </div>

      {/* Lineup */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Music className="w-4 h-4 text-accent" /> Lineup Artístico</h3>
          <button onClick={() => upd({ lineup: [...info.lineup, { atracao: '', horarioInicio: '', horarioTermino: '', status: 'aberto' }] })}
            className="flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="w-3.5 h-3.5" /> linha</button>
        </div>
        <div className="space-y-2">
          {info.lineup.length === 0 && <p className="text-xs text-muted">Sem atrações ainda.</p>}
          {info.lineup.map((l, i) => {
            const v = lineupView(l)
            const setL = (patch: Partial<typeof l>) => upd({ lineup: info.lineup.map((x, j) => j === i ? { ...x, ...patch } : x) })
            return (
              <div key={i} className="border border-bordercol/50 rounded-lg p-3">
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex-1 min-w-[140px] max-w-[420px]">
                    <label className={labelCls}>Atração</label>
                    <input className={inputCls} placeholder="Nome da atração" value={v.atracao} onChange={e => setL({ atracao: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Início</label>
                    <input type="time" className={`${inputCls} w-28`} value={v.inicio} onChange={e => setL({ horarioInicio: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Término</label>
                    <input type="time" className={`${inputCls} w-28`} value={v.termino} onChange={e => setL({ horarioTermino: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Situação</label>
                    <select value={v.status} onChange={e => setL({ status: e.target.value as FornecedorStatus })}
                      className={`text-[11px] font-medium border rounded px-2 py-2 w-full outline-none cursor-pointer ${STATUS_COR[v.status]}`}>
                      {(['aberto', 'aguardando', 'fechado'] as FornecedorStatus[]).map(s => (
                        <option key={s} value={s} className="bg-surface text-white">{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[120px]">
                    <label className={labelCls}>Rider</label>
                    <div className="h-[38px] flex items-center"><RiderAnexo rider={l.rider} onChange={nf => setL({ rider: nf })} /></div>
                  </div>
                  <button onClick={() => upd({ lineup: info.lineup.filter((_, j) => j !== i) })} className="text-muted hover:text-danger shrink-0 mb-2" title="Remover atração"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fornecedores */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Fornecedores</h3>
          <button onClick={() => upd({ fornecedores: [...info.fornecedores, { categoria: '', fornecedor: '', status: 'aberto' }] })}
            className="flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="w-3.5 h-3.5" /> fornecedor</button>
        </div>
        <div className="space-y-2">
          {info.fornecedores.length === 0 && <p className="text-xs text-muted">Nenhum fornecedor ainda.</p>}
          {info.fornecedores.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`${inputCls} w-40`} placeholder="Categoria" value={f.categoria}
                onChange={e => upd({ fornecedores: info.fornecedores.map((x, j) => j === i ? { ...x, categoria: e.target.value } : x) })} />
              <input className={`${inputCls} flex-1`} placeholder="Fornecedor" value={f.fornecedor}
                onChange={e => upd({ fornecedores: info.fornecedores.map((x, j) => j === i ? { ...x, fornecedor: e.target.value } : x) })} />
              <select value={statusFornecedor(f)}
                onChange={e => upd({ fornecedores: info.fornecedores.map((x, j) => j === i ? { ...x, status: e.target.value as FornecedorStatus } : x) })}
                className={`text-[11px] font-medium border rounded px-2 py-1.5 shrink-0 outline-none cursor-pointer ${STATUS_COR[statusFornecedor(f)]}`}>
                {(['aberto', 'aguardando', 'fechado'] as FornecedorStatus[]).map(s => (
                  <option key={s} value={s} className="bg-surface text-white">{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <button onClick={() => upd({ fornecedores: info.fornecedores.filter((_, j) => j !== i) })} className="text-muted hover:text-danger shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {importar && (
        <ModalImportarEvento
          turma={orc.turma}
          onImportar={info => { onChange(info); setImportar(false) }}
          onFechar={() => setImportar(false)}
        />
      )}
    </div>
  )
}
