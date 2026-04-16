// Calcular valor projetado com IPCA
export function calcularProjetado(valorAtual, ipcaAm, tempoMeses) {
  if (!valorAtual || !ipcaAm || !tempoMeses) return valorAtual || 0
  return Number(valorAtual) * Math.pow(1 + Number(ipcaAm), Number(tempoMeses))
}

// Calcular totais de uma lista de itens
export function calcularTotaisItens(itens) {
  const sum = (arr, fn) => arr.reduce((acc, i) => acc + (fn(i) || 0), 0)
  return {
    totalAtual: sum(itens, i => (i.qtde || 0) * (i.valorUnitarioAtual || 0)),
    totalProjetado: sum(itens, i => (i.qtde || 0) * (i.valorProjetado || 0)),
    totalOrcado: sum(itens, i => (i.qtdeOrcada || 0) * (i.valorUnitarioOrcado || 0)),
    totalContratado: sum(itens, i => (i.qtdeContratada || 0) * (i.valorUnitarioContratado || 0)),
    totalPago: sum(itens, i => i.valorPago || 0),
  }
}

// Calcular totais de uma seção
export function calcularSecao(secaoItens) {
  return calcularTotaisItens(secaoItens)
}

// Mapeamento subCategoria → linha do Resumo Geral
export const MAPEAMENTO_RESUMO = {
  'Locação Espaço':        { secao: '2.1', filtro: (i) => i.subCategoria?.toLowerCase().includes('aluguel') },
  'Legalização':           { secao: '2.1', filtro: (i) => i.subCategoria?.toLowerCase().includes('legalização') || i.subCategoria?.toLowerCase().includes('legalizacao') },
  'Decoração':             { secao: '2.1', filtro: (i) => i.subCategoria?.toLowerCase().includes('decoração') || i.subCategoria?.toLowerCase().includes('decoracao') },
  'Palco, Som e Luz':      { secao: '2.1', filtro: (i) => i.subCategoria?.toLowerCase().includes('palco') },
  'Infraestrutura':        { secao: '2.1', filtro: (i) => i.subCategoria?.toLowerCase().includes('infraestrutura') },
  'Experiência do Cliente':{ secao: '2.1', filtro: (i) => i.subCategoria?.toLowerCase().includes('experiência') || i.subCategoria?.toLowerCase().includes('experiencia') },
  'Artístico':             { secao: '2.2', filtro: () => true },
  'Equipe':                { secao: '2.3', filtro: () => true },
  'Bebidas e Alimentos':   { secao: '2.4', filtro: () => true },
  'Bolsa Folia / Pré-Eventos': { secao: '2.5', filtro: () => true },
  'Cerimônia Religiosa':   { secao: '2.6', filtro: () => true },
  'Colação de Grau':       { secao: '2.7', filtro: () => true },
  'Despesas ADM':          { secao: '2.8', filtro: (i) => !i.subCategoria?.toLowerCase().includes('fee') },
  'Despesas Fee':          { secao: '2.8', filtro: (i) => i.subCategoria?.toLowerCase().includes('fee') },
}

export function calcularResumoGeral(projeto) {
  const todasSecoes = projeto.secoes || {}
  const resultado = {}

  for (const [linha, cfg] of Object.entries(MAPEAMENTO_RESUMO)) {
    const itensSecao = todasSecoes[cfg.secao] || []
    const itensFiltrados = itensSecao.filter(cfg.filtro)
    resultado[linha] = calcularTotaisItens(itensFiltrados)
  }

  return resultado
}

// Calcular desvio percentual
export function calcularDesvio(contratado, orcado) {
  if (!orcado || orcado === 0) return 0
  return ((contratado - orcado) / orcado) * 100
}

// Calcular margem
export function calcularMargem(receita, custo) {
  if (!receita || receita === 0) return 0
  return ((receita - custo) / receita) * 100
}

// Status de pagamento
export function calcularStatusPgto(valorPago, valorContratado) {
  const pago = Number(valorPago) || 0
  const contratado = Number(valorContratado) || 0
  if (contratado <= 0) return 'N/A'
  if (pago >= contratado) return 'Pago'
  if (pago > 0) return 'Parcial'
  return 'N/A'
}
