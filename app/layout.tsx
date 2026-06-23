import type { Metadata, Viewport } from 'next'
import './globals.css'
import ToastContainer from '@/components/ToastContainer'
import ThemeLoader    from '@/components/ThemeLoader'
import UserInit       from '@/components/UserInit'
import ClientShell    from '@/components/ClientShell'
import { AppProvider } from '@/components/AppContext'
import GlobalContextBar from '@/components/GlobalContextBar'

export const metadata: Metadata = {
  title: 'Trainlog',
  description: 'Ton journal d\'entraînement intelligent pour CrossFit et sports fonctionnels.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trainlog',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Trainlog',
    description: 'Journal d\'entraînement CrossFit intelligent',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#F97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* PWA iOS */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Trainlog" />
        {/* PWA Android */}
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <AppProvider>
          <UserInit />
          <ThemeLoader />
          <ToastContainer />
          <GlobalContextBar />
          <div className="pb-20" style={{ background: '#F9FAFB' }}>
            {children}
          </div>
          <ClientShell />
        </AppProvider>
      </body>
    </html>
  )
}
