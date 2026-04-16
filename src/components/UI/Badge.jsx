const estilos = {
  azul:    { background: '#DBEAFE', color: '#1E3A8A' },
  verde:   { background: '#BBF7D0', color: '#14532D' },
  amarelo: { background: '#FEF08A', color: '#713F12' },
  vermelho:{ background: '#FECACA', color: '#7F1D1D' },
  roxo:    { background: '#DDD6FE', color: '#4C1D95' },
  ciano:   { background: '#CFFAFE', color: '#164E63' },
  cinza:   { background: '#F1F5F9', color: '#475569' },
  laranja: { background: '#FED7AA', color: '#9A3412' },
}

export default function Badge({ texto, cor = 'cinza', pequeno = false }) {
  const estilo = estilos[cor] || estilos.cinza
  return (
    <span style={{
      ...estilo,
      padding: pequeno ? '2px 6px' : '3px 8px',
      borderRadius: 4,
      fontSize: pequeno ? 10 : 11,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {texto}
    </span>
  )
}

export function BadgeDefCusto({ tipo }) {
  if (tipo === 'Custo Fixo') return <Badge texto="Fixo" cor="roxo" pequeno />
  if (tipo === 'Custo Variável') return <Badge texto="Variável" cor="ciano" pequeno />
  return <Badge texto={tipo || '—'} cor="cinza" pequeno />
}

export function BadgeTipoEnsino({ tipo }) {
  const mapa = {
    'Superior': 'azul',
    'Médio': 'amarelo',
    'Fundamental': 'verde',
  }
  return <Badge texto={tipo || '—'} cor={mapa[tipo] || 'cinza'} pequeno />
}

export function BadgeStatus({ status }) {
  const mapa = {
    'Fechado': 'verde',
    'Estimado': 'azul',
    'Orçando': 'amarelo',
    'Em aberto': 'vermelho',
  }
  return <Badge texto={status || 'Em aberto'} cor={mapa[status] || 'cinza'} pequeno />
}

export function BadgePgto({ status }) {
  if (status === 'Pago') return <Badge texto="Pago" cor="verde" pequeno />
  if (status === 'Parcial') return <Badge texto="Parcial" cor="laranja" pequeno />
  return <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>
}
