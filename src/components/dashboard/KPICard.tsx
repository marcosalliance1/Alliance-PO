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
    <div className="bg-surface rounded-[12px] shadow-card p-3 sm:p-6 flex gap-2.5 sm:gap-4 items-start">
      {Icon && (
        <div className="rounded-inner p-1.5 sm:p-2.5 shrink-0" style={{ backgroundColor: `${color}20` }}>
          <Icon size={16} className="sm:hidden" style={{ color }} />
          <Icon size={20} className="hidden sm:block" style={{ color }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-text-muted text-[10px] sm:text-xs font-medium uppercase tracking-wide truncate">{title}</p>
        <p className="text-text-main text-sm sm:text-xl font-bold mt-0.5 truncate">{value}</p>
        {subtitle && <p className="text-text-muted text-[10px] sm:text-xs mt-0.5 truncate">{subtitle}</p>}
        {trend && (
          <p className={`text-[10px] sm:text-xs mt-1 font-medium ${trend.positive ? 'text-success' : 'text-danger'}`}>
            {trend.positive ? '▲' : '▼'} {trend.value}
          </p>
        )}
      </div>
    </div>
  )
}
