import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatBRL } from '../../utils/formatters'

interface DataItem {
  nome: string
  valor: number
}

const CORES = ['#e94560', '#00b894', '#fdcb6e', '#74b9ff', '#a29bfe', '#fd79a8', '#55efc4', '#ffeaa7']

export function GraficoPizza({ data }: { data: DataItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="valor"
          nameKey="nome"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [formatBRL(Number(value)), '']}
          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#f0f0f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#8892b0' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
