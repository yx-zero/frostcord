export function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span
        className="glass rounded-full px-3 py-1 text-xs font-semibold text-subtext"
        style={{ ['--glass-blur' as string]: '10px' }}
      >
        {label}
      </span>
    </div>
  )
}
