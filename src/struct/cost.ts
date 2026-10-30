import { NODE_COST, SECTION_AREA_M2 } from './constants'
import { allMemberGeometry } from './geometry'
import { getMaterial } from './materials'
import type { TrussModel } from './types'

export interface CostBreakdown {
  total: number
  memberCost: number
  nodeCost: number
  byMember: Map<number, number>
}

export function computeCost(model: TrussModel): CostBreakdown {
  let memberCost = 0
  const byMember = new Map<number, number>()
  const nodes = new Map(model.nodes.map((node) => [node.id, node]))

  for (const member of model.members) {
    const a = nodes.get(member.a)
    const b = nodes.get(member.b)
    if (!a || !b) {
      byMember.set(member.id, 0)
      continue
    }
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const material = getMaterial(member.materialId)
    const cost = length * material.costPerMeter
    byMember.set(member.id, cost)
    memberCost += cost
  }

  const nodeCost = model.nodes.length * NODE_COST
  return {
    total: memberCost + nodeCost,
    memberCost,
    nodeCost,
    byMember,
  }
}

export function memberCostPerMeter(materialId: 'wood' | 'steel'): number {
  return getMaterial(materialId).costPerMeter
}

export function memberWeightKg(length: number, materialId: 'wood' | 'steel'): number {
  return SECTION_AREA_M2 * length * getMaterial(materialId).density
}

export function totalWeightKg(model: TrussModel): number {
  let weight = 0
  for (const geometry of allMemberGeometry(model)) {
    const member = model.members.find((item) => item.id === geometry.memberId)
    if (!member) continue
    weight += memberWeightKg(geometry.length, member.materialId)
  }
  return weight
}
