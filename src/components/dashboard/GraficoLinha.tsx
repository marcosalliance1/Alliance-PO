import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatBRL } from '../../utils/formatters'

interface DataItem {
  ano: string
  margem: number
  receita: number
}

export function GraficoLinha({ data }: { data: DataItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="ano" tick={{ fill: '#8892b0', fontSize: 11 }} />
        <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v) => formatBRL(Number(v))}
          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
        <Line type="monotone" dataKey="receita" name="Receita" stroke="#00b894" strokeWidth={2} dot={{ fill: '#00b894' }} />
        <Line type="monotone" dataKey="margem" name="Margem" stroke="#e94560" strokeWidth={2} dot={{ fill: '#e94560' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
