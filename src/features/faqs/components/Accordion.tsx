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
  expanded: boolean
  onToggle?: () => void
  href?: string
  trigger: ReactNode
  children: ReactNode
  id?: string
}

export function AccordionItem({ expanded, onToggle, href, trigger, children, id }: AccordionItemProps) {
  const triggerId = id ? `${id}-trigger` : undefined
  const panelId = id ? `${id}-panel` : undefined
  const content = <>
    <div className="flex-1 min-w-0">{trigger}</div>
    <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
  </>
  const triggerClass = "w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
  return (
    <div id={id} className="overflow-hidden scroll-mt-28">
      {href ? (
        <a href={href} id={triggerId} aria-expanded={expanded} aria-controls={panelId} className={triggerClass}>{content}</a>
      ) : (
        <button type="button" id={triggerId} onClick={onToggle} aria-expanded={expanded} aria-controls={panelId} className={triggerClass}>{content}</button>
      )}
      <div
        id={panelId}
        role="region"
        inert={!expanded}
        aria-hidden={!expanded}
        aria-labelledby={triggerId}
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
