'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/orgs'
import { getSchedules, occurrencesInRange } from '@/lib/classes'
import { getBookingsInRange, bookingKey } from '@/lib/reservations'
import { useAppContext } from '@/components/AppContext'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire', coach: 'Coach', member: 'Membre',
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// The box-side dashboard, shown when the active view is a box and the user is
// owner / coach. (Members in a box still see the athlete dashboard.)
export default function CoachDashboard({ orgId, orgName, role }: { orgId: string; orgName: string; role: Role }) {
  const { memberships, setActive } = useAppContext()
  const logoUrl = memberships.find(m => m.organizationId === orgId)?.logoUrl ?? null
  const [memberCount, setMemberCount] = useState<number | null>(null)
  // This-week occupancy: booked seats vs capacity across the week's classes.
  const [week, setWeek] = useState<{ occupancy: number; bookings: number; classes: number } | null>(null)

  useEffect(() => {
    supabase.from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('status', 'active')
      .then(({ count }) => setMemberCount(count ?? 0))
  }, [orgId])

  useEffect(() => {
    let alive = true
    const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const fromISO = iso(mon), toISO = iso(sun)
    Promise.all([getSchedules(orgId), getBookingsInRange(orgId, fromISO, toISO)])
      .then(([sch, bk]) => {
        if (!alive) return
        const occ = occurrencesInRange(sch, fromISO, toISO)
        let booked = 0, cap = 0
        for (const o of occ) {
          booked += bk.get(bookingKey(o.id, o.date))?.bookedCount ?? 0
          cap += o.capacity
        }
        setWeek({
          occupancy: cap > 0 ? Math.round((booked / cap) * 100) : 0,
          bookings: booked,
          classes: occ.length,
        })
      })
      .catch(() => { if (alive) setWeek({ occupancy: 0, bookings: 0, classes: 0 }) })
    return () => { alive = false }
  }, [orgId])

  const sections = [
    { href: '/box/members',  icon: '👥', title: 'Membres',       desc: 'Gérer les adhérents de la box' },
    { href: '/box/staff',    icon: '🧑‍🏫', title: 'Coachs',        desc: 'Coachs de la box' },
    { href: '/box/planning', icon: '📅', title: 'Planning',      desc: 'Cours, réservations & agenda des coachs' },
    { href: '/box/programming', icon: '🔥', title: 'Programmation', desc: 'Le WOD du jour pour tes membres' },
    { href: '/box/plans',    icon: '🎟️', title: 'Abonnements',   desc: 'Formules et tarifs' },
    { href: '/box/profile',  icon: 'ℹ️', title: 'Infos de la box', desc: 'Nom, adresse, contact' },
    { href: '/box/settings', icon: '⚙️', title: 'Réglages',       desc: 'Types de séances, préférences' },
  ]

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <Link href="/box/profile" className="block pt-8 pb-4 hover:opacity-80 transition">
          <span className="inline-block text-[10px] font-black uppercase tracking-wider text-white rounded-full px-2 py-0.5 mb-2"
            style={{ background: 'var(--theme-primary)' }}>Gestion</span>
          <div className="flex items-center gap-2.5">
            {logoUrl
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-[color:var(--border)] flex-shrink-0" />
              : <span className="w-10 h-10 rounded-xl grid place-items-center text-base font-black text-white flex-shrink-0"
                  style={{ background: 'var(--theme-primary)' }}>{orgName.charAt(0).toUpperCase()}</span>}
            <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight flex items-center gap-1.5 min-w-0">
              <span className="truncate">{orgName}</span> <span className="text-[var(--border-strong)] text-lg flex-shrink-0">›</span>
            </h1>
          </div>
          <p className="text-sm text-[var(--muted)] mt-1">Espace {ROLE_LABEL[role].toLowerCase()} · voir les infos</p>
        </Link>

        {/* Owners/coaches can preview their own box exactly as a member sees it
            (member dashboard, booking flow) without leaving the box. */}
        <button onClick={() => setActive({ type: 'org', orgId, orgName, role: 'member' })}
          className="ds-hover w-full mb-4 flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[var(--card)] py-2.5 text-sm font-bold text-[var(--ink-soft)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
          </svg>
          Voir en tant que membre
        </button>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 text-center">
            <p className="text-2xl font-black text-[var(--ink)]">{memberCount ?? '—'}</p>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Membres</p>
          </div>
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 text-center">
            <p className="text-2xl font-black text-[var(--ink)]">{week ? `${week.occupancy}%` : '—'}</p>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Occupation</p>
          </div>
          <div className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 text-center">
            <p className="text-2xl font-black text-[var(--ink)]">{week ? week.bookings : '—'}</p>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Réservations</p>
          </div>
        </div>
        {week && <p className="text-[11px] text-[var(--muted)] -mt-2 mb-4 text-center">Cette semaine · {week.classes} cours</p>}

        <div className="space-y-3">
          {sections.map(s => (
            <Link key={s.href} href={s.href}
              className="bg-[var(--card)] rounded-2xl border border-[color:var(--border)] p-4 flex items-center gap-3 hover:shadow-sm transition">
              <span className="text-2xl flex-shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--ink)]">{s.title}</p>
                <p className="text-xs text-[var(--muted)]">{s.desc}</p>
              </div>
              <span className="text-[var(--border-strong)]">›</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
