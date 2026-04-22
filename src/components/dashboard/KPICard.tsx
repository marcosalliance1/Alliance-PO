import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  color?: string
  trend?: { value: string; positive: boolean }
}

export function KPICard({ title, value, subtitle, icon: Icon, color = '#e94560', trend }: KPICardProps) {
  return (
    <div className="card flex gap-4 items-start">
      {Icon && (
        <div className="rounded-inner p-2.5 shrink-0" style={{ backgroundColor: `${color}20` }}>
          <Icon size={20} style={{ color }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-text-muted text-xs font-medium uppercase tracking-wide">{title}</p>
        <p className="text-text-main text-xl font-bold mt-0.5 truncate">{value}</p>
        {subtitle && <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>}
        {trend && (
          <p className={`text-xs mt-1 font-medium ${trend.positive ? 'text-success' : 'text-danger'}`}>
            {trend.positive ? '▲' : '▼'} {trend.value}
          </p>
        )}
      </div>
    </div>
  )
}
