'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext, type ActiveContext } from './AppContext'
import type { Role } from '@/lib/orgs'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire', coach: 'Coach', member: 'Membre',
}
// Label for the personal (athlete) context. Change here to rename everywhere.
const PERSONAL_LABEL = 'Mon espace'

// Lets the user switch between "My training" (personal) and any box they
// belong to. This is what turns one app into one switchable environment.
export default function ContextSwitcher() {
  const { memberships, active, setActive, loading } = useAppContext()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (loading) return null

  // Only boxes you're an active member of are switchable.
  const switchable = memberships.filter(m => m.status === 'active')
  const label = active.type === 'personal' ? PERSONAL_LABEL : active.orgName
  const sub   = active.type === 'personal' ? 'Athlète' : ROLE_LABEL[active.role]
  // Management mode (owner/coach/staff) gets a filled brand badge so it's
  // visibly distinct from the athlete/member view at a glance (ST-8 v2).
  const isMgmt = active.type === 'org' && active.role !== 'member'
  const activeLogo = active.type === 'org'
    ? (memberships.find(m => m.organizationId === active.orgId)?.logoUrl ?? null) : null

  // Box icon: the logo if set, else a generic emoji.
  const boxIcon = (logo: string | null) => logo
    ? /* eslint-disable-next-line @next/next/no-img-element */
      <img src={logo} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
    : <span className="text-base flex-shrink-0">🏢</span>

  const choose = (ctx: ActiveContext) => { setActive(ctx); setOpen(false); router.push('/') }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="ds-hover w-full h-10 flex items-center justify-between rounded-2xl border-2 border-[color:var(--border-strong)] bg-[var(--card)] px-3 shadow-sm">
        <span className="flex items-center gap-2 min-w-0">
          {active.type === 'personal' ? <span className="text-base flex-shrink-0">🏋️</span> : boxIcon(activeLogo)}
          <span className="text-sm font-black text-[var(--ink)] truncate">{label}</span>
          <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0"
            style={isMgmt
              ? { background: 'var(--theme-primary)', color: '#fff' }
              : { background: 'var(--track)', color: 'var(--sub)' }}>{sub}</span>
        </span>
        <span className="text-[var(--ink-soft)] text-xs flex-shrink-0 ml-2">▾</span>
      </button>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-[color:var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          <button onClick={() => choose({ type: 'personal' })}
            className="w-full text-left px-4 py-3 hover:bg-[var(--hover)] flex items-center justify-between gap-2 cursor-pointer">
            <span className="flex items-center gap-2 min-w-0">
              <span>🏋️</span>
              <span className="text-sm font-semibold text-[var(--ink)]">{PERSONAL_LABEL}</span>
            </span>
            {active.type === 'personal' && <span className="text-xs font-black flex-shrink-0" style={{ color: 'var(--theme-primary)' }}>✓</span>}
          </button>
          {switchable.map(m => {
            const isActive = active.type === 'org' && active.orgId === m.organizationId
            return (
              <button key={m.organizationId}
                onClick={() => choose({ type: 'org', orgId: m.organizationId, orgName: m.organizationName, role: m.role })}
                className="w-full text-left px-4 py-3 hover:bg-[var(--hover)] flex items-center justify-between gap-2 cursor-pointer">
                <span className="flex items-center gap-2 min-w-0">
                  {boxIcon(m.logoUrl)}
                  <span className="text-sm font-semibold text-[var(--ink)] truncate">{m.organizationName}</span>
                </span>
                {isActive
                  ? <span className="text-xs font-black flex-shrink-0" style={{ color: 'var(--theme-primary)' }}>✓</span>
                  : <span className="text-[11px] text-[var(--muted)] flex-shrink-0">{ROLE_LABEL[m.role]}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
