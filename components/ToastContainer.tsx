'use client'
import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' }

const ICONS = { success: '✓', error: '✕', info: 'ℹ' }
const COLORS = {
  success: 'bg-green-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    toast._register((message, type) => {
      const id = Date.now()
      setToasts(t => [...t, { id, message, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
    })
  }, [])

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${COLORS[t.type]} animate-fade-in`}>
          <span className="text-base leading-none">{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
