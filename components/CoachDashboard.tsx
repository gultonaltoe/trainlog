'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/orgs'
import { getSchedules, occurrencesInRange } from '@/lib/classes'
import { getBookingsInRange, bookingKey } from '@/lib/reservations'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire', coach: 'Coach', member: 'Membre',
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// The box-side dashboard, shown when the active view is a box and the user is
// owner / coach. (Members in a box still see the athlete dashboard.)
export default function CoachDashboard({ orgId, orgName, role }: { orgId: string; orgName: string; role: Role }) {
  const [memberCount, setMemberCount] = useState<number | null>(null)
  // This-week occupancy: booked seats vs capacity across the week's classes.
  const [week, setWeek] = useState<{ occupancy: number; avgRate: number; classes: number } | null>(null)

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
        let booked = 0, cap = 0; const rates: number[] = []
        for (const o of occ) {
          const b = bk.get(bookingKey(o.id, o.date))?.bookedCount ?? 0
          booked += b; cap += o.capacity
          if (o.capacity > 0) rates.push(b / o.capacity)
        }
        setWeek({
          occupancy: cap > 0 ? Math.round((booked / cap) * 100) : 0,
          avgRate: rates.length ? Math.round((rates.reduce((a, c) => a + c, 0) / rates.length) * 100) : 0,
          classes: occ.length,
        })
      })
      .catch(() => { if (alive) setWeek({ occupancy: 0, avgRate: 0, classes: 0 }) })
    return () => { alive = false }
  }, [orgId])

  const sections = [
    { href: '/box/members',  icon: '👥', title: 'Membres',       desc: 'Gérer les adhérents de la box' },
    { href: '/box/staff',    icon: '🧑‍🏫', title: 'Coachs',        desc: 'Coachs de la box' },
    { href: '/box/planning', icon: '📅', title: 'Planning',      desc: 'Cours et réservations' },
    { href: '/box/plans',    icon: '🎟️', title: 'Abonnements',   desc: 'Formules et tarifs' },
    { href: '/box/profile',  icon: 'ℹ️', title: 'Infos de la box', desc: 'Nom, adresse, contact' },
    { href: '/box/settings', icon: '⚙️', title: 'Réglages',       desc: 'Types de séances, préférences' },
  ]

  return (
    <div className="bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <Link href="/box/profile" className="block pt-8 pb-4 hover:opacity-80 transition">
          <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight flex items-center gap-1.5">
            {orgName} <span className="text-[var(--border-strong)] text-lg">›</span>
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Espace {ROLE_LABEL[role].toLowerCase()} · voir les infos</p>
        </Link>

        {/* Réserver une séance — owners/coaches train at their box too */}
        <Link href="/box/book"
          className="flex items-center justify-between rounded-2xl p-4 mb-4 text-white"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-sm font-black">Réserver une séance</p>
              <p className="text-xs text-white/80">M’inscrire à un cours</p>
            </div>
          </div>
          <span className="text-white/80">›</span>
        </Link>

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
            <p className="text-2xl font-black text-[var(--ink)]">{week ? `${week.avgRate}%` : '—'}</p>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Résa moy.</p>
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
