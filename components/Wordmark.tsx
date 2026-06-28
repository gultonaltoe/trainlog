// Trainlift logo (ST-53, first pass). Mark = orange rounded square with a double
// upward chevron (lift / upward progress); wordmark = "Train" (ink) + "lift"
// (accent). Pure SVG/text — no asset needed; easy to iterate on /design.
export default function Wordmark({ size = 28, markOnly = false, className = '' }: {
  size?: number; markOnly?: boolean; className?: string
}) {
  const primary = 'var(--theme-primary, #F97316)'
  const mark = (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="flex-shrink-0" aria-hidden>
      <rect width="32" height="32" rx="8" fill={primary} />
      <path d="M8 18.5l8-7.5 8 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 23.5l8-7.5 8 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  )
  if (markOnly) return mark
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {mark}
      <span className="font-black tracking-tight text-[var(--ink)]">Train<span style={{ color: primary }}>lift</span></span>
    </span>
  )
}
