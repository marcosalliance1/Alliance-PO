import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export const SecaoAccordion: React.FC<Props> = ({
  title, subtitle, defaultOpen = false, children
}) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-surface-2 border border-bordercol rounded-card overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-1 h-6 bg-accent rounded-full shrink-0" />
          <div className="text-left">
            <p className="text-white font-semibold text-sm">{title}</p>
            {subtitle && <p className="text-muted text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 text-muted" />
          : <ChevronDown className="w-5 h-5 text-muted" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-bordercol">
          {children}
        </div>
      )}
    </div>
  )
}
