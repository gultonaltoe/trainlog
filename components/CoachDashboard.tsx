'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/orgs'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire', coach: 'Coach', staff: 'Staff', member: 'Membre',
}

// The box-side dashboard, shown when the active view is a box and the user is
// owner / coach / staff. (Members in a box still see the athlete dashboard.)
export default function CoachDashboard({ orgId, orgName, role }: { orgId: string; orgName: string; role: Role }) {
  const [memberCount, setMemberCount] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('status', 'active')
      .then(({ count }) => setMemberCount(count ?? 0))
  }, [orgId])

  const sections = [
    { href: '/box/members',  icon: '👥', title: 'Membres',       desc: 'Gérer les adhérents de la box' },
    { href: '/box/staff',    icon: '🧑‍🏫', title: 'Staff',         desc: 'Coachs et équipe' },
    { href: '/box/planning', icon: '📅', title: 'Planning',      desc: 'Cours et réservations' },
    { href: '/box/profile',  icon: 'ℹ️', title: 'Infos de la box', desc: 'Nom, adresse, contact' },
  ]

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
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
          {sections.map(s => (
            <Link key={s.href} href={s.href}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-sm transition">
              <span className="text-2xl flex-shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-400">{s.desc}</p>
              </div>
              <span className="text-gray-300">›</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
