"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/providers/language-provider"
import { Check, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Step {
  id: string
  label: string
  href: string
  icon: LucideIcon
}

interface ProposalStepsProps {
  steps: Step[]
  rfpId: string
}

export function ProposalSteps({ steps, rfpId }: ProposalStepsProps) {
  const pathname = usePathname()
  const { dir } = useLanguage()
  
  const currentStepIndex = steps.findIndex(step => 
    pathname.includes(step.href.replace("[id]", rfpId))
  )

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-2" dir={dir}>
      {steps.map((step, index) => {
        const Icon = step.icon
        const isActive = index === currentStepIndex
        const isCompleted = index < currentStepIndex
        const href = step.href.replace("[id]", rfpId)

        return (
          <div key={step.id} className="flex items-center">
            <Link
              href={href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                isActive && "bg-primary text-primary-foreground",
                isCompleted && "text-primary",
                !isActive && !isCompleted && "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs",
                isActive && "bg-primary-foreground/20",
                isCompleted && "bg-primary/10",
                !isActive && !isCompleted && "bg-muted"
              )}>
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </Link>
            {index < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0 rtl:rotate-180" />
            )}
          </div>
        )
      })}
    </nav>
  )
}
