import { FORCE_TOLERANCE } from './constants'
import { nodeMap } from './geometry'
import type { MemberResult, TrussModel } from './types'

interface Direction {
  memberId: number
  ux: number
  uy: number
}

/**
 * 고전적인 영부재 규칙 두 가지.
 * 1) 하중이 없고 지지대가 없는 절점에 비공선 부재가 2개 → 둘 다 0.
 * 2) 하중이 없고 지지대가 없는 절점에 부재가 3개이고 둘이 공선 → 나머지가 0.
 * 규칙은 힌트용이고, 실제 판정은 해의 |F| < FORCE_TOLERANCE를 따른다.
 */
export function detectZeroForceCandidates(model: TrussModel): Set<number> {
  const nodes = nodeMap(model)
  const loaded = new Set<number>()
  for (const load of model.loads) {
    if (Math.abs(load.fx) > 0 || Math.abs(load.fy) > 0) loaded.add(load.nodeId)
  }

  const attached = new Map<number, number[]>()
  for (const member of model.members) {
    if (!attached.has(member.a)) attached.set(member.a, [])
    if (!attached.has(member.b)) attached.set(member.b, [])
    attached.get(member.a)?.push(member.id)
    attached.get(member.b)?.push(member.id)
  }

  const candidates = new Set<number>()

  for (const node of model.nodes) {
    if (node.support !== 'free' || loaded.has(node.id)) continue
    const memberIds = attached.get(node.id) ?? []
    if (memberIds.length < 2 || memberIds.length > 3) continue

    const directions: Direction[] = []
    for (const memberId of memberIds) {
      const member = model.members.find((item) => item.id === memberId)
      if (!member) continue
      const otherId = member.a === node.id ? member.b : member.a
      const other = nodes.get(otherId)
      if (!other) continue
      const dx = other.x - node.x
      const dy = other.y - node.y
      const length = Math.hypot(dx, dy)
      if (length < 1e-9) continue
      directions.push({ memberId, ux: dx / length, uy: dy / length })
    }

    if (directions.length === 2) {
      const cross = Math.abs(
        directions[0].ux * directions[1].uy - directions[0].uy * directions[1].ux,
      )
      if (cross > 1e-6) {
        candidates.add(directions[0].memberId)
        candidates.add(directions[1].memberId)
      }
    } else if (directions.length === 3) {
      for (let i = 0; i < directions.length; i += 1) {
        for (let j = i + 1; j < directions.length; j += 1) {
          const a = directions[i]
          const b = directions[j]
          const cross = Math.abs(a.ux * b.uy - a.uy * b.ux)
          const dot = a.ux * b.ux + a.uy * b.uy
          if (cross < 1e-6 && dot < 0) {
            const third = directions.find(
              (item) => item.memberId !== a.memberId && item.memberId !== b.memberId,
            )
            if (third) candidates.add(third.memberId)
          }
        }
      }
    }
  }

  return candidates
}

export function zeroForceResultIds(results: MemberResult[]): number[] {
  return results.filter((item) => item.zeroForce).map((item) => item.memberId)
}

export function isZeroForce(force: number): boolean {
  return Math.abs(force) < FORCE_TOLERANCE
}
