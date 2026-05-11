import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const statusBadgeVariants = cva(
  'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        success: 'bg-[#10B981]/10 text-[#047857] dark:bg-[#10B981]/20 dark:text-[#10B981]',
        warning: 'bg-[#F59E0B]/10 text-[#B45309] dark:bg-[#F59E0B]/20 dark:text-[#F59E0B]',
        danger: 'bg-[#EF4444]/10 text-[#B91C1C] dark:bg-[#EF4444]/20 dark:text-[#EF4444]',
        info: 'bg-[#3B82F6]/10 text-[#1D4ED8] dark:bg-[#3B82F6]/20 dark:text-[#3B82F6]',
        neutral: 'bg-muted text-muted-foreground',
        primary: 'bg-primary/10 text-primary dark:bg-primary/20',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean
}

export function StatusBadge({
  className,
  variant,
  dot = false,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'mr-1.5 h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-[#10B981]',
            variant === 'warning' && 'bg-[#F59E0B]',
            variant === 'danger' && 'bg-[#EF4444]',
            variant === 'info' && 'bg-[#3B82F6]',
            variant === 'neutral' && 'bg-muted-foreground',
            variant === 'primary' && 'bg-primary'
          )}
        />
      )}
      {children}
    </span>
  )
}
