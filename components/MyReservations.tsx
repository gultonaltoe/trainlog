'use client'
import { useCallback, useEffect, useState } from 'react'
import { getMyReservations, cancelClass, type MyReservation } from '@/lib/reservations'
import { endTime } from '@/lib/classes'
import { toast } from '@/lib/toast'

const fmtDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

// A member's own bookings: upcoming (cancellable) + past. Used in the booking
// hub's "Mes réservations" tab.
export default function MyReservations({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<MyReservation[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setItems(await getMyReservations(orgId)) } catch { setItems([]) }
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const now = new Date()
  const isUpcoming = (r: MyReservation) => new Date(`${r.date}T${r.startTime}:00`) >= now
  const upcoming = (items ?? []).filter(isUpcoming)
  const past = (items ?? []).filter(r => !isUpcoming(r)).reverse()

  const cancel = async (r: MyReservation) => {
    const key = `${r.scheduleId}|${r.date}`
    setConfirmKey(null)
    setBusy(key)
    try { await cancelClass(r.scheduleId, r.date); toast.success('Annulé'); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setBusy(null)
  }

  if (items === null) return <p className="text-sm text-[var(--muted)] text-center py-8">Chargement…</p>

  return (
    <div>
      <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">À venir</p>
      {upcoming.length === 0 ? (
        <p className="text-sm text-[var(--border-strong)] py-2 mb-4">Aucune réservation à venir — réserve un cours depuis l’onglet « Réserver » 👆</p>
      ) : (
        <div className="space-y-2 mb-6">
          {upcoming.map(r => {
            const key = `${r.scheduleId}|${r.date}`
            return (
              <div key={key} className="bg-[var(--card)] rounded-xl border border-[color:var(--border)] p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--ink)] truncate">{r.title}</p>
                  <p className="text-xs text-[var(--muted)] capitalize">{fmtDay(r.date)} · {r.startTime}–{endTime(r.startTime, r.durationMin)}</p>
                  {r.status === 'waitlisted' && <p className="text-[11px] font-bold text-amber-600">Liste d’attente</p>}
                </div>
                {confirmKey === key ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => cancel(r)} disabled={busy === key}
                      className="text-xs font-black text-white bg-red-500 rounded-lg px-3 py-2 disabled:opacity-50 cursor-pointer whitespace-nowrap">
                      {busy === key ? '…' : 'Confirmer'}
                    </button>
                    <button onClick={() => setConfirmKey(null)} className="text-[11px] font-bold text-[var(--muted)] px-1 cursor-pointer">Non</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmKey(key)}
                    className="text-xs font-bold text-red-500 border border-red-200 rounded-lg px-3 py-2 cursor-pointer flex-shrink-0">
                    Annuler
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {past.length > 0 && (
        <>
          <p className="text-xs font-bold text-[var(--sub)] uppercase tracking-wider mb-2">Passées</p>
          <div className="space-y-2">
            {past.slice(0, 30).map(r => (
              <div key={`${r.scheduleId}|${r.date}`} className="bg-[var(--card)] rounded-xl border border-[color:var(--track)] p-3 opacity-70">
                <p className="text-sm font-semibold text-[var(--ink-soft)] truncate">{r.title}</p>
                <p className="text-xs text-[var(--muted)] capitalize">{fmtDay(r.date)} · {r.startTime}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
