import type { ConfiguracaoAutomacoes, ItemOrcamento, LinhaTabelaQtde, EventType } from '../types'
import { newItemId } from './formatters'
import { getEventCategory } from '../data/defaults'

function interpolateQtde(tabela: LinhaTabelaQtde[], qtde: number): number {
  if (qtde <= tabela[0].convidados) return tabela[0].quantidade
  const last = tabela[tabela.length - 1]
  if (qtde >= last.convidados) return last.quantidade
  for (let i = 0; i < tabela.length - 1; i++) {
    const a = tabela[i], b = tabela[i + 1]
    if (qtde >= a.convidados && qtde <= b.convidados) {
      const ratio = (qtde - a.convidados) / (b.convidados - a.convidados)
      return Math.ceil(a.quantidade + ratio * (b.quantidade - a.quantidade))
    }
  }
  return last.quantidade
}

function makeItem(
  itemName: string,
  qtde: number,
  custoUnitario: number,
  automatico = true,
  grupo?: string,
): ItemOrcamento {
  const totalOrcado = qtde * custoUnitario
  return {
    id: newItemId(),
    item: itemName,
    fornecedor: '',
    qtde,
    custoUnitario,
    totalOrcado,
    totalPagoReal: 0,
    valorPassadoCliente: 0,
    bvAbsoluto: 0,
    bvPercentual: 0,
    status: 'PENDENTE',
    notas: '',
    automatico,
    fixo: false,
    grupo,
  }
}

function makeFixo(itemName: string): ItemOrcamento {
  return {
    id: newItemId(),
    item: itemName,
    fornecedor: '',
    qtde: 1,
    custoUnitario: 0,
    totalOrcado: 0,
    totalPagoReal: 0,
    valorPassadoCliente: 0,
    bvAbsoluto: 0,
    bvPercentual: 0,
    status: 'PENDENTE',
    notas: '',
    automatico: false,
    fixo: true,
  }
}

export function gerarEquipeAutomatica(
  tipo: EventType,
  qtde: number,
  config: ConfiguracaoAutomacoes,
): ItemOrcamento[] {
  const itens: ItemOrcamento[] = []

  // ── Time Alliance (drilldown por categoria de evento) ──
  const categoria = getEventCategory(tipo, qtde)
  if (categoria && config.equipeEvento[categoria]) {
    for (const e of config.equipeEvento[categoria]) {
      itens.push(makeItem(e.cargo, e.qtde, e.valor, true, 'Time Alliance'))
    }
  }

  // ── Segurança ──
  const nSeg = interpolateQtde(config.seguranca, qtde)
  itens.push(makeItem('Segurança', nSeg, config.custoSeguranca, true))

  // ── Brigadista ──
  const nBrig = interpolateQtde(config.brigadista, qtde)
  itens.push(makeItem('Brigadista', nBrig, config.custoBrigadista, true))

  // ── Ambulância (fixo manual) ──
  itens.push(makeFixo('Ambulância'))

  // ── Limpeza ──
  const nLimp = interpolateQtde(config.limpeza, qtde)
  itens.push(makeItem('Limpeza', nLimp, config.custoLimpeza, true))

  // ── Limpeza Pré / Pós (fixos manuais) ──
  itens.push(makeFixo('Limpeza Pré'))
  itens.push(makeFixo('Limpeza Pós'))

  // ── Estoquista (fixo manual) ──
  itens.push(makeFixo('Estoquista'))

  // ── Carregador (sempre 2) ──
  itens.push(makeItem('Carregador', 2, config.custoCarregador, true))

  // ── Hostess ──
  const nHostess = interpolateQtde(config.hostess, qtde)
  itens.push(makeItem('Hostess', nHostess, config.custoHostess, true))

  // ── VJ (fixo manual) ──
  itens.push(makeFixo('VJ'))

  return itens
}

export function recalcularItem(item: ItemOrcamento): ItemOrcamento {
  const totalOrcado = item.qtde * item.custoUnitario
  // "Pago (Comissão)": a comissão pagou do bolso deles — não sai da conta Alliance.
  // Zera o Total Pago (não fura a conciliação Everest) e não gera BV. O V. Cliente permanece.
  if (item.status === 'PAGO_COMISSAO') {
    return { ...item, totalOrcado, totalPagoReal: 0, bvAbsoluto: 0, bvPercentual: 0 }
  }
  const bvAbsoluto = item.valorPassadoCliente - item.totalPagoReal
  const bvPercentual = item.totalPagoReal > 0
    ? (bvAbsoluto / item.totalPagoReal) * 100
    : 0
  return { ...item, totalOrcado, bvAbsoluto, bvPercentual }
}
