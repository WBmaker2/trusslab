import { DEFLECTION_EXAGGERATION } from '../struct/constants'
import type { DeflectionEntry, TrussResult } from '../struct/types'

export interface DisplayDeflection {
  factor: number
  entries: Map<number, DeflectionEntry>
  maxMeters: number
  available: boolean
}

function niceFactor(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFLECTION_EXAGGERATION
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  const fraction = value / base
  const rounded = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return rounded * base
}

/**
 * 변위는 실제로는 수 mm 수준이라 그대로 그리면 보이지 않는다.
 * 가장 큰 변위가 화면에서 약 0.45 m가 되도록 과장 배율을 정하고,
 * UI에 실제 배율을 표시한다. 최소 배율은 DEFLECTION_EXAGGERATION.
 */
export function computeDisplayDeflection(result: TrussResult | null): DisplayDeflection {
  const entries = new Map<number, DeflectionEntry>()
  if (!result || result.deflection.length === 0) {
    return { factor: DEFLECTION_EXAGGERATION, entries, maxMeters: 0, available: false }
  }
  let max = 0
  for (const entry of result.deflection) {
    entries.set(entry.nodeId, entry)
    max = Math.max(max, Math.hypot(entry.dx, entry.dy))
  }
  if (max <= 0) {
    return { factor: DEFLECTION_EXAGGERATION, entries, maxMeters: 0, available: false }
  }
  const target = 0.45
  const factor = Math.max(DEFLECTION_EXAGGERATION, niceFactor(target / max))
  return { factor, entries, maxMeters: max, available: true }
}

export function deflectionFactorLabel(factor: number): string {
  if (!Number.isFinite(factor)) return '—'
  return `×${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(factor)}`
}
