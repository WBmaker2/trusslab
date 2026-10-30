import type { AppState, Tool } from '../app/state'
import {
  MAX_HEIGHT_METERS,
  MAX_SPAN_METERS,
  VIEW_HEIGHT_METERS,
  VIEW_WIDTH_METERS,
} from '../struct/constants'
import { memberGeometry, nodeMap } from '../struct/geometry'
import type { MemberResult } from '../struct/types'
import { formatForceShort, formatLength, formatPercent } from '../struct/units'
import {
  type CanvasTransform,
  type Hit,
  hitTest,
  screenToWorld,
  worldToScreen,
} from '../editor/hitTest'
import { snapPoint } from '../editor/grid'
import { computeDisplayDeflection } from './Deflection'
import { failureMotion, mechanismWobble } from './FailureAnimation'
import { COLORS, memberBaseColor, typeLabel } from './StressColors'

const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif'
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export interface DesignCanvasCallbacks {
  getState: () => AppState
  onPrimaryAction: (hit: Hit | null, world: { x: number; y: number }) => void
  onNodeDragStart: (nodeId: number) => void
  onNodeDrag: (nodeId: number, x: number, y: number) => void
  onNodeDragEnd: (nodeId: number) => void
  onDeleteAt: (hit: Hit | null) => void
  onCursorMove: (world: { x: number; y: number } | null) => void
  onTransformChange: (zoom: number, scale: number) => void
  onAnnounce: (message: string) => void
  onToolShortcut: (tool: Tool) => void
  onEscape: () => void
}

interface Point {
  x: number
  y: number
}

interface DragState {
  nodeId: number
  start: Point
  origin: Point
  moved: boolean
}

interface PanState {
  start: Point
  startPan: Point
  moved: boolean
}

interface PinchState {
  distance: number
  center: Point
  zoom: number
  pan: Point
}

export class DesignCanvas {
  private canvas: HTMLCanvasElement
  private callbacks: DesignCanvasCallbacks
  private ctx: CanvasRenderingContext2D
  private width = 1
  private height = 1
  private dpr = 1
  private baseScale = 1
  private originX = 0
  private originY = 0
  private zoom = 1
  private panX = 0
  private panY = 0
  private hover: Hit | null = null
  private cursorWorld: Point | null = null
  private keyboardCursor: Point = { x: 6, y: 4 }
  private keyboardActive = false
  private drag: DragState | null = null
  private pan: PanState | null = null
  private pinch: PinchState | null = null
  private pointers = new Map<number, Point>()
  private suppressClick = false
  private dirty = true
  private raf = 0
  private destroyed = false
  private resizeObserver: ResizeObserver
  private lastResult: MemberResult[] | null = null
  private resultMap = new Map<number, MemberResult>()
  private deflectionCache: ReturnType<typeof computeDisplayDeflection> | null = null
  private deflectionSource: unknown = null

  constructor(canvas: HTMLCanvasElement, callbacks: DesignCanvasCallbacks) {
    this.canvas = canvas
    this.callbacks = callbacks
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context is not available')
    this.ctx = ctx
    this.canvas.tabIndex = 0
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel)
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave)
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    this.canvas.addEventListener('keydown', this.handleKeyDown)
    this.canvas.addEventListener('focus', this.handleFocus)
    this.canvas.addEventListener('blur', this.handleBlur)
    this.canvas.addEventListener('contextmenu', this.handleContextMenu)
    this.canvas.addEventListener('dblclick', this.handleDoubleClick)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.canvas)
    this.resize()
    this.loop()
  }

  getState(): AppState {
    return this.callbacks.getState()
  }

  getTransform(): CanvasTransform {
    return {
      scale: this.baseScale,
      originX: this.originX,
      originY: this.originY,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
    }
  }

  focus(): void {
    this.canvas.focus({ preventScroll: true })
  }

  fit(): void {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
    this.publishTransform()
    this.requestDraw()
  }

  zoomBy(factor: number, center?: Point): void {
    const point = center ?? { x: this.width / 2, y: this.height / 2 }
    this.zoomAt(point, factor)
  }

  requestDraw(): void {
    this.dirty = true
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel)
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    this.canvas.removeEventListener('keydown', this.handleKeyDown)
    this.canvas.removeEventListener('focus', this.handleFocus)
    this.canvas.removeEventListener('blur', this.handleBlur)
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick)
  }

  private handleFocus = (): void => {
    this.requestDraw()
    this.callbacks.onAnnounce(
      '설계 캔버스. 화살표 키로 커서를 움직이고 Enter로 놓습니다. M은 부재, N은 절점, V는 선택 도구입니다.',
    )
  }

  private handleBlur = (): void => {
    this.keyboardActive = false
    this.requestDraw()
  }

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private handleDoubleClick = (): void => {
    this.fit()
  }

  private publishTransform(): void {
    this.callbacks.onTransformChange(this.zoom, this.baseScale)
    this.updateDataset()
  }

  private updateDataset(): void {
    this.canvas.dataset.scale = this.baseScale.toFixed(5)
    this.canvas.dataset.originX = this.originX.toFixed(2)
    this.canvas.dataset.originY = this.originY.toFixed(2)
    this.canvas.dataset.zoom = this.zoom.toFixed(4)
    this.canvas.dataset.panX = this.panX.toFixed(2)
    this.canvas.dataset.panY = this.panY.toFixed(2)
    this.canvas.dataset.worldWidth = String(VIEW_WIDTH_METERS)
    this.canvas.dataset.worldHeight = String(VIEW_HEIGHT_METERS)
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.width = width
    this.height = height
    this.dpr = dpr
    const pixelWidth = Math.max(1, Math.round(width * dpr))
    const pixelHeight = Math.max(1, Math.round(height * dpr))
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth
      this.canvas.height = pixelHeight
    }
    const pad = Math.min(64, Math.max(44, Math.min(width, height) * 0.09))
    this.baseScale = Math.min(
      (width - pad * 2) / VIEW_WIDTH_METERS,
      (height - pad * 2) / VIEW_HEIGHT_METERS,
    )
    this.originX = (width - VIEW_WIDTH_METERS * this.baseScale) / 2
    this.originY = (height + VIEW_HEIGHT_METERS * this.baseScale) / 2
    this.publishTransform()
    this.requestDraw()
  }

  private localPoint(event: PointerEvent | WheelEvent | MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private hitAt(point: Point): Hit | null {
    return hitTest(this.getState().model, point.x, point.y, this.getTransform())
  }

  private updateCursorStyle(): void {
    const state = this.getState()
    if (this.drag || this.pan) {
      this.canvas.style.cursor = 'grabbing'
      return
    }
    if (this.pointers.size >= 2) {
      this.canvas.style.cursor = 'grabbing'
      return
    }
    if (state.tool === 'select') {
      this.canvas.style.cursor = this.hover ? 'pointer' : 'default'
      return
    }
    if (state.tool === 'delete') {
      this.canvas.style.cursor = 'crosshair'
      return
    }
    this.canvas.style.cursor = 'crosshair'
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.getState().view !== '2d') return
    event.preventDefault()
    const point = this.localPoint(event)
    this.pointers.set(event.pointerId, point)
    this.canvas.setPointerCapture(event.pointerId)
    this.keyboardActive = false
    this.canvas.focus({ preventScroll: true })

    if (this.pointers.size === 2) {
      this.suppressClick = true
      if (this.drag) {
        this.callbacks.onNodeDragEnd(this.drag.nodeId)
      }
      this.drag = null
      this.pan = null
      const [a, b] = [...this.pointers.values()]
      this.pinch = {
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        zoom: this.zoom,
        pan: { x: this.panX, y: this.panY },
      }
      this.updateCursorStyle()
      return
    }

    if (event.button === 1 || event.button === 2) {
      this.pan = { start: point, startPan: { x: this.panX, y: this.panY }, moved: false }
      this.updateCursorStyle()
      return
    }

    const state = this.getState()
    const hit = this.hitAt(point)
    if (state.tool === 'select') {
      if (hit?.kind === 'node') {
        const node = state.model.nodes.find((item) => item.id === hit.id)
        if (node) {
          this.drag = {
            nodeId: node.id,
            start: point,
            origin: { x: node.x, y: node.y },
            moved: false,
          }
          this.callbacks.onNodeDragStart(node.id)
        }
      } else if (!hit) {
        this.pan = { start: point, startPan: { x: this.panX, y: this.panY }, moved: false }
      }
    }
    this.updateCursorStyle()
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.getState().view !== '2d') return
    const point = this.localPoint(event)
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, point)

    if (this.pointers.size >= 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()]
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const nextZoom = Math.min(
        4,
        Math.max(0.5, this.pinch.zoom * (distance / this.pinch.distance)),
      )
      const ratio = nextZoom / this.pinch.zoom
      this.zoom = nextZoom
      this.panX =
        this.pinch.center.x -
        this.originX -
        (this.pinch.center.x - this.originX - this.pinch.pan.x) * ratio
      this.panY =
        this.pinch.center.y -
        this.originY -
        (this.pinch.center.y - this.originY - this.pinch.pan.y) * ratio
      this.panX += center.x - this.pinch.center.x
      this.panY += center.y - this.pinch.center.y
      this.publishTransform()
      this.requestDraw()
      return
    }

    if (this.drag) {
      const dx = point.x - this.drag.start.x
      const dy = point.y - this.drag.start.y
      if (!this.drag.moved && Math.hypot(dx, dy) > 3) {
        this.drag.moved = true
        this.updateCursorStyle()
      }
      if (this.drag.moved) {
        const world = screenToWorld(point.x, point.y, this.getTransform())
        const snapped = snapPoint(world.x, world.y)
        this.callbacks.onNodeDrag(this.drag.nodeId, snapped.x, snapped.y)
      }
    } else if (this.pan) {
      const dx = point.x - this.pan.start.x
      const dy = point.y - this.pan.start.y
      if (Math.hypot(dx, dy) > 3) this.pan.moved = true
      this.panX = this.pan.startPan.x + dx
      this.panY = this.pan.startPan.y + dy
      this.publishTransform()
      this.updateCursorStyle()
    }

    const transform = this.getTransform()
    const world = screenToWorld(point.x, point.y, transform)
    this.cursorWorld = world
    this.callbacks.onCursorMove(world)
    const hit = this.hitAt(point)
    const changed = hit?.kind !== this.hover?.kind || hit?.id !== this.hover?.id
    this.hover = hit
    if (changed) {
      this.updateCursorStyle()
      this.requestDraw()
    }
    if (this.drag || this.pan) this.requestDraw()
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId) && !this.drag && !this.pan && !this.pinch) return
    const point = this.localPoint(event)
    this.pointers.delete(event.pointerId)
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId)
    }

    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null
      if (this.pointers.size === 0) this.suppressClick = false
      this.updateCursorStyle()
      return
    }

    if (this.drag) {
      const drag = this.drag
      this.drag = null
      if (drag.moved) {
        this.callbacks.onNodeDragEnd(drag.nodeId)
      } else {
        const hit = this.hitAt(point)
        const world = screenToWorld(point.x, point.y, this.getTransform())
        this.callbacks.onPrimaryAction(hit, world)
      }
      this.updateCursorStyle()
      this.requestDraw()
      return
    }

    if (this.pan) {
      const pan = this.pan
      this.pan = null
      if (!pan.moved && event.button === 0) {
        const world = screenToWorld(point.x, point.y, this.getTransform())
        this.callbacks.onPrimaryAction(null, world)
      }
      this.updateCursorStyle()
      this.requestDraw()
      return
    }

    if (event.button === 0 && !this.suppressClick && this.pointers.size === 0) {
      const hit = this.hitAt(point)
      const world = screenToWorld(point.x, point.y, this.getTransform())
      this.callbacks.onPrimaryAction(hit, world)
    }
    if (this.pointers.size === 0) this.suppressClick = false
    this.updateCursorStyle()
    this.requestDraw()
  }

  private handlePointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId)
    this.drag = null
    this.pan = null
    this.pinch = null
    this.suppressClick = false
    this.updateCursorStyle()
    this.requestDraw()
  }

  private handlePointerLeave = (): void => {
    if (this.pointers.size > 0) return
    this.hover = null
    this.cursorWorld = null
    this.callbacks.onCursorMove(null)
    this.updateCursorStyle()
    this.requestDraw()
  }

  private handleWheel = (event: WheelEvent): void => {
    if (this.getState().view !== '2d') return
    event.preventDefault()
    const point = this.localPoint(event)
    const factor = Math.exp(-event.deltaY * 0.0015)
    this.zoomAt(point, factor)
  }

  private zoomAt(point: Point, factor: number): void {
    const nextZoom = Math.min(4, Math.max(0.5, this.zoom * factor))
    const ratio = nextZoom / this.zoom
    this.panX = point.x - this.originX - (point.x - this.originX - this.panX) * ratio
    this.panY = point.y - this.originY - (point.y - this.originY - this.panY) * ratio
    this.zoom = nextZoom
    this.publishTransform()
    this.requestDraw()
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key
    this.keyboardActive = true

    if (key.startsWith('Arrow')) {
      event.preventDefault()
      const step = event.shiftKey ? 0.5 : 1
      if (key === 'ArrowLeft') this.keyboardCursor.x = Math.max(0, this.keyboardCursor.x - step)
      if (key === 'ArrowRight')
        this.keyboardCursor.x = Math.min(MAX_SPAN_METERS, this.keyboardCursor.x + step)
      if (key === 'ArrowUp')
        this.keyboardCursor.y = Math.min(MAX_HEIGHT_METERS, this.keyboardCursor.y + step)
      if (key === 'ArrowDown') this.keyboardCursor.y = Math.max(0, this.keyboardCursor.y - step)
      this.callbacks.onAnnounce(
        `커서 ${this.keyboardCursor.x.toFixed(1)} m, ${this.keyboardCursor.y.toFixed(1)} m`,
      )
      this.requestDraw()
      return
    }

    const cursorScreen = worldToScreen(
      this.keyboardCursor.x,
      this.keyboardCursor.y,
      this.getTransform(),
    )
    const hit = this.hitAt(cursorScreen)

    if (key === 'Enter') {
      event.preventDefault()
      this.callbacks.onPrimaryAction(hit, this.keyboardCursor)
      return
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault()
      this.callbacks.onDeleteAt(hit)
      return
    }
    if (key === 'Escape') {
      event.preventDefault()
      this.callbacks.onEscape()
      return
    }
    if (key === 'f' || key === 'F') {
      event.preventDefault()
      this.fit()
      return
    }
    if (key === '+' || key === '=') {
      event.preventDefault()
      this.zoomBy(1.2)
      return
    }
    if (key === '-' || key === '_') {
      event.preventDefault()
      this.zoomBy(1 / 1.2)
      return
    }

    const shortcuts: Record<string, Tool> = {
      v: 'select',
      n: 'node',
      m: 'member',
      p: 'pin',
      r: 'roller',
      l: 'load',
      d: 'delete',
    }
    const tool = shortcuts[key.toLowerCase()]
    if (tool) {
      event.preventDefault()
      this.callbacks.onToolShortcut(tool)
    }
  }

  private loop = (): void => {
    if (this.destroyed) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    const now = performance.now()
    const state = this.getState()
    const failure = state.test.result?.failure ?? null
    const failureAnimating =
      state.test.status === 'done' &&
      failure !== null &&
      state.test.completedAt !== null &&
      now - state.test.completedAt < 1300 &&
      !state.preferences.reducedMotion
    const unstableWobble =
      state.analysis.determinacy.status === 'unstable' &&
      state.model.members.length > 0 &&
      !state.preferences.reducedMotion
    const animating = state.test.status === 'running' || failureAnimating || unstableWobble
    if (this.dirty || animating) {
      this.dirty = false
      this.draw(now)
    }
  }

  private getDeflection(state: AppState) {
    const result = state.analysis.result
    if (this.deflectionSource === result && this.deflectionCache) return this.deflectionCache
    this.deflectionSource = result
    this.deflectionCache = computeDisplayDeflection(result)
    return this.deflectionCache
  }

  private getResultMap(state: AppState): Map<number, MemberResult> {
    const members = state.analysis.result?.members ?? null
    if (members !== this.lastResult) {
      this.lastResult = members
      this.resultMap = new Map((members ?? []).map((member) => [member.memberId, member]))
    }
    return this.resultMap
  }

  private testScale(state: AppState): { scale: number; active: boolean } {
    const test = state.test
    if (test.status === 'running') {
      const failure = test.result?.failure
      const limit = failure ? failure.scale : 1
      return { scale: test.progress * limit, active: true }
    }
    if (test.status === 'done') {
      const failure = test.result?.failure
      return { scale: failure ? failure.scale : 1, active: true }
    }
    return { scale: 0, active: false }
  }

  private draw(now: number): void {
    const ctx = this.ctx
    const state = this.getState()
    if (state.view !== '2d') return
    const t = this.getTransform()
    const scale = t.scale * t.zoom
    const dpr = this.dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)

    const bg = ctx.createLinearGradient(0, 0, this.width, this.height)
    bg.addColorStop(0, '#fbf9f2')
    bg.addColorStop(1, '#f3efe5')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, this.width, this.height)

    const sheetTop = t.originY + t.panY - VIEW_HEIGHT_METERS * scale
    const sheetLeft = t.originX + t.panX
    const sheetWidth = VIEW_WIDTH_METERS * scale
    const sheetHeight = VIEW_HEIGHT_METERS * scale

    ctx.save()
    ctx.shadowColor = 'rgba(23, 35, 33, 0.08)'
    ctx.shadowBlur = 22
    ctx.shadowOffsetY = 8
    ctx.fillStyle = COLORS.sheet
    ctx.fillRect(sheetLeft, sheetTop, sheetWidth, sheetHeight)
    ctx.restore()

    if (state.overlays.grid) this.drawGrid(state, scale)
    this.drawTicks(scale)
    this.drawSheetBorder(sheetLeft, sheetTop, sheetWidth, sheetHeight)

    const transform = this.getTransform()
    const deflection = this.getDeflection(state)
    const testScale = this.testScale(state)
    const isTest = state.route === 'test'
    const deflectionActive =
      deflection.available && (isTest ? testScale.active : state.overlays.deflection)
    const deflectionProgress = isTest ? testScale.scale : 1
    const reduced = state.preferences.reducedMotion
    const positions = new Map<number, Point>()
    for (const node of state.model.nodes) {
      let x = node.x
      let y = node.y
      if (deflectionActive) {
        const entry = deflection.entries.get(node.id)
        if (entry) {
          x += entry.dx * deflection.factor * deflectionProgress
          y += entry.dy * deflection.factor * deflectionProgress
        }
      }
      positions.set(node.id, { x, y })
    }

    const unstable =
      state.analysis.determinacy.status === 'unstable' && state.model.members.length > 0
    const wobble = unstable ? mechanismWobble(now, reduced) : 0
    if (wobble !== 0) {
      for (const node of state.model.nodes) {
        const position = positions.get(node.id)
        if (!position) continue
        position.x += wobble * (node.y / MAX_HEIGHT_METERS)
      }
    }

    if (deflectionActive) {
      this.drawStructure(state, positions, transform, {
        ghost: true,
        resultMap: this.getResultMap(state),
      })
    }

    const motion =
      isTest && state.test.status === 'done' && state.test.result?.failure
        ? failureMotion(now, state.test.completedAt, reduced)
        : null

    this.drawStructure(state, positions, transform, {
      ghost: false,
      resultMap: this.getResultMap(state),
      failureId: state.test.result?.failure?.memberId ?? null,
      motion,
      unstable,
    })

    this.drawSupports(state, positions, transform)
    this.drawLoads(state, positions, transform)
    if (state.overlays.forces && state.analysis.result) {
      this.drawReactions(state, positions, transform)
    }
    this.drawNodes(state, positions, transform)

    if (state.overlays.labels || state.overlays.forces || state.overlays.stress) {
      this.drawMemberLabels(state, positions, transform)
    }
    this.drawLoadLabels(state, positions, transform)

    if (state.pendingMemberFrom !== null) {
      this.drawPendingMember(state, positions, transform)
    }

    if (unstable) {
      this.drawMechanismBadge(state, transform)
    }

    if (this.keyboardActive) {
      this.drawKeyboardCursor(state, transform)
    }

    if (state.model.nodes.length === 0) {
      this.drawEmptyState(transform)
    }

    const failed = state.test.result?.failure
    if (isTest && failed && motion?.broken) {
      this.drawFailureCallout(state, positions, transform, failed.memberId, motion.phase)
    }

    this.updateDataset()
    this.canvas.dataset.cursorX = this.cursorWorld ? this.cursorWorld.x.toFixed(2) : ''
    this.canvas.dataset.cursorY = this.cursorWorld ? this.cursorWorld.y.toFixed(2) : ''
  }

  private drawGrid(state: AppState, scale: number): void {
    const ctx = this.ctx
    const t = this.getTransform()
    const left = t.originX + t.panX
    const top = t.originY + t.panY - VIEW_HEIGHT_METERS * scale
    ctx.save()
    ctx.beginPath()
    ctx.rect(left, top, VIEW_WIDTH_METERS * scale, VIEW_HEIGHT_METERS * scale)
    ctx.clip()
    for (let x = 1; x < VIEW_WIDTH_METERS; x += 1) {
      const screen = worldToScreen(x, 0, t)
      ctx.beginPath()
      ctx.strokeStyle = x % 5 === 0 ? '#ddd6c6' : COLORS.grid
      ctx.lineWidth = x % 5 === 0 ? 1.1 : 0.8
      ctx.moveTo(screen.x, top)
      ctx.lineTo(screen.x, top + VIEW_HEIGHT_METERS * scale)
      ctx.stroke()
    }
    for (let y = 1; y < VIEW_HEIGHT_METERS; y += 1) {
      const screen = worldToScreen(0, y, t)
      ctx.beginPath()
      ctx.strokeStyle = y % 5 === 0 ? '#ddd6c6' : COLORS.grid
      ctx.lineWidth = y % 5 === 0 ? 1.1 : 0.8
      ctx.moveTo(left, screen.y)
      ctx.lineTo(left + VIEW_WIDTH_METERS * scale, screen.y)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(23,35,33,0.10)'
    ctx.lineWidth = 1
    const origin = worldToScreen(0, 0, t)
    ctx.beginPath()
    ctx.moveTo(left, origin.y)
    ctx.lineTo(left + VIEW_WIDTH_METERS * scale, origin.y)
    ctx.stroke()
    const yAxis = worldToScreen(0, 0, t)
    ctx.beginPath()
    ctx.moveTo(yAxis.x, top)
    ctx.lineTo(yAxis.x, top + VIEW_HEIGHT_METERS * scale)
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = 'rgba(23,35,33,0.05)'
    const step = scale
    if (step > 34) {
      for (let x = 0; x <= VIEW_WIDTH_METERS; x += 1) {
        for (let y = 0; y <= VIEW_HEIGHT_METERS; y += 1) {
          const screen = worldToScreen(x, y, t)
          ctx.beginPath()
          ctx.arc(screen.x, screen.y, 1.1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    if (state.overlays.grid) {
      ctx.strokeStyle = 'rgba(23,35,33,0.08)'
      ctx.lineWidth = 1
      ctx.strokeRect(
        left + 0.5,
        top + 0.5,
        VIEW_WIDTH_METERS * scale - 1,
        VIEW_HEIGHT_METERS * scale - 1,
      )
    }
  }

  private drawTicks(scale: number): void {
    const ctx = this.ctx
    const t = this.getTransform()
    ctx.save()
    ctx.font = `500 9.5px ${FONT_MONO}`
    ctx.fillStyle = 'rgba(60,74,69,0.58)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let x = 0; x <= VIEW_WIDTH_METERS; x += 1) {
      if (x % 2 !== 0 && scale < 36) continue
      const screen = worldToScreen(x, VIEW_HEIGHT_METERS, t)
      ctx.fillText(String(x), screen.x, screen.y + 5)
    }
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let y = 0; y <= VIEW_HEIGHT_METERS; y += 1) {
      if (y % 2 !== 0 && scale < 44) continue
      const screen = worldToScreen(0, y, t)
      ctx.fillText(String(y), screen.x - 10, screen.y)
    }
    ctx.restore()
  }

  private drawSheetBorder(left: number, top: number, width: number, height: number): void {
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = 'rgba(23,35,33,0.28)'
    ctx.lineWidth = 1.2
    ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1)
    const mark = 10
    ctx.strokeStyle = 'rgba(200,69,31,0.7)'
    ctx.lineWidth = 1.4
    const corners: Array<[number, number, number, number]> = [
      [left, top, 1, 1],
      [left + width, top, -1, 1],
      [left, top + height, 1, -1],
      [left + width, top + height, -1, -1],
    ]
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath()
      ctx.moveTo(x + dx * mark, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y + dy * mark)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawStructure(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
    options: {
      ghost: boolean
      resultMap: Map<number, MemberResult>
      failureId?: number | null
      motion?: ReturnType<typeof failureMotion> | null
      unstable?: boolean
    },
  ): void {
    const ctx = this.ctx
    const nodes = nodeMap(state.model)
    for (const member of state.model.members) {
      const geometry = memberGeometry(member, nodes)
      if (!geometry) continue
      const a = positions.get(member.a)
      const b = positions.get(member.b)
      if (!a || !b) continue
      const result = options.resultMap.get(member.id)
      const aScreen = worldToScreen(a.x, a.y, transform)
      const bScreen = worldToScreen(b.x, b.y, transform)
      const isFailed = options.failureId === member.id
      const motion = isFailed ? options.motion : null

      let ax = aScreen.x
      let ay = aScreen.y
      let bx = bScreen.x
      let by = bScreen.y
      if (motion && motion.shake !== 0) {
        const dx = bx - ax
        const dy = by - ay
        const length = Math.hypot(dx, dy) || 1
        const nx = -dy / length
        const ny = dx / length
        const shake = motion.shake * 7
        ax += nx * shake
        ay += ny * shake
        bx += nx * shake
        by += ny * shake
      }

      if (options.ghost) {
        ctx.save()
        ctx.globalAlpha = 0.3
        ctx.strokeStyle = 'rgba(23,35,33,0.42)'
        ctx.lineWidth = 1.2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
        ctx.restore()
        continue
      }

      const selected = state.selection.kind === 'member' && state.selection.id === member.id
      const hovered = this.hover?.kind === 'member' && this.hover.id === member.id
      const color = memberBaseColor(result)
      const width =
        result === undefined ? 2.4 : 2.6 + Math.min(2.2, Math.max(0, result.utilization) * 2.1)
      const isZero = result?.zeroForce ?? false

      ctx.save()
      if (selected) {
        ctx.strokeStyle = 'rgba(199,149,44,0.34)'
        ctx.lineWidth = width + 9
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      } else if (hovered) {
        ctx.strokeStyle = 'rgba(23,35,33,0.12)'
        ctx.lineWidth = width + 7
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }

      ctx.strokeStyle = COLORS.sheet
      ctx.lineWidth = width + 3
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()

      if (isFailed) {
        ctx.shadowColor = 'rgba(180,35,24,0.45)'
        ctx.shadowBlur = 10
      } else if (result?.state === 'warning') {
        ctx.shadowColor = 'rgba(161,98,7,0.32)'
        ctx.shadowBlur = 7
      }
      ctx.strokeStyle = color
      ctx.lineWidth = isFailed ? 5 : width
      if (isZero) {
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 2.5
      }
      if (motion?.broken) {
        const mx = (ax + bx) / 2
        const my = (ay + by) / 2
        const dx = bx - ax
        const dy = by - ay
        const length = Math.hypot(dx, dy) || 1
        const gap = 5 + motion.phase * 17
        const ux = dx / length
        const uy = dy / length
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(mx - ux * gap, my - uy * gap)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(mx + ux * gap, my + uy * gap + motion.drop * 15)
        ctx.lineTo(bx, by + motion.drop * 15)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }
      ctx.restore()

      if (isFailed) {
        const mx = (ax + bx) / 2
        const my = (ay + by) / 2
        ctx.save()
        ctx.fillStyle = COLORS.failed
        ctx.beginPath()
        ctx.arc(mx, my - 1, 7.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = COLORS.white
        ctx.font = `700 10px ${FONT_SANS}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('!', mx, my - 0.5)
        ctx.restore()
      }
    }
  }

  private drawSupports(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
  ): void {
    const ctx = this.ctx
    for (const node of state.model.nodes) {
      if (node.support === 'free') continue
      const position = positions.get(node.id)
      if (!position) continue
      const screen = worldToScreen(position.x, position.y, transform)
      const x = screen.x
      const y = screen.y
      ctx.save()
      ctx.strokeStyle = COLORS.inkSoft
      ctx.fillStyle = COLORS.sheet
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, y + 8)
      ctx.lineTo(x - 10, y + 22)
      ctx.lineTo(x + 10, y + 22)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      if (node.support === 'roller') {
        ctx.beginPath()
        ctx.arc(x - 4, y + 26, 2.6, 0, Math.PI * 2)
        ctx.arc(x + 4, y + 26, 2.6, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.sheet
        ctx.fill()
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - 15, y + 31)
        ctx.lineTo(x + 15, y + 31)
        ctx.stroke()
        for (let i = -12; i <= 12; i += 6) {
          ctx.beginPath()
          ctx.moveTo(x + i, y + 31)
          ctx.lineTo(x + i - 4, y + 36)
          ctx.stroke()
        }
      } else {
        ctx.beginPath()
        ctx.moveTo(x - 15, y + 22)
        ctx.lineTo(x + 15, y + 22)
        ctx.stroke()
        for (let i = -12; i <= 12; i += 6) {
          ctx.beginPath()
          ctx.moveTo(x + i, y + 22)
          ctx.lineTo(x + i - 4, y + 27)
          ctx.stroke()
        }
      }
      ctx.restore()
    }
  }

  private drawLoads(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
  ): void {
    const ctx = this.ctx
    for (const load of state.model.loads) {
      const node = state.model.nodes.find((item) => item.id === load.nodeId)
      const position = positions.get(load.nodeId)
      if (!node || !position) continue
      const magnitude = Math.hypot(load.fx, load.fy)
      if (magnitude < 0.01) continue
      const screen = worldToScreen(position.x, position.y, transform)
      const dirX = load.fx / magnitude
      const dirY = -load.fy / magnitude
      const length = 30 + Math.min(20, Math.log10(Math.max(10, magnitude) / 100) * 9)
      const tail = { x: screen.x - dirX * length, y: screen.y - dirY * length }
      const head = { x: screen.x - dirX * 4, y: screen.y - dirY * 4 }
      ctx.save()
      ctx.strokeStyle = COLORS.accent
      ctx.fillStyle = COLORS.accent
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(tail.x, tail.y)
      ctx.lineTo(head.x, head.y)
      ctx.stroke()
      const angle = Math.atan2(head.y - tail.y, head.x - tail.x)
      ctx.beginPath()
      ctx.moveTo(head.x, head.y)
      ctx.lineTo(
        head.x - 8 * Math.cos(angle - Math.PI / 7),
        head.y - 8 * Math.sin(angle - Math.PI / 7),
      )
      ctx.lineTo(
        head.x - 8 * Math.cos(angle + Math.PI / 7),
        head.y - 8 * Math.sin(angle + Math.PI / 7),
      )
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  private drawLoadLabels(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
  ): void {
    const ctx = this.ctx
    for (const load of state.model.loads) {
      const position = positions.get(load.nodeId)
      if (!position) continue
      const magnitude = Math.hypot(load.fx, load.fy)
      if (magnitude < 0.01) continue
      const screen = worldToScreen(position.x, position.y, transform)
      const dirX = load.fx / magnitude
      const dirY = -load.fy / magnitude
      const length = 30 + Math.min(20, Math.log10(Math.max(10, magnitude) / 100) * 9)
      const tail = { x: screen.x - dirX * length, y: screen.y - dirY * length }
      const text = formatForceShort(magnitude)
      ctx.save()
      ctx.font = `700 10px ${FONT_MONO}`
      const width = ctx.measureText(text).width + 12
      const x = Math.min(this.width - width - 5, Math.max(5, tail.x + (dirX >= 0 ? -width : 0)))
      const y = Math.min(this.height - 22, Math.max(5, tail.y + (dirY >= 0 ? -24 : 10)))
      ctx.fillStyle = 'rgba(255, 247, 239, 0.96)'
      ctx.strokeStyle = 'rgba(200,69,31,0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(x, y, width, 19, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = COLORS.accentDark
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x + width / 2, y + 10)
      ctx.restore()
    }
  }

  private drawReactions(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
  ): void {
    const result = state.analysis.result
    if (!result) return
    const ctx = this.ctx
    for (const reaction of result.reactions) {
      const magnitude = Math.hypot(reaction.fx, reaction.fy)
      if (magnitude < 1) continue
      const position = positions.get(reaction.nodeId)
      if (!position) continue
      const screen = worldToScreen(position.x, position.y, transform)
      const dirX = reaction.fx / magnitude
      const dirY = -reaction.fy / magnitude
      const length = 25
      const tail = { x: screen.x - dirX * length, y: screen.y - dirY * length }
      const head = { x: screen.x - dirX * 6, y: screen.y - dirY * 6 }
      ctx.save()
      ctx.strokeStyle = 'rgba(47,111,78,0.8)'
      ctx.fillStyle = 'rgba(47,111,78,0.9)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(tail.x, tail.y)
      ctx.lineTo(head.x, head.y)
      ctx.stroke()
      const angle = Math.atan2(head.y - tail.y, head.x - tail.x)
      ctx.beginPath()
      ctx.moveTo(head.x, head.y)
      ctx.lineTo(
        head.x - 6 * Math.cos(angle - Math.PI / 6),
        head.y - 6 * Math.sin(angle - Math.PI / 6),
      )
      ctx.lineTo(
        head.x - 6 * Math.cos(angle + Math.PI / 6),
        head.y - 6 * Math.sin(angle + Math.PI / 6),
      )
      ctx.closePath()
      ctx.fill()
      if (state.overlays.labels) {
        ctx.font = `600 9px ${FONT_MONO}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'rgba(47,111,78,0.9)'
        ctx.fillText(`R ${formatForceShort(magnitude)}`, tail.x, tail.y + 5)
      }
      ctx.restore()
    }
  }

  private drawNodes(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
  ): void {
    const ctx = this.ctx
    for (const node of state.model.nodes) {
      const position = positions.get(node.id)
      if (!position) continue
      const screen = worldToScreen(position.x, position.y, transform)
      const selected = state.selection.kind === 'node' && state.selection.id === node.id
      const hovered = this.hover?.kind === 'node' && this.hover.id === node.id
      const load = state.model.loads.some((item) => item.nodeId === node.id)
      ctx.save()
      if (selected || hovered) {
        ctx.fillStyle = selected ? 'rgba(199,149,44,0.3)' : 'rgba(23,35,33,0.10)'
        ctx.beginPath()
        ctx.arc(screen.x, screen.y, selected ? 13 : 10, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = load ? COLORS.sheet : COLORS.white
      ctx.strokeStyle = selected ? COLORS.gold : COLORS.ink
      ctx.lineWidth = selected ? 2.2 : 1.7
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, 5.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (node.support !== 'free') {
        ctx.fillStyle = COLORS.ink
        ctx.beginPath()
        ctx.arc(screen.x, screen.y, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      if (state.overlays.labels) {
        ctx.font = `600 9px ${FONT_MONO}`
        ctx.fillStyle = 'rgba(23,35,33,0.6)'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`N${node.id}`, screen.x + 8, screen.y - 7)
      }
      ctx.restore()
    }
  }

  private drawMemberLabels(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
  ): void {
    const ctx = this.ctx
    const resultMap = this.getResultMap(state)
    const nodes = nodeMap(state.model)
    const showForces = state.overlays.forces
    const showLengths = state.overlays.labels
    const showStress = state.overlays.stress
    for (const member of state.model.members) {
      const geometry = memberGeometry(member, nodes)
      if (!geometry) continue
      const a = positions.get(member.a)
      const b = positions.get(member.b)
      if (!a || !b) continue
      const aScreen = worldToScreen(a.x, a.y, transform)
      const bScreen = worldToScreen(b.x, b.y, transform)
      const screenLength = Math.hypot(bScreen.x - aScreen.x, bScreen.y - aScreen.y)
      const selected = state.selection.kind === 'member' && state.selection.id === member.id
      if ((this.width < 560 || window.innerWidth < 1024) && !selected) continue
      if (screenLength < 40 && !selected) continue
      const result = resultMap.get(member.id)
      if (!result && !showLengths && !selected) continue
      const parts: string[] = []
      if (showLengths || selected) parts.push(`M${member.id}`)
      if (result && (showForces || selected)) {
        if (result.zeroForce) {
          parts.push('0 N')
        } else {
          parts.push(
            `${typeLabel(result.force, result.zeroForce)} ${formatForceShort(result.force)}`,
          )
        }
      }
      if ((showStress || selected) && result && !result.zeroForce) {
        parts.push(formatPercent(result.utilization, 0))
      }
      if (showLengths) parts.push(formatLength(geometry.length))
      if (parts.length === 0) continue
      const text = parts.join(' · ')
      const mx = (aScreen.x + bScreen.x) / 2
      const my = (aScreen.y + bScreen.y) / 2
      const dx = bScreen.x - aScreen.x
      const dy = bScreen.y - aScreen.y
      const length = Math.hypot(dx, dy) || 1
      let nx = -dy / length
      let ny = dx / length
      const steep = Math.abs(ny) > 0.5
      if (steep && member.id % 2 === 0) {
        nx = -nx
        ny = -ny
      } else if (ny > 0 || (ny === 0 && nx < 0)) {
        nx = -nx
        ny = -ny
      }
      const px = mx + nx * 15
      const py = my + ny * 15
      ctx.save()
      ctx.font = `600 10px ${FONT_MONO}`
      const textWidth = ctx.measureText(text).width
      const width = textWidth + 14
      const height = 18
      const x = Math.min(this.width - width - 4, Math.max(4, px - width / 2))
      const y = Math.min(this.height - height - 4, Math.max(4, py - height / 2))
      const failed = result?.state === 'failed'
      const warning = result?.state === 'warning'
      ctx.fillStyle = failed ? COLORS.failedSoft : COLORS.sheet
      ctx.strokeStyle = failed
        ? 'rgba(180,35,24,0.6)'
        : warning
          ? 'rgba(161,98,7,0.55)'
          : 'rgba(23,35,33,0.16)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, 5)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = failed ? COLORS.failed : COLORS.ink
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x + width / 2, y + height / 2 + 0.5)
      ctx.restore()
    }
  }

  private drawPendingMember(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
  ): void {
    const from = state.pendingMemberFrom
    if (from === null) return
    const node = state.model.nodes.find((item) => item.id === from)
    const position = positions.get(from)
    if (!node || !position) return
    const a = worldToScreen(position.x, position.y, transform)
    let target: Point
    if (this.hover?.kind === 'node' && this.hover.id !== from) {
      const hoverNode = state.model.nodes.find((item) => item.id === this.hover?.id)
      const hoverPosition = hoverNode ? positions.get(hoverNode.id) : null
      if (!hoverPosition) return
      target = worldToScreen(hoverPosition.x, hoverPosition.y, transform)
    } else if (this.cursorWorld) {
      target = worldToScreen(this.cursorWorld.x, this.cursorWorld.y, transform)
    } else {
      return
    }
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = COLORS.gold
    ctx.lineWidth = 1.8
    ctx.setLineDash([6, 5])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(target.x, target.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(199,149,44,0.25)'
    ctx.beginPath()
    ctx.arc(a.x, a.y, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = COLORS.gold
    ctx.beginPath()
    ctx.arc(target.x, target.y, 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  private drawKeyboardCursor(state: AppState, transform: CanvasTransform): void {
    const ctx = this.ctx
    const screen = worldToScreen(this.keyboardCursor.x, this.keyboardCursor.y, transform)
    ctx.save()
    ctx.strokeStyle = 'rgba(199,149,44,0.9)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(screen.x - 12, screen.y)
    ctx.lineTo(screen.x + 12, screen.y)
    ctx.moveTo(screen.x, screen.y - 12)
    ctx.lineTo(screen.x, screen.y + 12)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.gold
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2)
    ctx.fill()
    const text =
      state.tool === 'member' && state.pendingMemberFrom !== null
        ? '연결할 절점에서 Enter'
        : `${this.keyboardCursor.x.toFixed(1)}, ${this.keyboardCursor.y.toFixed(1)} m`
    ctx.font = `600 10px ${FONT_MONO}`
    const width = ctx.measureText(text).width + 12
    ctx.fillStyle = 'rgba(23,35,33,0.88)'
    ctx.beginPath()
    ctx.roundRect(screen.x + 14, screen.y - 26, width, 19, 4)
    ctx.fill()
    ctx.fillStyle = '#f8f3e6'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, screen.x + 20, screen.y - 16)
    ctx.restore()
  }

  private drawMechanismBadge(state: AppState, transform: CanvasTransform): void {
    const ctx = this.ctx
    let minX = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of state.model.nodes) {
      minX = Math.min(minX, node.x)
      maxX = Math.max(maxX, node.x)
      maxY = Math.max(maxY, node.y)
    }
    if (!Number.isFinite(minX)) return
    const center = worldToScreen((minX + maxX) / 2, maxY, transform)
    const text = '기구 · 형태 유지 불가'
    ctx.save()
    ctx.font = `700 10px ${FONT_SANS}`
    const width = ctx.measureText(text).width + 18
    ctx.fillStyle = 'rgba(180,35,24,0.92)'
    ctx.beginPath()
    ctx.roundRect(center.x - width / 2, center.y - 46, width, 22, 6)
    ctx.fill()
    ctx.fillStyle = '#fff5f1'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, center.x, center.y - 34.5)
    ctx.restore()
  }

  private drawEmptyState(transform: CanvasTransform): void {
    const ctx = this.ctx
    const center = worldToScreen(VIEW_WIDTH_METERS / 2, VIEW_HEIGHT_METERS / 2 + 0.4, transform)
    ctx.save()
    ctx.strokeStyle = 'rgba(23,35,33,0.18)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([6, 6])
    const size = 70
    ctx.beginPath()
    ctx.moveTo(center.x, center.y - size)
    ctx.lineTo(center.x - size, center.y + size * 0.62)
    ctx.lineTo(center.x + size, center.y + size * 0.62)
    ctx.closePath()
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(23,35,33,0.12)'
    for (const [dx, dy] of [
      [0, -size],
      [-size, size * 0.62],
      [size, size * 0.62],
    ]) {
      ctx.beginPath()
      ctx.arc(center.x + dx, center.y + dy, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.font = `600 12px ${FONT_SANS}`
    ctx.fillStyle = COLORS.inkSoft
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('빈 캔버스', center.x, center.y + size + 2)
    ctx.font = `500 11px ${FONT_SANS}`
    ctx.fillStyle = 'rgba(60,74,69,0.7)'
    ctx.fillText(
      '절점 도구(N)를 고르고 격자를 클릭하거나, 미션에서 시작하세요.',
      center.x,
      center.y + size + 23,
    )
    ctx.restore()
  }

  private drawFailureCallout(
    state: AppState,
    positions: Map<number, Point>,
    transform: CanvasTransform,
    memberId: number,
    phase: number,
  ): void {
    const member = state.model.members.find((item) => item.id === memberId)
    if (!member) return
    const a = positions.get(member.a)
    const b = positions.get(member.b)
    if (!a || !b) return
    const aScreen = worldToScreen(a.x, a.y, transform)
    const bScreen = worldToScreen(b.x, b.y, transform)
    const x = (aScreen.x + bScreen.x) / 2
    const y = (aScreen.y + bScreen.y) / 2
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = Math.min(1, phase * 2)
    ctx.fillStyle = 'rgba(180,35,24,0.95)'
    const text = '파괴'
    ctx.font = `700 10px ${FONT_SANS}`
    const width = ctx.measureText(text).width + 16
    ctx.beginPath()
    ctx.roundRect(x - width / 2, y - 40, width, 20, 5)
    ctx.fill()
    ctx.fillStyle = '#fff5f1'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y - 29.5)
    ctx.restore()
  }
}
