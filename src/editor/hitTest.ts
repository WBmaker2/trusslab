import { memberGeometry, nodeMap, pointToSegmentDistance } from '../struct/geometry'
import type { TrussModel } from '../struct/types'

export interface CanvasTransform {
  scale: number
  originX: number
  originY: number
  zoom: number
  panX: number
  panY: number
}

export interface Hit {
  kind: 'node' | 'member'
  id: number
}

export const NODE_HIT_RADIUS_PX = 14
export const MEMBER_HIT_RADIUS_PX = 9

export function worldToScreen(
  x: number,
  y: number,
  transform: CanvasTransform,
): { x: number; y: number } {
  const scale = transform.scale * transform.zoom
  return {
    x: transform.originX + transform.panX + x * scale,
    y: transform.originY + transform.panY - y * scale,
  }
}

export function screenToWorld(
  px: number,
  py: number,
  transform: CanvasTransform,
): { x: number; y: number } {
  const scale = transform.scale * transform.zoom
  return {
    x: (px - transform.originX - transform.panX) / scale,
    y: (transform.originY + transform.panY - py) / scale,
  }
}

export function hitTest(
  model: TrussModel,
  px: number,
  py: number,
  transform: CanvasTransform,
): Hit | null {
  let closestNode: { id: number; distance: number } | null = null
  for (const node of model.nodes) {
    const screen = worldToScreen(node.x, node.y, transform)
    const distance = Math.hypot(screen.x - px, screen.y - py)
    if (distance <= NODE_HIT_RADIUS_PX && (!closestNode || distance < closestNode.distance)) {
      closestNode = { id: node.id, distance }
    }
  }
  if (closestNode) return { kind: 'node', id: closestNode.id }

  const nodes = nodeMap(model)
  let closestMember: { id: number; distance: number } | null = null
  for (const member of model.members) {
    const geometry = memberGeometry(member, nodes)
    if (!geometry) continue
    const a = worldToScreen(geometry.ax, geometry.ay, transform)
    const b = worldToScreen(geometry.bx, geometry.by, transform)
    const distance = pointToSegmentDistance(px, py, a.x, a.y, b.x, b.y)
    if (distance <= MEMBER_HIT_RADIUS_PX && (!closestMember || distance < closestMember.distance)) {
      closestMember = { id: member.id, distance }
    }
  }
  if (closestMember) return { kind: 'member', id: closestMember.id }
  return null
}

export function nodeAt(
  model: TrussModel,
  px: number,
  py: number,
  transform: CanvasTransform,
): number | null {
  for (const node of [...model.nodes].reverse()) {
    const screen = worldToScreen(node.x, node.y, transform)
    if (Math.hypot(screen.x - px, screen.y - py) <= 16) return node.id
  }
  return null
}
