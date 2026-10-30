import { computeDeflection } from './deflection'
import { analyzeDeterminacy } from './determinacy'
import { computeCost } from './cost'
import { computeMemberResults, factorOfSafety, maxUtilization } from './forces'
import { solveTruss } from './methodOfJoints'
import { validateModel, hasBlockingError } from './validate'
import { zeroForceResultIds } from './zeroForce'
import type { Determinacy, StructWarning, TrussModel, TrussResult } from './types'

export interface Analysis {
  determinacy: Determinacy
  result: TrussResult | null
  warnings: StructWarning[]
  cost: number
  zeroForceMemberIds: number[]
  blockingError: boolean
}

export function analyzeModel(model: TrussModel): Analysis {
  const validation = validateModel(model)
  const determinacy = analyzeDeterminacy(model)
  const cost = computeCost(model).total
  const warnings = [...validation]

  if (determinacy.status === 'unstable') {
    warnings.push({
      code: 'unstable',
      severity: 'warning',
      messageKo: determinacy.reasonKo,
    })
  } else if (determinacy.status === 'indeterminate') {
    warnings.push({
      code: 'indeterminate',
      severity: 'warning',
      messageKo: determinacy.reasonKo,
    })
  }

  if (hasBlockingError(validation)) {
    return {
      determinacy,
      result: null,
      warnings,
      cost,
      zeroForceMemberIds: [],
      blockingError: true,
    }
  }

  if (determinacy.status !== 'determinate') {
    return {
      determinacy,
      result: null,
      warnings,
      cost,
      zeroForceMemberIds: [],
      blockingError: false,
    }
  }

  const solved = solveTruss(model)
  if (!solved.ok) {
    warnings.push({
      code: 'solve-failed',
      severity: 'error',
      messageKo: solved.reasonKo ?? '구조 해석에 실패했습니다.',
    })
    return {
      determinacy,
      result: null,
      warnings,
      cost,
      zeroForceMemberIds: [],
      blockingError: true,
    }
  }

  const members = computeMemberResults(model, solved.memberForces)
  const maxUtil = maxUtilization(members)
  const safety = factorOfSafety(members)
  const deflection = computeDeflection(model, solved.memberForces)
  const zeroForceMemberIds = zeroForceResultIds(members)
  const memberWarnings = [...warnings]

  const failed = members.filter((member) => member.state === 'failed')
  if (failed.length > 0) {
    memberWarnings.push({
      code: 'over-utilized',
      severity: 'warning',
      messageKo: `설계 하중에서 ${failed.length}개 부재가 한계를 넘습니다.`,
      memberIds: failed.map((member) => member.memberId),
    })
  }

  if (zeroForceMemberIds.length > 0) {
    memberWarnings.push({
      code: 'zero-force',
      severity: 'info',
      messageKo: `힘이 0인 부재가 ${zeroForceMemberIds.length}개 있습니다. 구조 안정성에 필요할 수 있으니 쉽게 빼지 마세요.`,
      memberIds: zeroForceMemberIds,
    })
  }

  if (!deflection.ok) {
    memberWarnings.push({
      code: 'deflection-unavailable',
      severity: 'info',
      messageKo: '변형 표시를 계산하지 못했습니다. 힘 결과는 정상입니다.',
    })
  }

  const result: TrussResult = {
    reactions: solved.reactions,
    members,
    maxUtilization: maxUtil,
    factorOfSafety: safety,
    cost,
    stable: determinacy.stable,
    determinate: determinacy.determinate,
    deflection: deflection.entries,
    warnings: memberWarnings,
  }

  return {
    determinacy,
    result,
    warnings: memberWarnings,
    cost,
    zeroForceMemberIds,
    blockingError: false,
  }
}
