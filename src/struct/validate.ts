import { FORCE_TOLERANCE, MAX_HEIGHT_METERS, MAX_SPAN_METERS, MIN_NODE_DISTANCE } from './constants'
import { duplicateMemberIds, memberGeometry, nodeMap, segmentsCross } from './geometry'
import type { StructWarning, TrussModel } from './types'

export function validateModel(model: TrussModel): StructWarning[] {
  const warnings: StructWarning[] = []
  const byId = nodeMap(model)
  const nodeIds = new Set(model.nodes.map((node) => node.id))

  for (const node of model.nodes) {
    if (node.x < 0 || node.x > MAX_SPAN_METERS || node.y < 0 || node.y > MAX_HEIGHT_METERS) {
      warnings.push({
        code: 'out-of-bounds',
        severity: 'warning',
        messageKo: '격자 범위를 벗어난 절점이 있습니다.',
        nodeIds: [node.id],
      })
    }
  }

  for (const member of model.members) {
    if (!nodeIds.has(member.a) || !nodeIds.has(member.b)) {
      warnings.push({
        code: 'unknown-node',
        severity: 'error',
        messageKo: '존재하지 않는 절점을 참조하는 부재가 있습니다.',
        memberIds: [member.id],
      })
      continue
    }
    if (member.a === member.b) {
      warnings.push({
        code: 'self-member',
        severity: 'error',
        messageKo: '같은 절점을 두 번 연결한 부재가 있습니다.',
        memberIds: [member.id],
      })
      continue
    }
    const geometry = memberGeometry(member, byId)
    if (!geometry || geometry.length < MIN_NODE_DISTANCE) {
      warnings.push({
        code: 'zero-length',
        severity: 'error',
        messageKo: '길이가 0에 가까운 부재가 있습니다.',
        memberIds: [member.id],
      })
    }
  }

  const duplicates = duplicateMemberIds(model)
  if (duplicates.length > 0) {
    warnings.push({
      code: 'duplicate-member',
      severity: 'error',
      messageKo: '같은 두 절점을 잇는 부재가 중복되어 있습니다.',
      memberIds: duplicates,
    })
  }

  const attached = new Set<number>()
  for (const member of model.members) {
    attached.add(member.a)
    attached.add(member.b)
  }
  const isolatedIds = model.nodes.filter((node) => !attached.has(node.id)).map((node) => node.id)
  if (isolatedIds.length > 0 && model.nodes.length > 1) {
    warnings.push({
      code: 'isolated-node',
      severity: 'warning',
      messageKo: '어떤 부재와도 연결되지 않은 절점이 있습니다.',
      nodeIds: isolatedIds,
    })
  }

  for (const load of model.loads) {
    if (!nodeIds.has(load.nodeId)) {
      warnings.push({
        code: 'unknown-load-node',
        severity: 'error',
        messageKo: '존재하지 않는 절점에 하중이 걸려 있습니다.',
        nodeIds: [load.nodeId],
      })
    } else if (!attached.has(load.nodeId) && model.members.length > 0) {
      warnings.push({
        code: 'load-without-member',
        severity: 'warning',
        messageKo: '하중이 걸린 절점이 어떤 부재와도 연결되어 있지 않습니다.',
        nodeIds: [load.nodeId],
      })
    }
  }

  if (model.loads.length === 0) {
    warnings.push({
      code: 'no-load',
      severity: 'info',
      messageKo: '아직 하중이 없습니다. 하중 도구로 절점을 클릭해 하중을 걸어 보세요.',
    })
  }

  const noSupport = model.nodes.every((node) => node.support === 'free')
  if (model.nodes.length > 0 && noSupport) {
    warnings.push({
      code: 'no-support',
      severity: 'warning',
      messageKo: '지지대가 없습니다. 핀 또는 롤러를 절점에 놓으세요.',
    })
  }

  const geometries = model.members.map((member) => memberGeometry(member, byId)).filter(Boolean)
  const crossingMembers: number[] = []
  for (let i = 0; i < geometries.length; i += 1) {
    for (let k = i + 1; k < geometries.length; k += 1) {
      const a = geometries[i]
      const b = geometries[k]
      if (!a || !b) continue
      const memberA = model.members.find((member) => member.id === a.memberId)
      const memberB = model.members.find((member) => member.id === b.memberId)
      if (!memberA || !memberB) continue
      const shared =
        memberA.a === memberB.a ||
        memberA.a === memberB.b ||
        memberA.b === memberB.a ||
        memberA.b === memberB.b
      if (shared) continue
      if (segmentsCross(a.ax, a.ay, a.bx, a.by, b.ax, b.ay, b.bx, b.by)) {
        crossingMembers.push(memberA.id, memberB.id)
      }
    }
  }
  if (crossingMembers.length > 0) {
    warnings.push({
      code: 'crossing-members',
      severity: 'warning',
      messageKo: '교차하지만 공유 절점이 없는 부재가 있습니다. 교차점에 절점을 추가하세요.',
      memberIds: [...new Set(crossingMembers)],
    })
  }

  const loadedNodes = new Set(
    model.loads
      .filter((load) => Math.hypot(load.fx, load.fy) > FORCE_TOLERANCE)
      .map((load) => load.nodeId),
  )
  if (model.loads.length > 0 && loadedNodes.size === 0) {
    warnings.push({
      code: 'zero-loads',
      severity: 'info',
      messageKo: '모든 하중이 0입니다. 하중 크기를 입력하세요.',
    })
  }

  return warnings
}

export function hasBlockingError(warnings: StructWarning[]): boolean {
  return warnings.some((warning) => warning.severity === 'error')
}

export function warningsForNode(warnings: StructWarning[], nodeId: number): StructWarning[] {
  return warnings.filter((warning) => warning.nodeIds?.includes(nodeId))
}

export function warningsForMember(warnings: StructWarning[], memberId: number): StructWarning[] {
  return warnings.filter((warning) => warning.memberIds?.includes(memberId))
}
