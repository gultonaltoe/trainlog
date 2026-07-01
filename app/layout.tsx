import type { Metadata, Viewport } from 'next'
import './globals.css'
import ToastContainer from '@/components/ToastContainer'
import BoxBranding    from '@/components/BoxBranding'
import UserInit       from '@/components/UserInit'
import ClientShell    from '@/components/ClientShell'
import { AppProvider } from '@/components/AppContext'
import GlobalContextBar from '@/components/GlobalContextBar'

export const metadata: Metadata = {
  title: 'Trainlift',
  description: 'Ton journal d\'entraînement intelligent pour CrossFit et sports fonctionnels.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trainlift',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Trainlift',
    description: 'Journal d\'entraînement CrossFit intelligent',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
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
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Nero" />
        {/* PWA Android */}
        <link rel="manifest" href="/manifest.json" />
        {/* Dark mode no-flash: apply saved theme before first paint (ST-39). */}
        <script dangerouslySetInnerHTML={{ __html: `try{var m=localStorage.getItem('theme-mode')||'system';if(m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body>
        <AppProvider>
          <UserInit />
          <BoxBranding />
          <ToastContainer />
          <GlobalContextBar />
          <div className="pb-20" style={{ background: 'var(--bg)' }}>
            {children}
          </div>
          <ClientShell />
        </AppProvider>
      </body>
    </html>
  )
}
