import { BUCKLING_K } from './constants'
import { memberGeometry, nodeMap } from './geometry'
import { solveLinearSystem } from './linalg'
import type { MemberForceSet, Reaction, TrussModel, TrussNode } from './types'

export interface ReactionColumn {
  nodeId: number
  component: 'fx' | 'fy'
}

export interface EquilibriumSystem {
  matrix: number[][]
  rhs: number[]
  nodeIndex: Map<number, number>
  memberIndex: Map<number, number>
  reactionColumns: ReactionColumn[]
}

/**
 * 절점법 평형 방정식.
 *
 * 미지수 x = [F1..Fm, R1..Rr]^T, 인장을 +로 둔다.
 * 절점 i에서 부재가 절점을 잡아당기는 방향(절점 → 상대 절점)을 +로 하면
 *   ΣFx: Σ Fm·cosθ + Σ R·rx + loadFx = 0
 *   ΣFy: Σ Fm·sinθ + Σ R·ry + loadFy = 0
 * 이므로 A·x = −load 가 된다.
 */
export function buildEquilibriumSystem(model: TrussModel): EquilibriumSystem {
  const nodes = model.nodes
  const n = nodes.length
  const nodeIndex = new Map<number, number>()
  nodes.forEach((node, index) => nodeIndex.set(node.id, index))

  const memberIndex = new Map<number, number>()
  model.members.forEach((member, index) => memberIndex.set(member.id, index))

  const reactionColumns: ReactionColumn[] = []
  for (const node of nodes) {
    if (node.support === 'pin') {
      reactionColumns.push({ nodeId: node.id, component: 'fx' })
      reactionColumns.push({ nodeId: node.id, component: 'fy' })
    } else if (node.support === 'roller') {
      reactionColumns.push({ nodeId: node.id, component: 'fy' })
    }
  }

  const columns = model.members.length + reactionColumns.length
  const matrix = Array.from({ length: n * 2 }, () => new Array<number>(columns).fill(0))
  const rhs = new Array<number>(n * 2).fill(0)
  const byId = nodeMap(model)

  for (const [index, member] of model.members.entries()) {
    const geometry = memberGeometry(member, byId)
    if (!geometry) continue
    const a = nodeIndex.get(member.a)
    const b = nodeIndex.get(member.b)
    if (a === undefined || b === undefined) continue
    matrix[a * 2][index] += geometry.cos
    matrix[a * 2 + 1][index] += geometry.sin
    matrix[b * 2][index] -= geometry.cos
    matrix[b * 2 + 1][index] -= geometry.sin
  }

  reactionColumns.forEach((column, offset) => {
    const row = nodeIndex.get(column.nodeId)
    if (row === undefined) return
    const col = model.members.length + offset
    if (column.component === 'fx') matrix[row * 2][col] += 1
    else matrix[row * 2 + 1][col] += 1
  })

  for (const load of model.loads) {
    const index = nodeIndex.get(load.nodeId)
    if (index === undefined) continue
    rhs[index * 2] -= load.fx
    rhs[index * 2 + 1] -= load.fy
  }

  return { matrix, rhs, nodeIndex, memberIndex, reactionColumns }
}

export function solveTruss(model: TrussModel): MemberForceSet {
  const system = buildEquilibriumSystem(model)
  const equationCount = system.matrix.length
  const unknownCount = system.matrix[0]?.length ?? 0

  if (equationCount === 0) {
    return { ok: false, memberForces: new Map(), reactions: [], reasonKo: '절점이 없습니다.' }
  }
  if (unknownCount !== equationCount) {
    return {
      ok: false,
      memberForces: new Map(),
      reactions: [],
      reasonKo: '정정 구조만 풀 수 있습니다. 부재 수와 지지대 수를 확인하세요.',
    }
  }

  const solved = solveLinearSystem(system.matrix, system.rhs)
  if (!solved.ok || !solved.x) {
    return {
      ok: false,
      memberForces: new Map(),
      reactions: [],
      reasonKo: solved.reasonKo ?? '구조를 풀 수 없습니다.',
    }
  }

  const memberForces = new Map<number, number>()
  for (const [index, member] of model.members.entries()) {
    memberForces.set(member.id, solved.x[index])
  }

  const reactionMap = new Map<number, Reaction>()
  for (const node of model.nodes) {
    if (node.support !== 'free') {
      reactionMap.set(node.id, { nodeId: node.id, fx: 0, fy: 0 })
    }
  }
  system.reactionColumns.forEach((column, offset) => {
    const value = solved.x?.[model.members.length + offset] ?? 0
    const reaction = reactionMap.get(column.nodeId)
    if (!reaction) return
    reaction[column.component] += value
  })

  return {
    ok: true,
    memberForces,
    reactions: [...reactionMap.values()],
    reasonKo: undefined,
  }
}

export function zeroReaction(node: TrussNode): Reaction {
  return { nodeId: node.id, fx: 0, fy: 0 }
}

export function effectiveLength(meters: number): number {
  return BUCKLING_K * meters
}
