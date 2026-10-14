import { useState } from 'react'
import type { ReactNode } from 'react'
import type { TAP, TipoEscola } from '../../types'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

// TAP no formato da aba "0. TAP – TERMO DE ABERTURA" da planilha: faixa vermelha, rótulos cinza em
// negrito à esquerda e valor à direita, em três colunas. Mesmos campos e mesma edição do TAPForm
// (só admin edita; cada alteração chama onChange com o TAP inteiro) — muda apenas a apresentação.

interface Props {
  tap: TAP
  onChange: (tap: TAP) => void
  totalConvidadosAtual?: number
  isRealizado?: boolean
}

const TIPOS: { value: TipoEscola; label: string }[] = [
  { value: 'FUNDAMENTAL', label: 'Ensino Fundamental (9º ano)' },
  { value: 'MEDIO', label: 'Ensino Médio' },
  { value: 'SUPERIOR', label: 'Ensino Superior' },
]

const CELULA = 'w-full bg-transparent px-3 py-2 text-[12.5px] text-[#1e2430] outline-none focus:bg-[#fffceb] disabled:cursor-default [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'

function Linha({ rotulo, children, nota }: { rotulo: string; children: ReactNode; nota?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] border-t border-[#e2e6ec] first:border-t-0">
      <div className="flex items-center bg-[#f3f3f3] px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-[#1e2430]">{rotulo}</div>
      <div className="flex flex-col justify-center border-l border-[#e2e6ec] bg-white">
        {children}
        {nota && <div className="px-3 pb-1.5 text-[10px] text-[#64707f]">{nota}</div>}
      </div>
    </div>
  )
}

function Barra({ titulo }: { titulo: string }) {
  return <div className="bg-[#ef3935] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#ffffff]">{titulo}</div>
}

export function TAPPlanilha({ tap, onChange, totalConvidadosAtual, isRealizado }: Props) {
  const { isAdmin } = useAuth()
  const ro = !isAdmin
  const [t, setT] = useState<TAP>(tap)

  function update(partial: Partial<TAP>) {
    const next = { ...t, ...partial }
    setT(next)
    onChange(next)
  }
  const num = (v: string, int = true) => (int ? parseInt(v) || 0 : parseFloat(v) || 0)

  const txt = (campo: 'instituicao' | 'curso' | 'turma' | 'local' | 'modeloContrato' | 'tempoContrato' | 'tempoDeFesta' | 'pacoteBase', ph = '') => (
    <input className={CELULA} value={t[campo]} onChange={e => update({ [campo]: e.target.value } as Partial<TAP>)} placeholder={ph} disabled={ro} />
  )
  const numero = (campo: 'anoOrcamento' | 'anoRealizacao' | 'qtdFormandos' | 'adesoesPrevistas' | 'qtdConvidadosBaile' | 'qtdConvidadosPosBaile' | 'parcelas') => (
    <input type="number" className={CELULA} value={t[campo]} onChange={e => update({ [campo]: num(e.target.value) } as Partial<TAP>)} disabled={ro} />
  )

  const grupo = 'overflow-hidden rounded-md border border-[#e2e6ec] bg-white'

  function updatePacote(i: number, campo: 'nome' | 'valor', val: string) {
    update({ pacotes: t.pacotes.map((p, idx) => (idx === i ? { ...p, [campo]: campo === 'valor' ? parseFloat(val) || 0 : val } : p)) })
  }

  return (
    <div className="space-y-8" style={{ fontFamily: "'Montserrat', ui-sans-serif, system-ui, sans-serif", color: '#1e2430' }}>
      <section className={grupo}>
        <Barra titulo="Informações gerais do projeto" />
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:divide-x lg:divide-[#e2e6ec]">
          <div>
            <Linha rotulo="Instituição de ensino">{txt('instituicao', 'Nome da escola/faculdade')}</Linha>
            <Linha rotulo="Curso">{txt('curso', 'Ex: Direito, Medicina…')}</Linha>
            <Linha rotulo="Turma">{txt('turma', 'Ex: 2025B')}</Linha>
            <Linha rotulo="Tipo de orçamento">
              <select className={CELULA} value={t.tipoEscola} onChange={e => update({ tipoEscola: e.target.value as TipoEscola })} disabled={ro}>
                {TIPOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Linha>
            <Linha rotulo="Local do evento">{txt('local', 'Ex: Espaço Royal')}</Linha>
            <Linha rotulo="Data do evento">
              <input type="date" className={CELULA} value={t.dataEvento} onChange={e => update({ dataEvento: e.target.value })} disabled={ro} />
            </Linha>
          </div>

          <div className="border-t border-[#e2e6ec] lg:border-t-0">
            <Linha rotulo="Total de alunos na turma">{numero('qtdFormandos')}</Linha>
            <Linha rotulo="Adesões previstas">{numero('adesoesPrevistas')}</Linha>
            <Linha rotulo="Pacote base p/ cálculo">{txt('pacoteBase')}</Linha>
            <Linha
              rotulo="Convidados previstos (baile)"
              nota={!!totalConvidadosAtual ? `Real (sincronizado): ${totalConvidadosAtual.toLocaleString('pt-BR')}` : undefined}
            >
              <div className={isRealizado ? 'opacity-50' : ''}>{numero('qtdConvidadosBaile')}</div>
            </Linha>
            <Linha rotulo="Convidados pós-baile">{numero('qtdConvidadosPosBaile')}</Linha>
            <Linha rotulo="IPCA a.a (ex: 0,0594)">
              <input type="number" step="0.001" className={CELULA} value={t.ipca} onChange={e => update({ ipca: num(e.target.value, false) })} disabled={ro} />
            </Linha>
          </div>

          <div className="border-t border-[#e2e6ec] lg:border-t-0">
            <Linha rotulo="Ano do orçamento">{numero('anoOrcamento')}</Linha>
            <Linha rotulo="Ano de realização">{numero('anoRealizacao')}</Linha>
            <Linha rotulo="Modelo de contrato">{txt('modeloContrato')}</Linha>
            <Linha rotulo="Tempo de contrato">{txt('tempoContrato', 'Ex: 24 meses')}</Linha>
            <Linha rotulo="Tempo de festa">{txt('tempoDeFesta', 'Ex: 8h')}</Linha>
            <Linha rotulo="Parcelas">{numero('parcelas')}</Linha>
          </div>
        </div>
      </section>

      <section className={grupo}>
        <div className="flex items-center justify-between bg-[#ef3935] px-3 py-2 text-[#ffffff]">
          <h3 className="text-[11px] font-bold uppercase tracking-wide">Pacotes</h3>
          {isAdmin && (
            <button className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold hover:bg-white/30" onClick={() => update({ pacotes: [...t.pacotes, { nome: '', valor: 0 }] })}>
              <Plus size={12} /> Adicionar
            </button>
          )}
        </div>
        {t.pacotes.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-[#64707f]">Nenhum pacote cadastrado.</p>
        ) : (
          <div>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_32px] bg-[#f3f3f3] text-[10.5px] font-bold uppercase tracking-wide">
              <div className="px-3 py-2">Pacote</div><div className="border-l border-[#e2e6ec] px-3 py-2">Valor</div><div />
            </div>
            {t.pacotes.map((p, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_32px] border-t border-[#e2e6ec]">
                <input className={CELULA} placeholder="Nome do pacote" value={p.nome} onChange={e => updatePacote(i, 'nome', e.target.value)} disabled={ro} />
                <input type="number" className={`${CELULA} border-l border-[#e2e6ec]`} placeholder="Valor" value={p.valor || ''} onChange={e => updatePacote(i, 'valor', e.target.value)} disabled={ro} />
                {isAdmin ? (
                  <button className="flex items-center justify-center text-[#c0392b] hover:opacity-75" title="Remover pacote" onClick={() => update({ pacotes: t.pacotes.filter((_, idx) => idx !== i) })}>
                    <Trash2 size={14} />
                  </button>
                ) : <div />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
