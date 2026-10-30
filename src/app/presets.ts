import { GRID_METERS, MAX_HEIGHT_METERS, MAX_SPAN_METERS } from '../struct/constants'
import type { MaterialId, SupportType, TrussModel } from '../struct/types'

export interface PresetDefinition {
  id: string
  nameKo: string
  descriptionKo: string
  model: TrussModel
  badgeKo?: string
}

interface NodeSpec {
  x: number
  y: number
  support?: SupportType
}

interface MemberSpec {
  a: number
  b: number
  materialId?: MaterialId
}

interface LoadSpec {
  node: number
  fx?: number
  fy?: number
}

function buildModel(
  nodeSpecs: NodeSpec[],
  memberSpecs: MemberSpec[],
  loadSpecs: LoadSpec[],
  materialId: MaterialId = 'wood',
): TrussModel {
  const nodes = nodeSpecs.map((spec, index) => ({
    id: index + 1,
    x: spec.x,
    y: spec.y,
    support: spec.support ?? 'free',
  }))
  const members = memberSpecs.map((spec, index) => ({
    id: index + 1,
    a: spec.a,
    b: spec.b,
    materialId: spec.materialId ?? materialId,
  }))
  const loads = loadSpecs.map((spec, index) => ({
    id: index + 1,
    nodeId: spec.node,
    fx: spec.fx ?? 0,
    fy: spec.fy ?? 0,
  }))
  return {
    nodes,
    members,
    loads,
    nextNodeId: nodes.length + 1,
    nextMemberId: members.length + 1,
    nextLoadId: loads.length + 1,
  }
}

export function cloneModel(model: TrussModel): TrussModel {
  return {
    nodes: model.nodes.map((node) => ({ ...node })),
    members: model.members.map((member) => ({ ...member })),
    loads: model.loads.map((load) => ({ ...load })),
    nextNodeId: model.nextNodeId,
    nextMemberId: model.nextMemberId,
    nextLoadId: model.nextLoadId,
  }
}

export function blankModel(): TrussModel {
  return { nodes: [], members: [], loads: [], nextNodeId: 1, nextMemberId: 1, nextLoadId: 1 }
}

function demoModel(): TrussModel {
  return buildModel(
    [
      { x: 0, y: 0, support: 'pin' },
      { x: 3, y: 0 },
      { x: 6, y: 0, support: 'roller' },
      { x: 1.5, y: 2 },
      { x: 4.5, y: 2 },
    ],
    [
      { a: 1, b: 4 },
      { a: 2, b: 4 },
      { a: 2, b: 5 },
      { a: 3, b: 5 },
      { a: 4, b: 5 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ],
    [{ node: 2, fy: -500 }],
    'steel',
  )
}

function triangleModel(load = -500, material: MaterialId = 'steel'): TrussModel {
  return buildModel(
    [
      { x: 0, y: 0, support: 'pin' },
      { x: 4, y: 0, support: 'roller' },
      { x: 2, y: 3 },
    ],
    [
      { a: 1, b: 3 },
      { a: 2, b: 3 },
      { a: 1, b: 2 },
    ],
    [{ node: 3, fy: load }],
    material,
  )
}

function rectangleModel(): TrussModel {
  return buildModel(
    [
      { x: 0, y: 0, support: 'pin' },
      { x: 4, y: 0, support: 'roller' },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ],
    [
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
      { a: 4, b: 1 },
    ],
    [{ node: 3, fy: -150 }],
    'wood',
  )
}

function warrenModel(load = -400, material: MaterialId = 'steel'): TrussModel {
  return buildModel(
    [
      { x: 0, y: 0, support: 'pin' },
      { x: 3, y: 0 },
      { x: 6, y: 0, support: 'roller' },
      { x: 1.5, y: 2 },
      { x: 4.5, y: 2 },
    ],
    [
      { a: 1, b: 4 },
      { a: 2, b: 4 },
      { a: 2, b: 5 },
      { a: 3, b: 5 },
      { a: 4, b: 5 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ],
    [{ node: 2, fy: load }],
    material,
  )
}

function repairMissingModel(): TrussModel {
  return buildModel(
    [
      { x: 0, y: 0, support: 'pin' },
      { x: 3, y: 0 },
      { x: 6, y: 0, support: 'roller' },
      { x: 1.5, y: 2 },
      { x: 4.5, y: 2 },
    ],
    [
      { a: 1, b: 4 },
      { a: 2, b: 4 },
      { a: 2, b: 5 },
      { a: 3, b: 5 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ],
    [{ node: 2, fy: -200 }],
    'wood',
  )
}

function zeroForceModel(): TrussModel {
  return buildModel(
    [
      { x: 0, y: 0, support: 'pin' },
      { x: 4, y: 0, support: 'roller' },
      { x: 2, y: 3 },
      { x: 2, y: 0 },
    ],
    [
      { a: 1, b: 3 },
      { a: 2, b: 3 },
      { a: 1, b: 4 },
      { a: 2, b: 4 },
      { a: 4, b: 3 },
    ],
    [{ node: 3, fy: -200 }],
    'wood',
  )
}

function sixMemberBase(): TrussModel {
  return buildModel(
    [
      { x: 0, y: 0, support: 'pin' },
      { x: 6, y: 0, support: 'roller' },
      { x: 3, y: 3 },
    ],
    [],
    [{ node: 3, fy: -500 }],
  )
}

function budgetBase(): TrussModel {
  return buildModel(
    [
      { x: 0, y: 0, support: 'pin' },
      { x: 8, y: 0, support: 'roller' },
      { x: 4, y: 4 },
    ],
    [],
    [{ node: 3, fy: -800 }],
  )
}

export const PRESETS: Record<string, PresetDefinition> = {
  demo: {
    id: 'demo',
    nameKo: '워런 트러스 예시',
    descriptionKo: '강재 7부재, 6 m 스팬, 가운데 500 N 하중. 앱을 열면 보이는 예시 구조입니다.',
    model: demoModel(),
    badgeKo: '예시',
  },
  triangle: {
    id: 'triangle',
    nameKo: '삼각형 (강재)',
    descriptionKo: '4 m 스팬의 가장 단순한 정정 삼각형. A는 핀, B는 롤러 지지대입니다.',
    model: triangleModel(-500, 'steel'),
  },
  'triangle-200': {
    id: 'triangle-200',
    nameKo: '삼각형 (목재 200 N)',
    descriptionKo: '인장·압축 미션용 삼각형. 아래쪽 수평재 AB에 인장이 걸립니다.',
    model: triangleModel(-200, 'wood'),
  },
  rectangle: {
    id: 'rectangle',
    nameKo: '네모 (불안정)',
    descriptionKo: '대각선이 없는 4 m × 3 m 사각형. 하중을 받으면 기구처럼 움직입니다.',
    model: rectangleModel(),
  },
  warren: {
    id: 'warren',
    nameKo: '워런 트러스',
    descriptionKo: '6 m 스팬의 강재 워런 트러스. 위아래가 번갈아 삼각형을 만듭니다.',
    model: warrenModel(-400, 'steel'),
  },
  failed: {
    id: 'failed',
    nameKo: '좌굴 실패 예시',
    descriptionKo: '같은 워런 트러스를 목재로 지은 경우. 긴 위쪽 압축재가 좌굴로 먼저 파괴됩니다.',
    model: warrenModel(-400, 'wood'),
    badgeKo: '실패',
  },
  'zero-force': {
    id: 'zero-force',
    nameKo: '힘이 0인 부재',
    descriptionKo: '가운데 수직재 CD에 힘이 걸리지 않는 대칭 트러스. CD를 빼면 D점이 움직입니다.',
    model: zeroForceModel(),
  },
  'repair-missing': {
    id: 'repair-missing',
    nameKo: '빠진 부재 찾기',
    descriptionKo: '워런 트러스에서 위쪽 수평재 DE가 빠진 기구. 부재 하나를 더하면 안정해집니다.',
    model: repairMissingModel(),
  },
  'six-members': {
    id: 'six-members',
    nameKo: '6부재 설계 스타터',
    descriptionKo: '6 m 스팬의 지지 절점 두 개와 3 m 높이의 하중 절점. 부재를 직접 추가하세요.',
    model: sixMemberBase(),
  },
  budget: {
    id: 'budget',
    nameKo: '예산 설계 스타터',
    descriptionKo: '8 m 스팬, 800 N 하중, 1,500 cr 예산. 재료와 부재 수를 함께 고려하세요.',
    model: budgetBase(),
  },
  blank: {
    id: 'blank',
    nameKo: '빈 캔버스',
    descriptionKo: '아무것도 없는 12 m × 8 m 격자에서 처음부터 설계합니다.',
    model: blankModel(),
  },
}

export const TEACHER_PRESETS = [
  'triangle',
  'rectangle',
  'warren',
  'failed',
  'zero-force',
  'repair-missing',
] as const

export function getPreset(id: string): PresetDefinition {
  return PRESETS[id] ?? PRESETS.demo
}

export function loadPresetModel(id: string): TrussModel {
  return cloneModel(getPreset(id).model)
}

/** 노드 좌표를 1 m 격자에 맞추고 범위를 강제한다. */
export function snapToGrid(value: number): number {
  return Math.round(value / GRID_METERS) * GRID_METERS
}

export function clampNodeX(x: number): number {
  return Math.min(MAX_SPAN_METERS, Math.max(0, snapToGrid(x)))
}

export function clampNodeY(y: number): number {
  return Math.min(MAX_HEIGHT_METERS, Math.max(0, snapToGrid(y)))
}
