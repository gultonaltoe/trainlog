'use client'
import { useCallback, useEffect, useState } from 'react'
import { useBoxGuard } from '@/components/useBoxGuard'
import { getOrganization, updateOrgSessionTypes, updateReservationSettings, DEFAULT_SESSION_TYPES, DEFAULT_DURATION_MIN, DEFAULT_CAPACITY, DEFAULT_RESERVATION_SETTINGS, type SessionType, type ReservationSettings, type WaitlistMode } from '@/lib/orgs'
import { toast } from '@/lib/toast'

const fieldCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function BoxSettingsPage() {
  const org = useBoxGuard()
  const orgId = org?.orgId
  const canEdit = org?.role === 'owner'
  const [types, setTypes] = useState<SessionType[]>([])
  const [resa, setResa] = useState<ReservationSettings>(DEFAULT_RESERVATION_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingResa, setSavingResa] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const info = await getOrganization(orgId)
    // Pre-fill the standard set until the box saves its own.
    setTypes(info.sessionTypes.length > 0 ? info.sessionTypes : DEFAULT_SESSION_TYPES)
    setResa(info.reservations)
    setLoading(false)
  }, [orgId])
  useEffect(() => { void load() }, [load])

  const addType = () => setTypes(t => [...t, { name: '', defaultDurationMin: DEFAULT_DURATION_MIN, defaultCapacity: DEFAULT_CAPACITY }])
  const updType = (i: number, patch: Partial<SessionType>) => setTypes(t => t.map((x, j) => j === i ? { ...x, ...patch } : x))
  const updResa = (patch: Partial<ReservationSettings>) => setResa(r => ({ ...r, ...patch }))

  const save = async () => {
    if (!orgId) return
    const clean = types
      .filter(t => t.name.trim())
      .map(t => ({ name: t.name.trim(), defaultDurationMin: t.defaultDurationMin || 60, defaultCapacity: t.defaultCapacity || 1 }))
    setSaving(true)
    try { await updateOrgSessionTypes(orgId, clean); setTypes(clean); toast.success('Réglages enregistrés') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setSaving(false)
  }

  const saveResa = async () => {
    if (!orgId) return
    const clean: ReservationSettings = {
      waitlistEnabled: resa.waitlistEnabled,
      waitlistMode: resa.waitlistMode,
      waitlistCapacity: Math.max(0, resa.waitlistCapacity || 0),
      cancelCutoffMin: Math.max(0, resa.cancelCutoffMin || 0),
      bookAheadDays: Math.max(0, resa.bookAheadDays || 0),
      bookCutoffMin: Math.max(0, resa.bookCutoffMin || 0),
    }
    setSavingResa(true)
    try { await updateReservationSettings(orgId, clean); setResa(clean); toast.success('Réservations enregistrées') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    setSavingResa(false)
  }

  if (!org) return null

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Réglages</h1>
          <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
        </div>

        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Types de séances</p>
        <p className="text-xs text-gray-400 mb-3">Définis tes types de cours avec durée et places par défaut. Ils pré-remplissent le planning.</p>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>
        ) : (
          <div className="space-y-2">
            {types.map((t, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input className={`${fieldCls} flex-1`} placeholder="Nom (WOD, Haltéro, Open gym…)"
                    value={t.name} disabled={!canEdit} onChange={e => updType(i, { name: e.target.value })} />
                  {canEdit && (
                    <button onClick={() => setTypes(arr => arr.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-red-500 text-xl px-1">×</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-gray-400 block">Durée (min)
                    <input type="number" min={15} step={15} className={fieldCls} value={t.defaultDurationMin} disabled={!canEdit}
                      onChange={e => updType(i, { defaultDurationMin: parseInt(e.target.value) || 0 })} />
                  </label>
                  <label className="text-[11px] text-gray-400 block">Places
                    <input type="number" min={1} className={fieldCls} value={t.defaultCapacity} disabled={!canEdit}
                      onChange={e => updType(i, { defaultCapacity: parseInt(e.target.value) || 0 })} />
                  </label>
                </div>
              </div>
            ))}
            {types.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun type pour l’instant.</p>}
          </div>
        )}

        {canEdit && (
          <>
            <button onClick={addType} className="mt-3 text-sm font-bold text-orange-600">+ Ajouter un type</button>
            <button onClick={save} disabled={saving}
              className="w-full mt-4 py-3.5 rounded-2xl text-white font-black text-base disabled:opacity-50"
              style={{ background: 'var(--theme-primary, #F97316)' }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        )}

        {/* Réservations */}
        <div className="mt-10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Réservations</p>
          <p className="text-xs text-gray-400 mb-3">Règles de réservation des membres : liste d’attente et délai d’annulation. Le nombre de places en liste d’attente peut être ajusté par cours dans le planning.</p>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-4">
              {/* Waitlist on/off */}
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-800">Liste d’attente</span>
                <input type="checkbox" className="w-5 h-5 accent-orange-500" checked={resa.waitlistEnabled}
                  disabled={!canEdit} onChange={e => updResa({ waitlistEnabled: e.target.checked })} />
              </label>

              {resa.waitlistEnabled && (
                <>
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Quand une place se libère</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([['auto_promote', 'Promotion auto'], ['notify', 'Notifier']] as [WaitlistMode, string][]).map(([mode, label]) => (
                        <button key={mode} type="button" disabled={!canEdit} onClick={() => updResa({ waitlistMode: mode })}
                          className="py-2 rounded-lg text-xs font-bold border transition disabled:opacity-60"
                          style={resa.waitlistMode === mode
                            ? { background: 'var(--theme-primary, #F97316)', color: '#fff', borderColor: 'transparent' }
                            : { background: '#F9FAFB', color: '#6B7280', borderColor: '#E5E7EB' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {resa.waitlistMode === 'auto_promote'
                        ? 'Le premier en attente est automatiquement inscrit.'
                        : 'Le premier en attente est prévenu et doit confirmer sa place.'}
                    </p>
                  </div>

                  <label className="text-[11px] text-gray-400 block">Places en liste d’attente (défaut)
                    <input type="number" min={0} className={fieldCls} value={resa.waitlistCapacity} disabled={!canEdit}
                      onChange={e => updResa({ waitlistCapacity: parseInt(e.target.value) || 0 })} />
                  </label>
                </>
              )}

              <label className="text-[11px] text-gray-400 block">Délai limite d’annulation (min avant le cours)
                <input type="number" min={0} step={15} className={fieldCls} value={resa.cancelCutoffMin} disabled={!canEdit}
                  onChange={e => updResa({ cancelCutoffMin: parseInt(e.target.value) || 0 })} />
                <span className="block mt-1">0 = annulation possible jusqu’au début du cours.</span>
              </label>

              <div className="pt-1 border-t border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 mt-2">Fenêtre de réservation</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-gray-400 block">Ouverture (jours avant)
                    <input type="number" min={0} className={fieldCls} value={resa.bookAheadDays} disabled={!canEdit}
                      onChange={e => updResa({ bookAheadDays: parseInt(e.target.value) || 0 })} />
                    <span className="block mt-1">0 = aucune limite.</span>
                  </label>
                  <label className="text-[11px] text-gray-400 block">Fermeture (min avant)
                    <input type="number" min={0} step={15} className={fieldCls} value={resa.bookCutoffMin} disabled={!canEdit}
                      onChange={e => updResa({ bookCutoffMin: parseInt(e.target.value) || 0 })} />
                    <span className="block mt-1">0 = jusqu’au début.</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {canEdit && !loading && (
            <button onClick={saveResa} disabled={savingResa}
              className="w-full mt-4 py-3.5 rounded-2xl text-white font-black text-base disabled:opacity-50"
              style={{ background: 'var(--theme-primary, #F97316)' }}>
              {savingResa ? 'Enregistrement…' : 'Enregistrer les réservations'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
