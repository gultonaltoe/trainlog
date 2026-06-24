'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext, type ActiveContext } from './AppContext'
import type { Role } from '@/lib/orgs'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire', coach: 'Coach', staff: 'Staff', member: 'Membre',
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

  const choose = (ctx: ActiveContext) => { setActive(ctx); setOpen(false); router.push('/') }

  return (
    <div className="relative mb-4">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-2.5">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-base">{active.type === 'personal' ? '🏋️' : '🏢'}</span>
          <span className="min-w-0 text-left">
            <span className="block text-sm font-bold text-gray-800 truncate">{label}</span>
            <span className="block text-[11px] text-gray-400">{sub}</span>
          </span>
        </span>
        <span className="text-gray-400 text-xs">▾</span>
      </button>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <button onClick={() => choose({ type: 'personal' })}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2">
            <span>🏋️</span>
            <span className="text-sm font-semibold text-gray-800">{PERSONAL_LABEL}</span>
          </button>
          {switchable.map(m => (
            <button key={m.organizationId}
              onClick={() => choose({ type: 'org', orgId: m.organizationId, orgName: m.organizationName, role: m.role })}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span>🏢</span>
                <span className="text-sm font-semibold text-gray-800 truncate">{m.organizationName}</span>
              </span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{ROLE_LABEL[m.role]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
