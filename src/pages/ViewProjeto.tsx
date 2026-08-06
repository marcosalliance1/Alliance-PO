import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Projeto, ItemCusto, ItemCatalogo, TAP, Receitas, ConciliacaoEverest, CustoAdicional } from '../types'
import { TAPForm } from '../components/projeto/TAPForm'
import { SecaoCusto } from '../components/projeto/SecaoCusto'
import { ResumoGeral } from '../components/projeto/ResumoGeral'
import { ProjectDashboard } from '../components/projeto/ProjectDashboard'
import { FinanceiroEverestTab } from '../components/projeto/FinanceiroEverestTab'
import { Header } from '../components/layout/Header'
import { BadgeEscola } from '../components/ui/Badge'
import { useAuth } from '../contexts/AuthContext'
import { gerarRelatorioPendencias } from '../lib/gerarRelatorioPendencias'
import { ArrowLeft, Save, Check, Loader, FileWarning } from 'lucide-react'

interface ViewProjetoProps {
  projeto: Projeto
  bancoItens?: ItemCatalogo[]
  onUpdateTAP: (tap: TAP) => void
  onUpdateReceitas: (r: Receitas) => void
  onUpdateConciliacao: (c: ConciliacaoEverest) => void
  onUpdateCustosAdicionais: (items: CustoAdicional[]) => void
  onAddItem: (secaoId: string) => void
  onAddItemFromBanco: (secaoId: string, partial: Partial<ItemCusto>) => void
  onUpdateItem: (secaoId: string, itemId: string, changes: Partial<ItemCusto>) => void
  onDeleteItem: (secaoId: string, itemId: string) => void
  onSalvar: () => Promise<void>
  fornecedoresSugeridos?: string[]
}

type SalvarEstado = 'idle' | 'saving' | 'saved' | 'error'

export function ViewProjeto({
  projeto,
  bancoItens = [],
  onUpdateTAP,
  onUpdateReceitas,
  onUpdateConciliacao,
  onUpdateCustosAdicionais,
  onAddItem,
  onAddItemFromBanco,
  onUpdateItem,
  onDeleteItem,
  onSalvar,
  fornecedoresSugeridos = [],
}: ViewProjetoProps) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [abaAtiva, setAbaAtiva] = useState<string>('tap')
  const [salvarEstado, setSalvarEstado] = useState<SalvarEstado>('idle')

  async function handleSalvar() {
    setSalvarEstado('saving')
    try {
      await onSalvar()
      setSalvarEstado('saved')
      setTimeout(() => setSalvarEstado('idle'), 2000)
    } catch {
      setSalvarEstado('error')
      setTimeout(() => setSalvarEstado('idle'), 3000)
    }
  }

  const abas = [
    { id: 'tap', label: 'TAP' },
    ...projeto.secoes.map((s) => ({ id: s.id, label: s.numero })),
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'resumo', label: 'Resumo Geral' },
    { id: 'financeiro-everest', label: 'Financeiro Everest' },
  ]

  const handleUpdateItem = useCallback(
    (secaoId: string, itemId: string, changes: Partial<ItemCusto>) => {
      onUpdateItem(secaoId, itemId, changes)
    },
    [onUpdateItem],
  )

  const titulo = projeto.tap.turma || projeto.tap.instituicao || `Projeto #${projeto.id.slice(0, 6)}`

  const salvarBtn = {
    idle:   { label: 'Salvar',  icon: <Save size={15} />,   cls: 'btn-primary' },
    saving: { label: 'Salvando…', icon: <Loader size={15} className="animate-spin" />, cls: 'bg-surface-2 text-text-muted px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed' },
    saved:  { label: 'Salvo!',  icon: <Check size={15} />,  cls: 'bg-success text-white px-4 py-2 rounded-lg text-sm font-medium' },
    error:  { label: 'Erro ao salvar', icon: null, cls: 'bg-danger text-white px-4 py-2 rounded-lg text-sm font-medium' },
  }[salvarEstado]

  return (
    <div>
      <Header
        title={titulo}
        subtitle={`${projeto.tap.instituicao} — ${projeto.tap.anoRealizacao}`}
        actions={
          <>
            <BadgeEscola tipo={projeto.tap.tipoEscola} />
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() => gerarRelatorioPendencias(projeto)}
              title="Gerar PDF com itens ainda não fechados (estimado/orçando) para enviar à produção"
            >
              <FileWarning size={15} /> Relatório Pendências
            </button>
            <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/projetos')}>
              <ArrowLeft size={15} /> Projetos
            </button>
            {isAdmin && (
              <button
                className={`flex items-center gap-2 ${salvarBtn.cls}`}
                onClick={handleSalvar}
                disabled={salvarEstado === 'saving'}
              >
                {salvarBtn.icon}
                {salvarBtn.label}
              </button>
            )}
          </>
        }
      />

      {/* Abas */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {abas.map((aba) => {
          const secao = projeto.secoes.find((s) => s.id === aba.id)
          const label = secao ? `${secao.numero} ${secao.nome.split(' ').slice(1, 3).join(' ')}` : aba.label
          const temDivergencia = secao?.itens.some((i) => i.divergenciaTotais)
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`relative px-3 py-1.5 rounded-inner text-xs font-medium whitespace-nowrap transition-colors ${
                abaAtiva === aba.id
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-muted hover:text-text-main hover:bg-surface-2'
              }`}
            >
              {label}
              {temDivergencia && (
                <span
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#EA580C', display: 'inline-block', marginLeft: 5, verticalAlign: 'middle' }}
                  title="Esta seção tem itens com divergência de totais"
                />
              )}
            </button>
          )
        })}
      </div>

      {abaAtiva === 'tap' && (
        <TAPForm
          tap={projeto.tap}
          onChange={onUpdateTAP}
          totalConvidadosAtual={projeto.totalConvidadosAtual}
          isRealizado={projeto.status === 'realizado'}
        />
      )}

      {projeto.secoes.map((secao) =>
        abaAtiva === secao.id ? (
          <SecaoCusto
            key={secao.id}
            secao={secao}
            qtdFormandos={projeto.tap.qtdFormandos}
            bancoItens={bancoItens}
            onAddItem={() => onAddItem(secao.id)}
            onAddItemFromBanco={(partial) => onAddItemFromBanco(secao.id, partial)}
            onUpdateItem={(itemId, changes) => handleUpdateItem(secao.id, itemId, changes)}
            onDeleteItem={(itemId) => onDeleteItem(secao.id, itemId)}
            fornecedoresSugeridos={fornecedoresSugeridos}
          />
        ) : null,
      )}

      {abaAtiva === 'dashboard' && (
        <ProjectDashboard projeto={projeto} />
      )}

      {abaAtiva === 'resumo' && (
        <ResumoGeral
          projeto={projeto}
          onUpdateReceitas={onUpdateReceitas}
          onUpdateConciliacao={onUpdateConciliacao}
          onUpdateCustosAdicionais={onUpdateCustosAdicionais}
        />
      )}

      {abaAtiva === 'financeiro-everest' && (
        <FinanceiroEverestTab projeto={projeto} />
      )}
    </div>
  )
}
