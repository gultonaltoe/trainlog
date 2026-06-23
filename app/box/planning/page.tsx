'use client'
import { useBoxGuard } from '@/components/useBoxGuard'
import { toast } from '@/lib/toast'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function PlanningPage() {
  const org = useBoxGuard()
  if (!org) return null

  return (
    <div className="bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-4">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Planning</h1>
          <p className="text-sm text-gray-400 mt-0.5">{org.orgName}</p>
        </div>

        <button onClick={() => toast.info('Création de cours bientôt disponible')}
          className="w-full mb-4 py-3 rounded-2xl text-white font-bold text-sm"
          style={{ background: 'var(--theme-primary, #F97316)' }}>
          + Créer un cours
        </button>

        {/* Week grid shell — structure ready, classes/bookings come next */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="grid grid-cols-7 gap-1 mb-3">
            {DAYS.map(d => (
              <p key={d} className="text-center text-[11px] font-bold text-gray-400">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="min-h-24 rounded-lg border border-dashed border-gray-200 bg-gray-50" />
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
          Bientôt : créer des cours récurrents, gérer les capacités et les réservations des membres.
        </p>
      </div>
    </div>
  )
}
