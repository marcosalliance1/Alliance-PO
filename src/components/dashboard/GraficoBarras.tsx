import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatBRL } from '../../utils/formatters'

interface DataItem {
  nome: string
  receita: number
  custo: number
  margem: number
}

interface GraficoBarrasProps {
  data: DataItem[]
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-white/10 rounded-inner p-3 text-xs shadow-card">
      <p className="text-text-main font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-text-muted">{p.name}: <span className="text-text-main">{formatBRL(p.value)}</span></p>
      ))}
    </div>
  )
}

export function GraficoBarras({ data }: GraficoBarrasProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="nome" tick={{ fill: '#8892b0', fontSize: 11 }} />
        <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
        <Bar dataKey="receita" name="Receita" fill="#00b894" radius={[4, 4, 0, 0]} />
        <Bar dataKey="custo" name="Custo" fill="#e94560" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
