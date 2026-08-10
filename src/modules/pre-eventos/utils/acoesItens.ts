// Ações em massa sobre os itens do orçamento: apagar linhas vazias e preencher
// V. Cliente (repasse do Pago onde não há BV). Funções puras — não mutam o original.
import type { Orcamento, ItemOrcamento } from '../types'
import { recalcularItem } from './automacoes'
import { SECOES } from './matchEverest'

// Linha vazia = sem fornecedor E sem nenhum valor (orçado, pago, cliente).
// O nome não conta — pega as linhas de template não usadas.
export function isLinhaVazia(i: ItemOrcamento): boolean {
  return !(i.fornecedor || '').trim()
    && (i.totalOrcado || 0) === 0
    && (i.totalPagoReal || 0) === 0
    && (i.valorPassadoCliente || 0) === 0
}

export function listarVazias(orc: Orcamento): { secaoLabel: string; nome: string; id: string }[] {
  const out: { secaoLabel: string; nome: string; id: string }[] = []
  for (const s of SECOES) for (const it of orc[s.key]) {
    if (isLinhaVazia(it)) out.push({ secaoLabel: s.label, nome: it.item || '(sem nome)', id: it.id })
  }
  return out
}

export function apagarVazias(orc: Orcamento): { orcamento: Orcamento; removidos: number } {
  let removidos = 0
  let novo: Orcamento = { ...orc }
  for (const s of SECOES) {
    const filtrados = orc[s.key].filter(it => {
      const vazia = isLinhaVazia(it)
      if (vazia) removidos++
      return !vazia
    })
    novo = { ...novo, [s.key]: filtrados }
  }
  return { orcamento: novo, removidos }
}

// Itens elegíveis pro "Preencher V. Cliente": os que já têm Total Pago > 0.
export function itensComPago(orc: Orcamento): { secaoLabel: string; item: ItemOrcamento }[] {
  const out: { secaoLabel: string; item: ItemOrcamento }[] = []
  for (const s of SECOES) for (const it of orc[s.key]) {
    if ((it.totalPagoReal || 0) > 0) out.push({ secaoLabel: s.label, item: it })
  }
  return out
}

// Preenche V. Cliente = Pago nos itens com Pago > 0 que NÃO têm BV (não marcados).
// Os marcados (com BV) ficam intocados pra o usuário pôr o valor à mão.
export function preencherVCliente(orc: Orcamento, idsComBV: Set<string>): { orcamento: Orcamento; preenchidos: number } {
  let preenchidos = 0
  let novo: Orcamento = { ...orc }
  for (const s of SECOES) {
    const itens = orc[s.key].map(it => {
      if ((it.totalPagoReal || 0) > 0 && !idsComBV.has(it.id)) {
        preenchidos++
        return recalcularItem({ ...it, valorPassadoCliente: it.totalPagoReal })
      }
      return it
    })
    novo = { ...novo, [s.key]: itens }
  }
  return { orcamento: novo, preenchidos }
}
