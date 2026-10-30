export type SupportType = 'free' | 'pin' | 'roller'
export type MaterialId = 'wood' | 'steel'

export interface TrussNode {
  id: number
  x: number
  y: number
  support: SupportType
}

export interface TrussMember {
  id: number
  a: number
  b: number
  materialId: MaterialId
}

export interface PointLoad {
  id: number
  nodeId: number
  fx: number
  fy: number
}

export interface TrussModel {
  nodes: TrussNode[]
  members: TrussMember[]
  loads: PointLoad[]
  nextNodeId: number
  nextMemberId: number
  nextLoadId: number
}

export interface Material {
  id: MaterialId
  nameKo: string
  E: number
  allowableTension: number
  allowableCompression: number
  costPerMeter: number
  color: string
  density: number
  noteKo: string
}

export interface MemberResult {
  memberId: number
  force: number
  stress: number
  stressUtilization: number
  bucklingLoad: number | null
  bucklingUtilization: number
  utilization: number
  state: 'ok' | 'warning' | 'failed'
  zeroForce: boolean
  length: number
  materialId: MaterialId
}

export interface Reaction {
  nodeId: number
  fx: number
  fy: number
}

export interface DeflectionEntry {
  nodeId: number
  dx: number
  dy: number
}

export interface TrussResult {
  reactions: Reaction[]
  members: MemberResult[]
  maxUtilization: number
  factorOfSafety: number
  cost: number
  stable: boolean
  determinate: boolean
  deflection: DeflectionEntry[]
  warnings: StructWarning[]
}

export type WarningSeverity = 'info' | 'warning' | 'error'

export interface StructWarning {
  code: string
  severity: WarningSeverity
  messageKo: string
  nodeIds?: number[]
  memberIds?: number[]
}

export type DeterminacyStatus = 'determinate' | 'indeterminate' | 'unstable' | 'empty'

export interface Determinacy {
  status: DeterminacyStatus
  labelKo: string
  m: number
  j: number
  r: number
  unknowns: number
  equations: number
  rank: number
  stable: boolean
  determinate: boolean
  reasonKo: string
}

export interface SolveSystemResult {
  ok: boolean
  x: number[] | null
  rank: number
  reasonKo?: string
}

export interface MemberForceSet {
  ok: boolean
  memberForces: Map<number, number>
  reactions: Reaction[]
  reasonKo?: string
}

export interface LoadTestStep {
  step: number
  scale: number
  loadN: number
  maxUtilization: number
  failedMemberId: number | null
}

export interface LoadTestFailure {
  memberId: number
  reason: 'stress' | 'buckling'
  scale: number
  loadN: number
  utilization: number
  stressUtilization: number
  bucklingUtilization: number
}

export interface LoadTestResult {
  steps: LoadTestStep[]
  passed: boolean
  failure: LoadTestFailure | null
  unstable: boolean
  targetLoadN: number
  maxUtilizationAtTarget: number
}
