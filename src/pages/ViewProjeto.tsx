import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Projeto, ItemCusto, TAP, Receitas } from '../types'
import { TAPForm } from '../components/projeto/TAPForm'
import { SecaoCusto } from '../components/projeto/SecaoCusto'
import { ResumoGeral } from '../components/projeto/ResumoGeral'
import { Header } from '../components/layout/Header'
import { BadgeEscola } from '../components/ui/Badge'
import { ArrowLeft, Save } from 'lucide-react'

interface ViewProjetoProps {
  projeto: Projeto
  onUpdateTAP: (tap: TAP) => void
  onUpdateReceitas: (r: Receitas) => void
  onAddItem: (secaoId: string) => void
  onUpdateItem: (secaoId: string, itemId: string, changes: Partial<ItemCusto>) => void
  onDeleteItem: (secaoId: string, itemId: string) => void
  onSalvar: () => void
  fornecedoresSugeridos?: string[]
}

export function ViewProjeto({
  projeto,
  onUpdateTAP,
  onUpdateReceitas,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onSalvar,
  fornecedoresSugeridos = [],
}: ViewProjetoProps) {
  const navigate = useNavigate()
  const [abaAtiva, setAbaAtiva] = useState<string>('tap')

  const abas = [
    { id: 'tap', label: 'TAP' },
    ...projeto.secoes.map((s) => ({ id: s.id, label: s.numero })),
    { id: 'dashboard', label: 'Dashboard' },
  ]

  const handleUpdateItem = useCallback(
    (secaoId: string, itemId: string, changes: Partial<ItemCusto>) => {
      onUpdateItem(secaoId, itemId, changes)
    },
    [onUpdateItem],
  )

  const titulo = projeto.tap.turma || projeto.tap.instituicao || `Projeto #${projeto.id.slice(0, 6)}`

  return (
    <div>
      <Header
        title={titulo}
        subtitle={`${projeto.tap.instituicao} — ${projeto.tap.anoRealizacao}`}
        actions={
          <>
            <BadgeEscola tipo={projeto.tap.tipoEscola} />
            <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/projetos')}>
              <ArrowLeft size={15} /> Projetos
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={onSalvar}>
              <Save size={15} /> Salvar
            </button>
          </>
        }
      />

      {/* Abas */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {abas.map((aba) => {
          const secao = projeto.secoes.find((s) => s.id === aba.id)
          const label = secao ? `${secao.numero} ${secao.nome.split(' ').slice(1, 3).join(' ')}` : aba.label
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`px-3 py-1.5 rounded-inner text-xs font-medium whitespace-nowrap transition-colors ${
                abaAtiva === aba.id
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-muted hover:text-text-main hover:bg-surface-2'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo da aba */}
      {abaAtiva === 'tap' && (
        <TAPForm tap={projeto.tap} onChange={onUpdateTAP} />
      )}

      {projeto.secoes.map((secao) =>
        abaAtiva === secao.id ? (
          <SecaoCusto
            key={secao.id}
            secao={secao}
            qtdFormandos={projeto.tap.qtdFormandos}
            onAddItem={() => onAddItem(secao.id)}
            onUpdateItem={(itemId, changes) => handleUpdateItem(secao.id, itemId, changes)}
            onDeleteItem={(itemId) => onDeleteItem(secao.id, itemId)}
            fornecedoresSugeridos={fornecedoresSugeridos}
          />
        ) : null,
      )}

      {abaAtiva === 'dashboard' && (
        <ResumoGeral projeto={projeto} onUpdateReceitas={onUpdateReceitas} />
      )}
    </div>
  )
}
