export interface FailureMotion {
  phase: number
  shake: number
  drop: number
  broken: boolean
}

const DURATION_MS = 1200

export function failureMotion(
  now: number,
  completedAt: number | null,
  reducedMotion: boolean,
): FailureMotion {
  if (completedAt === null) return { phase: 0, shake: 0, drop: 0, broken: false }
  if (reducedMotion) return { phase: 1, shake: 0, drop: 1, broken: true }
  const elapsed = Math.max(0, now - completedAt)
  const phase = Math.min(1, elapsed / DURATION_MS)
  const eased = 1 - (1 - phase) ** 3
  const shake = phase < 0.55 ? Math.sin(elapsed / 26) * (1 - phase / 0.55) : 0
  return {
    phase,
    shake,
    drop: eased,
    broken: phase > 0.35,
  }
}

export function mechanismWobble(now: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.05
  return 0.06 * Math.sin(now / 780)
}
