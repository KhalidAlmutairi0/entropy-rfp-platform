import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    label?: string
  }
  icon?: React.ReactNode
  className?: string
}

export function KpiCard({ title, value, change, icon, className }: KpiCardProps) {
  const getTrendIcon = () => {
    if (!change) return null
    if (change.value > 0) return <TrendingUp className="h-3 w-3" />
    if (change.value < 0) return <TrendingDown className="h-3 w-3" />
    return <Minus className="h-3 w-3" />
  }

  const getTrendColor = () => {
    if (!change) return ''
    if (change.value > 0) return 'text-[#10B981]'
    if (change.value < 0) return 'text-[#EF4444]'
    return 'text-muted-foreground'
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <div className={cn('flex items-center gap-1 text-xs mt-1', getTrendColor())}>
            {getTrendIcon()}
            <span>
              {change.value > 0 ? '+' : ''}
              {change.value}%
            </span>
            {change.label && (
              <span className="text-muted-foreground">{change.label}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
