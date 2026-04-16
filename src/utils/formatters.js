export function formatarMoeda(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(valor))
}

export function formatarPercentual(valor) {
  if (!valor && valor !== 0) return '0,00%'
  return `${Number(valor).toFixed(2).replace('.', ',')}%`
}

export function formatarNumero(valor, decimais = 2) {
  if (!valor && valor !== 0) return '0'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais
  }).format(Number(valor))
}

export function parseMoeda(str) {
  if (!str) return 0
  if (typeof str === 'number') return str
  return parseFloat(str.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

export function abreviarValor(valor) {
  const n = Number(valor)
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}K`
  return formatarMoeda(n)
}
