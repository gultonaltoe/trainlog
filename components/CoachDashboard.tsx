'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/orgs'
import ContextSwitcher from './ContextSwitcher'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire', coach: 'Coach', staff: 'Staff', member: 'Membre',
}

// The box-side dashboard, shown when the active view is an org and the user
// is owner / coach / staff. Members in a box still see the athlete dashboard.
export default function CoachDashboard({ orgId, orgName, role }: { orgId: string; orgName: string; role: Role }) {
  const [memberCount, setMemberCount] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('status', 'active')
      .then(({ count }) => setMemberCount(count ?? 0))
  }, [orgId])

  const upcoming = [
    { icon: '📅', title: 'Planning & réservations', desc: 'Créer des cours, gérer les réservations' },
    { icon: '📋', title: 'Programmation',            desc: 'Publier les WODs du jour aux membres' },
    { icon: '📊', title: 'Suivi des membres',         desc: 'Progression des athlètes qui partagent leurs données' },
  ]

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-6"><ContextSwitcher /></div>

        <div className="pb-5">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{orgName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Espace {ROLE_LABEL[role].toLowerCase()}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Membres actifs</p>
            <p className="text-3xl font-black text-gray-900">{memberCount ?? '—'}</p>
          </div>
          <span className="text-3xl">👥</span>
        </div>

        <div className="space-y-3">
          {upcoming.map(f => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 opacity-70">
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{f.title}</p>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
              <span className="text-[10px] font-bold text-gray-400 border border-dashed border-gray-300 px-2 py-0.5 rounded-full flex-shrink-0">
                BIENTÔT
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
