import type { ItemCusto, SecaoCusto, Projeto, TotaisSecao, ResumoProjeto, Receitas, ReceitaLinha } from '../types'

export function calcValorProjetado(valorUnitarioAtual: number, ipca: number, parcelas: number): number {
  const safeIpca = (ipca == null || isNaN(ipca)) ? 0 : ipca
  // parcelas está em meses; ipca é taxa anual decimal (ex: 0.0594 = 5,94% a.a.)
  const safeParcelas = (parcelas == null || isNaN(parcelas) || parcelas <= 0) ? 12 : parcelas
  return valorUnitarioAtual * Math.pow(1 + safeIpca, safeParcelas / 12)
}

export function calcItemTotais(item: ItemCusto, ipca: number, parcelas: number): Partial<ItemCusto> {
  const totalAtual = item.qtdeVendida * item.valorUnitarioAtual
  const valorProjetado = calcValorProjetado(item.valorUnitarioAtual, ipca, parcelas)
  const totalProjetado = item.qtdeVendida * valorProjetado
  const valorOrcado = item.qtdeOrcada * item.valorUnitarioOrcado
  const valorContratado = item.qtdeContratada * item.valorUnitarioContratado
  const faltaPagar = item.valorFinal - item.valorPago
  return { totalAtual, valorProjetado, totalProjetado, valorOrcado, valorContratado, faltaPagar }
}

/**
 * Retorna true se o item é uma linha agrupadora (pai com filhas).
 * Detecta pelo código hierárquico: "2.7.23" é pai de "2.7.23.1".
 */
function isLinhaAgrupadora(item: ItemCusto, todosItens: ItemCusto[]): boolean {
  const cod = item.codigo?.trim()
  if (!cod) return false
  const prefix = cod + '.'
  return todosItens.some((other) => other.id !== item.id && (other.codigo ?? '').startsWith(prefix))
}

/**
 * Filtra itens para cálculos financeiros:
 * - Exclui linhas com statusPagamento === 'N/A' (itens cancelados/desconsiderados)
 * - Exclui linhas agrupadoras (subtotais automáticos que somam as filhas)
 */
export function filtrarItensCalculo(itens: ItemCusto[]): ItemCusto[] {
  return itens.filter(
    (item) =>
      item.statusPagamento !== 'N/A' &&
      !isLinhaAgrupadora(item, itens),
  )
}

export function calcTotaisSecao(secao: SecaoCusto, qtdFormandos: number): TotaisSecao {
  const itens = filtrarItensCalculo(secao.itens)
  const totalVendido = itens.reduce((s, i) => s + (i.totalAtual ?? 0), 0)
  const totalProjetado = itens.reduce((s, i) => s + (i.totalProjetado ?? 0), 0)
  const totalOrcado = itens.reduce((s, i) => s + (i.valorOrcado ?? 0), 0)
  const totalContratado = itens.reduce((s, i) => s + (i.valorContratado ?? 0), 0)
  const totalPago = itens.reduce((s, i) => s + (i.valorPago ?? 0), 0)
  const totalFaltaPagar = itens.reduce((s, i) => s + (i.faltaPagar ?? 0), 0)
  const qf = qtdFormandos || 1
  return {
    totalVendido, totalProjetado, totalOrcado, totalContratado, totalPago, totalFaltaPagar,
    custoPorFormandoVendido: totalVendido / qf,
    custoPorFormandoOrcado: totalOrcado / qf,
    custoPorFormandoContratado: totalContratado / qf,
  }
}

const RECEITA_KEYS: (keyof Receitas)[] = [
  'faturamentoAdesoes', 'vendasConvitesExtras', 'vendasMesasExtras',
  'arrecadacaoExtra', 'receitaVendasBaile', 'outros', 'receitaRescisoes',
]

function somarLinhas(r: Receitas): { vendido: number; orcado: number; contratado: number; pago: number; faltaPagar: number } {
  return RECEITA_KEYS.reduce(
    (acc, key) => {
      const l = r[key]
      acc.vendido += l.vendido
      acc.orcado += l.orcado
      acc.contratado += l.contratado
      acc.pago += l.pago
      acc.faltaPagar += l.faltaPagar !== 0 ? l.faltaPagar : (l.contratado - l.pago)
      return acc
    },
    { vendido: 0, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
  )
}

export function calcReceitaBaile(r: Receitas): number {
  return RECEITA_KEYS.reduce((s, k) => s + r[k].vendido, 0)
}

export function calcResumoProjeto(projeto: Projeto): ResumoProjeto {
  const r = projeto.receitas
  const qf = projeto.tap.qtdFormandos || 1

  const LABELS: Record<keyof Receitas, string> = {
    faturamentoAdesoes: 'Faturamento Adesões',
    vendasConvitesExtras: 'Vendas Convites Extras',
    vendasMesasExtras: 'Vendas Mesas Extras',
    arrecadacaoExtra: 'Arrecadação Extra',
    receitaVendasBaile: 'Receita Vendas Baile',
    outros: 'Outros',
    receitaRescisoes: 'Receita Rescisões',
  }

  const receitas = RECEITA_KEYS.map((key) => {
    const l = r[key]
    return {
      descricao: LABELS[key],
      vendido: l.vendido,
      orcado: l.orcado,
      contratado: l.contratado,
      pago: l.pago,
      faltaPagar: l.faltaPagar !== 0 ? l.faltaPagar : (l.contratado - l.pago),
    }
  })

  const totReceitaBaile = somarLinhas(r)
  const receitaBaile = { descricao: 'RECEITA BAILE', ...totReceitaBaile }

  const custos = projeto.secoes.map((secao) => {
    const t = calcTotaisSecao(secao, qf)
    return {
      secaoId: secao.id,
      nome: `${secao.numero} ${secao.nome}`,
      vendido: t.totalVendido,
      projetado: t.totalProjetado,
      orcado: t.totalOrcado,
      contratado: t.totalContratado,
      pago: t.totalPago,
      faltaPagar: t.totalFaltaPagar,
    }
  })

  const custoTotal = custos.reduce(
    (acc, c) => ({
      vendido: acc.vendido + c.vendido,
      projetado: acc.projetado + c.projetado,
      orcado: acc.orcado + c.orcado,
      contratado: acc.contratado + c.contratado,
      pago: acc.pago + c.pago,
      faltaPagar: acc.faltaPagar + c.faltaPagar,
    }),
    { vendido: 0, projetado: 0, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
  )

  for (const ca of projeto.custosAdicionais ?? []) {
    custoTotal.vendido += ca.vendido
    custoTotal.orcado += ca.orcado
    custoTotal.contratado += ca.contratado
    custoTotal.pago += ca.pago
    custoTotal.faltaPagar += ca.contratado - ca.pago
  }

  const margem = {
    vendido: totReceitaBaile.vendido - custoTotal.vendido,
    orcado: totReceitaBaile.orcado - custoTotal.orcado,
    contratado: totReceitaBaile.contratado - custoTotal.contratado,
    pago: totReceitaBaile.pago - custoTotal.pago,
    faltaPagar: totReceitaBaile.faltaPagar - custoTotal.faltaPagar,
  }

  return { receitas, receitaBaile, custos, custoTotal, margem }
}

export function calcPercentFechados(projeto: Projeto): number {
  let total = 0
  let fechados = 0
  for (const secao of projeto.secoes) {
    for (const item of secao.itens) {
      total++
      if (item.status === 'fechado') fechados++
    }
  }
  return total === 0 ? 0 : fechados / total
}

// ── Helpers de inicialização e migração ──────────────────────────────────────

export function emptyLinha(): ReceitaLinha {
  return { vendido: 0, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 }
}

export function emptyReceitas(): Receitas {
  return {
    faturamentoAdesoes: emptyLinha(),
    vendasConvitesExtras: emptyLinha(),
    vendasMesasExtras: emptyLinha(),
    arrecadacaoExtra: emptyLinha(),
    receitaVendasBaile: emptyLinha(),
    outros: emptyLinha(),
    receitaRescisoes: emptyLinha(),
  }
}

// Converte formato antigo (number) ou garante ReceitaLinha completo
export function migrateReceitas(raw: unknown): Receitas {
  const empty = emptyReceitas()
  if (!raw || typeof raw !== 'object') return empty
  const obj = raw as Record<string, unknown>

  function toLinha(val: unknown): ReceitaLinha {
    if (typeof val === 'number') return { vendido: val, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 }
    if (val && typeof val === 'object') {
      const v = val as Partial<ReceitaLinha>
      return {
        vendido: v.vendido ?? 0,
        orcado: v.orcado ?? 0,
        contratado: v.contratado ?? 0,
        pago: v.pago ?? 0,
        faltaPagar: v.faltaPagar ?? 0,
      }
    }
    return emptyLinha()
  }

  return {
    faturamentoAdesoes: toLinha(obj.faturamentoAdesoes),
    vendasConvitesExtras: toLinha(obj.vendasConvitesExtras),
    vendasMesasExtras: toLinha(obj.vendasMesasExtras),
    arrecadacaoExtra: toLinha(obj.arrecadacaoExtra),
    receitaVendasBaile: toLinha(obj.receitaVendasBaile),
    outros: toLinha(obj.outros),
    receitaRescisoes: toLinha(obj.receitaRescisoes),
  }
}
