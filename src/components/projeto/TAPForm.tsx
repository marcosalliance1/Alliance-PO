import { useState } from 'react'
import type { TAP, TipoEscola } from '../../types'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface TAPFormProps {
  tap: TAP
  onChange: (tap: TAP) => void
}

const TIPOS: { value: TipoEscola; label: string }[] = [
  { value: 'FUNDAMENTAL', label: 'Ensino Fundamental (9º ano)' },
  { value: 'MEDIO', label: 'Ensino Médio' },
  { value: 'SUPERIOR', label: 'Ensino Superior' },
]

function Field({
  label, children, half,
}: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2 md:col-span-1'}>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      {children}
    </div>
  )
}

const INPUT = 'w-full bg-surface-2 border border-white/10 rounded-inner px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary'
const SELECT = INPUT

export function TAPForm({ tap, onChange }: TAPFormProps) {
  const { isAdmin } = useAuth()
  const ro = !isAdmin
  const [tap_, setTap] = useState<TAP>(tap)

  function update(partial: Partial<TAP>) {
    const next = { ...tap_, ...partial }
    setTap(next)
    onChange(next)
  }

  function addPacote() {
    update({ pacotes: [...tap_.pacotes, { nome: '', valor: 0 }] })
  }

  function removePacote(i: number) {
    update({ pacotes: tap_.pacotes.filter((_, idx) => idx !== i) })
  }

  function updatePacote(i: number, field: 'nome' | 'valor', val: string) {
    const pacotes = tap_.pacotes.map((p, idx) =>
      idx === i ? { ...p, [field]: field === 'valor' ? parseFloat(val) || 0 : val } : p,
    )
    update({ pacotes })
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-sm font-semibold text-text-main mb-4">Identificação</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Instituição">
            <input className={INPUT} value={tap_.instituicao} onChange={(e) => update({ instituicao: e.target.value })} placeholder="Nome da escola/faculdade" disabled={ro} />
          </Field>
          <Field label="Curso">
            <input className={INPUT} value={tap_.curso} onChange={(e) => update({ curso: e.target.value })} placeholder="Ex: Direito, Medicina..." disabled={ro} />
          </Field>
          <Field label="Turma">
            <input className={INPUT} value={tap_.turma} onChange={(e) => update({ turma: e.target.value })} placeholder="Ex: 2025B" disabled={ro} />
          </Field>
          <Field label="Tipo de Escola">
            <select className={SELECT} value={tap_.tipoEscola} onChange={(e) => update({ tipoEscola: e.target.value as TipoEscola })} disabled={ro}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Local do Evento">
            <input className={INPUT} value={tap_.local} onChange={(e) => update({ local: e.target.value })} placeholder="Ex: Espaço Royal" disabled={ro} />
          </Field>
          <Field label="Data do Evento">
            <input type="date" className={INPUT} value={tap_.dataEvento} onChange={(e) => update({ dataEvento: e.target.value })} disabled={ro} />
          </Field>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-main mb-4">Contrato e Formandos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Ano Orçamento">
            <input type="number" className={INPUT} value={tap_.anoOrcamento} onChange={(e) => update({ anoOrcamento: parseInt(e.target.value) || 0 })} disabled={ro} />
          </Field>
          <Field label="Ano Realização">
            <input type="number" className={INPUT} value={tap_.anoRealizacao} onChange={(e) => update({ anoRealizacao: parseInt(e.target.value) || 0 })} disabled={ro} />
          </Field>
          <Field label="Qtd. Formandos">
            <input type="number" className={INPUT} value={tap_.qtdFormandos} onChange={(e) => update({ qtdFormandos: parseInt(e.target.value) || 0 })} disabled={ro} />
          </Field>
          <Field label="Adesões Previstas">
            <input type="number" className={INPUT} value={tap_.adesoesPrevistas} onChange={(e) => update({ adesoesPrevistas: parseInt(e.target.value) || 0 })} disabled={ro} />
          </Field>
          <Field label="Convidados Baile">
            <input type="number" className={INPUT} value={tap_.qtdConvidadosBaile} onChange={(e) => update({ qtdConvidadosBaile: parseInt(e.target.value) || 0 })} disabled={ro} />
          </Field>
          <Field label="Convidados Pós-Baile">
            <input type="number" className={INPUT} value={tap_.qtdConvidadosPosBaile} onChange={(e) => update({ qtdConvidadosPosBaile: parseInt(e.target.value) || 0 })} disabled={ro} />
          </Field>
          <Field label="Parcelas">
            <input type="number" className={INPUT} value={tap_.parcelas} onChange={(e) => update({ parcelas: parseInt(e.target.value) || 0 })} disabled={ro} />
          </Field>
          <Field label="IPCA (ex: 0.0594)">
            <input type="number" step="0.001" className={INPUT} value={tap_.ipca} onChange={(e) => update({ ipca: parseFloat(e.target.value) || 0 })} disabled={ro} />
          </Field>
          <Field label="Modelo de Contrato">
            <input className={INPUT} value={tap_.modeloContrato} onChange={(e) => update({ modeloContrato: e.target.value })} disabled={ro} />
          </Field>
          <Field label="Tempo de Contrato">
            <input className={INPUT} value={tap_.tempoContrato} onChange={(e) => update({ tempoContrato: e.target.value })} placeholder="Ex: 24 meses" disabled={ro} />
          </Field>
          <Field label="Tempo de Festa">
            <input className={INPUT} value={tap_.tempoDeFesta} onChange={(e) => update({ tempoDeFesta: e.target.value })} placeholder="Ex: 8h" disabled={ro} />
          </Field>
          <Field label="Pacote Base">
            <input className={INPUT} value={tap_.pacoteBase} onChange={(e) => update({ pacoteBase: e.target.value })} disabled={ro} />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-main">Pacotes</h3>
          {isAdmin && (
            <button className="btn-secondary text-xs py-1 px-3 flex items-center gap-1" onClick={addPacote}>
              <Plus size={14} /> Adicionar
            </button>
          )}
        </div>
        {tap_.pacotes.length === 0 && (
          <p className="text-text-muted text-sm">Nenhum pacote cadastrado.</p>
        )}
        <div className="space-y-2">
          {tap_.pacotes.map((p, i) => (
            <div key={i} className="flex gap-3 items-center">
              <input
                className={`${INPUT} flex-1`}
                placeholder="Nome do pacote"
                value={p.nome}
                onChange={(e) => updatePacote(i, 'nome', e.target.value)}
                disabled={ro}
              />
              <input
                type="number"
                className={`${INPUT} w-36`}
                placeholder="Valor"
                value={p.valor || ''}
                onChange={(e) => updatePacote(i, 'valor', e.target.value)}
                disabled={ro}
              />
              {isAdmin && (
                <button className="text-danger hover:opacity-75" onClick={() => removePacote(i)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
