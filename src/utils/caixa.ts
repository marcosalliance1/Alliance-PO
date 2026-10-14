// Padroniza a caixa de textos vindos das planilhas (uns em CAIXA ALTA, outros em minúscula, outros
// misturados) para "Título Com Iniciais": "ADESÃO INDIVIDUAL - À VISTA" e "adesão individual - à vista"
// viram "Adesão Individual - à Vista". Nunca CAPS LOCK (decisão do Marcos, 14/10/2026). Siglas conhecidas
// e numerais romanos ficam em maiúsculas; preposições no meio da frase ficam em minúsculo.

const SIGLAS = new Set([
  'PIX', 'CMMG', 'BQ', 'DJ', 'TAP', 'VS', 'CJ', 'PUC', 'UFMG', 'UNIFENAS', 'FAMED', 'EABH', 'CSAG', 'CSA', 'NL', 'MED',
  'DRE', 'ISS', 'NF', 'NFS', 'CPF', 'CNPJ', 'TV', 'LED', 'SP', 'BH', 'MG', 'PO', 'VIP', 'OS', 'RH', 'ME', 'EPP', 'LTDA',
  'SA', 'TED', 'DOC', 'IPTU', 'ECAD', 'AVCB', 'ART', 'UTI', 'CC', 'CE', 'WC', 'BVS', 'SGE', 'ERP', 'KPI', 'USB', 'PDF',
])
const PEQUENAS = new Set(['a', 'à', 'as', 'o', 'os', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'sem', 'ao', 'aos', 'um', 'uma', 'ou'])
const ROMANO = /^[IVXL]+$/

export function padronizarCaixa(entrada: string): string {
  if (!entrada || !/\p{L}/u.test(entrada)) return entrada
  return entrada.replace(/\p{L}+/gu, (palavra, pos: number, todo: string) => {
    const up = palavra.toUpperCase()
    if (SIGLAS.has(up)) return up
    if (palavra.length > 1 && ROMANO.test(palavra)) return palavra // numeral romano já em caixa alta (XXVIII)
    // meio de frase (precedido por letra/dígito) → preposição fica minúscula; início de frase → capitaliza
    const antes = todo.slice(0, pos).trimEnd()
    const meio = antes.length > 0 && /[\p{L}\d]$/u.test(antes)
    const baixa = palavra.toLowerCase()
    if (meio && PEQUENAS.has(baixa)) return baixa
    if (palavra.length === 1) return up
    return up[0] + baixa.slice(1)
  })
}
