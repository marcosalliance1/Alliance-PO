// Fórmula dos lotes de ingresso (venda). A partir do nº de formandos (Info do
// Evento) e do custo variável por pessoa (A&B ÷ formandos), gera 5 lotes com
// percentuais fixos de quantidade e de preço. Considera 80% de venda (a soma dos
// % de quantidade dá 80% dos formandos, de propósito).
import type { Orcamento, SymplaLote } from '../types'
import { newItemId } from './formatters'

export const LOTES_MODELO = [
  { nome: 'No Escuro / Pré-lote', pctQtde: 0.15, pctValor: 1.30 },
  { nome: 'Lote 1',               pctQtde: 0.20, pctValor: 1.40 },
  { nome: 'Lote 2',               pctQtde: 0.15, pctValor: 1.50 },
  { nome: 'Lote 3',               pctQtde: 0.20, pctValor: 1.60 },
  { nome: 'Lote 4',               pctQtde: 0.10, pctValor: 1.80 },
]

// Custo variável por pessoa = total da seção A&B ÷ formandos (da Info do Evento).
export function custoVariavelPorPessoa(orc: Orcamento): { valor: number; formandos: number; totalAB: number } {
  const formandos = parseInt((orc.infoEvento?.formandos ?? '').replace(/[^\d]/g, ''), 10) || 0
  const totalAB = orc.abBebidas.reduce((s, i) => s + i.totalOrcado, 0)
  const valor = formandos > 0 ? totalAB / formandos : 0
  return { valor, formandos, totalAB }
}

export function gerarLotesIngresso(orc: Orcamento): SymplaLote[] {
  const { valor: custoVar, formandos } = custoVariavelPorPessoa(orc)
  if (formandos <= 0 || custoVar <= 0) return []
  return LOTES_MODELO.map(l => {
    const qtde = Math.round(formandos * l.pctQtde)
    const valorUnitario = Math.round(custoVar * l.pctValor * 100) / 100
    return { id: newItemId(), nome: l.nome, qtde, valorUnitario, total: Math.round(qtde * valorUnitario * 100) / 100 }
  })
}
