import rawMissions from '../../data/missions.json'
import { FORCE_TOLERANCE } from '../../struct/constants'
import { totalLoadMagnitude } from '../../struct/failure'
import type { Analysis } from '../../struct/analysis'
import type { LoadTestResult, TrussModel } from '../../struct/types'

export type MissionConcept = 'stability' | 'forces' | 'design' | 'budget' | 'buckling' | 'repair'

export interface MissionSetup {
  presetModel: string
  targetLoadN?: number
  maxCost?: number
  maxMembers?: number
  memberCount?: number
  requireStable?: boolean
  requireTest?: boolean
  requirePass?: boolean
  selectZeroForceMember?: boolean
}

export interface Mission {
  id: string
  titleKo: string
  concept: MissionConcept
  difficulty: 1 | 2 | 3
  promptKo: string
  options: string[]
  answer: string
  setup: MissionSetup
  explanationKo: string
  takeawayKo: string
  hintKo: string
}

export const MISSIONS: Mission[] = rawMissions as Mission[]
export const MISSION_MAP = new Map(MISSIONS.map((mission) => [mission.id, mission]))

export const CONCEPT_LABELS: Record<MissionConcept, string> = {
  stability: '안정',
  forces: '힘',
  design: '설계',
  budget: '예산',
  buckling: '좌굴',
  repair: '보수',
}

export function getMission(id: string | null): Mission | null {
  if (!id) return null
  return MISSION_MAP.get(id) ?? null
}

export function isPredictionCorrect(mission: Mission, answer: string | undefined): boolean {
  return answer === mission.answer
}

export function predictionAnswerFor(
  mission: Mission,
  answers: Record<string, string>,
): string | undefined {
  return answers[mission.id]
}

export function evaluatePrediction(
  mission: Mission,
  answer: string | undefined,
): { passed: boolean; hintKo: string } {
  if (!answer) {
    return { passed: false, hintKo: '먼저 예측 카드에서 답을 골라 보세요.' }
  }
  if (isPredictionCorrect(mission, answer)) {
    return { passed: true, hintKo: '' }
  }
  return {
    passed: false,
    hintKo:
      '예측이 아직 맞지 않습니다. 하중을 걸었을 때 각 절점에 어떤 힘이 필요한지 떠올린 뒤 다시 골라 보세요.',
  }
}

export interface MissionCheck {
  key: string
  labelKo: string
  hintKo: string
  passed: boolean
  required: boolean
}

export interface MissionEvaluation {
  passed: boolean
  checks: MissionCheck[]
  unmet: MissionCheck[]
  hintKo: string
}

export interface MissionEvaluationInput {
  model: TrussModel
  analysis: Analysis
  predictionAnswer: string | undefined
  testResult: LoadTestResult | null
  selection: { kind: 'node' | 'member' | null; id: number | null }
}

export function evaluateMission(
  mission: Mission,
  input: MissionEvaluationInput,
): MissionEvaluation {
  const { model, analysis, predictionAnswer, testResult, selection } = input
  const setup = mission.setup
  const checks: MissionCheck[] = []

  const predictionPassed = isPredictionCorrect(mission, predictionAnswer)
  checks.push({
    key: 'prediction',
    labelKo: '예측 질문에 답했습니다',
    hintKo: predictionPassed
      ? ''
      : '예측 카드에서 답을 고르세요. 맞힌 뒤에 미션을 완료할 수 있습니다.',
    passed: predictionPassed,
    required: true,
  })

  if (setup.targetLoadN !== undefined) {
    const applied = totalLoadMagnitude(model)
    const passed = applied >= setup.targetLoadN - FORCE_TOLERANCE
    checks.push({
      key: 'target-load',
      labelKo: `목표 하중 ${setup.targetLoadN} N 이상`,
      hintKo: '하중이 목표보다 작습니다. 하중 도구로 절점을 선택해 크기를 확인하세요.',
      passed,
      required: true,
    })
  }

  if (setup.requireStable) {
    const stable = analysis.determinacy.status === 'determinate'
    checks.push({
      key: 'stable',
      labelKo: '정정·안정 구조',
      hintKo:
        analysis.determinacy.status === 'indeterminate'
          ? '부정정 구조는 아직 해석하지 않습니다. 부재를 하나 줄여 정정 구조로 만드세요.'
          : '구조가 아직 불안정합니다. 부재나 지지대를 추가해 삼각형과 구속을 완성하세요.',
      passed: stable,
      required: true,
    })
  }

  if (setup.memberCount !== undefined) {
    const passed = model.members.length === setup.memberCount
    checks.push({
      key: 'member-count',
      labelKo: `부재 ${setup.memberCount}개로 완성`,
      hintKo:
        model.members.length < setup.memberCount
          ? `부재가 ${setup.memberCount}개가 되도록 하나 더 연결하세요.`
          : `부재가 너무 많습니다. ${setup.memberCount}개가 되도록 정리하세요.`,
      passed,
      required: true,
    })
  }

  if (setup.maxMembers !== undefined) {
    const passed = model.members.length <= setup.maxMembers
    checks.push({
      key: 'max-members',
      labelKo: `부재 ${setup.maxMembers}개 이하`,
      hintKo: `부재 수 제한(${setup.maxMembers}개)을 넘었습니다. 더 적은 부재로 같은 구속을 만들어 보세요.`,
      passed,
      required: true,
    })
  }

  if (setup.maxCost !== undefined) {
    const passed = analysis.cost <= setup.maxCost
    checks.push({
      key: 'max-cost',
      labelKo: `예산 ${setup.maxCost.toLocaleString('ko-KR')} cr 이내`,
      hintKo: `예산을 초과했습니다. 재료를 바꾸거나 부재 수를 줄여 비용을 낮추세요.`,
      passed,
      required: true,
    })
  }

  if (setup.requirePass) {
    const passed = testResult !== null && !testResult.unstable && testResult.passed
    checks.push({
      key: 'test-pass',
      labelKo: '하중 시험에서 견딤',
      hintKo:
        testResult === null
          ? '먼저 하중 시험을 실행하세요.'
          : testResult.unstable
            ? '구조가 불안정해 시험할 수 없습니다. 먼저 구조를 고치세요.'
            : '시험에서 부재가 먼저 파괴되었습니다. 활용률이 높은 부재를 보강하거나 재료를 바꾸세요.',
      passed,
      required: true,
    })
  } else if (setup.requireTest) {
    checks.push({
      key: 'test-run',
      labelKo: '하중 시험 실행',
      hintKo: '먼저 하중 시험을 실행하세요.',
      passed: testResult !== null,
      required: true,
    })
  }

  if (setup.selectZeroForceMember) {
    let selectedZeroForce = false
    if (selection.kind === 'member' && selection.id !== null && analysis.result) {
      const member = analysis.result.members.find((item) => item.memberId === selection.id)
      selectedZeroForce = member?.zeroForce ?? false
    }
    checks.push({
      key: 'zero-force-selected',
      labelKo: '힘이 0인 부재를 선택했습니다',
      hintKo:
        '힘 표에서 0 N에 가까운 부재를 찾아 선택하세요. 그 부재가 구조에서 어떤 역할을 하는지 생각해 보세요.',
      passed: selectedZeroForce,
      required: true,
    })
  }

  const unmet = checks.filter((check) => check.required && !check.passed)
  return {
    passed: unmet.length === 0,
    checks,
    unmet,
    hintKo: unmet[0]?.hintKo ?? mission.hintKo,
  }
}

export function nextMissionId(currentId: string | null): string | null {
  const index = MISSIONS.findIndex((mission) => mission.id === currentId)
  if (index < 0) return MISSIONS[0]?.id ?? null
  return MISSIONS[index + 1]?.id ?? null
}

export function missionProgress(completed: string[]): {
  done: number
  total: number
  ratio: number
} {
  const done = MISSIONS.filter((mission) => completed.includes(mission.id)).length
  return { done, total: MISSIONS.length, ratio: MISSIONS.length ? done / MISSIONS.length : 0 }
}
