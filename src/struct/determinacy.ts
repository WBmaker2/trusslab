import { buildEquilibriumSystem, solveTruss } from './methodOfJoints'
import { countReactionComponents } from './geometry'
import { matrixRank } from './linalg'
import type { Determinacy, TrussModel } from './types'

/**
 * m + r 와 2j 를 비교하고, 같은 경우에는 평형 행렬의 계수까지 확인한다.
 * m + r < 2j  → 불안정(기구)
 * m + r = 2j  → 계수가 가득 차면 정정·안정
 * m + r > 2j  → 부정정 (MVP에서는 해석하지 않음)
 */
export function analyzeDeterminacy(model: TrussModel): Determinacy {
  const j = model.nodes.length
  const m = model.members.length
  const r = countReactionComponents(model)
  const equations = j * 2
  const unknowns = m + r

  const base = { m, j, r, unknowns, equations, rank: 0 }

  if (j === 0) {
    return {
      ...base,
      status: 'empty',
      labelKo: '비어 있음',
      stable: false,
      determinate: false,
      reasonKo: '절점이 없습니다. 격자를 클릭해 절점을 놓으세요.',
    }
  }

  if (m === 0) {
    return {
      ...base,
      status: 'unstable',
      labelKo: '불안정',
      stable: false,
      determinate: false,
      reasonKo: '부재가 없습니다. 절점 사이를 부재로 연결하세요.',
    }
  }

  if (r === 0) {
    return {
      ...base,
      status: 'unstable',
      labelKo: '불안정',
      stable: false,
      determinate: false,
      reasonKo: '지지대가 없습니다. 절점에 핀 또는 롤러 지지대를 놓으세요.',
    }
  }

  const system = buildEquilibriumSystem(model)
  const rank = matrixRank(system.matrix)

  if (unknowns < equations) {
    return {
      ...base,
      rank,
      status: 'unstable',
      labelKo: '불안정',
      stable: false,
      determinate: false,
      reasonKo: `m + r = ${unknowns}, 2j = ${equations}로 미지수가 부족합니다. 부재나 지지대를 더하세요.`,
    }
  }

  if (rank < equations) {
    return {
      ...base,
      rank,
      status: 'unstable',
      labelKo: '불안정',
      stable: false,
      determinate: false,
      reasonKo: '평형 행렬의 계수가 부족합니다. 구조가 기구(메커니즘)처럼 움직입니다.',
    }
  }

  if (unknowns === equations) {
    const solved = solveTruss(model)
    if (!solved.ok) {
      return {
        ...base,
        rank,
        status: 'unstable',
        labelKo: '불안정',
        stable: false,
        determinate: false,
        reasonKo: solved.reasonKo ?? '평형 방정식을 풀 수 없습니다.',
      }
    }
    return {
      ...base,
      rank,
      status: 'determinate',
      labelKo: '정정·안정',
      stable: true,
      determinate: true,
      reasonKo: `m + r = 2j = ${equations}, 평형 행렬이 가득 찼습니다.`,
    }
  }

  return {
    ...base,
    rank,
    status: 'indeterminate',
    labelKo: '부정정',
    stable: true,
    determinate: false,
    reasonKo: `m + r = ${unknowns} > 2j = ${equations}입니다. 여분 부재가 있어 정정 구조가 아닙니다.`,
  }
}
