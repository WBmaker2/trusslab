import type { MobileTab, Selection, Tool, ViewMode, TableSortKey } from '../../app/state'
import type { Route } from '../../app/routes'
import type { MaterialId, SupportType } from '../../struct/types'

export interface UiActions {
  navigate: (route: Route) => void
  setTool: (tool: Tool) => void
  setMaterial: (materialId: MaterialId) => void
  select: (selection: Selection) => void
  undo: () => void
  redo: () => void
  setOverlay: (key: 'grid' | 'labels' | 'forces' | 'stress' | 'deflection', value: boolean) => void
  setView: (view: ViewMode) => void
  fitCanvas: () => void
  zoomCanvas: (factor: number) => void
  runTest: () => void
  backToDesign: () => void
  openHelp: () => void
  openWarnings: () => void
  openPrediction: () => void
  resetModel: () => void
  updateNodePosition: (nodeId: number, x: number, y: number) => void
  setSupport: (nodeId: number, support: SupportType) => void
  addLoad: (nodeId: number) => void
  updateLoad: (loadId: number, fx: number, fy: number) => void
  removeLoad: (loadId: number) => void
  deleteNode: (nodeId: number) => void
  deleteMember: (memberId: number) => void
  changeMemberMaterial: (memberId: number, materialId: MaterialId) => void
  setSort: (key: TableSortKey) => void
  startMission: (missionId: string) => void
  restartMission: () => void
  nextMission: () => void
  toggleTeacherAnswers: () => void
  resetProgress: () => void
  printWorksheet: () => void
  loadPreset: (presetId: string) => void
  setMobileTab: (tab: MobileTab) => void
  toggleReducedMotion: () => void
}
