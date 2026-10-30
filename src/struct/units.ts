const numberFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 })
const integerFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

export function formatForce(newtons: number, decimals = 1): string {
  if (!Number.isFinite(newtons)) return '—'
  if (Math.abs(newtons) < 0.05) return '0.0 N'
  if (decimals === 0) return `${integerFormatter.format(Math.round(newtons))} N`
  return `${numberFormatter.format(Number(newtons.toFixed(decimals)))} N`
}

export function formatForceShort(newtons: number): string {
  if (!Number.isFinite(newtons)) return '—'
  if (Math.abs(newtons) < 0.05) return '0 N'
  const abs = Math.abs(newtons)
  if (abs >= 1000) return `${(newtons / 1000).toFixed(2)} kN`
  return `${newtons.toFixed(1)} N`
}

export function formatStress(pascals: number): string {
  if (!Number.isFinite(pascals)) return '—'
  const mpa = pascals / 1e6
  if (Math.abs(mpa) < 0.0001) return '0 MPa'
  const abs = Math.abs(mpa)
  if (abs >= 100) return `${mpa.toFixed(0)} MPa`
  return `${Number(mpa.toPrecision(2))} MPa`
}

export function formatPercent(ratio: number, decimals = 0): string {
  if (!Number.isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(decimals)}%`
}

export function formatCost(credits: number): string {
  if (!Number.isFinite(credits)) return '—'
  return `${integerFormatter.format(Math.round(credits))} cr`
}

export function formatLength(meters: number): string {
  if (!Number.isFinite(meters)) return '—'
  return `${Number(meters.toFixed(2))} m`
}

export function formatUtilization(ratio: number, decimals = 0): string {
  return formatPercent(ratio, decimals)
}

export function formatSafetyFactor(factor: number): string {
  if (!Number.isFinite(factor)) return '∞'
  if (factor >= 100) return '> 99'
  return factor.toFixed(2)
}

export function formatSignedForce(newtons: number, decimals = 1): string {
  const sign = newtons > 0 ? '+' : ''
  return `${sign}${formatForce(newtons, decimals)}`
}
