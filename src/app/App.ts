import { DISCLAIMER_KO } from '../struct/constants'
import { analyzeModel } from '../struct/analysis'
import { runLoadTest, totalLoadMagnitude } from '../struct/failure'
import type { TrussModel } from '../struct/types'
import { formatForce, formatPercent } from '../struct/units'
import { DesignCanvas } from '../render/DesignCanvas'
import { BridgeView } from '../render/BridgeScene'
import { ModelHistory } from '../editor/commands'
import { snapPoint } from '../editor/grid'
import {
  addLoad as addLoadToModel,
  addMember as addMemberToModel,
  addNode as addNodeToModel,
  loadForNode,
  moveNode,
  removeLoad as removeLoadFromModel,
  removeMember as removeMemberFromModel,
  removeNode as removeNodeFromModel,
  setMemberMaterial,
  setSupport as setSupportToModel,
  updateLoad as updateLoadToModel,
} from '../editor/placement'
import { clearProgress, loadProgress, saveProgress } from '../storage/progress'
import {
  evaluateMission,
  evaluatePrediction,
  getMission,
  isPredictionCorrect,
  nextMissionId,
  type MissionEvaluation,
} from '../features/missions/missions'
import { blankModel, cloneModel, loadPresetModel } from './presets'
import { parseRoute, routeHref, type Route } from './routes'
import {
  createInitialState,
  idleTest,
  type AppState,
  type MobileTab,
  type Selection,
  type TableSortKey,
  type Tool,
  type ViewMode,
} from './state'
import { clear, el, qs, setText } from '../ui/dom'
import { icon } from '../ui/icons'
import { renderTopbar } from '../ui/components/topbar'
import { renderLeftPanel } from '../ui/components/leftPanel'
import { renderRightPanel } from '../ui/components/forceTable'
import { renderInspector } from '../ui/components/inspector'
import {
  renderHud,
  renderMobileTabs,
  renderStageHeader,
  renderStageStatus,
  renderWarningBanner,
} from '../ui/components/stage'
import { renderMissionsPage } from '../ui/components/missionsPage'
import { renderTeacherPage } from '../ui/components/teacherPage'
import {
  confirmDialog,
  openCompletionDialog,
  openHelpDialog,
  openPredictionDialog,
  openWarningsDialog,
} from '../ui/components/dialogs'
import type { UiActions } from '../ui/components/actions'
import { summaryText } from '../ui/components/common'

interface FocusSnapshot {
  kind: 'canvas' | 'key'
  key?: string
  start?: number
  end?: number
}

interface ShellElements {
  root: HTMLElement
  topbar: HTMLElement
  studio: HTMLElement
  panelLeft: HTMLElement
  stage: HTMLElement
  stageHeader: HTMLElement
  canvasFrame: HTMLElement
  canvas: HTMLCanvasElement
  threeFrame: HTMLElement
  threeHost: HTMLElement
  hud: HTMLElement
  warning: HTMLElement
  status: HTMLElement
  mobileTabs: HTMLElement
  panelRight: HTMLElement
  pageView: HTMLElement
  toast: HTMLElement
  canvasLive: HTMLElement
  modelLive: HTMLElement
}

export class App {
  private state: AppState
  private history: ModelHistory
  private actions: UiActions
  private els: ShellElements
  private canvas!: DesignCanvas
  private bridge: BridgeView | null = null
  private zoomPercent = 100
  private testRaf = 0
  private testRunId = 0
  private saveTimer: number | null = null
  private lastSummary = ''
  private dragBase: TrussModel | null = null
  private dragChanged = false
  private draggedNodeId: number | null = null

  constructor() {
    const progress = loadProgress()
    this.state = createInitialState(progress)
    this.history = new ModelHistory(this.state.model)
    this.actions = this.createActions()
    this.els = this.buildShell()
    this.canvas = new DesignCanvas(this.els.canvas, {
      getState: () => this.state,
      onPrimaryAction: (hit, world) => this.handleCanvasAction(hit, world),
      onNodeDragStart: (nodeId) => this.beginNodeDrag(nodeId),
      onNodeDrag: (nodeId, x, y) => this.dragNode(nodeId, x, y),
      onNodeDragEnd: (nodeId) => this.endNodeDrag(nodeId),
      onDeleteAt: (hit) => this.deleteAt(hit),
      onCursorMove: (world) => this.updateCursorReadout(world),
      onTransformChange: (zoom) => this.updateZoomReadout(zoom),
      onAnnounce: (message) => this.announce(message),
      onToolShortcut: (tool) => this.setTool(tool),
      onEscape: () => this.handleEscape(),
    })
    this.bindWindow()
    if (!window.location.hash) {
      window.history.replaceState(null, '', routeHref(this.state.route))
    }
    this.updateWorksheetDate()
    this.render()
    this.canvas.requestDraw()
  }

  private buildShell(): ShellElements {
    const root = document.getElementById('app')
    if (!root) throw new Error('App root is missing')
    clear(root)

    const topbar = el('header', { class: 'topbar', id: 'topbar' })
    const panelLeft = el('aside', {
      class: 'panel panel-left',
      id: 'panel-left',
      'aria-label': '도구와 미션',
    })
    const stageHeader = el('div', { class: 'stage-header', id: 'stage-header' })
    const canvas = el('canvas', {
      class: 'design-canvas',
      id: 'design-canvas',
      role: 'application',
      tabindex: '0',
      'aria-label': '트러스 설계 캔버스',
      'aria-describedby': 'canvas-help',
    }) as HTMLCanvasElement
    const hud = el('div', { class: 'hud', id: 'hud' })
    const canvasHelp = el('p', {
      class: 'sr-only',
      id: 'canvas-help',
      text: '2D 트러스 편집 캔버스입니다. 화살표 키로 커서를 움직이고 Enter로 현재 도구를 적용합니다. V 선택, N 절점, M 부재, P 핀, R 롤러, L 하중, D 삭제. Esc는 취소, F는 화면 맞춤입니다. 오른쪽 모델 목록과 힘 표에서도 모든 항목을 선택할 수 있습니다.',
    })
    const canvasFrame = el(
      'div',
      { class: 'canvas-frame', id: 'canvas-frame' },
      canvas,
      canvasHelp,
      hud,
    )
    const threeHost = el('div', { class: 'three-host', id: 'three-host' })
    const threeFrame = el(
      'div',
      { class: 'three-frame', id: 'three-frame', hidden: true },
      threeHost,
      el(
        'div',
        { class: 'three-overlay', 'aria-hidden': 'true' },
        el('span', { class: 'badge badge-accent', text: '3D' }),
        el('span', { text: '2D 해석을 3D로 표현 · 드래그로 회전, 스크롤로 확대' }),
      ),
    )
    const warning = el('div', { class: 'warning-slot', id: 'warning-slot' })
    const status = el('div', { class: 'stage-status-slot', id: 'stage-status' })
    const stage = el(
      'section',
      { class: 'stage', id: 'stage', 'aria-label': '설계 무대' },
      stageHeader,
      el('div', { class: 'stage-view', id: 'stage-view' }, canvasFrame, threeFrame),
      warning,
      status,
    )
    const mobileTabs = el('div', { class: 'mobile-tabs-slot', id: 'mobile-tabs' })
    const panelRight = el('aside', {
      class: 'panel panel-right',
      id: 'panel-right',
      'aria-label': '검사와 힘 표',
    })
    const studio = el(
      'section',
      { class: 'studio', id: 'studio' },
      panelLeft,
      stage,
      mobileTabs,
      panelRight,
    )
    const pageView = el('section', { class: 'page-view', id: 'page-view', hidden: true })
    const main = el('main', { class: 'main', id: 'main' }, studio, pageView)
    const toast = el('div', {
      class: 'toast-region',
      id: 'toast-region',
      'aria-live': 'polite',
      'aria-atomic': 'false',
    })
    const canvasLive = el('p', {
      class: 'sr-only',
      id: 'canvas-live',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    })
    const modelLive = el('p', {
      class: 'sr-only',
      id: 'model-live',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    })
    const footerHelp = el('button', {
      class: 'footer-link',
      type: 'button',
      'data-focus-key': 'footer-help',
      text: '도움말',
    })
    footerHelp.addEventListener('click', () => this.actions.openHelp())
    const footer = el(
      'footer',
      { class: 'footer' },
      el('p', { class: 'footer-disclaimer', text: DISCLAIMER_KO }),
      el(
        'div',
        { class: 'footer-meta' },
        el('span', { text: '2D · 정정 구조만' }),
        el('span', { text: 'v0.1.0' }),
        footerHelp,
      ),
    )

    root.appendChild(topbar)
    root.appendChild(main)
    root.appendChild(toast)
    root.appendChild(canvasLive)
    root.appendChild(modelLive)
    root.appendChild(footer)
    document.body.querySelector('#worksheet')?.remove()
    document.body.appendChild(this.buildWorksheet())

    return {
      root,
      topbar,
      studio,
      panelLeft,
      stage,
      stageHeader,
      canvasFrame,
      canvas,
      threeFrame,
      threeHost,
      hud,
      warning,
      status,
      mobileTabs,
      panelRight,
      pageView,
      toast,
      canvasLive,
      modelLive,
    }
  }

  private buildWorksheet(): HTMLElement {
    const width = 480
    const height = 320
    const step = 40
    const lines: string[] = []
    for (let x = 0; x <= width; x += step) {
      lines.push(
        `<line x1="${x}" y1="0" x2="${x}" y2="${height}" class="${x === 0 || x === width ? 'is-edge' : ''}" />`,
      )
    }
    for (let y = 0; y <= height; y += step) {
      lines.push(
        `<line x1="0" y1="${y}" x2="${width}" y2="${y}" class="${y === 0 || y === height ? 'is-edge' : ''}" />`,
      )
    }
    const tableRows = Array.from({ length: 8 }, (_, index) => {
      return `<tr><td>${index + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>`
    }).join('')
    const section = el('section', {
      class: 'worksheet',
      id: 'worksheet',
      'aria-hidden': 'true',
    })
    section.innerHTML = `
      <header class="worksheet-header">
        <p class="worksheet-kicker">TRUSSLAB · STRUCTURE WORKSHEET</p>
        <h1>트러스 설계 활동지</h1>
        <div class="worksheet-meta">
          <span>이름 <span class="worksheet-blank"></span></span>
          <span>학급 <span class="worksheet-blank"></span></span>
          <span>날짜 <span id="worksheet-date"></span></span>
        </div>
      </header>
      <p class="worksheet-instructions">12 m × 8 m 격자에 절점과 부재를 그려 보세요. 지지대(핀·롤러), 하중의 방향과 크기, 부재의 T/C를 표시합니다. 아래 힘 표에는 앱에서 확인한 값을 적습니다.</p>
      <div class="worksheet-grid-wrap">
        <svg class="worksheet-grid" viewBox="0 0 ${width} ${height}" role="img" aria-label="12미터 곱하기 8미터 빈 격자">
          <g class="worksheet-grid-lines">${lines.join('')}</g>
          <text x="6" y="12" class="worksheet-axis">0, 8</text>
          <text x="${width - 34}" y="12" class="worksheet-axis">12, 8</text>
          <text x="6" y="${height - 5}" class="worksheet-axis">0, 0</text>
          <text x="${width - 34}" y="${height - 5}" class="worksheet-axis">12, 0</text>
        </svg>
      </div>
      <h2>부재 힘 표</h2>
      <table class="worksheet-table">
        <thead><tr><th>번호</th><th>부재</th><th>힘 (N)</th><th>T / C</th><th>활용률</th><th>상태</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <h2>반력과 판정</h2>
      <div class="worksheet-lines">
        <span>지지대 반력</span>
        <span>최대 활용률 / 안전율</span>
        <span>가장 먼저 파괴될 부재와 그 이유</span>
      </div>
      <p class="worksheet-note">이 활동지는 2D 이상화 모델을 사용합니다. 실제 시공 설계나 안전 인증에 사용할 수 없습니다.</p>
    `
    return section
  }

  private bindWindow(): void {
    window.addEventListener('hashchange', () => {
      const route = parseRoute()
      if (route !== this.state.route) this.applyRoute(route, { scrollTop: true })
    })
    window.addEventListener('beforeunload', () => {
      this.saveNow()
      this.canvas.destroy()
      this.bridge?.destroy()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveNow()
      }
    })
  }

  private createActions(): UiActions {
    return {
      navigate: (route) => this.navigate(route),
      setTool: (tool) => this.setTool(tool),
      setMaterial: (materialId) => this.setMaterial(materialId),
      select: (selection) => this.select(selection),
      undo: () => this.undo(),
      redo: () => this.redo(),
      setOverlay: (key, value) => this.setOverlay(key, value),
      setView: (view) => this.setView(view),
      fitCanvas: () => this.canvas.fit(),
      zoomCanvas: (factor) => this.canvas.zoomBy(factor),
      runTest: () => this.runTest(),
      backToDesign: () => this.navigate('design'),
      openHelp: () => openHelpDialog(this.state, this.actions),
      openWarnings: () => openWarningsDialog(this.state.analysis.warnings),
      openPrediction: () => this.openPrediction(),
      resetModel: () => this.resetModel(),
      updateNodePosition: (nodeId, x, y) => this.updateNodePosition(nodeId, x, y),
      setSupport: (nodeId, support) => this.setSupport(nodeId, support),
      addLoad: (nodeId) => this.addLoad(nodeId),
      updateLoad: (loadId, fx, fy) => this.updateLoad(loadId, fx, fy),
      removeLoad: (loadId) => this.removeLoad(loadId),
      deleteNode: (nodeId) => this.deleteNode(nodeId),
      deleteMember: (memberId) => this.deleteMember(memberId),
      changeMemberMaterial: (memberId, materialId) =>
        this.changeMemberMaterial(memberId, materialId),
      setSort: (key) => this.setSort(key),
      startMission: (missionId) => this.startMission(missionId),
      restartMission: () => this.restartMission(),
      nextMission: () => this.nextMission(),
      toggleTeacherAnswers: () => this.toggleTeacherAnswers(),
      resetProgress: () => this.resetProgress(),
      printWorksheet: () => this.printWorksheet(),
      loadPreset: (presetId) => this.loadPreset(presetId),
      setMobileTab: (tab) => this.setMobileTab(tab),
      toggleReducedMotion: () => this.toggleReducedMotion(),
    }
  }

  private render(options: { scrollTop?: boolean } = {}): void {
    const focus = this.captureFocus()
    const leftScroll = this.els.panelLeft.scrollTop
    const rightScroll = this.els.panelRight.scrollTop
    const pageScroll = this.els.pageView.scrollTop
    const studioRoute = this.state.route === 'design' || this.state.route === 'test'

    this.els.root.dataset.route = this.state.route
    this.els.root.dataset.mobileTab = this.state.mobileTab
    this.els.root.dataset.view = this.state.view
    this.els.root.classList.toggle('is-reduced-motion', this.state.preferences.reducedMotion)

    clear(this.els.topbar)
    this.els.topbar.appendChild(
      renderTopbar(this.state, this.actions, {
        canUndo: this.history.canUndo(),
        canRedo: this.history.canRedo(),
      }),
    )

    this.els.studio.hidden = !studioRoute
    this.els.pageView.hidden = studioRoute

    if (studioRoute) {
      const evaluation = this.currentEvaluation()
      clear(this.els.stageHeader)
      this.els.stageHeader.appendChild(
        renderStageHeader(this.state, this.actions, `${this.zoomPercent}%`),
      )
      clear(this.els.warning)
      this.els.warning.appendChild(renderWarningBanner(this.state, this.actions))
      clear(this.els.status)
      this.els.status.appendChild(renderStageStatus(this.state, this.actions, evaluation))
      clear(this.els.panelLeft)
      this.els.panelLeft.appendChild(renderLeftPanel(this.state, this.actions, evaluation))
      clear(this.els.panelRight)
      this.els.panelRight.appendChild(
        renderRightPanel(this.state, this.actions, renderInspector(this.state, this.actions)),
      )
      clear(this.els.mobileTabs)
      this.els.mobileTabs.appendChild(renderMobileTabs(this.state, this.actions))
      clear(this.els.hud)
      this.els.hud.appendChild(renderHud(this.state))

      const is3d = this.state.view === '3d'
      this.els.canvasFrame.hidden = is3d
      this.els.threeFrame.hidden = !is3d
      if (is3d) {
        this.mountBridge()
        this.bridge?.update(this.state)
      } else {
        this.unmountBridge()
      }
      this.canvas.requestDraw()
    } else {
      this.unmountBridge()
      clear(this.els.pageView)
      this.els.pageView.appendChild(
        this.state.route === 'missions'
          ? renderMissionsPage(this.state, this.actions)
          : renderTeacherPage(this.state, this.actions),
      )
    }

    this.els.panelLeft.scrollTop = leftScroll
    this.els.panelRight.scrollTop = rightScroll
    this.els.pageView.scrollTop = pageScroll
    if (options.scrollTop) {
      window.scrollTo({ top: 0, behavior: 'auto' })
      this.els.pageView.scrollTop = 0
    }

    const summary = summaryText(this.state)
    if (summary !== this.lastSummary) {
      this.lastSummary = summary
      this.els.modelLive.textContent = summary
    }

    this.restoreFocus(focus)
  }

  private captureFocus(): FocusSnapshot | null {
    const active = document.activeElement as HTMLElement | null
    if (!active || active === document.body) return null
    if (active === this.els.canvas) return { kind: 'canvas' }
    if (active.closest('dialog')) return null
    const key = active.dataset.focusKey
    if (!key) return null
    const snapshot: FocusSnapshot = { kind: 'key', key }
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      snapshot.start = active.selectionStart ?? undefined
      snapshot.end = active.selectionEnd ?? undefined
    }
    return snapshot
  }

  private restoreFocus(snapshot: FocusSnapshot | null): void {
    if (!snapshot) return
    if (snapshot.kind === 'canvas') {
      this.canvas.focus()
      return
    }
    if (!snapshot.key) return
    const target = document.querySelector<HTMLElement>(`[data-focus-key="${snapshot.key}"]`)
    if (!target) {
      if (!this.els.studio.hidden) this.canvas.focus()
      return
    }
    if (target instanceof HTMLButtonElement && target.disabled) {
      if (!this.els.studio.hidden) this.canvas.focus()
      return
    }
    target.focus({ preventScroll: true })
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      snapshot.start !== undefined
    ) {
      try {
        target.setSelectionRange(snapshot.start, snapshot.end ?? snapshot.start)
      } catch {
        // Number inputs do not support selection ranges.
      }
    }
  }

  private currentEvaluation(): MissionEvaluation | null {
    const mission = getMission(this.state.mission.currentId)
    if (!mission) return null
    return evaluateMission(mission, {
      model: this.state.model,
      analysis: this.state.analysis,
      predictionAnswer: this.state.mission.answers[mission.id],
      testResult: this.state.test.status === 'done' ? this.state.test.result : null,
      selection: this.state.selection,
    })
  }

  private navigate(route: Route): void {
    if (route === this.state.route) return
    if (window.location.hash !== routeHref(route)) {
      window.location.hash = routeHref(route)
    }
    this.applyRoute(route, { scrollTop: true })
  }

  private applyRoute(route: Route, options: { scrollTop?: boolean } = {}): void {
    if (this.state.route === 'test' && route !== 'test' && this.state.test.status === 'running') {
      this.cancelTestAnimation()
      this.state.test = idleTest()
    }
    this.state.route = route
    this.state.pendingMemberFrom = null
    if (route === 'test') this.state.mobileTab = 'test'
    else if (route === 'design') this.state.mobileTab = 'build'
    this.render({ scrollTop: options.scrollTop })
  }

  private setTool(tool: Tool): void {
    this.state.tool = tool
    this.state.pendingMemberFrom = null
    this.render()
    this.announce(`도구: ${tool}`)
  }

  private setMaterial(materialId: 'wood' | 'steel'): void {
    this.state.materialId = materialId
    this.state.preferences.materialId = materialId
    if (this.state.selection.kind === 'member' && this.state.selection.id !== null) {
      const changed = setMemberMaterial(this.state.model, this.state.selection.id, materialId)
      if (changed.ok) {
        this.applyModel(changed.model)
        return
      }
    }
    this.scheduleSave()
    this.render()
  }

  private select(selection: Selection): void {
    this.state.selection = selection
    this.render()
  }

  private undo(): void {
    const model = this.history.undo()
    if (!model) return
    this.applyModelFromHistory(model)
    this.showToast('실행 취소했습니다.', 'info')
  }

  private redo(): void {
    const model = this.history.redo()
    if (!model) return
    this.applyModelFromHistory(model)
    this.showToast('다시 실행했습니다.', 'info')
  }

  private applyModelFromHistory(model: TrussModel): void {
    this.cancelTestAnimation()
    this.state.model = model
    this.state.analysis = analyzeModel(model)
    this.state.test = idleTest()
    this.state.pendingMemberFrom = null
    if (!this.selectionExists()) this.state.selection = { kind: null, id: null }
    this.scheduleSave()
    this.render()
  }

  private setOverlay(
    key: 'grid' | 'labels' | 'forces' | 'stress' | 'deflection',
    value: boolean,
  ): void {
    this.state.overlays[key] = value
    this.scheduleSave()
    this.render()
  }

  private setView(view: ViewMode): void {
    this.state.view = view
    this.scheduleSave()
    this.render()
  }

  private updateZoomReadout(zoom: number): void {
    this.zoomPercent = Math.round(zoom * 100)
    setText(qs('#zoom-readout'), `${this.zoomPercent}%`)
  }

  private updateCursorReadout(world: { x: number; y: number } | null): void {
    setText(
      qs('#cursor-readout'),
      world ? `x ${world.x.toFixed(1)} m, y ${world.y.toFixed(1)} m` : 'x —, y —',
    )
  }

  private announce(message: string): void {
    const live = this.els.canvasLive
    live.textContent = ''
    window.setTimeout(() => {
      live.textContent = message
    }, 20)
  }

  private handleCanvasAction(
    hit: { kind: 'node' | 'member'; id: number } | null,
    world: { x: number; y: number },
  ): void {
    const state = this.state
    const snapped = snapPoint(world.x, world.y)
    const nodeHit = hit?.kind === 'node' ? hit : null
    const memberHit = hit?.kind === 'member' ? hit : null

    switch (state.tool) {
      case 'select': {
        if (hit) this.select({ kind: hit.kind, id: hit.id })
        else this.select({ kind: null, id: null })
        return
      }
      case 'node': {
        if (nodeHit) {
          this.select({ kind: 'node', id: nodeHit.id })
          return
        }
        const result = addNodeToModel(state.model, snapped.x, snapped.y)
        if (!result.ok) {
          if (result.nodeId !== undefined) this.select({ kind: 'node', id: result.nodeId })
          this.showToast(result.reasonKo ?? '절점을 놓을 수 없습니다.', 'warning')
          return
        }
        this.state.selection = { kind: 'node', id: result.nodeId ?? null }
        this.applyModel(result.model, { keepSelection: true })
        this.announce(`절점 N${result.nodeId}을 놓았습니다.`)
        return
      }
      case 'member': {
        if (nodeHit) {
          if (state.pendingMemberFrom === null) {
            this.state.pendingMemberFrom = nodeHit.id
            this.render()
            this.announce(`시작 절점 N${nodeHit.id}. 연결할 절점을 선택하세요.`)
            return
          }
          if (state.pendingMemberFrom === nodeHit.id) {
            this.state.pendingMemberFrom = null
            this.render()
            this.announce('부재 연결을 취소했습니다.')
            return
          }
          const result = addMemberToModel(
            state.model,
            state.pendingMemberFrom,
            nodeHit.id,
            state.materialId,
          )
          if (!result.ok) {
            this.showToast(result.reasonKo ?? '부재를 만들 수 없습니다.', 'warning')
            return
          }
          this.state.pendingMemberFrom = null
          this.state.selection = { kind: 'member', id: result.memberId ?? null }
          this.applyModel(result.model, { keepSelection: true })
          this.announce(`부재 M${result.memberId}을 연결했습니다.`)
          return
        }
        if (state.pendingMemberFrom !== null) {
          this.state.pendingMemberFrom = null
          this.render()
        }
        this.showToast('부재 도구는 절점을 클릭해 연결합니다.', 'info')
        return
      }
      case 'pin':
      case 'roller': {
        if (!nodeHit) {
          this.showToast('지지대를 놓을 절점을 클릭하세요.', 'info')
          return
        }
        const node = state.model.nodes.find((item) => item.id === nodeHit.id)
        if (!node) return
        const target = node.support === state.tool ? 'free' : state.tool
        const result = setSupportToModel(state.model, node.id, target)
        if (result.ok) {
          this.state.selection = { kind: 'node', id: node.id }
          this.applyModel(result.model, { keepSelection: true })
          this.announce(
            target === 'free'
              ? '지지대를 제거했습니다.'
              : `${target === 'pin' ? '핀' : '롤러'} 지지대를 놓았습니다.`,
          )
        }
        return
      }
      case 'load': {
        if (!nodeHit) {
          this.showToast('하중을 걸 절점을 클릭하세요.', 'info')
          return
        }
        if (loadForNode(state.model, nodeHit.id)) {
          this.select({ kind: 'node', id: nodeHit.id })
          this.showToast('이미 이 절점에 하중이 있습니다. 검사창에서 크기를 바꾸세요.', 'info')
          return
        }
        const result = addLoadToModel(state.model, nodeHit.id)
        if (result.ok) {
          this.state.selection = { kind: 'node', id: nodeHit.id }
          this.applyModel(result.model, { keepSelection: true })
          this.announce('아래 방향 500 N 하중을 걸었습니다.')
        }
        return
      }
      case 'delete': {
        if (nodeHit) {
          this.deleteNode(nodeHit.id)
          return
        }
        if (memberHit) {
          this.deleteMember(memberHit.id)
          return
        }
        this.showToast('삭제할 절점이나 부재를 클릭하세요.', 'info')
        return
      }
      default:
        return
    }
  }

  private beginNodeDrag(nodeId: number): void {
    if (this.state.tool !== 'select') return
    this.dragBase = cloneModel(this.state.model)
    this.dragChanged = false
    this.draggedNodeId = nodeId
    this.state.selection = { kind: 'node', id: nodeId }
    this.canvas.requestDraw()
  }

  private dragNode(nodeId: number, x: number, y: number): void {
    if (this.draggedNodeId !== nodeId) return
    const result = moveNode(this.state.model, nodeId, x, y)
    if (!result.ok) return
    this.state.model = result.model
    this.state.analysis = analyzeModel(result.model)
    this.dragChanged = true
    this.canvas.requestDraw()
  }

  private endNodeDrag(nodeId: number): void {
    if (this.draggedNodeId !== nodeId) return
    if (this.dragChanged && this.dragBase) {
      this.history.push(this.state.model)
      this.cancelTestAnimation()
      this.state.test = idleTest()
      this.scheduleSave()
      this.announce('절점 위치를 옮겼습니다. 실행 취소로 되돌릴 수 있습니다.')
    }
    this.dragBase = null
    this.dragChanged = false
    this.draggedNodeId = null
    this.render()
  }

  private deleteAt(hit: { kind: 'node' | 'member'; id: number } | null): void {
    if (hit?.kind === 'node') this.deleteNode(hit.id)
    else if (hit?.kind === 'member') this.deleteMember(hit.id)
    else if (this.state.selection.kind === 'node' && this.state.selection.id !== null) {
      this.deleteNode(this.state.selection.id)
    } else if (this.state.selection.kind === 'member' && this.state.selection.id !== null) {
      this.deleteMember(this.state.selection.id)
    } else {
      this.showToast('삭제할 절점이나 부재가 선택되어 있지 않습니다.', 'info')
    }
  }

  private handleEscape(): void {
    if (this.state.pendingMemberFrom !== null) {
      this.state.pendingMemberFrom = null
      this.render()
      this.announce('부재 연결을 취소했습니다.')
      return
    }
    if (this.state.selection.kind !== null) {
      this.select({ kind: null, id: null })
      this.announce('선택을 해제했습니다.')
    }
  }

  private applyModel(model: TrussModel, options: { keepSelection?: boolean } = {}): void {
    this.cancelTestAnimation()
    this.history.push(model)
    this.state.model = model
    this.state.analysis = analyzeModel(model)
    this.state.test = idleTest()
    this.state.pendingMemberFrom =
      this.state.pendingMemberFrom !== null &&
      model.nodes.some((node) => node.id === this.state.pendingMemberFrom)
        ? this.state.pendingMemberFrom
        : null
    if (!options.keepSelection && !this.selectionExists()) {
      this.state.selection = { kind: null, id: null }
    }
    this.scheduleSave()
    this.render()
  }

  private selectionExists(): boolean {
    const { kind, id } = this.state.selection
    if (kind === 'node') return this.state.model.nodes.some((node) => node.id === id)
    if (kind === 'member') return this.state.model.members.some((member) => member.id === id)
    return true
  }

  private updateNodePosition(nodeId: number, x: number, y: number): void {
    const snapped = snapPoint(x, y)
    const result = moveNode(this.state.model, nodeId, snapped.x, snapped.y)
    if (!result.ok) {
      this.showToast(result.reasonKo ?? '절점을 옮길 수 없습니다.', 'warning')
      this.render()
      return
    }
    this.state.selection = { kind: 'node', id: nodeId }
    this.applyModel(result.model, { keepSelection: true })
  }

  private setSupport(nodeId: number, support: 'free' | 'pin' | 'roller'): void {
    const result = setSupportToModel(this.state.model, nodeId, support)
    if (result.ok) {
      this.state.selection = { kind: 'node', id: nodeId }
      this.applyModel(result.model, { keepSelection: true })
    }
  }

  private addLoad(nodeId: number): void {
    const result = addLoadToModel(this.state.model, nodeId)
    if (!result.ok) {
      this.showToast(result.reasonKo ?? '하중을 추가할 수 없습니다.', 'warning')
      return
    }
    this.state.selection = { kind: 'node', id: nodeId }
    this.applyModel(result.model, { keepSelection: true })
  }

  private updateLoad(loadId: number, fx: number, fy: number): void {
    const clampedFx = Math.max(-5000, Math.min(5000, Number.isFinite(fx) ? fx : 0))
    const clampedFy = Math.max(-5000, Math.min(5000, Number.isFinite(fy) ? fy : 0))
    const result = updateLoadToModel(this.state.model, loadId, clampedFx, clampedFy)
    if (result.ok) this.applyModel(result.model, { keepSelection: true })
  }

  private removeLoad(loadId: number): void {
    const result = removeLoadFromModel(this.state.model, loadId)
    if (result.ok) {
      this.applyModel(result.model, { keepSelection: true })
      this.showToast('하중을 삭제했습니다.', 'info')
    }
  }

  private deleteNode(nodeId: number): void {
    const result = removeNodeFromModel(this.state.model, nodeId)
    if (!result.ok) {
      this.showToast(result.reasonKo ?? '절점을 삭제할 수 없습니다.', 'warning')
      return
    }
    if (this.state.selection.kind === 'node' && this.state.selection.id === nodeId) {
      this.state.selection = { kind: null, id: null }
    }
    this.applyModel(result.model)
    this.showToast('절점을 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.', 'info')
  }

  private deleteMember(memberId: number): void {
    const result = removeMemberFromModel(this.state.model, memberId)
    if (!result.ok) {
      this.showToast(result.reasonKo ?? '부재를 삭제할 수 없습니다.', 'warning')
      return
    }
    if (this.state.selection.kind === 'member' && this.state.selection.id === memberId) {
      this.state.selection = { kind: null, id: null }
    }
    this.applyModel(result.model)
    this.showToast('부재를 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.', 'info')
  }

  private changeMemberMaterial(memberId: number, materialId: 'wood' | 'steel'): void {
    const result = setMemberMaterial(this.state.model, memberId, materialId)
    if (!result.ok) return
    this.state.materialId = materialId
    this.state.preferences.materialId = materialId
    this.state.selection = { kind: 'member', id: memberId }
    this.applyModel(result.model, { keepSelection: true })
  }

  private setSort(key: TableSortKey): void {
    if (this.state.tableSort.key === key) {
      this.state.tableSort.direction = this.state.tableSort.direction === 'asc' ? 'desc' : 'asc'
    } else {
      this.state.tableSort.key = key
      this.state.tableSort.direction =
        key === 'utilization' || key === 'force' || key === 'stress' ? 'desc' : 'asc'
    }
    this.render()
  }

  private runTest(): void {
    if (this.state.route !== 'test') {
      this.navigate('test')
    }
    if (this.state.test.status === 'running') return
    this.startLoadTest()
  }

  private startLoadTest(): void {
    this.cancelTestAnimation()
    const loadN = totalLoadMagnitude(this.state.model)
    if (loadN <= 0) {
      this.state.test = idleTest()
      this.render()
      this.showToast('하중이 없습니다. 하중 도구로 절점에 힘을 걸어 주세요.', 'warning')
      return
    }
    const result = runLoadTest(this.state.model, this.state.analysis.result)
    const runId = ++this.testRunId
    if (this.state.preferences.reducedMotion) {
      this.state.test = {
        status: 'done',
        result,
        progress: 1,
        startedAt: performance.now(),
        completedAt: performance.now(),
        runId,
      }
      this.render()
      this.maybeCompleteMission()
      return
    }
    const startedAt = performance.now()
    this.state.test = {
      status: 'running',
      result,
      progress: 0,
      startedAt,
      completedAt: null,
      runId,
    }
    this.render()
    const duration = 1650
    const tick = (now: number): void => {
      if (this.testRunId !== runId) return
      const progress = Math.min(1, (now - startedAt) / duration)
      if (this.state.test.runId !== runId) return
      this.state.test.progress = progress
      this.updateTestProgressDom(progress, result)
      this.canvas.requestDraw()
      if (progress < 1) {
        this.testRaf = requestAnimationFrame(tick)
        return
      }
      this.state.test.status = 'done'
      this.state.test.progress = 1
      this.state.test.completedAt = performance.now()
      this.testRaf = 0
      this.render()
      this.maybeCompleteMission()
    }
    this.testRaf = requestAnimationFrame(tick)
  }

  private updateTestProgressDom(progress: number, result: ReturnType<typeof runLoadTest>): void {
    const limit = result.failure ? result.failure.scale : 1
    const loadN = totalLoadMagnitude(this.state.model)
    const baseUtil = this.state.analysis.result?.maxUtilization ?? 0
    const percent = Math.round(progress * 100)
    const fill = document.getElementById('test-progress-fill')
    if (fill) fill.style.width = `${percent}%`
    const track = document.querySelector<HTMLElement>('.test-progress-track')
    if (track) track.setAttribute('aria-valuenow', String(percent))
    setText(
      document.getElementById('test-progress-label'),
      `${Math.min(10, Math.ceil(progress * 10))} / 10 단계`,
    )
    setText(document.getElementById('test-current-load'), formatForce(loadN * progress * limit))
    setText(
      document.getElementById('test-current-util'),
      formatPercent(baseUtil * progress * limit, 0),
    )
  }

  private cancelTestAnimation(): void {
    if (this.testRaf) cancelAnimationFrame(this.testRaf)
    this.testRaf = 0
    this.testRunId += 1
  }

  private maybeCompleteMission(): void {
    const mission = getMission(this.state.mission.currentId)
    if (!mission) return
    const evaluation = this.currentEvaluation()
    if (!evaluation?.passed) return
    if (this.state.mission.completed.includes(mission.id)) {
      if (this.state.test.status === 'done') {
        this.showToast('이미 완료한 미션입니다. 조건을 다시 만족했습니다.', 'success')
      }
      return
    }
    this.state.mission.completed = [...this.state.mission.completed, mission.id]
    this.saveNow()
    this.render()
    const next = nextMissionId(mission.id)
    const openWhenFree = (attempt = 0): void => {
      const openDialog = document.querySelector('dialog[open]')
      if (openDialog && attempt < 6) {
        window.setTimeout(() => openWhenFree(attempt + 1), 450)
        return
      }
      openCompletionDialog(
        mission,
        () => {
          if (next) this.startMission(next)
          else {
            this.navigate('missions')
            this.showToast('모든 미션을 완료했습니다. 수고했어요.', 'success')
          }
        },
        () => this.navigate('missions'),
      )
    }
    openWhenFree()
  }

  private openPrediction(): void {
    const mission = getMission(this.state.mission.currentId)
    if (!mission) {
      this.showToast('진행 중인 미션이 없습니다.', 'info')
      return
    }
    if (this.state.mission.completed.includes(mission.id)) {
      this.showToast('이미 완료한 미션입니다.', 'info')
      return
    }
    openPredictionDialog(mission, this.state.mission.answers[mission.id], (answer) => {
      this.state.mission.answers[mission.id] = answer
      this.saveNow()
      this.render()
      const evaluation = evaluatePrediction(mission, answer)
      if (evaluation.passed) {
        window.setTimeout(() => this.maybeCompleteMission(), 700)
      }
      return { correct: evaluation.passed, hint: evaluation.hintKo }
    })
  }

  private startMission(missionId: string): void {
    const mission = getMission(missionId)
    if (!mission) return
    const model = loadPresetModel(mission.setup.presetModel)
    this.cancelTestAnimation()
    this.state.model = model
    this.state.analysis = analyzeModel(model)
    this.state.selection = { kind: null, id: null }
    this.state.test = idleTest()
    this.state.pendingMemberFrom = null
    this.state.mission.currentId = mission.id
    this.state.tool =
      mission.id === 'six-members' ||
      mission.id === 'budget' ||
      mission.id === 'triangle-vs-square' ||
      mission.id === 'repair'
        ? 'member'
        : 'select'
    this.history.reset(model)
    this.state.route = 'design'
    this.state.mobileTab = 'build'
    if (window.location.hash !== routeHref('design')) window.location.hash = routeHref('design')
    this.render({ scrollTop: true })
    this.saveNow()
    if (
      !this.state.mission.completed.includes(mission.id) &&
      !isPredictionCorrect(mission, this.state.mission.answers[mission.id])
    ) {
      window.setTimeout(() => this.openPrediction(), 200)
    }
  }

  private restartMission(): void {
    const mission = getMission(this.state.mission.currentId)
    if (!mission) return
    void confirmDialog({
      title: '미션을 처음부터 다시 시작할까요?',
      message: '지금 캔버스의 모델이 미션 시작 상태로 돌아갑니다. 완료 기록은 유지됩니다.',
      confirmLabel: '다시 시작',
      dangerous: true,
    }).then((confirmed) => {
      if (confirmed) this.startMission(mission.id)
    })
  }

  private nextMission(): void {
    const next = nextMissionId(this.state.mission.currentId)
    if (next) this.startMission(next)
    else this.navigate('missions')
  }

  private toggleTeacherAnswers(): void {
    this.state.preferences.teacherShowAnswers = !this.state.preferences.teacherShowAnswers
    this.scheduleSave()
    this.render()
  }

  private resetProgress(): void {
    void confirmDialog({
      title: '진행을 모두 초기화할까요?',
      message:
        '완료한 미션, 예측 답, 마지막 모델이 이 브라우저에서 삭제됩니다. 되돌릴 수 없습니다.',
      confirmLabel: '모두 지우기',
      dangerous: true,
    }).then((confirmed) => {
      if (!confirmed) return
      if (this.saveTimer !== null) {
        window.clearTimeout(this.saveTimer)
        this.saveTimer = null
      }
      clearProgress()
      this.cancelTestAnimation()
      this.unmountBridge()
      this.state = createInitialState(null)
      this.history = new ModelHistory(this.state.model)
      this.lastSummary = ''
      this.canvas.fit()
      this.render({ scrollTop: true })
      this.showToast('진행을 초기화했습니다.', 'success')
    })
  }

  private resetModel(): void {
    const hasContent = this.state.model.nodes.length > 0 || this.state.model.members.length > 0
    const apply = (): void => {
      this.cancelTestAnimation()
      const model = blankModel()
      this.state.model = model
      this.state.analysis = analyzeModel(model)
      this.state.selection = { kind: null, id: null }
      this.state.test = idleTest()
      this.state.pendingMemberFrom = null
      this.state.mission.currentId = null
      this.state.tool = 'node'
      this.history.reset(model)
      this.state.route = 'design'
      this.state.mobileTab = 'build'
      if (window.location.hash !== routeHref('design')) window.location.hash = routeHref('design')
      this.saveNow()
      this.render({ scrollTop: true })
      this.showToast('빈 캔버스입니다. 절점 도구로 첫 절점을 놓으세요.', 'info')
    }
    if (!hasContent) {
      apply()
      return
    }
    void confirmDialog({
      title: '모든 절점과 부재를 지울까요?',
      message: '현재 모델과 진행 중인 미션이 초기화됩니다. 완료한 미션 기록은 유지됩니다.',
      confirmLabel: '비우기',
      dangerous: true,
    }).then((confirmed) => {
      if (confirmed) apply()
    })
  }

  private loadPreset(presetId: string): void {
    this.cancelTestAnimation()
    const model = loadPresetModel(presetId)
    this.state.model = model
    this.state.analysis = analyzeModel(model)
    this.state.selection = { kind: null, id: null }
    this.state.test = idleTest()
    this.state.pendingMemberFrom = null
    this.state.mission.currentId = null
    this.state.tool = 'select'
    this.history.reset(model)
    this.state.route = 'design'
    this.state.mobileTab = 'build'
    if (window.location.hash !== routeHref('design')) window.location.hash = routeHref('design')
    this.saveNow()
    this.render({ scrollTop: true })
    this.showToast('프리셋을 캔버스에 불러왔습니다.', 'success')
  }

  private setMobileTab(tab: MobileTab): void {
    this.state.mobileTab = tab
    this.render()
  }

  private toggleReducedMotion(): void {
    this.state.preferences.reducedMotion = !this.state.preferences.reducedMotion
    this.scheduleSave()
    this.render()
    this.showToast(
      this.state.preferences.reducedMotion ? '움직임을 줄입니다.' : '애니메이션을 켰습니다.',
      'info',
    )
  }

  private printWorksheet(): void {
    this.updateWorksheetDate()
    window.print()
  }

  private updateWorksheetDate(): void {
    const dateEl = document.getElementById('worksheet-date')
    if (!dateEl) return
    try {
      dateEl.textContent = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(
        new Date(),
      )
    } catch {
      dateEl.textContent = new Date().toLocaleDateString()
    }
  }

  private mountBridge(): void {
    if (this.bridge || this.state.route === 'missions' || this.state.route === 'teacher') return
    this.bridge = new BridgeView(this.els.threeHost, () => this.state)
    this.bridge.mount()
  }

  private unmountBridge(): void {
    if (!this.bridge) return
    this.bridge.destroy()
    this.bridge = null
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null
      this.saveNow()
    }, 280)
  }

  private saveNow(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    saveProgress({
      completed: [...this.state.mission.completed],
      answers: { ...this.state.mission.answers },
      currentMissionId: this.state.mission.currentId,
      model: cloneModel(this.state.model),
      preferences: {
        reducedMotion: this.state.preferences.reducedMotion,
        view3d: this.state.view === '3d',
        materialId: this.state.materialId,
        overlays: { ...this.state.overlays },
        teacherShowAnswers: this.state.preferences.teacherShowAnswers,
      },
    })
  }

  private showToast(
    message: string,
    kind: 'info' | 'success' | 'warning' | 'danger' = 'info',
  ): void {
    const iconName =
      kind === 'success' ? 'check' : kind === 'danger' || kind === 'warning' ? 'warning' : 'info'
    const toast = el(
      'div',
      { class: `toast toast-${kind}`, role: 'status' },
      el('span', { class: 'toast-icon', html: icon(iconName, 17) }),
      el('span', { class: 'toast-text', text: message }),
    )
    this.els.toast.appendChild(toast)
    while (this.els.toast.children.length > 3) this.els.toast.firstElementChild?.remove()
    window.setTimeout(() => {
      toast.classList.add('is-leaving')
      window.setTimeout(() => toast.remove(), 240)
    }, 3800)
  }
}
