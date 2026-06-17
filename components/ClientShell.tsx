'use client'
import { usePathname } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import FeedbackButton from '@/components/FeedbackButton'

export default function ClientShell() {
  const pathname = usePathname()
  if (pathname.startsWith('/auth')) return null
  return (
    <>
      <BottomNav />
      <FeedbackButton />
    </>
  )
}
