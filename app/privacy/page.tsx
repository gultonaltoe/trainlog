import Link from 'next/link'
import Wordmark from '@/components/Wordmark'

export const metadata = { title: 'Confidentialité · Trainlift' }

// Public legal page (no auth) — also the Privacy Policy URL for the Google
// OAuth consent screen. Starter content; have a professional review before scale.
export default function PrivacyPage() {
  return (
    <div className="bg-[var(--bg)] min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link href="/" className="inline-block mb-8"><Wordmark size={32} className="text-2xl" /></Link>

        <h1 className="text-3xl font-black text-[var(--ink)] tracking-tight">Politique de confidentialité</h1>
        <p className="text-sm text-[var(--muted)] mt-1 mb-8">Dernière mise à jour : 29 juin 2026</p>

        <div className="space-y-7 text-[15px] leading-relaxed text-[var(--ink-soft)]">
          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">1. Responsable du traitement</h2>
            <p>Trainlift est édité par Julien Altoé. Pour toute question relative à tes données, écris à <a href="mailto:julienaltoe@gmail.com" className="text-[var(--accent-text)] font-semibold">julienaltoe@gmail.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">2. Données que nous collectons</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-[var(--ink)]">Compte</strong> : adresse email, prénom, et — si tu te connectes avec Google — ton nom et ta photo de profil Google.</li>
              <li><strong className="text-[var(--ink)]">Entraînement</strong> : séances, records (PR), objectifs, profil sportif (blessures, disponibilités, matériel, niveau) que tu renseignes.</li>
              <li><strong className="text-[var(--ink)]">Box</strong> : appartenance à une box, réservations de cours, et — pour les gérants — les informations de la box.</li>
              <li><strong className="text-[var(--ink)]">Technique</strong> : données de session strictement nécessaires à ton authentification (stockées localement sur ton appareil).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">3. Pourquoi nous les utilisons</h2>
            <p>Pour créer et sécuriser ton compte, te fournir le suivi d’entraînement, gérer les réservations de cours, et te proposer des recommandations personnalisées. Base légale : l’exécution du service que tu demandes et, le cas échéant, ton consentement.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">4. Sous-traitants</h2>
            <p>Nous nous appuyons sur des prestataires qui traitent des données pour notre compte : <strong className="text-[var(--ink)]">Supabase</strong> (base de données et authentification), <strong className="text-[var(--ink)]">Vercel</strong> (hébergement), <strong className="text-[var(--ink)]">Google</strong> (connexion, si tu la choisis), et <strong className="text-[var(--ink)]">Anthropic</strong> (analyse des WOD/photos et conseils par IA — uniquement les données nécessaires à la fonctionnalité que tu utilises). Nous ne vendons jamais tes données.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">5. Conservation</h2>
            <p>Tes données sont conservées tant que ton compte est actif. À sa suppression, elles sont effacées sous 30 jours, sauf obligation légale de conservation.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">6. Tes droits</h2>
            <p>Conformément au RGPD, tu disposes d’un droit d’accès, de rectification, d’effacement, de portabilité et d’opposition. Pour les exercer, écris-nous à <a href="mailto:julienaltoe@gmail.com" className="text-[var(--accent-text)] font-semibold">julienaltoe@gmail.com</a>. Tu peux aussi introduire une réclamation auprès de la CNIL.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--ink)] mb-2">7. Modifications</h2>
            <p>Cette politique peut évoluer ; la date en haut de page indique la dernière mise à jour. Voir aussi nos <Link href="/terms" className="text-[var(--accent-text)] font-semibold">Conditions d’utilisation</Link>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
