import { SECTION_AREA_M2, FORCE_TOLERANCE, UTILIZATION_WARNING } from './constants'
import { bucklingUtilization, eulerBucklingLoad } from './buckling'
import { memberGeometry, nodeMap } from './geometry'
import { getMaterial } from './materials'
import type { MemberResult, TrussModel } from './types'

export function classifyMemberState(utilization: number): 'ok' | 'warning' | 'failed' {
  if (utilization > 1) return 'failed'
  if (utilization >= UTILIZATION_WARNING) return 'warning'
  return 'ok'
}

export function computeMemberResults(
  model: TrussModel,
  memberForces: Map<number, number>,
): MemberResult[] {
  const nodes = nodeMap(model)
  const results: MemberResult[] = []

  for (const member of model.members) {
    const geometry = memberGeometry(member, nodes)
    if (!geometry) continue
    const force = memberForces.get(member.id) ?? 0
    const material = getMaterial(member.materialId)
    const stress = force / SECTION_AREA_M2
    const allowable = stress >= 0 ? material.allowableTension : material.allowableCompression
    const stressUtilization = allowable > 0 ? Math.abs(stress) / allowable : 0
    const isCompression = force < 0
    const buckling =
      isCompression && geometry.length > 0 ? eulerBucklingLoad(material.E, geometry.length) : null
    const bucklingUtil = isCompression ? bucklingUtilization(force, material.E, geometry.length) : 0
    const utilization = Math.max(stressUtilization, bucklingUtil)
    const zeroForce = Math.abs(force) < FORCE_TOLERANCE

    results.push({
      memberId: member.id,
      force,
      stress,
      stressUtilization,
      bucklingLoad: buckling,
      bucklingUtilization: bucklingUtil,
      utilization,
      state: zeroForce ? 'ok' : classifyMemberState(utilization),
      zeroForce,
      length: geometry.length,
      materialId: member.materialId,
    })
  }

  return results
}

export function maxUtilization(results: MemberResult[]): number {
  return results.reduce((max, item) => Math.max(max, item.utilization), 0)
}

export function factorOfSafety(results: MemberResult[]): number {
  const max = maxUtilization(results)
  return max > 0 ? 1 / max : Number.POSITIVE_INFINITY
}

export function memberTensionCompressionLabel(force: number): 'T' | 'C' | '0' {
  if (Math.abs(force) < FORCE_TOLERANCE) return '0'
  return force > 0 ? 'T' : 'C'
}
