import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { montarInstanciasPipeline, ETAPA_LABEL, type EtapaPipeline } from '../lib/rifaPipeline'
import { formatarData, formatarValor } from '../lib/formatadores'
import { normalizarChave } from '../../../lib/rifasSync'

// Mesma junção rifas+ganhadores+compras que vira a aba "VISÃO ÚNICA" da planilha —
// só que lida direto do banco (sempre atualizada, não depende de ter sincronizado).
// Somente leitura: pra editar, use Todas as Rifas / Ganhadores / Acompanhamento de Compra.

const ETAPA_COR: Record<EtapaPipeline, string> = {
  sorteada_sem_contato: 'text-primary',
  contatado_sem_compra: 'text-warning',
  aguardando_sorteio: 'text-text-muted',
  concluido: 'text-success',
  nao_vai_ter: 'text-danger',
}

export function VisaoUnicaPage() {
  const { rifas, ganhadores, compras, carregando } = useAtendimento()
  const [busca, setBusca] = useState('')

  const instancias = useMemo(() => montarInstanciasPipeline(rifas, ganhadores, compras), [rifas, ganhadores, compras])

  const instanciasFiltradas = useMemo(() => {
    if (!busca.trim()) return instancias
    const chave = normalizarChave(busca)
    return instancias.filter(i =>
      normalizarChave(i.rifa?.turma ?? i.ganhador?.turma ?? '').includes(chave) ||
      normalizarChave(i.ganhador?.nome_ganhador ?? '').includes(chave),
    )
  }, [instancias, busca])

  return (
    <div>
      <h1 className="text-xl font-bold text-text-main mb-1">Visão Única</h1>
      <p className="text-xs text-text-muted mb-4">
        Rifa + Ganhador + Compra juntos numa linha só, direto do banco. Somente consulta — pra editar, use as telas em Configurações.
      </p>

      <div className="relative mb-4 w-64">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por turma ou nome do ganhador..."
          className="bg-surface border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-text-main w-full"
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th rowSpan={2} className="px-3 py-2 bg-white/5 text-left text-text-muted uppercase tracking-wider text-[10px] font-semibold align-bottom sticky left-0">Status</th>
                <th colSpan={8} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'rgba(120,170,255,0.18)', color: '#a8c8ff' }}>Rifa</th>
                <th colSpan={9} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'rgba(120,220,140,0.18)', color: '#9fe8ae' }}>Ganhador</th>
                <th colSpan={6} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'rgba(255,220,120,0.18)', color: '#ffe9a8' }}>Compra</th>
              </tr>
              <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Turma</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Edição</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Formação</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Ano</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Vencimento</th>
                <th className="px-3 py-2 font-semibold">Prêmio</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Valor</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Situação</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Tipo</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Responsável</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Data Sorteio</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Ganhador</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Contato</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Contato Feito?</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Prêmio Entregue</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Financeiro</th>
                <th className="px-3 py-2 font-semibold">Obs</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Site</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Valor Compra</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Status Compra</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Data Compra</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Data Entrega</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Cartão</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr><td colSpan={24} className="px-4 py-8 text-center text-text-muted">Carregando...</td></tr>
              )}
              {!carregando && instanciasFiltradas.length === 0 && (
                <tr><td colSpan={24} className="px-4 py-8 text-center text-text-muted">Nada encontrado.</td></tr>
              )}
              {instanciasFiltradas.map((inst, i) => {
                const { rifa: r, ganhador: g, compra: c, etapa } = inst
                return (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                    <td className={`px-3 py-2 font-semibold whitespace-nowrap sticky left-0 bg-surface ${ETAPA_COR[etapa]}`}>{ETAPA_LABEL[etapa]}</td>
                    <td className="px-3 py-2 text-text-main whitespace-nowrap">{r?.turma ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r?.edicao ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r?.formacao ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r?.ano_formatura ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{formatarData(r?.dia_vencimento ?? null)}</td>
                    <td className="px-3 py-2 text-text-muted max-w-[180px] truncate" title={r?.premio_descricao ?? ''}>{r?.premio_descricao ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{formatarValor(r?.valor_boleto ?? null)}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r?.situacao ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{g?.tipo ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{g?.responsavel ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{formatarData(g?.data_sorteio ?? null)}</td>
                    <td className="px-3 py-2 text-text-main whitespace-nowrap">{g?.nome_ganhador ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{g?.contato ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{g ? (g.contato_feito ? 'Sim' : 'Não') : '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{g?.premio_entregue ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{g?.financeiro ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted max-w-[140px] truncate" title={g?.obs ?? ''}>{g?.obs ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{c?.site ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{formatarValor(c?.valor ?? null)}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{c?.status ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{formatarData(c?.data_compra ?? null)}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{c?.data_entrega_raw ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{c?.nome_cartao ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
