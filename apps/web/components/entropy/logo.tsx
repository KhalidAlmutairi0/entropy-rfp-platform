import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showWordmark?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ className, showWordmark = true, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  }
  
  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Bookend Icon - Books held between two bookends */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizeClasses[size], 'w-auto')}
      >
        {/* Left bookend - L shape */}
        <path
          d="M3 6C3 5.44772 3.44772 5 4 5H6V27H4C3.44772 27 3 26.5523 3 26V6Z"
          className="fill-primary"
        />
        <rect x="3" y="25" width="6" height="2" className="fill-primary" />
        
        {/* Book 1 - tall */}
        <rect x="10" y="7" width="4" height="18" rx="0.5" className="fill-primary" />
        <line x1="12" y1="9" x2="12" y2="23" className="stroke-background/40" strokeWidth="0.5" />
        
        {/* Book 2 - medium */}
        <rect x="15" y="10" width="4" height="15" rx="0.5" className="fill-primary/75" />
        <line x1="17" y1="12" x2="17" y2="23" className="stroke-background/40" strokeWidth="0.5" />
        
        {/* Book 3 - shorter */}
        <rect x="20" y="13" width="3" height="12" rx="0.5" className="fill-primary/50" />
        
        {/* Right bookend - L shape */}
        <path
          d="M29 6C29 5.44772 28.5523 5 28 5H26V27H28C28.5523 27 29 26.5523 29 26V6Z"
          className="fill-primary"
        />
        <rect x="23" y="25" width="6" height="2" className="fill-primary" />
      </svg>
      
      {showWordmark && (
        <span className={cn(
          'font-semibold tracking-tight text-foreground',
          textSizes[size]
        )}>
          Entropy
        </span>
      )}
    </div>
  )
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-8 w-8', className)}
    >
      {/* Left bookend - L shape */}
      <path
        d="M3 6C3 5.44772 3.44772 5 4 5H6V27H4C3.44772 27 3 26.5523 3 26V6Z"
        className="fill-primary"
      />
      <rect x="3" y="25" width="6" height="2" className="fill-primary" />
      
      {/* Book 1 - tall */}
      <rect x="10" y="7" width="4" height="18" rx="0.5" className="fill-primary" />
      <line x1="12" y1="9" x2="12" y2="23" className="stroke-background/40" strokeWidth="0.5" />
      
      {/* Book 2 - medium */}
      <rect x="15" y="10" width="4" height="15" rx="0.5" className="fill-primary/75" />
      <line x1="17" y1="12" x2="17" y2="23" className="stroke-background/40" strokeWidth="0.5" />
      
      {/* Book 3 - shorter */}
      <rect x="20" y="13" width="3" height="12" rx="0.5" className="fill-primary/50" />
      
      {/* Right bookend - L shape */}
      <path
        d="M29 6C29 5.44772 28.5523 5 28 5H26V27H28C28.5523 27 29 26.5523 29 26V6Z"
        className="fill-primary"
      />
      <rect x="23" y="25" width="6" height="2" className="fill-primary" />
    </svg>
  )
}
