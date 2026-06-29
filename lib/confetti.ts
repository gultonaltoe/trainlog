import confetti from 'canvas-confetti'

// Light celebration on a successful session log (ST-76). Non-blocking, ~1.5s,
// and respects prefers-reduced-motion (no-op for users who reduce animations).
export function celebrate() {
  if (typeof window === 'undefined') return
  confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 38,
    origin: { y: 0.7 },
    scalar: 0.9,
    disableForReducedMotion: true,
  })
}
