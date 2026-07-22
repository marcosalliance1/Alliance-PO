// Motor de conciliação puro (sem I/O) entre os gastos importados da planilha
// COMERCIAL (por projeto) e da planilha GERAL (extrato do cartão) — ver o desenho em
// cartaoGeralSheets.ts / cartaoComercialSheets.ts pra como cada lado é importado.

export const DIAS_TOLERANCIA_MATCH = 3

export type StatusConciliacao =
  | 'conciliado' | 'divergencia_data' | 'cartao_divergente' | 'nao_encontrado' | 'ambiguo' | 'fora_do_cartao' | 'sem_portador'

export interface ComercialParaConciliar {
  id: string
  valor: number
  data: string // ISO yyyy-mm-dd
  portador: string | null
  foraDoCartao: boolean
  portadorNaoInformado: boolean
}

export interface GeralParaConciliar {
  id: string
  valor: number
  data: string
  portador: string
  ehComercial: boolean
}

export interface ResultadoConciliacaoLinha {
  id: string
  status: StatusConciliacao
  matchGeralId: string | null
  difDias: number | null
}

function centavos(v: number): number {
  return Math.round(v * 100)
}

function diffDias(a: string, b: string): number {
  const ms = Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime())
  return Math.round(ms / 86_400_000)
}

export function conciliar(
  comercial: ComercialParaConciliar[],
  geral: GeralParaConciliar[],
  diasTolerancia: number = DIAS_TOLERANCIA_MATCH,
): { resultados: ResultadoConciliacaoLinha[]; geralSemCorrespondencia: string[] } {
  const resultados: ResultadoConciliacaoLinha[] = []
  const geralUsados = new Set<string>()

  for (const linha of comercial) {
    if (linha.foraDoCartao) {
      resultados.push({ id: linha.id, status: 'fora_do_cartao', matchGeralId: null, difDias: null })
      continue
    }
    // Sem anotação de cartão nenhuma na planilha comercial — dado incompleto, não "não
    // encontrado" (que implica que a busca rodou e falhou). Nunca tenta casar com a
    // GERAL, pra não sugerir um erro de conciliação que na verdade é falta de
    // preenchimento na origem.
    if (linha.portadorNaoInformado) {
      resultados.push({ id: linha.id, status: 'sem_portador', matchGeralId: null, difDias: null })
      continue
    }

    const mesmoPortadorEValor = geral.filter(
      g => g.portador === linha.portador && centavos(g.valor) === centavos(linha.valor),
    )

    if (mesmoPortadorEValor.length === 0) {
      // Nada no mesmo cartão — tenta achar o mesmo valor em QUALQUER outro portador,
      // dentro da tolerância de data, pra sinalizar um possível erro de anotação de
      // cartão na planilha comercial (em vez de simplesmente "não encontrado").
      const outroPortador = geral.filter(
        g => centavos(g.valor) === centavos(linha.valor) && diffDias(g.data, linha.data) <= diasTolerancia,
      )
      if (outroPortador.length === 1) {
        geralUsados.add(outroPortador[0].id)
        resultados.push({ id: linha.id, status: 'cartao_divergente', matchGeralId: outroPortador[0].id, difDias: diffDias(outroPortador[0].data, linha.data) })
      } else if (outroPortador.length > 1) {
        resultados.push({ id: linha.id, status: 'cartao_divergente', matchGeralId: null, difDias: null })
      } else {
        resultados.push({ id: linha.id, status: 'nao_encontrado', matchGeralId: null, difDias: null })
      }
      continue
    }

    if (mesmoPortadorEValor.length > 1) {
      // Mais de uma correspondência possível dentro do mesmo cartão — nunca decide
      // sozinho qual é a certa.
      resultados.push({ id: linha.id, status: 'ambiguo', matchGeralId: null, difDias: null })
      continue
    }

    const candidato = mesmoPortadorEValor[0]
    const dif = diffDias(candidato.data, linha.data)
    geralUsados.add(candidato.id)
    resultados.push({
      id: linha.id,
      status: dif <= diasTolerancia ? 'conciliado' : 'divergencia_data',
      matchGeralId: candidato.id,
      difDias: dif,
    })
  }

  const geralSemCorrespondencia = geral
    .filter(g => g.ehComercial && !geralUsados.has(g.id))
    .map(g => g.id)

  return { resultados, geralSemCorrespondencia }
}
