import type { Release } from '../../types'

interface ReleaseDividerProps {
  release: Release | null
  label: string
}

export function ReleaseDivider({ release, label }: ReleaseDividerProps) {
  const colour = release?.colour || '#9CA3AF'

  return (
    <div className="flex items-center gap-2 py-2 w-full">
      <span
        className="text-xs font-medium whitespace-nowrap px-2 py-0.5 rounded-full"
        style={{ color: colour, backgroundColor: `${colour}15` }}
      >
        {label}
      </span>
      <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: colour }} />
    </div>
  )
}
