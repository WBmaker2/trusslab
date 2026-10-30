import { analyzeModel, type Analysis } from '../struct/analysis'
import type { LoadTestResult, MaterialId, TrussModel } from '../struct/types'
import { getMission } from '../features/missions/missions'
import type { ProgressV1, StoredOverlays } from '../storage/progress'
import { PRESETS, cloneModel } from './presets'
import { parseRoute, type Route } from './routes'

export type Tool = 'select' | 'node' | 'member' | 'pin' | 'roller' | 'load' | 'delete'
export type ViewMode = '2d' | '3d'
export type MobileTab = 'build' | 'forces' | 'mission' | 'test'

export interface Selection {
  kind: 'node' | 'member' | null
  id: number | null
}

export interface Overlays {
  grid: boolean
  labels: boolean
  forces: boolean
  stress: boolean
  deflection: boolean
}

export interface TestState {
  status: 'idle' | 'running' | 'done'
  result: LoadTestResult | null
  progress: number
  startedAt: number | null
  completedAt: number | null
  runId: number
}

export interface MissionState {
  currentId: string | null
  answers: Record<string, string>
  completed: string[]
}

export interface Preferences {
  reducedMotion: boolean
  materialId: MaterialId
  teacherShowAnswers: boolean
}

export type TableSortKey =
  'member' | 'type' | 'force' | 'stress' | 'utilization' | 'length' | 'state'

export interface TableSort {
  key: TableSortKey
  direction: 'asc' | 'desc'
}

export interface AppState {
  route: Route
  model: TrussModel
  analysis: Analysis
  selection: Selection
  tool: Tool
  materialId: MaterialId
  view: ViewMode
  overlays: Overlays
  mission: MissionState
  test: TestState
  preferences: Preferences
  tableSort: TableSort
  mobileTab: MobileTab
  pendingMemberFrom: number | null
}

export const DEFAULT_OVERLAYS: Overlays = {
  grid: true,
  labels: false,
  forces: true,
  stress: false,
  deflection: false,
}

function systemReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function readOverlays(value: Partial<StoredOverlays> | undefined): Overlays {
  if (!value) return { ...DEFAULT_OVERLAYS }
  return {
    grid: typeof value.grid === 'boolean' ? value.grid : DEFAULT_OVERLAYS.grid,
    labels: typeof value.labels === 'boolean' ? value.labels : DEFAULT_OVERLAYS.labels,
    forces: typeof value.forces === 'boolean' ? value.forces : DEFAULT_OVERLAYS.forces,
    stress: typeof value.stress === 'boolean' ? value.stress : DEFAULT_OVERLAYS.stress,
    deflection:
      typeof value.deflection === 'boolean' ? value.deflection : DEFAULT_OVERLAYS.deflection,
  }
}

export function idleTest(): TestState {
  return {
    status: 'idle',
    result: null,
    progress: 0,
    startedAt: null,
    completedAt: null,
    runId: 0,
  }
}

export function createInitialState(progress: ProgressV1 | null = null): AppState {
  const model = progress?.model ? cloneModel(progress.model) : cloneModel(PRESETS.demo.model)
  const currentMission = getMission(progress?.currentMissionId ?? null)
  const preferences = progress?.preferences ?? {}
  const overlays = readOverlays(preferences.overlays)
  const materialId =
    preferences.materialId === 'steel' || preferences.materialId === 'wood'
      ? preferences.materialId
      : 'wood'
  const reducedMotion =
    typeof preferences.reducedMotion === 'boolean'
      ? preferences.reducedMotion
      : systemReducedMotion()

  return {
    route: typeof window === 'undefined' ? 'design' : parseRoute(),
    model,
    analysis: analyzeModel(model),
    selection: { kind: null, id: null },
    tool: 'select',
    materialId,
    view: preferences.view3d ? '3d' : '2d',
    overlays,
    mission: {
      currentId: currentMission?.id ?? null,
      answers: progress?.answers ?? {},
      completed: progress?.completed ?? [],
    },
    test: idleTest(),
    preferences: {
      reducedMotion,
      materialId,
      teacherShowAnswers: preferences.teacherShowAnswers === true,
    },
    tableSort: { key: 'utilization', direction: 'desc' },
    mobileTab: 'build',
    pendingMemberFrom: null,
  }
}

export function cloneSelection(selection: Selection): Selection {
  return { kind: selection.kind, id: selection.id }
}
