import type { MaterialId, SupportType, TrussModel } from '../struct/types'

export const PROGRESS_KEY = 'trusslab.progress.v1'

export interface StoredOverlays {
  grid: boolean
  labels: boolean
  forces: boolean
  stress: boolean
  deflection: boolean
}

export interface StoredPreferences {
  reducedMotion: boolean
  view3d: boolean
  materialId: MaterialId
  overlays: StoredOverlays
  teacherShowAnswers: boolean
}

export interface ProgressV1 {
  version: 1
  completed: string[]
  answers: Record<string, string>
  currentMissionId: string | null
  model: TrussModel | null
  preferences: Partial<StoredPreferences>
  savedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sanitizeSupport(value: unknown): SupportType {
  if (value === 'pin' || value === 'roller') return value
  return 'free'
}

function sanitizeMaterial(value: unknown): MaterialId {
  return value === 'steel' ? 'steel' : 'wood'
}

export function sanitizeModel(value: unknown): TrussModel | null {
  if (!isRecord(value)) return null
  const rawNodes = value.nodes
  const rawMembers = value.members
  const rawLoads = value.loads
  if (!Array.isArray(rawNodes) || !Array.isArray(rawMembers) || !Array.isArray(rawLoads)) {
    return null
  }

  const nodes = rawNodes
    .filter(isRecord)
    .map((node) => ({
      id: Number(node.id),
      x: Number(node.x),
      y: Number(node.y),
      support: sanitizeSupport(node.support),
    }))
    .filter(
      (node) =>
        Number.isInteger(node.id) &&
        finiteNumber(node.x) &&
        finiteNumber(node.y) &&
        node.x >= 0 &&
        node.x <= 12 &&
        node.y >= 0 &&
        node.y <= 8,
    )

  const nodeIds = new Set(nodes.map((node) => node.id))
  const members = rawMembers
    .filter(isRecord)
    .map((member) => ({
      id: Number(member.id),
      a: Number(member.a),
      b: Number(member.b),
      materialId: sanitizeMaterial(member.materialId),
    }))
    .filter(
      (member) =>
        Number.isInteger(member.id) &&
        nodeIds.has(member.a) &&
        nodeIds.has(member.b) &&
        member.a !== member.b,
    )

  const loads = rawLoads
    .filter(isRecord)
    .map((load) => ({
      id: Number(load.id),
      nodeId: Number(load.nodeId),
      fx: Number(load.fx),
      fy: Number(load.fy),
    }))
    .filter(
      (load) =>
        Number.isInteger(load.id) &&
        nodeIds.has(load.nodeId) &&
        finiteNumber(load.fx) &&
        finiteNumber(load.fy),
    )

  const nextNodeId = Math.max(1, ...nodes.map((node) => node.id + 1))
  const nextMemberId = Math.max(1, ...members.map((member) => member.id + 1))
  const nextLoadId = Math.max(1, ...loads.map((load) => load.id + 1))

  return { nodes, members, loads, nextNodeId, nextMemberId, nextLoadId }
}

export function loadProgress(): ProgressV1 | null {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    const completed = Array.isArray(parsed.completed)
      ? parsed.completed.filter((item): item is string => typeof item === 'string')
      : []
    const answers: Record<string, string> = {}
    if (isRecord(parsed.answers)) {
      for (const [key, value] of Object.entries(parsed.answers)) {
        if (typeof value === 'string') answers[key] = value
      }
    }
    const preferences = isRecord(parsed.preferences)
      ? (parsed.preferences as Partial<StoredPreferences>)
      : {}

    return {
      version: 1,
      completed,
      answers,
      currentMissionId:
        typeof parsed.currentMissionId === 'string' ? parsed.currentMissionId : null,
      model: sanitizeModel(parsed.model),
      preferences,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function saveProgress(progress: Omit<ProgressV1, 'version' | 'savedAt'>): boolean {
  try {
    const payload: ProgressV1 = {
      ...progress,
      version: 1,
      savedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function clearProgress(): boolean {
  try {
    window.localStorage.removeItem(PROGRESS_KEY)
    return true
  } catch {
    return false
  }
}
