import { DEFAULT_LOAD_N, MAX_MEMBERS, MAX_NODES, MIN_NODE_DISTANCE } from '../struct/constants'
import type { MaterialId, SupportType, TrussModel } from '../struct/types'

export interface PlacementResult {
  ok: boolean
  model: TrussModel
  nodeId?: number
  memberId?: number
  reasonKo?: string
}

function copyModel(model: TrussModel): TrussModel {
  return {
    nodes: model.nodes.map((node) => ({ ...node })),
    members: model.members.map((member) => ({ ...member })),
    loads: model.loads.map((load) => ({ ...load })),
    nextNodeId: model.nextNodeId,
    nextMemberId: model.nextMemberId,
    nextLoadId: model.nextLoadId,
  }
}

export function findNodeNear(
  model: TrussModel,
  x: number,
  y: number,
  distance = MIN_NODE_DISTANCE,
): number | null {
  let closest: { id: number; distance: number } | null = null
  for (const node of model.nodes) {
    const d = Math.hypot(node.x - x, node.y - y)
    if (d < distance && (!closest || d < closest.distance)) {
      closest = { id: node.id, distance: d }
    }
  }
  return closest?.id ?? null
}

export function addNode(model: TrussModel, x: number, y: number): PlacementResult {
  const existing = findNodeNear(model, x, y)
  if (existing !== null) {
    return {
      ok: false,
      model,
      nodeId: existing,
      reasonKo: '이미 가까운 곳에 절점이 있습니다. 기존 절점을 사용합니다.',
    }
  }
  if (model.nodes.length >= MAX_NODES) {
    return { ok: false, model, reasonKo: `절점은 최대 ${MAX_NODES}개까지 놓을 수 있습니다.` }
  }
  const node = {
    id: model.nextNodeId,
    x,
    y,
    support: 'free' as SupportType,
  }
  const next = copyModel(model)
  next.nodes.push(node)
  next.nextNodeId += 1
  return { ok: true, model: next, nodeId: node.id }
}

export function moveNode(model: TrussModel, nodeId: number, x: number, y: number): PlacementResult {
  const target = model.nodes.find((node) => node.id === nodeId)
  if (!target) return { ok: false, model, reasonKo: '절점을 찾을 수 없습니다.' }
  const collision = model.nodes.find(
    (node) => node.id !== nodeId && Math.hypot(node.x - x, node.y - y) < MIN_NODE_DISTANCE,
  )
  if (collision) {
    return { ok: false, model, reasonKo: '다른 절점과 너무 가깝습니다.' }
  }
  const next = copyModel(model)
  const node = next.nodes.find((item) => item.id === nodeId)
  if (!node) return { ok: false, model }
  node.x = x
  node.y = y
  return { ok: true, model: next, nodeId }
}

export function removeNode(model: TrussModel, nodeId: number): PlacementResult {
  if (!model.nodes.some((node) => node.id === nodeId)) {
    return { ok: false, model, reasonKo: '절점을 찾을 수 없습니다.' }
  }
  const next = copyModel(model)
  next.nodes = next.nodes.filter((node) => node.id !== nodeId)
  next.members = next.members.filter((member) => member.a !== nodeId && member.b !== nodeId)
  next.loads = next.loads.filter((load) => load.nodeId !== nodeId)
  return { ok: true, model: next }
}

export function hasMember(model: TrussModel, a: number, b: number): boolean {
  return model.members.some(
    (member) => (member.a === a && member.b === b) || (member.a === b && member.b === a),
  )
}

export function addMember(
  model: TrussModel,
  a: number,
  b: number,
  materialId: MaterialId,
): PlacementResult {
  if (a === b) return { ok: false, model, reasonKo: '같은 절점끼리는 연결할 수 없습니다.' }
  const nodeA = model.nodes.find((node) => node.id === a)
  const nodeB = model.nodes.find((node) => node.id === b)
  if (!nodeA || !nodeB) return { ok: false, model, reasonKo: '절점을 찾을 수 없습니다.' }
  if (Math.hypot(nodeB.x - nodeA.x, nodeB.y - nodeA.y) < MIN_NODE_DISTANCE) {
    return { ok: false, model, reasonKo: '두 절점이 너무 가깝습니다.' }
  }
  if (hasMember(model, a, b)) {
    return { ok: false, model, reasonKo: '이미 같은 두 절점을 잇는 부재가 있습니다.' }
  }
  if (model.members.length >= MAX_MEMBERS) {
    return {
      ok: false,
      model,
      reasonKo: `부재는 최대 ${MAX_MEMBERS}개까지 만들 수 있습니다.`,
    }
  }
  const member = { id: model.nextMemberId, a, b, materialId }
  const next = copyModel(model)
  next.members.push(member)
  next.nextMemberId += 1
  return { ok: true, model: next, memberId: member.id }
}

export function removeMember(model: TrussModel, memberId: number): PlacementResult {
  if (!model.members.some((member) => member.id === memberId)) {
    return { ok: false, model, reasonKo: '부재를 찾을 수 없습니다.' }
  }
  const next = copyModel(model)
  next.members = next.members.filter((member) => member.id !== memberId)
  return { ok: true, model: next }
}

export function setMemberMaterial(
  model: TrussModel,
  memberId: number,
  materialId: MaterialId,
): PlacementResult {
  if (!model.members.some((member) => member.id === memberId)) {
    return { ok: false, model, reasonKo: '부재를 찾을 수 없습니다.' }
  }
  const next = copyModel(model)
  const member = next.members.find((item) => item.id === memberId)
  if (!member) return { ok: false, model }
  member.materialId = materialId
  return { ok: true, model: next, memberId }
}

export function setSupport(
  model: TrussModel,
  nodeId: number,
  support: SupportType,
): PlacementResult {
  if (!model.nodes.some((node) => node.id === nodeId)) {
    return { ok: false, model, reasonKo: '절점을 찾을 수 없습니다.' }
  }
  const next = copyModel(model)
  const node = next.nodes.find((item) => item.id === nodeId)
  if (!node) return { ok: false, model }
  node.support = support
  return { ok: true, model: next, nodeId }
}

export function loadForNode(model: TrussModel, nodeId: number) {
  return model.loads.find((load) => load.nodeId === nodeId) ?? null
}

export function addLoad(model: TrussModel, nodeId: number, fy = -DEFAULT_LOAD_N): PlacementResult {
  if (!model.nodes.some((node) => node.id === nodeId)) {
    return { ok: false, model, reasonKo: '절점을 찾을 수 없습니다.' }
  }
  if (loadForNode(model, nodeId)) {
    return { ok: false, model, nodeId, reasonKo: '이미 이 절점에 하중이 있습니다.' }
  }
  const next = copyModel(model)
  next.loads.push({ id: next.nextLoadId, nodeId, fx: 0, fy })
  next.nextLoadId += 1
  return { ok: true, model: next, nodeId }
}

export function updateLoad(
  model: TrussModel,
  loadId: number,
  fx: number,
  fy: number,
): PlacementResult {
  if (!model.loads.some((load) => load.id === loadId)) {
    return { ok: false, model, reasonKo: '하중을 찾을 수 없습니다.' }
  }
  const next = copyModel(model)
  const load = next.loads.find((item) => item.id === loadId)
  if (!load) return { ok: false, model }
  load.fx = fx
  load.fy = fy
  return { ok: true, model }
}

export function removeLoad(model: TrussModel, loadId: number): PlacementResult {
  if (!model.loads.some((load) => load.id === loadId)) {
    return { ok: false, model, reasonKo: '하중을 찾을 수 없습니다.' }
  }
  const next = copyModel(model)
  next.loads = next.loads.filter((load) => load.id !== loadId)
  return { ok: true, model: next }
}

export function attachedMembers(model: TrussModel, nodeId: number) {
  return model.members.filter((member) => member.a === nodeId || member.b === nodeId)
}

export function nodeDegree(model: TrussModel, nodeId: number): number {
  return attachedMembers(model, nodeId).length
}
