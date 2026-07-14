import { useState, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, Cell,
} from 'recharts'
import {
  RefreshCw, Loader, ListChecks, CheckCircle2, Clock, AlertTriangle,
  Flame, UserX, Target, X,
} from 'lucide-react'
import { useMarketing, type MarketingDemanda, type MarketingGrupo } from '../hooks/useMarketing'
import { tempoDesde } from '../utils/parseFinanceiro'
import { KPICard } from '../components/dashboard/KPICard'
import { Toast } from '../components/ui/Toast'

// ─── Constantes visuais ───────────────────────────────────────────
const C_SUCCESS = '#00b894'
const C_ABERTO  = '#fdcb6e'
const C_DANGER  = '#e17055'
const C_PRIMARY = '#e94560'
const C_AZUL    = '#0078d4'
const CORES_STATUS = ['#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16', '#EF4444']

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Tooltip reutilizável ─────────────────────────────────────────
function TTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-white/10 rounded-inner p-3 text-xs shadow-card">
      <p className="text-text-main font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-text-muted">{p.name}: <span style={{ color: p.color }}>{p.value.toLocaleString('pt-BR')}</span></p>
      ))}
    </div>
  )
}

function EmptyChart({ label = 'Sem dados' }: { label?: string }) {
  return <div className="flex items-center justify-center h-40 text-text-muted text-sm text-center px-4">{label}</div>
}

interface Filtro {
  tipo: 'grupo' | 'responsavel' | 'status' | 'clienteTurma'
  valor: string
  label: string
}

export function Marketing() {
  const { grupos, demandas, responsaveis, subitens, carregando, sincronizando, ultimoSync, sincronizarAgora } = useMarketing()
  const [filtro, setFiltro] = useState<Filtro | null>(null)
  const [esconderArquivo, setEsconderArquivo] = useState(true)
  const [corteOficial, setCorteOficial] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ texto: string; erro: boolean } | null>(null)

  const hoje = hojeISO()

  const grupoMap = useMemo(() => {
    const m = new Map<string, MarketingGrupo>()
    for (const g of grupos) m.set(g.group_id, g)
    return m
  }, [grupos])

  const respPorItem = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const r of responsaveis) {
      const arr = m.get(r.item_id) ?? []
      arr.push(r.person_name)
      m.set(r.item_id, arr)
    }
    return m
  }, [responsaveis])

  async function handleSincronizar() {
    setSyncMsg(null)
    try {
      const res = await sincronizarAgora()
      setSyncMsg({
        texto: `Sincronizado: ${res.synced} demandas, ${res.subitensSynced} subitens${res.errors.length ? ` — ${res.errors.length} erro(s)` : ''}.`,
        erro: res.errors.length > 0,
      })
    } catch (err) {
      setSyncMsg({ texto: `Erro ao sincronizar: ${(err as Error).message}`, erro: true })
    }
  }

  // ── KPIs ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = demandas.length
    const done = demandas.filter(d => d.status_is_done).length
    const emAberto = total - done
    const atrasadas = demandas.filter(d => !d.status_is_done && d.data_fim && d.data_fim < hoje).length
    const urgentesAberto = demandas.filter(d => !d.status_is_done && d.prioridade === 'Urgente').length
    const semResponsavelAberto = demandas.filter(d => !d.status_is_done && !(respPorItem.get(d.id)?.length)).length
    const matchOficial = demandas.filter(d => d.match_dimensao).length
    const pctOficial = total ? (matchOficial / total) * 100 : 0
    return { total, done, pctDone: total ? (done / total) * 100 : 0, emAberto, atrasadas, urgentesAberto, semResponsavelAberto, pctOficial, pctAproximado: 100 - pctOficial }
  }, [demandas, respPorItem, hoje])

  // ── Funil de status em aberto ─────────────────────────────────────
  const funilStatus = useMemo(() => {
    const porStatus: Record<string, number> = {}
    for (const d of demandas) {
      if (d.status_is_done) continue
      const s = d.status || '(sem status)'
      porStatus[s] = (porStatus[s] ?? 0) + 1
    }
    return Object.entries(porStatus).map(([status, qtd]) => ({ status, qtd })).sort((a, b) => b.qtd - a.qtd)
  }, [demandas])

  // ── Carga por responsável (top 10) ────────────────────────────────
  const cargaResponsavel = useMemo(() => {
    const porPessoa: Record<string, { concluidas: number; abertas: number }> = {}
    for (const d of demandas) {
      const nomes = respPorItem.get(d.id)
      if (!nomes?.length) continue
      for (const nome of nomes) {
        porPessoa[nome] ??= { concluidas: 0, abertas: 0 }
        if (d.status_is_done) porPessoa[nome].concluidas++
        else porPessoa[nome].abertas++
      }
    }
    return Object.entries(porPessoa)
      .map(([nome, v]) => ({ nome, ...v, total: v.concluidas + v.abertas }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [demandas, respPorItem])

  // ── Volume por cliente/projeto (aproximado x oficial) e por turma ──
  const volumeCliente = useMemo(() => {
    const porNome: Record<string, number> = {}
    for (const d of demandas) {
      const nome = corteOficial ? (d.dimensao_nome_projeto ?? 'Sem match oficial') : (d.cliente_extraido ?? '(sem cliente)')
      porNome[nome] = (porNome[nome] ?? 0) + 1
    }
    return Object.entries(porNome).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 12)
  }, [demandas, corteOficial])

  const volumeTurma = useMemo(() => {
    const porTurma: Record<string, number> = {}
    for (const d of demandas) {
      if (!d.turma) continue
      porTurma[d.turma] = (porTurma[d.turma] ?? 0) + 1
    }
    return Object.entries(porTurma).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd)
  }, [demandas])

  // ── Por grupo ────────────────────────────────────────────────────
  const porGrupo = useMemo(() => {
    const m: Record<string, { nome: string; concluidas: number; abertas: number }> = {}
    for (const d of demandas) {
      const g = d.group_id ? grupoMap.get(d.group_id) : undefined
      const isArquivo = g?.is_arquivo ?? false
      if (esconderArquivo && isArquivo) continue
      const nome = g?.nome ?? '(sem grupo)'
      m[nome] ??= { nome, concluidas: 0, abertas: 0 }
      if (d.status_is_done) m[nome].concluidas++
      else m[nome].abertas++
    }
    return Object.values(m).sort((a, b) => (b.concluidas + b.abertas) - (a.concluidas + a.abertas))
  }, [demandas, grupoMap, esconderArquivo])

  // ── Tendência mensal de concluídos ──────────────────────────────
  const tendenciaMensal = useMemo(() => {
    const doneItems = demandas.filter(d => d.status_is_done)
    const comData = doneItems.filter(d => d.data_fim)
    const porMes: Record<string, number> = {}
    for (const d of comData) {
      const mes = d.data_fim!.slice(0, 7)
      porMes[mes] = (porMes[mes] ?? 0) + 1
    }
    const serie = Object.entries(porMes).map(([mes, qtd]) => ({ mes, qtd })).sort((a, b) => a.mes.localeCompare(b.mes))
    const coberturaPct = doneItems.length ? (comData.length / doneItems.length) * 100 : 0
    return { serie, coberturaPct, totalDone: doneItems.length, comData: comData.length }
  }, [demandas])

  // ── Qualidade de dados ───────────────────────────────────────────
  const qualidade = useMemo(() => {
    const total = demandas.length || 1
    const campos = [
      { label: 'Responsável',     vazio: demandas.filter(d => !(respPorItem.get(d.id)?.length)).length },
      { label: 'Data de início',  vazio: demandas.filter(d => !d.data_inicio).length },
      { label: 'Data de fim',     vazio: demandas.filter(d => !d.data_fim).length },
      { label: 'Prioridade',      vazio: demandas.filter(d => !d.prioridade).length },
      { label: 'Turma',           vazio: demandas.filter(d => !d.turma).length },
      { label: 'Solicitante',     vazio: demandas.filter(d => !d.solicitante).length },
      { label: 'Link Demandas Internas', vazio: demandas.filter(d => !d.link_demandas_texto).length },
      { label: 'Arquivo anexado', vazio: demandas.filter(d => !d.tem_arquivo).length },
    ]
    return campos.map(c => ({ ...c, pct: (c.vazio / total) * 100 })).sort((a, b) => b.pct - a.pct)
  }, [demandas, respPorItem])

  // ── Subitens ─────────────────────────────────────────────────────
  const resumoSubitens = useMemo(() => {
    const itensComSub = new Set(subitens.map(s => s.item_id)).size
    const done = subitens.filter(s => s.status_is_done).length
    return { itensComSub, total: subitens.length, done, abertos: subitens.length - done }
  }, [subitens])

  // ── Prazos em atenção (com filtro de drilldown) ─────────────────
  const passaFiltro = useCallback((d: MarketingDemanda) => {
    if (!filtro) return true
    if (filtro.tipo === 'status') return d.status === filtro.valor
    if (filtro.tipo === 'grupo') {
      const g = d.group_id ? grupoMap.get(d.group_id) : undefined
      return (g?.nome ?? '(sem grupo)') === filtro.valor
    }
    if (filtro.tipo === 'responsavel') return !!respPorItem.get(d.id)?.includes(filtro.valor)
    if (filtro.tipo === 'clienteTurma') {
      const nomeCliente = corteOficial ? (d.dimensao_nome_projeto ?? 'Sem match oficial') : (d.cliente_extraido ?? '(sem cliente)')
      return nomeCliente === filtro.valor || d.turma === filtro.valor
    }
    return true
  }, [filtro, grupoMap, respPorItem, corteOficial])

  const prazosAtencao = useMemo(() => {
    return demandas
      .filter(d => !d.status_is_done && ((!!d.data_fim && d.data_fim < hoje) || d.prioridade === 'Urgente'))
      .filter(passaFiltro)
      .map(d => ({
        ...d,
        atrasada: !!d.data_fim && d.data_fim < hoje,
        grupoNome: (d.group_id ? grupoMap.get(d.group_id)?.nome : null) ?? '(sem grupo)',
        responsaveisNomes: respPorItem.get(d.id)?.join(', ') || '—',
      }))
      .sort((a, b) => (a.data_fim ?? '9999').localeCompare(b.data_fim ?? '9999'))
  }, [demandas, hoje, passaFiltro, grupoMap, respPorItem])

  if (carregando) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto flex items-center justify-center h-64 gap-3 text-text-muted">
        <Loader size={20} className="animate-spin" />
        <span className="text-sm">Carregando dados de marketing...</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-text-main text-xl font-bold">Marketing</h1>
          <p className="text-text-muted text-xs mt-0.5">
            Sincronização com o board Marketing do monday.com
            {ultimoSync && <> · última sincronização {tempoDesde(ultimoSync)}</>}
          </p>
        </div>
        <button
          onClick={handleSincronizar}
          disabled={sincronizando}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-white/5 border border-white/10 text-text-muted hover:text-text-main hover:bg-white/10"
        >
          {sincronizando ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sincronizar agora
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total de Demandas" value={kpis.total.toLocaleString('pt-BR')} icon={ListChecks} color={C_PRIMARY} />
        <KPICard title="% Concluído" value={`${kpis.pctDone.toFixed(1)}%`} subtitle={`${kpis.done} de ${kpis.total}`} icon={CheckCircle2} color={C_SUCCESS} />
        <KPICard title="Em Aberto" value={kpis.emAberto.toLocaleString('pt-BR')} icon={Clock} color={C_ABERTO} />
        <KPICard title="Atrasadas" value={kpis.atrasadas.toLocaleString('pt-BR')} icon={AlertTriangle} color={C_DANGER} />
        <KPICard title="Urgentes em Aberto" value={kpis.urgentesAberto.toLocaleString('pt-BR')} icon={Flame} color={C_PRIMARY} />
        <KPICard title="Aberto sem Responsável" value={kpis.semResponsavelAberto.toLocaleString('pt-BR')} icon={UserX} color={C_AZUL} />
        <KPICard title="Centro de Custo Oficial" value={`${kpis.pctOficial.toFixed(1)}%`} subtitle={`${kpis.pctAproximado.toFixed(1)}% aproximado`} icon={Target} color={C_AZUL} />
      </div>

      {/* Funil de status + Carga por responsável */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-3">Funil de Status <span className="text-xs text-text-muted font-normal">(em aberto, exclui Feito)</span></h3>
          {funilStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(160, funilStatus.length * 36)}>
              <BarChart data={funilStatus} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="status" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} width={150} />
                <Tooltip content={<TTip />} />
                <Bar dataKey="qtd" name="Demandas" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(data) => { const status = data.payload.status as string; setFiltro({ tipo: 'status', valor: status, label: `Status: ${status}` }) }}>
                  {funilStatus.map((f, i) => <Cell key={f.status} fill={CORES_STATUS[i % CORES_STATUS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-3">Carga por Responsável <span className="text-xs text-text-muted font-normal">(top 10)</span></h3>
          {cargaResponsavel.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, cargaResponsavel.length * 32)}>
              <BarChart data={cargaResponsavel} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<TTip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
                <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill={C_SUCCESS} cursor="pointer"
                  onClick={(data) => { const nome = data.payload.nome as string; setFiltro({ tipo: 'responsavel', valor: nome, label: `Responsável: ${nome}` }) }} />
                <Bar dataKey="abertas" name="Abertas" stackId="a" fill={C_ABERTO} radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(data) => { const nome = data.payload.nome as string; setFiltro({ tipo: 'responsavel', valor: nome, label: `Responsável: ${nome}` }) }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* Volume por cliente/projeto + por turma */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-text-main text-sm font-semibold">Volume por Cliente/Projeto</h3>
            <div className="flex items-center gap-1 text-xs bg-white/5 rounded-lg p-0.5">
              <button onClick={() => setCorteOficial(false)} className={`px-2.5 py-1 rounded-md transition-colors ${!corteOficial ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-main'}`}>Aproximado</button>
              <button onClick={() => setCorteOficial(true)} className={`px-2.5 py-1 rounded-md transition-colors ${corteOficial ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-main'}`}>Centro de custo oficial</button>
            </div>
          </div>
          {volumeCliente.length > 0 ? (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {volumeCliente.map((c, idx) => {
                const max = volumeCliente[0]?.qtd || 1
                const pct = (c.qtd / max) * 100
                const ativo = filtro?.tipo === 'clienteTurma' && filtro.valor === c.nome
                return (
                  <button key={c.nome} onClick={() => setFiltro({ tipo: 'clienteTurma', valor: c.nome, label: `Cliente/Projeto: ${c.nome}` })} className="w-full text-left cursor-pointer">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-text-muted truncate flex-1 pr-3">{idx + 1}. {c.nome}</span>
                      <span className="text-xs font-semibold text-text-main shrink-0">{c.qtd}</span>
                    </div>
                    <div className="h-1.5 bg-black/30 rounded-full">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ativo ? C_PRIMARY : C_AZUL, opacity: ativo ? 1 : 0.75 }} />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : <EmptyChart />}
        </div>

        <div className="card">
          <h3 className="text-text-main text-sm font-semibold mb-3">Volume por Turma</h3>
          {volumeTurma.length > 0 ? (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {volumeTurma.map((c, idx) => {
                const max = volumeTurma[0]?.qtd || 1
                const pct = (c.qtd / max) * 100
                const ativo = filtro?.tipo === 'clienteTurma' && filtro.valor === c.nome
                return (
                  <button key={c.nome} onClick={() => setFiltro({ tipo: 'clienteTurma', valor: c.nome, label: `Turma: ${c.nome}` })} className="w-full text-left cursor-pointer">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-text-muted truncate flex-1 pr-3">{idx + 1}. {c.nome}</span>
                      <span className="text-xs font-semibold text-text-main shrink-0">{c.qtd}</span>
                    </div>
                    <div className="h-1.5 bg-black/30 rounded-full">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ativo ? C_PRIMARY : C_AZUL, opacity: ativo ? 1 : 0.75 }} />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : <EmptyChart label="Nenhuma demanda com turma preenchida ainda (coluna TURMAS pouco usada no board hoje)" />}
        </div>
      </div>

      {/* Por grupo */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-text-main text-sm font-semibold">Volume por Grupo</h3>
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input type="checkbox" checked={esconderArquivo} onChange={e => setEsconderArquivo(e.target.checked)} className="accent-primary" />
            Esconder arquivo Lacrou
          </label>
        </div>
        {porGrupo.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porGrupo}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="nome" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={80} interval={0} />
              <YAxis tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<TTip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
              <Bar dataKey="concluidas" name="Concluídas" stackId="g" fill={C_SUCCESS} cursor="pointer"
                onClick={(data) => { const nome = data.payload.nome as string; setFiltro({ tipo: 'grupo', valor: nome, label: `Grupo: ${nome}` }) }} />
              <Bar dataKey="abertas" name="Abertas" stackId="g" fill={C_ABERTO} radius={[4, 4, 0, 0]} cursor="pointer"
                onClick={(data) => { const nome = data.payload.nome as string; setFiltro({ tipo: 'grupo', valor: nome, label: `Grupo: ${nome}` }) }} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </div>

      {/* Tendência mensal */}
      <div className="card">
        <h3 className="text-text-main text-sm font-semibold mb-3">Tendência Mensal de Concluídos</h3>
        {tendenciaMensal.serie.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={tendenciaMensal.serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<TTip />} />
                <Line type="monotone" dataKey="qtd" name="Concluídos" stroke={C_SUCCESS} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-text-muted mt-2">
              Cobertura: {tendenciaMensal.coberturaPct.toFixed(1)}% dos concluídos têm data de fim preenchida ({tendenciaMensal.comData} de {tendenciaMensal.totalDone}).
            </p>
          </>
        ) : <EmptyChart />}
      </div>

      {/* Qualidade de dados */}
      <div className="card">
        <h3 className="text-text-main text-sm font-semibold mb-4">Qualidade de Dados <span className="text-xs text-text-muted font-normal">(% de campos vazios)</span></h3>
        <div className="space-y-3">
          {qualidade.map(c => {
            const cor = c.pct > 50 ? C_DANGER : c.pct > 20 ? C_ABERTO : C_SUCCESS
            return (
              <div key={c.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-text-muted">{c.label}</span>
                  <span className="text-xs font-semibold" style={{ color: cor }}>{c.pct.toFixed(1)}% vazio</span>
                </div>
                <div className="h-1.5 bg-black/30 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: cor, opacity: 0.8 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Subitens */}
      <div className="card">
        <h3 className="text-text-main text-sm font-semibold mb-4">Subitens</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-text-main">{resumoSubitens.itensComSub}</p>
            <p className="text-xs text-text-muted mt-0.5">itens com subitens</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-main">{resumoSubitens.total}</p>
            <p className="text-xs text-text-muted mt-0.5">subitens no total</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: C_SUCCESS }}>{resumoSubitens.done}</p>
            <p className="text-xs text-text-muted mt-0.5">concluídos</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: C_ABERTO }}>{resumoSubitens.abertos}</p>
            <p className="text-xs text-text-muted mt-0.5">em aberto</p>
          </div>
        </div>
      </div>

      {/* Prazos em atenção */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
          <span className="text-text-main text-sm font-semibold">Prazos em Atenção <span className="text-xs text-text-muted font-normal">({prazosAtencao.length} · atrasadas ou urgentes em aberto)</span></span>
          {filtro && (
            <button onClick={() => setFiltro(null)} className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity">
              <X size={12} /> {filtro.label} · Limpar filtro
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/5 sticky top-0">
                <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-2 font-semibold">Demanda</th>
                  <th className="px-4 py-2 font-semibold">Grupo</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Prioridade</th>
                  <th className="px-4 py-2 font-semibold">Responsável</th>
                  <th className="px-4 py-2 font-semibold">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {prazosAtencao.map(d => (
                  <tr key={d.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2 text-text-main max-w-xs truncate" title={d.nome}>{d.nome}</td>
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap">{d.grupoNome}</td>
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap">{d.status}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{d.prioridade === 'Urgente' && <span className="text-primary font-semibold">Urgente</span>}</td>
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap">{d.responsaveisNomes}</td>
                    <td className={`px-4 py-2 font-medium whitespace-nowrap ${d.atrasada ? 'text-danger' : 'text-text-muted'}`}>
                      {d.data_fim ?? '—'}{d.atrasada ? ' (atrasado)' : ''}
                    </td>
                  </tr>
                ))}
                {prazosAtencao.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Nenhuma demanda em atenção com esse filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {syncMsg && <Toast mensagem={syncMsg.texto} tipo={syncMsg.erro ? 'erro' : 'sucesso'} onFechar={() => setSyncMsg(null)} />}
    </div>
  )
}
