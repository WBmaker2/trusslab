import type { MemberResult } from '../struct/types'

export const COLORS = {
  paper: '#faf7ef',
  paperDeep: '#f1ede2',
  sheet: '#fbf9f2',
  ink: '#172321',
  inkSoft: '#3c4a45',
  muted: '#6a736c',
  grid: '#e3ddcf',
  gridStrong: '#cfc8b7',
  tension: '#0f766e',
  tensionSoft: '#d9efec',
  compression: '#4338ca',
  compressionSoft: '#e3e1fb',
  zero: '#8a8f86',
  zeroSoft: '#eeece5',
  failed: '#b42318',
  failedSoft: '#f9dfdc',
  warning: '#a16207',
  warningSoft: '#f7ecd4',
  safe: '#2f6f4e',
  gold: '#c7952c',
  accent: '#c8451f',
  accentDark: '#9e3214',
  white: '#ffffff',
} as const

export function memberBaseColor(member: MemberResult | undefined): string {
  if (!member) return COLORS.inkSoft
  if (member.state === 'failed') return COLORS.failed
  if (member.zeroForce) return COLORS.zero
  return member.force >= 0 ? COLORS.tension : COLORS.compression
}

export function memberSoftColor(member: MemberResult | undefined): string {
  if (!member) return COLORS.paperDeep
  if (member.state === 'failed') return COLORS.failedSoft
  if (member.zeroForce) return COLORS.zeroSoft
  return member.force >= 0 ? COLORS.tensionSoft : COLORS.compressionSoft
}

export function typeLabel(force: number, zeroForce: boolean): 'T' | 'C' | '0' {
  if (zeroForce) return '0'
  if (force > 0) return 'T'
  if (force < 0) return 'C'
  return '0'
}

export function typeLabelKo(force: number, zeroForce: boolean): string {
  if (zeroForce) return '영부재'
  return force > 0 ? '인장' : '압축'
}

export function stateLabelKo(state: MemberResult['state']): string {
  if (state === 'failed') return '파괴'
  if (state === 'warning') return '주의'
  return '안전'
}

export function utilizationColor(utilization: number): string {
  if (utilization > 1) return COLORS.failed
  if (utilization >= 0.8) return COLORS.warning
  return COLORS.safe
}

export function utilizationSoftColor(utilization: number): string {
  if (utilization > 1) return COLORS.failedSoft
  if (utilization >= 0.8) return COLORS.warningSoft
  return '#e2efe7'
}

export const STRESS_LEGEND = [
  { key: 'tension', labelKo: '인장 (T)', color: COLORS.tension },
  { key: 'compression', labelKo: '압축 (C)', color: COLORS.compression },
  { key: 'zero', labelKo: '힘 0', color: COLORS.zero },
  { key: 'failed', labelKo: '파괴', color: COLORS.failed },
] as const
