'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

type FType = 'bug' | 'suggestion' | 'question' | 'autre'
const TYPES: { v: FType; l: string; emoji: string }[] = [
  { v: 'bug',        l: 'Bug',      emoji: '🐛' },
  { v: 'suggestion', l: 'Idée',     emoji: '💡' },
  { v: 'question',   l: 'Question', emoji: '❓' },
  { v: 'autre',      l: 'Autre',    emoji: '💬' },
]

export default function FeedbackButton() {
  const path = usePathname()
  const [open, setOpen]       = useState(false)
  const [type, setType]       = useState<FType>('suggestion')
  const [message, setMessage] = useState('')
  const [name, setName]       = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    supabase.from('user_profile').select('first_name').limit(1).maybeSingle()
      .then(({ data }) => { if (data?.first_name) setName(data.first_name) })
  }, [])

  if (path === '/welcome') return null

  const submit = async () => {
    if (!message.trim()) return
    setSaving(true)
    await supabase.from('feedback').insert({
      user_name: name || null, type, message: message.trim(), page: path,
    })
    toast.success('Merci pour ton retour ! 🙏')
    setOpen(false); setMessage(''); setType('suggestion'); setSaving(false)
  }

  return (
    <>
      {/* Bouton flottant */}
      <button onClick={() => setOpen(true)}
        className="fixed z-40 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-4 py-2.5 rounded-full shadow-lg transition flex items-center gap-2"
        style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', right: 16 }}>
        <span>💬</span> Feedback
      </button>

      {/* Backdrop + Bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pt-2 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-black text-gray-900">Laisser un retour</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Aide-nous à améliorer Trainlog</p>
                </div>
                <button onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-lg font-bold">
                  ×
                </button>
              </div>

              {/* Type */}
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Type</p>
                <div className="grid grid-cols-4 gap-2">
                  {TYPES.map(t => (
                    <button key={t.v} onClick={() => setType(t.v)}
                      className={`py-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                        type === t.v
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-gray-200 bg-white'
                      }`}>
                      <span className="text-xl">{t.emoji}</span>
                      <span className={`text-xs font-semibold ${type === t.v ? 'text-orange-600' : 'text-gray-500'}`}>{t.l}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Message</p>
                <textarea rows={3} value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Décris le problème, l'idée ou ta question..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>

              <button onClick={submit} disabled={saving || !message.trim()}
                className={`w-full py-3.5 rounded-xl text-white text-sm font-bold transition ${
                  message.trim() && !saving
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}>
                {saving ? 'Envoi...' : 'Envoyer →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
