export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function parseBRL(value: string): number {
  const cleaned = value
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export function parseNumBR(value: string): number {
  const cleaned = value.replace(',', '.').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// `new Date('YYYY-MM-DD')` parses as UTC midnight, which shifts to the previous
// day once converted to a UTC-3 local time — this parses the date as local instead.
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  return parseLocalDate(iso).toLocaleDateString('pt-BR')
}
