import { useMemo } from 'react'
import { dataDoMarco, hojeISO, nomeTurma, useProjetosOpcoes, useVariasCategorias } from './useRegistros'

// Avisos de hoje (o "sininho" do painel original). No original eles vinham do Calendário
// e de Sorteios; como o Calendário virou a Google Agenda e Sorteios entra na Fase 3,
// aqui os avisos vêm de Eventos, da Régua ao Contrário e de Aniversários.
// Rifas para sortear / boletos vencendo hoje entram junto com Sorteios (Fase 3).

export interface Aviso {
  grupo: string
  titulo: string
  sub: string
  link: string
}

export function useAvisosHoje(gatilho = '') {
  const { porCategoria, carregando, erro } = useVariasCategorias(['eventos', 'regua', 'turmas', 'aniversarios'], gatilho)
  const projetos = useProjetosOpcoes()

  const avisos = useMemo(() => {
    const hoje = hojeISO()
    const lista: Aviso[] = []

    for (const e of porCategoria.eventos ?? []) {
      if (e.dados.data === hoje && e.status !== 'Cancelado') {
        lista.push({
          grupo: 'Eventos de hoje',
          titulo: String(e.dados.nomeEvento || e.dados.tipoEvento || 'Evento'),
          sub: [nomeTurma(e, projetos), e.dados.horario, e.dados.local].filter(Boolean).join(' · '),
          link: '/atendimento/eventos',
        })
      }
    }

    const dataEventoPorPO = new Map<string, unknown>()
    for (const t of porCategoria.turmas ?? []) if (t.projeto_id) dataEventoPorPO.set(t.projeto_id, t.dados.dataEvento)
    for (const m of porCategoria.regua ?? []) {
      if (m.status === 'Feito' || !m.projeto_id) continue
      if (dataDoMarco(dataEventoPorPO.get(m.projeto_id), m.dados.diasAntes) === hoje) {
        lista.push({
          grupo: 'Régua ao Contrário: marcos de hoje',
          titulo: String(m.dados.marco ?? 'Marco'),
          sub: `${nomeTurma(m, projetos)} · D-${String(m.dados.diasAntes ?? 0)}`,
          link: `/atendimento/regua?turma=${m.projeto_id}`,
        })
      }
    }

    const mmdd = hoje.slice(5)
    for (const a of porCategoria.aniversarios ?? []) {
      if (String(a.dados.aniversario ?? '').slice(5) === mmdd) {
        lista.push({
          grupo: 'Aniversários de hoje',
          titulo: String(a.dados.formando ?? 'Formando'),
          sub: nomeTurma(a, projetos),
          link: '/atendimento/aniversarios',
        })
      }
    }
    return lista
  }, [porCategoria, projetos])

  return { avisos, carregando, erro }
}
