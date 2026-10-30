import { LOAD_TEST_STEPS } from './constants'
import type {
  LoadTestFailure,
  LoadTestResult,
  LoadTestStep,
  TrussModel,
  TrussResult,
} from './types'

export function totalLoadMagnitude(model: TrussModel): number {
  return model.loads.reduce((sum, load) => sum + Math.hypot(load.fx, load.fy), 0)
}

/**
 * 하중을 10단계로 올리며 각 단계의 최대 활용률을 계산한다.
 * 힘은 선형이므로 각 부재의 활용률도 하중 배율에 비례한다.
 * 목표 하중에서 1.0을 처음 넘는 부재가 첫 파괴 부재다.
 */
export function runLoadTest(model: TrussModel, result: TrussResult | null): LoadTestResult {
  const targetLoadN = totalLoadMagnitude(model)
  if (!result) {
    return {
      steps: [],
      passed: false,
      failure: null,
      unstable: true,
      targetLoadN,
      maxUtilizationAtTarget: 0,
    }
  }

  const governing = result.members.reduce<null | (typeof result.members)[number]>(
    (worst, member) => (worst === null || member.utilization > worst.utilization ? member : worst),
    null,
  )
  const baseMax = governing?.utilization ?? 0
  const steps: LoadTestStep[] = []

  for (let step = 1; step <= LOAD_TEST_STEPS; step += 1) {
    const scale = step / LOAD_TEST_STEPS
    steps.push({
      step,
      scale,
      loadN: targetLoadN * scale,
      maxUtilization: baseMax * scale,
      failedMemberId: governing && baseMax * scale > 1 ? governing.memberId : null,
    })
  }

  let failure: LoadTestFailure | null = null
  if (governing && baseMax > 1) {
    const scale = 1 / baseMax
    const reason: 'stress' | 'buckling' =
      governing.bucklingUtilization >= governing.stressUtilization ? 'buckling' : 'stress'
    failure = {
      memberId: governing.memberId,
      reason,
      scale,
      loadN: targetLoadN * scale,
      utilization: governing.utilization,
      stressUtilization: governing.stressUtilization,
      bucklingUtilization: governing.bucklingUtilization,
    }
  }

  return {
    steps,
    passed: baseMax <= 1,
    failure,
    unstable: false,
    targetLoadN,
    maxUtilizationAtTarget: baseMax,
  }
}

export function formatFailureReason(failure: LoadTestFailure): string {
  if (failure.reason === 'buckling') return '압축 좌굴'
  return '인장/압축 응력 초과'
}
