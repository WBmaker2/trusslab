import { SECTION_AREA_M2 } from './constants'
import { nodeMap } from './geometry'
import { solveLinearSystem } from './linalg'
import { getMaterial } from './materials'
import type { DeflectionEntry, TrussModel } from './types'

export interface DeflectionResult {
  entries: DeflectionEntry[]
  maxMagnitude: number
  ok: boolean
  reasonKo?: string
}

/**
 * 정정 트러스의 절점 변위를 부재 신장량에서 직접 구한다.
 * 각 부재: (u_b − u_a)·n = F·L/(A·E)
 * 지지 조건: 핀 ux=uy=0, 롤러 uy=0.
 * m + r = 2j 이므로 방정식 수와 미지수 수가 같다.
 * 표시할 때는 과장 배율을 곱하고 '변형(과장)' 배지를 붙인다.
 */
export function computeDeflection(
  model: TrussModel,
  memberForces: Map<number, number>,
): DeflectionResult {
  const j = model.nodes.length
  if (j === 0) {
    return { entries: [], maxMagnitude: 0, ok: false, reasonKo: '절점이 없습니다.' }
  }

  const indexes = new Map<number, number>()
  model.nodes.forEach((node, index) => indexes.set(node.id, index))
  const unknowns = j * 2

  const rows: number[][] = []
  const rhs: number[] = []
  const byId = nodeMap(model)

  for (const member of model.members) {
    const a = byId.get(member.a)
    const b = byId.get(member.b)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length < 1e-9) continue
    const nx = dx / length
    const ny = dy / length
    const material = getMaterial(member.materialId)
    const force = memberForces.get(member.id) ?? 0
    const elongation = (force * length) / (SECTION_AREA_M2 * material.E)
    const row = new Array<number>(unknowns).fill(0)
    const ia = indexes.get(member.a)
    const ib = indexes.get(member.b)
    if (ia === undefined || ib === undefined) continue
    row[ib * 2] += nx
    row[ib * 2 + 1] += ny
    row[ia * 2] -= nx
    row[ia * 2 + 1] -= ny
    rows.push(row)
    rhs.push(elongation)
  }

  for (const node of model.nodes) {
    const index = indexes.get(node.id)
    if (index === undefined) continue
    if (node.support === 'pin' || node.support === 'roller') {
      const yRow = new Array<number>(unknowns).fill(0)
      yRow[index * 2 + 1] = 1
      rows.push(yRow)
      rhs.push(0)
    }
    if (node.support === 'pin') {
      const xRow = new Array<number>(unknowns).fill(0)
      xRow[index * 2] = 1
      rows.push(xRow)
      rhs.push(0)
    }
  }

  if (rows.length !== unknowns) {
    return {
      entries: [],
      maxMagnitude: 0,
      ok: false,
      reasonKo: '변형을 계산하려면 정정·안정 구조여야 합니다.',
    }
  }

  const solved = solveLinearSystem(rows, rhs)
  if (!solved.ok || !solved.x) {
    return {
      entries: [],
      maxMagnitude: 0,
      ok: false,
      reasonKo: solved.reasonKo ?? '변형을 계산할 수 없습니다.',
    }
  }

  const entries: DeflectionEntry[] = model.nodes.map((node) => {
    const index = indexes.get(node.id) ?? 0
    const dx = Math.abs(solved.x?.[index * 2] ?? 0) < 1e-12 ? 0 : (solved.x?.[index * 2] ?? 0)
    const dy =
      Math.abs(solved.x?.[index * 2 + 1] ?? 0) < 1e-12 ? 0 : (solved.x?.[index * 2 + 1] ?? 0)
    return { nodeId: node.id, dx, dy }
  })

  const maxMagnitude = entries.reduce(
    (max, entry) => Math.max(max, Math.hypot(entry.dx, entry.dy)),
    0,
  )
  return { entries, maxMagnitude, ok: true }
}
