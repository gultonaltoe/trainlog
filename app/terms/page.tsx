import Link from 'next/link'
import Wordmark from '@/components/Wordmark'

export const metadata = { title: 'Conditions d’utilisation · Trainlift' }

// Public legal page (no auth) — also the Terms of Service URL for the Google
// OAuth consent screen. Starter content; have a professional review before scale.
export default function TermsPage() {
  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link href="/" className="inline-block mb-8"><Wordmark size={32} className="text-2xl" /></Link>

        <h1 className="text-3xl font-black text-[var(--ink)] tracking-tight">Conditions d’utilisation</h1>
        <p className="text-sm text-[var(--muted)] mt-1 mb-8">Dernière mise à jour : 29 juin 2026</p>

        <div className="space-y-7 text-[15px] leading-relaxed text-[var(--ink-soft)]">
          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">1. Acceptation</h2>
            <p>En créant un compte ou en utilisant Trainlift, tu acceptes les présentes conditions. Si tu n’es pas d’accord, n’utilise pas le service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">2. Le service</h2>
            <p>Trainlift est une application de suivi d’entraînement et de gestion de box (CrossFit et fitness). Le service est en développement actif (bêta) : des fonctionnalités peuvent évoluer, apparaître ou disparaître.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">3. Ton compte</h2>
            <p>Tu es responsable de l’accès à ton compte et des données que tu y saisis. Fournis des informations exactes et ne partage pas ton accès.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">4. Usage acceptable</h2>
            <p>Tu t’engages à ne pas détourner le service, tenter d’y accéder sans autorisation, ni l’utiliser à des fins illégales ou nuisibles pour les autres utilisateurs ou les box.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">5. Tes contenus</h2>
            <p>Tes données d’entraînement t’appartiennent. Tu nous accordes uniquement le droit de les traiter pour te fournir le service, comme décrit dans notre <Link href="/privacy" className="text-[var(--accent-text)] font-semibold">politique de confidentialité</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">6. Santé &amp; avertissement</h2>
            <p>Trainlift est un outil de suivi, pas un conseil médical. Les recommandations (y compris générées par IA) sont indicatives. Consulte un professionnel de santé avant de modifier ton entraînement, et arrête en cas de douleur.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">7. Responsabilité</h2>
            <p>Le service est fourni « en l’état », sans garantie d’absence d’interruption ou d’erreur. Dans les limites permises par la loi, notre responsabilité ne saurait être engagée pour les dommages indirects liés à l’usage du service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">8. Droit applicable</h2>
            <p>Les présentes conditions sont régies par le droit français. Pour toute question : <a href="mailto:julienaltoe@gmail.com" className="text-[var(--accent-text)] font-semibold">julienaltoe@gmail.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
