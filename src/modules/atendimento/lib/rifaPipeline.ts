// Conceito central: rifas / rifas_ganhadores / rifas_compras não são 3 entidades soltas —
// são 3 ETAPAS SEQUENCIAIS de um único pipeline por rifa (ou por sorteio avulso, quando
// rifa_id é null). Toda lógica de "está completo?"/"em que pé está?" fica centralizada
// aqui, para não ser reimplementada diferente em cada tela.
import type { Rifa, RifaGanhador, RifaCompra } from '../../../hooks/useRifas'

export type PremioEntregueClasse = 'sim' | 'nao' | 'outro'

export function classificarPremioEntregue(texto: string | null): PremioEntregueClasse {
  const t = (texto ?? '').trim().toLowerCase()
  if (!t) return 'outro'
  if (t.includes('não') || t.includes('nao')) return 'nao'
  if (t.includes('sim')) return 'sim'
  return 'outro'
}

export interface RifaPipelineStatus {
  temEtapa1: boolean // false = sorteio avulso (Sorteio Comissão/Comercial, Torneio Personalidades) — pipeline de 2 etapas
  sorteada: boolean // etapa 1: situacao SORTEADA ou FECHADA (o sorteio já aconteceu)
  contatoFeito: boolean // etapa 2
  premioComprado: boolean // etapa 3
  completo: boolean
  avisoIntegridade: string | null
}

// Uma rifa (com etapa 1) "fecha o ciclo" quando situacao=FECHADA E contato_feito E
// premio_entregue~sim E status='Comprado'. Um sorteio avulso (sem etapa 1) fecha o ciclo
// só com as etapas 2 e 3.
export function calcularPipeline(rifa: Rifa | null, ganhador: RifaGanhador | null, compra: RifaCompra | null): RifaPipelineStatus {
  const temEtapa1 = !!rifa
  const sorteada = rifa ? rifa.situacao === 'SORTEADA' || rifa.situacao === 'FECHADA' : !!ganhador
  const contatoFeito = !!ganhador?.contato_feito
  const premioEntregueSim = classificarPremioEntregue(ganhador?.premio_entregue ?? null) === 'sim'
  const premioComprado = compra?.status === 'Comprado'

  let avisoIntegridade: string | null = null
  if (premioComprado && ganhador && !contatoFeito) {
    avisoIntegridade = 'Prêmio marcado como comprado, mas o contato com o ganhador ainda não foi registrado como feito.'
  }

  const completo = temEtapa1
    ? rifa!.situacao === 'FECHADA' && contatoFeito && premioEntregueSim && premioComprado
    : contatoFeito && premioEntregueSim && premioComprado

  return { temEtapa1, sorteada, contatoFeito, premioComprado, completo, avisoIntegridade }
}

export function isRifaPipelineCompleto(rifa: Rifa | null, ganhador: RifaGanhador | null, compra: RifaCompra | null): boolean {
  return calcularPipeline(rifa, ganhador, compra).completo
}

// Classificação de etapa única, usada tanto pelo Kanban (colunas visuais) quanto pela
// aba "VISÃO ÚNICA" da planilha (coluna "Status do Pipeline") — uma função só, pra não
// ter duas lógicas de "em que pé está" divergindo com o tempo.
export type EtapaPipeline = 'nao_vai_ter' | 'aguardando_sorteio' | 'sorteada_sem_contato' | 'contatado_sem_compra' | 'concluido'

export const ETAPA_LABEL: Record<EtapaPipeline, string> = {
  nao_vai_ter: 'Não vai ter',
  aguardando_sorteio: 'Aguardando sorteio',
  sorteada_sem_contato: 'Sorteada — falta contatar',
  contatado_sem_compra: 'Contatado — falta comprar',
  concluido: 'Concluído',
}

// Prioridade de exibição: o que precisa de ação primeiro (menor número = mais urgente).
export const ETAPA_PRIORIDADE: Record<EtapaPipeline, number> = {
  sorteada_sem_contato: 0,
  contatado_sem_compra: 1,
  aguardando_sorteio: 2,
  concluido: 3,
  nao_vai_ter: 4,
}

export function etapaPipeline(rifa: Rifa | null, ganhador: RifaGanhador | null, compra: RifaCompra | null): EtapaPipeline {
  if (rifa?.situacao === 'NÃO VAI TER') return 'nao_vai_ter'
  if (isRifaPipelineCompleto(rifa, ganhador, compra)) return 'concluido'
  if (ganhador?.contato_feito) return 'contatado_sem_compra'
  if (rifa ? rifa.situacao === 'SORTEADA' : !!ganhador) return 'sorteada_sem_contato'
  return 'aguardando_sorteio'
}

export interface InstanciaPipeline {
  rifa: Rifa | null
  ganhador: RifaGanhador | null
  compra: RifaCompra | null
  etapa: EtapaPipeline
}

// Enumera toda "instância de pipeline" existente — uma por rifa (com ou sem ganhador/
// compra ainda) mais uma por sorteio avulso (ganhador sem rifa_id) — ordenada pela
// mesma prioridade usada no Dashboard/Kanban (o que precisa de ação primeiro, depois
// pela data mais relevante de cada etapa). Usada tanto pelo Kanban quanto pela geração
// da aba "VISÃO ÚNICA" da planilha, pra não duplicar a lógica de junção/ordenação.
export function montarInstanciasPipeline(rifas: Rifa[], ganhadores: RifaGanhador[], compras: RifaCompra[]): InstanciaPipeline[] {
  const instancias: (InstanciaPipeline & { dataOrdenacao: string })[] = []

  for (const rifa of rifas) {
    const ganhador = ganhadores.find(g => g.rifa_id === rifa.id) ?? null
    const compra = ganhador ? compras.find(c => c.ganhador_id === ganhador.id) ?? null : null
    const etapa = etapaPipeline(rifa, ganhador, compra)
    instancias.push({ rifa, ganhador, compra, etapa, dataOrdenacao: ganhador?.data_sorteio ?? rifa.dia_vencimento ?? '9999-12-31' })
  }

  for (const ganhador of ganhadores.filter(g => !g.rifa_id)) {
    const compra = compras.find(c => c.ganhador_id === ganhador.id) ?? null
    const etapa = etapaPipeline(null, ganhador, compra)
    instancias.push({ rifa: null, ganhador, compra, etapa, dataOrdenacao: ganhador.data_sorteio ?? '9999-12-31' })
  }

  instancias.sort((a, b) => ETAPA_PRIORIDADE[a.etapa] - ETAPA_PRIORIDADE[b.etapa] || a.dataOrdenacao.localeCompare(b.dataOrdenacao))
  return instancias
}

// Acha o ganhador/compra vinculados a uma rifa (a partir dos arrays já carregados em
// memória pelo AtendimentoContext) — evita cada tela reimplementar seu próprio find().
export function useRifaPipeline(
  rifaId: string | null,
  ganhadores: RifaGanhador[],
  compras: RifaCompra[],
  rifas?: Rifa[],
): { rifa: Rifa | null; ganhador: RifaGanhador | null; compra: RifaCompra | null; status: RifaPipelineStatus } {
  const rifa = (rifaId && rifas ? rifas.find(r => r.id === rifaId) : null) ?? null
  const ganhador = ganhadores.find(g => g.rifa_id === rifaId) ?? null
  const compra = ganhador ? compras.find(c => c.ganhador_id === ganhador.id) ?? null : null
  return { rifa, ganhador, compra, status: calcularPipeline(rifa, ganhador, compra) }
}

// Mesma ideia, mas ancorada num ganhador (usado na tela Ganhadores, inclusive pra
// sorteios avulsos sem rifa_id).
export function pipelineDoGanhador(
  ganhador: RifaGanhador,
  compras: RifaCompra[],
  rifas: Rifa[],
): { rifa: Rifa | null; compra: RifaCompra | null; status: RifaPipelineStatus } {
  const rifa = ganhador.rifa_id ? rifas.find(r => r.id === ganhador.rifa_id) ?? null : null
  const compra = compras.find(c => c.ganhador_id === ganhador.id) ?? null
  return { rifa, compra, status: calcularPipeline(rifa, ganhador, compra) }
}
