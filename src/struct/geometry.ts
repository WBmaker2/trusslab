import type { TrussMember, TrussModel, TrussNode } from './types'

export interface MemberGeometry {
  memberId: number
  ax: number
  ay: number
  bx: number
  by: number
  dx: number
  dy: number
  length: number
  cos: number
  sin: number
  midX: number
  midY: number
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

export function nodeMap(model: TrussModel): Map<number, TrussNode> {
  return new Map(model.nodes.map((node) => [node.id, node]))
}

export function memberGeometry(
  member: TrussMember,
  nodes: Map<number, TrussNode>,
): MemberGeometry | null {
  const a = nodes.get(member.a)
  const b = nodes.get(member.b)
  if (!a || !b) return null
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-9) return null
  return {
    memberId: member.id,
    ax: a.x,
    ay: a.y,
    bx: b.x,
    by: b.y,
    dx,
    dy,
    length,
    cos: dx / length,
    sin: dy / length,
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
  }
}

export function allMemberGeometry(model: TrussModel): MemberGeometry[] {
  const nodes = nodeMap(model)
  const list: MemberGeometry[] = []
  for (const member of model.members) {
    const geometry = memberGeometry(member, nodes)
    if (geometry) list.push(geometry)
  }
  return list
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function segmentsCross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const cross = (ox: number, oy: number, px: number, py: number, qx: number, qy: number) =>
    (px - ox) * (qy - oy) - (py - oy) * (qx - ox)
  const d1 = cross(cx, cy, dx, dy, ax, ay)
  const d2 = cross(cx, cy, dx, dy, bx, by)
  const d3 = cross(ax, ay, bx, by, cx, cy)
  const d4 = cross(ax, ay, bx, by, dx, dy)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

export function crossValue(a: MemberGeometry, b: MemberGeometry): number {
  return Math.abs(a.cos * b.sin - a.sin * b.cos)
}

export function countReactionComponents(model: TrussModel): number {
  let count = 0
  for (const node of model.nodes) {
    if (node.support === 'pin') count += 2
    if (node.support === 'roller') count += 1
  }
  return count
}

export function hasDuplicateMember(model: TrussModel): boolean {
  const seen = new Set<string>()
  for (const member of model.members) {
    const key = member.a < member.b ? `${member.a}:${member.b}` : `${member.b}:${member.a}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

export function duplicateMemberIds(model: TrussModel): number[] {
  const seen = new Map<string, number>()
  const duplicates: number[] = []
  for (const member of model.members) {
    const key = member.a < member.b ? `${member.a}:${member.b}` : `${member.b}:${member.a}`
    if (seen.has(key)) duplicates.push(member.id)
    else seen.set(key, member.id)
  }
  return duplicates
}
