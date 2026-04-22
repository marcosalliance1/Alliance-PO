import type { ItemCusto, SecaoCusto, Projeto, TotaisSecao, ResumoProjeto, Receitas } from '../types'

export function calcValorProjetado(valorUnitarioAtual: number, ipca: number, parcelas: number): number {
  return valorUnitarioAtual * Math.pow(1 + ipca, parcelas)
}

export function calcItemTotais(item: ItemCusto, ipca: number, parcelas: number): Partial<ItemCusto> {
  const totalAtual = item.qtdeVendida * item.valorUnitarioAtual
  const valorProjetado = calcValorProjetado(item.valorUnitarioAtual, ipca, parcelas)
  const totalProjetado = item.qtdeVendida * valorProjetado
  const valorOrcado = item.qtdeOrcada * item.valorUnitarioOrcado
  const valorContratado = item.qtdeContratada * item.valorUnitarioContratado
  const faltaPagar = item.valorFinal - item.valorPago
  return {
    totalAtual,
    valorProjetado,
    totalProjetado,
    valorOrcado,
    valorContratado,
    faltaPagar,
  }
}

export function calcTotaisSecao(secao: SecaoCusto, qtdFormandos: number): TotaisSecao {
  const itens = secao.itens
  const totalVendido = itens.reduce((s, i) => s + i.totalAtual, 0)
  const totalOrcado = itens.reduce((s, i) => s + i.valorOrcado, 0)
  const totalContratado = itens.reduce((s, i) => s + i.valorContratado, 0)
  const totalPago = itens.reduce((s, i) => s + i.valorPago, 0)
  const totalFaltaPagar = itens.reduce((s, i) => s + i.faltaPagar, 0)
  const qf = qtdFormandos || 1
  return {
    totalVendido,
    totalOrcado,
    totalContratado,
    totalPago,
    totalFaltaPagar,
    custoPorFormandoVendido: totalVendido / qf,
    custoPorFormandoOrcado: totalOrcado / qf,
    custoPorFormandoContratado: totalContratado / qf,
  }
}

export function calcReceitaBaile(r: Receitas): number {
  return (
    r.faturamentoAdesoes +
    r.vendasConvitesExtras +
    r.vendasMesasExtras +
    r.arrecadacaoExtra +
    r.receitaVendasBaile +
    r.outros +
    r.receitaRescisoes
  )
}

export function calcResumoProjeto(projeto: Projeto): ResumoProjeto {
  const r = projeto.receitas
  const qf = projeto.tap.qtdFormandos || 1

  const receitas = [
    { descricao: 'Faturamento Adesões', vendido: r.faturamentoAdesoes, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
    { descricao: 'Vendas Convites Extras', vendido: r.vendasConvitesExtras, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
    { descricao: 'Vendas Mesas Extras', vendido: r.vendasMesasExtras, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
    { descricao: 'Arrecadação Extra', vendido: r.arrecadacaoExtra, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
    { descricao: 'Receita Vendas Baile', vendido: r.receitaVendasBaile, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
    { descricao: 'Outros', vendido: r.outros, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
    { descricao: 'Receita Rescisões', vendido: r.receitaRescisoes, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
  ]

  const somaReceita = calcReceitaBaile(r)
  const receitaBaile = {
    descricao: 'RECEITA BAILE',
    vendido: somaReceita,
    orcado: somaReceita,
    contratado: somaReceita,
    pago: 0,
    faltaPagar: 0,
  }

  const custos = projeto.secoes.map((secao) => {
    const t = calcTotaisSecao(secao, qf)
    return {
      secaoId: secao.id,
      nome: `${secao.numero} ${secao.nome}`,
      vendido: t.totalVendido,
      orcado: t.totalOrcado,
      contratado: t.totalContratado,
      pago: t.totalPago,
      faltaPagar: t.totalFaltaPagar,
    }
  })

  const custoTotal = custos.reduce(
    (acc, c) => ({
      vendido: acc.vendido + c.vendido,
      orcado: acc.orcado + c.orcado,
      contratado: acc.contratado + c.contratado,
      pago: acc.pago + c.pago,
      faltaPagar: acc.faltaPagar + c.faltaPagar,
    }),
    { vendido: 0, orcado: 0, contratado: 0, pago: 0, faltaPagar: 0 },
  )

  const margem = {
    vendido: somaReceita - custoTotal.vendido,
    orcado: somaReceita - custoTotal.orcado,
    contratado: somaReceita - custoTotal.contratado,
    pago: 0 - custoTotal.pago,
    faltaPagar: 0 - custoTotal.faltaPagar,
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
