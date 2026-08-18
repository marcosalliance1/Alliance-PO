import React, { useState } from 'react'
import { Calendar, Music, Users, Plus, Trash2, Download } from 'lucide-react'
import type { Orcamento, InfoEvento } from '../../types'
import { ModalImportarEvento } from './ModalImportarEvento'

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
          {CAMPOS.map(([campo, label]) => (
            <div key={campo}>
              <label className={labelCls}>{label}</label>
              <input className={inputCls} value={String(info[campo] ?? '')} onChange={e => upd({ [campo]: e.target.value } as Partial<InfoEvento>)} />
            </div>
          ))}
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
          <button onClick={() => upd({ lineup: [...info.lineup, { horario: '', artista: '', obs: '' }] })}
            className="flex items-center gap-1 text-xs text-accent hover:underline"><Plus className="w-3.5 h-3.5" /> linha</button>
        </div>
        <div className="space-y-2">
          {info.lineup.length === 0 && <p className="text-xs text-muted">Sem atrações ainda.</p>}
          {info.lineup.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`${inputCls} w-24`} placeholder="Horário" value={l.horario}
                onChange={e => upd({ lineup: info.lineup.map((x, j) => j === i ? { ...x, horario: e.target.value } : x) })} />
              <input className={`${inputCls} flex-1`} placeholder="Artista" value={l.artista}
                onChange={e => upd({ lineup: info.lineup.map((x, j) => j === i ? { ...x, artista: e.target.value } : x) })} />
              <input className={`${inputCls} flex-1`} placeholder="Obs" value={l.obs}
                onChange={e => upd({ lineup: info.lineup.map((x, j) => j === i ? { ...x, obs: e.target.value } : x) })} />
              <button onClick={() => upd({ lineup: info.lineup.filter((_, j) => j !== i) })} className="text-muted hover:text-danger shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Fornecedores */}
      <div className="bg-surface-2 border border-bordercol rounded-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Fornecedores</h3>
          <button onClick={() => upd({ fornecedores: [...info.fornecedores, { categoria: '', fornecedor: '', fechado: false }] })}
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
              <button onClick={() => upd({ fornecedores: info.fornecedores.map((x, j) => j === i ? { ...x, fechado: !x.fechado } : x) })}
                className={`text-[11px] font-medium border rounded px-2 py-1.5 shrink-0 ${f.fechado ? 'text-success border-success/30 bg-success/10' : 'text-muted border-bordercol'}`}>
                {f.fechado ? 'fechado' : 'em aberto'}
              </button>
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
