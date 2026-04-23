"use client"

import { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionProps {
  children: ReactNode
  className?: string
}

export function Accordion({ children, className }: AccordionProps) {
  return <div className={cn('divide-y rounded-md border', className)}>{children}</div>
}

interface AccordionItemProps {
  value: string
  expanded: boolean
  onToggle: () => void
  trigger: ReactNode
  children: ReactNode
  id?: string
}

export function AccordionItem({ expanded, onToggle, trigger, children, id }: AccordionItemProps) {
  return (
    <div id={id} className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex-1 min-w-0">{trigger}</div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
