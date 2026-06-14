import type { Metadata } from 'next'
import './globals.css'
import BottomNav       from '@/components/BottomNav'
import ToastContainer  from '@/components/ToastContainer'
import FeedbackButton  from '@/components/FeedbackButton'
import ThemeLoader     from '@/components/ThemeLoader'

export const metadata: Metadata = {
  title: 'Trainlog',
  description: 'Ton journal d\'entraînement intelligent',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ThemeLoader />
        <ToastContainer />
        <div className="pb-20 min-h-screen" style={{ background: '#F9FAFB' }}>
          {children}
        </div>
        <BottomNav />
        <FeedbackButton />
      </body>
    </html>
  )
}
