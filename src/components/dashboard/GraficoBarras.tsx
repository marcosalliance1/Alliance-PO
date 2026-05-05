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
  custoLabel?: string
  height?: number
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; dataKey: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const receita = payload.find((p) => p.dataKey === 'receita')?.value ?? 0
  const custo = payload.find((p) => p.dataKey === 'custo')?.value ?? 0
  const margem = receita - custo
  const margemPct = receita > 0 ? (margem / receita) * 100 : 0
  return (
    <div className="bg-surface border border-white/10 rounded-inner p-3 text-xs shadow-card">
      <p className="text-text-main font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-text-muted">{p.name}: <span className="text-text-main">{formatBRL(p.value)}</span></p>
      ))}
      {receita > 0 && custo > 0 && (
        <p className="text-text-muted mt-1 pt-1 border-t border-white/10">
          Margem Orçada: <span className={margem >= 0 ? 'text-green-400' : 'text-red-400'}>{formatBRL(margem)} ({margemPct.toFixed(1)}%)</span>
        </p>
      )}
    </div>
  )
}

export function GraficoBarras({ data, custoLabel = 'Custo', height = 260 }: GraficoBarrasProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="nome" tick={{ fill: '#8892b0', fontSize: 11 }} />
        <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0' }} />
        <Bar dataKey="receita" name="Receita Orçada" fill="#00b894" radius={[4, 4, 0, 0]} />
        <Bar dataKey="custo" name={custoLabel} fill="#e94560" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
