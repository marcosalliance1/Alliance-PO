import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, PhoneCall, ShoppingCart, DollarSign } from 'lucide-react'
import { KPICard } from '../../../components/dashboard/KPICard'
import { useAtendimento } from '../contexts/AtendimentoContext'
import { MesCalendario, type DiaEvento } from '../components/MesCalendario'
import { calcularPipeline } from '../lib/rifaPipeline'
import { formatarValor } from '../lib/formatadores'
import type { Rifa, RifaGanhador } from '../../../hooks/useRifas'

function diasEntre(dataISO: string): number {
  return Math.floor((Date.now() - new Date(dataISO).getTime()) / 86_400_000)
}

interface ItemAtencao {
  id: string
  urgencia: number
  turma: string
  mensagem: string
  destino: string
}

export function DashboardRifasPage() {
  const { rifas, ganhadores, compras, dimensaoProjetos } = useAtendimento()
  const navigate = useNavigate()
  const [filtroEnsino, setFiltroEnsino] = useState('')
  const [filtroInstituicao, setFiltroInstituicao] = useState('')

  const hojeISO = new Date().toISOString().slice(0, 10)
  const em7DiasISO = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

  const dimensaoPorId = useMemo(() => new Map(dimensaoProjetos.map(d => [d.id, d])), [dimensaoProjetos])
  const ensinos = useMemo(() => Array.from(new Set(dimensaoProjetos.map(d => d.ensino))).sort(), [dimensaoProjetos])
  const instituicoes = useMemo(() => {
    const base = filtroEnsino ? dimensaoProjetos.filter(d => d.ensino === filtroEnsino) : dimensaoProjetos
    return Array.from(new Set(base.map(d => d.instituicao))).sort()
  }, [dimensaoProjetos, filtroEnsino])

  const filtroAtivo = !!(filtroEnsino || filtroInstituicao)

  function rifaPassaFiltro(r: Rifa): boolean {
    if (!filtroAtivo) return true
    const dim = r.dimensao_projeto_id ? dimensaoPorId.get(r.dimensao_projeto_id) : null
    if (!dim) return false
    if (filtroEnsino && dim.ensino !== filtroEnsino) return false
    if (filtroInstituicao && dim.instituicao !== filtroInstituicao) return false
    return true
  }

  const rifasFiltradas = useMemo(() => rifas.filter(rifaPassaFiltro), [rifas, filtroEnsino, filtroInstituicao, dimensaoPorId])
  const rifasFiltradasIds = useMemo(() => new Set(rifasFiltradas.map(r => r.id)), [rifasFiltradas])

  function ganhadorPassaFiltro(g: RifaGanhador): boolean {
    if (!filtroAtivo) return true
    return !!g.rifa_id && rifasFiltradasIds.has(g.rifa_id)
  }

  const ganhadoresFiltrados = useMemo(() => ganhadores.filter(ganhadorPassaFiltro), [ganhadores, filtroEnsino, filtroInstituicao, rifasFiltradasIds])

  const rifasSorteadasAguardandoContato = ganhadoresFiltrados.filter(g => !g.contato_feito).length

  const premiosAguardandoCompra = ganhadoresFiltrados.filter(g => {
    const compra = compras.find(c => c.ganhador_id === g.id)
    return !compra || compra.status !== 'Comprado'
  }).length

  const sorteiosProximos7Dias = rifasFiltradas.filter(
    r => r.situacao === 'EM ANDAMENTO' && r.dia_vencimento && r.dia_vencimento >= hojeISO && r.dia_vencimento <= em7DiasISO,
  ).length

  const valorPendenteCompra = rifasFiltradas.reduce((soma, r) => {
    const ganhador = ganhadores.find(g => g.rifa_id === r.id) ?? null
    const compra = ganhador ? compras.find(c => c.ganhador_id === ganhador.id) ?? null : null
    const status = calcularPipeline(r, ganhador, compra)
    return status.premioComprado ? soma : soma + (r.valor_boleto ?? 0)
  }, 0)

  // Urgência mistura 3 tipos de item numa escala aproximada e comparável: sorteio
  // chegando em N dias vira "N dias de antecedência" (quanto menor, mais urgente,
  // por isso 7-N), e atrasos de contato/compra usam o atraso em dias direto — os
  // dois ficam numa faixa parecida (0-15ish) e se intercalam de forma razoável.
  const itensAtencao = useMemo(() => {
    const itens: ItemAtencao[] = []

    for (const r of rifasFiltradas) {
      if (r.situacao !== 'EM ANDAMENTO' || !r.dia_vencimento) continue
      if (r.dia_vencimento < hojeISO) continue
      const diasAte = diasEntre(r.dia_vencimento) * -1
      if (diasAte > 3) continue
      itens.push({
        id: `sorteio-${r.id}`,
        urgencia: 7 - diasAte,
        turma: r.turma,
        mensagem: diasAte === 0
          ? `${r.turma} — sorteio é hoje (${r.premio_descricao ?? 'prêmio'})`
          : `${r.turma} — sorteio em ${diasAte} dia(s) (${r.premio_descricao ?? 'prêmio'})`,
        destino: '/atendimento/rifas/kanban',
      })
    }

    for (const g of ganhadoresFiltrados) {
      if (g.contato_feito || !g.data_sorteio) continue
      const diasAtraso = diasEntre(g.data_sorteio)
      if (diasAtraso <= 5) continue
      itens.push({
        id: `contato-${g.id}`,
        urgencia: diasAtraso,
        turma: g.turma,
        mensagem: `${g.turma} — contatar ${g.nome_ganhador ?? 'o ganhador'} sobre ${g.premio_descricao ?? 'o prêmio'}, sorteado há ${diasAtraso} dias`,
        destino: '/atendimento/rifas/ganhadores',
      })
    }

    for (const g of ganhadoresFiltrados) {
      if (!g.data_sorteio) continue
      const compra = compras.find(c => c.ganhador_id === g.id)
      if (compra?.status === 'Comprado') continue
      const diasAtraso = diasEntre(g.data_sorteio)
      if (diasAtraso <= 5) continue
      itens.push({
        id: `compra-${g.id}`,
        urgencia: diasAtraso,
        turma: g.turma,
        mensagem: `${g.turma} — comprar o prêmio de ${g.nome_ganhador ?? 'o ganhador'} (${g.premio_descricao ?? '—'}), sorteado há ${diasAtraso} dias`,
        destino: '/atendimento/rifas/compras',
      })
    }

    return itens.sort((a, b) => b.urgencia - a.urgencia).slice(0, 10)
  }, [rifasFiltradas, ganhadoresFiltrados, compras, hojeISO])

  const eventosPorDia = useMemo(() => {
    const map: Record<string, DiaEvento[]> = {}
    for (const r of rifasFiltradas) {
      if (!r.dia_vencimento || (r.situacao !== 'EM ANDAMENTO' && r.situacao !== 'SORTEADA')) continue
      const cor = r.situacao === 'SORTEADA' ? 'bg-success' : 'bg-warning'
      if (!map[r.dia_vencimento]) map[r.dia_vencimento] = []
      map[r.dia_vencimento].push({ cor })
    }
    return map
  }, [rifasFiltradas])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-text-main">Dashboard</h1>
        <div className="flex gap-3">
          <select
            value={filtroEnsino}
            onChange={e => { setFiltroEnsino(e.target.value); setFiltroInstituicao('') }}
            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
          >
            <option value="">Todos os ensinos</option>
            {ensinos.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            value={filtroInstituicao}
            onChange={e => setFiltroInstituicao(e.target.value)}
            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-text-main"
          >
            <option value="">Todas as instituições</option>
            {instituicoes.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Sorteadas aguardando contato" value={String(rifasSorteadasAguardandoContato)} icon={PhoneCall} color="#fdcb6e" />
        <KPICard title="Prêmios aguardando compra" value={String(premiosAguardandoCompra)} icon={ShoppingCart} color="#e17055" />
        <KPICard title="Sorteios nos próximos 7 dias" value={String(sorteiosProximos7Dias)} icon={Gift} color="#e94560" />
        <KPICard title="Valor pendente de compra" value={formatarValor(valorPendenteCompra)} icon={DollarSign} color="#00b894" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <h2 className="text-sm font-semibold text-text-main mb-3">Atenção necessária hoje</h2>
          {itensAtencao.length === 0 && <div className="text-sm text-text-muted">Tudo em dia por aqui. 🎉</div>}
          <div className="space-y-2">
            {itensAtencao.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.destino)}
                className="w-full text-left bg-bg rounded-lg p-3 border border-white/5 hover:border-primary/30 transition-colors text-sm text-text-main"
              >
                {item.mensagem}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-text-main mb-3 capitalize">
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h2>
          <MesCalendario
            mes={new Date()}
            eventosPorDia={eventosPorDia}
            compacto
            aoClicarDia={iso => navigate(`/atendimento/rifas/calendario?dia=${iso}`)}
          />
        </div>
      </div>
    </div>
  )
}
