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

  const close = () => setOpen(false)

  return (
    <>
      {/* Bouton flottant — orange, proéminent */}
      <button onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-4 py-2.5 rounded-full shadow-lg transition flex items-center gap-2"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <span className="text-base">💬</span>
        Feedback
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-50" onClick={close}
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>

          {/* Modal centré */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4"
            style={{ left: '50%' }}
            onClick={e => e.stopPropagation()}>
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-black text-gray-900">Laisser un retour</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Aide-nous à améliorer Trainlog</p>
                </div>
                <button onClick={close}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition text-lg font-bold">
                  ×
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Type */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Type</p>
                  <div className="grid grid-cols-4 gap-2">
                    {TYPES.map(t => (
                      <button key={t.v} onClick={() => setType(t.v)}
                        className={`py-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                          type === t.v
                            ? 'border-orange-400 bg-orange-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                        <span className="text-xl">{t.emoji}</span>
                        <span className={`text-xs font-semibold ${type === t.v ? 'text-orange-600' : 'text-gray-500'}`}>{t.l}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Message</p>
                  <textarea rows={4} value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Décris le problème, l'idée ou ta question..."
                    className="w-full rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    autoFocus />
                </div>

                <button onClick={submit} disabled={saving || !message.trim()}
                  className={`w-full py-3 rounded-xl text-white text-sm font-bold transition ${
                    message.trim() && !saving
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}>
                  {saving ? 'Envoi...' : 'Envoyer →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
