import * as THREE from 'three'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { AppState } from '../app/state'
import type { MemberResult, TrussModel } from '../struct/types'
import { formatForceShort, formatPercent } from '../struct/units'
import {
  computeDisplayDeflection,
  deflectionFactorLabel,
  type DisplayDeflection,
} from './Deflection'
import { failureMotion } from './FailureAnimation'
import { COLORS, memberBaseColor, typeLabel } from './StressColors'
import { CameraRig } from './CameraRig'

const UP = new THREE.Vector3(0, 1, 0)

interface MemberVisual {
  memberId: number
  a: number
  b: number
  radius: number
  geometry: THREE.BufferGeometry
  material: THREE.MeshStandardMaterial
  meshes: THREE.Mesh[]
  label: CSS2DObject | null
}

interface LoadVisual {
  nodeId: number
  arrow: THREE.ArrowHelper
  label: CSS2DObject
  direction: THREE.Vector3
  offset: number
}

function makeDeckTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#cfb68d')
  gradient.addColorStop(0.5, '#c3a97d')
  gradient.addColorStop(1, '#b79a6e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = 'rgba(82, 54, 27, 0.22)'
    ctx.fillRect(x, 0, 2, 256)
    ctx.fillStyle = 'rgba(255, 244, 220, 0.13)'
    ctx.fillRect(x + 2, 0, 2, 256)
  }
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 73) % 256
    const y = (i * 41) % 256
    ctx.strokeStyle = 'rgba(78, 52, 28, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + 10, y + 4, x + 18, y - 4, x + 30, y + 2)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 8)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export class BridgeView {
  private host: HTMLElement
  private getState: () => AppState
  private mounted = false
  private renderer: THREE.WebGLRenderer | null = null
  private labelRenderer: CSS2DRenderer | null = null
  private scene: THREE.Scene | null = null
  private rig: CameraRig | null = null
  private bridgeGroup = new THREE.Group()
  private deckTexture: THREE.CanvasTexture | null = null
  private memberVisuals: MemberVisual[] = []
  private loadVisuals: LoadVisual[] = []
  private labelElements: HTMLElement[] = []
  private nodeBase = new Map<number, THREE.Vector3>()
  private nodeDisplay = new Map<number, THREE.Vector3>()
  private deflection: DisplayDeflection = {
    factor: 20,
    entries: new Map(),
    maxMeters: 0,
    available: false,
  }
  private lastModel: TrussModel | null = null
  private lastResult: unknown = null
  private lastOverlayKey = ''
  private lastSelectionKey = ''
  private lastFrameKey = ''
  private emptyNote: HTMLDivElement | null = null
  private deflectionNote: HTMLDivElement | null = null
  private raf = 0
  private resizeObserver: ResizeObserver | null = null
  private tmpA = new THREE.Vector3()
  private tmpB = new THREE.Vector3()
  private tmpDir = new THREE.Vector3()
  private tmpMid = new THREE.Vector3()
  private tmpQuat = new THREE.Quaternion()
  private disposed = false

  constructor(host: HTMLElement, getState: () => AppState) {
    this.host = host
    this.getState = getState
  }

  mount(): void {
    if (this.mounted) return
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      })
    } catch {
      this.showFallback()
      return
    }
    this.mounted = true
    this.disposed = false
    const renderer = this.renderer
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.02
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.touchAction = 'none'
    this.host.replaceChildren()
    this.host.appendChild(renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    const labelDom = this.labelRenderer.domElement
    labelDom.style.position = 'absolute'
    labelDom.style.inset = '0'
    labelDom.style.pointerEvents = 'none'
    labelDom.style.overflow = 'hidden'
    this.host.appendChild(labelDom)

    this.emptyNote = document.createElement('div')
    this.emptyNote.className = 'scene-empty'
    this.emptyNote.textContent = '3D로 볼 구조가 없습니다. 2D에서 절점과 부재를 먼저 만드세요.'
    this.emptyNote.hidden = true
    this.host.appendChild(this.emptyNote)

    this.deflectionNote = document.createElement('div')
    this.deflectionNote.className = 'scene-deflection'
    this.deflectionNote.hidden = true
    this.host.appendChild(this.deflectionNote)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f1ede3')
    scene.fog = new THREE.Fog('#f1ede3', 32, 82)
    this.scene = scene

    const hemi = new THREE.HemisphereLight(0xfff7e8, 0x58645c, 1.35)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(9, 15, 11)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffd8bf, 0.65)
    fill.position.set(-10, 7, -8)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xbcd8d3, 0.45)
    rim.position.set(6, 5, -12)
    scene.add(rim)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: '#f1ede3', roughness: 1, metalness: 0 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.37
    scene.add(ground)

    const grid = new THREE.GridHelper(64, 64, 0xa99f8a, 0xcfc6b4)
    grid.position.y = -0.355
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    for (const material of gridMaterials) {
      material.transparent = true
      material.opacity = 0.68
    }
    scene.add(grid)

    this.deckTexture = makeDeckTexture()

    this.bridgeGroup = new THREE.Group()
    scene.add(this.bridgeGroup)
    this.rig = new CameraRig(renderer.domElement)
    this.rig.setSize(this.host.clientWidth || 1, this.host.clientHeight || 1)

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(this.host)
    this.handleResize()
    this.loop()
  }

  update(state: AppState): void {
    if (!this.mounted) return
    const overlayKey = `${state.overlays.labels}|${state.overlays.forces}|${state.overlays.stress}|${state.overlays.deflection}`
    const selectionKey = `${state.selection.kind}:${state.selection.id}`
    if (
      this.lastModel === state.model &&
      this.lastResult === state.analysis.result &&
      this.lastOverlayKey === overlayKey &&
      this.lastSelectionKey === selectionKey
    ) {
      return
    }
    this.lastModel = state.model
    this.lastResult = state.analysis.result
    this.lastOverlayKey = overlayKey
    this.lastSelectionKey = selectionKey
    this.rebuild(state)
  }

  setDirty(): void {
    this.lastModel = null
  }

  destroy(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.rig?.dispose()
    this.rig = null
    this.clearBridge()
    for (const element of this.labelElements) element.remove()
    this.labelElements = []
    this.emptyNote?.remove()
    this.deflectionNote?.remove()
    this.emptyNote = null
    this.deflectionNote = null
    this.deckTexture?.dispose()
    this.deckTexture = null
    if (this.scene) {
      const materials = new Set<THREE.Material>()
      this.scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (mesh.material) {
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const material of list) materials.add(material)
        }
      })
      for (const material of materials) material.dispose()
      this.scene.clear()
      this.scene = null
    }
    this.renderer?.dispose()
    if (this.renderer?.domElement.parentElement === this.host) {
      this.renderer.domElement.remove()
    }
    this.renderer = null
    this.labelRenderer?.domElement.remove()
    this.labelRenderer = null
    this.host.replaceChildren()
    this.mounted = false
  }

  private handleResize(): void {
    if (!this.renderer || !this.rig) return
    const width = Math.max(1, this.host.clientWidth)
    const height = Math.max(1, this.host.clientHeight)
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setSize(width, height, false)
    this.labelRenderer?.setSize(width, height)
    this.rig.setSize(width, height)
  }

  private loop = (): void => {
    if (!this.mounted || this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    const now = performance.now()
    this.rig?.update()
    this.updateScene(now)
    if (this.renderer && this.scene && this.rig) {
      this.renderer.render(this.scene, this.rig.camera)
    }
    this.labelRenderer?.render(this.scene!, this.rig!.camera)
  }

  private resultMap(state: AppState): Map<number, MemberResult> {
    return new Map(
      (state.analysis.result?.members ?? []).map((member) => [member.memberId, member]),
    )
  }

  private rebuild(state: AppState): void {
    if (!this.scene || !this.rig) return
    this.clearBridge()
    this.memberVisuals = []
    this.loadVisuals = []
    this.nodeBase.clear()
    this.nodeDisplay.clear()
    this.deflection = computeDisplayDeflection(state.analysis.result)
    const model = state.model
    const hasBridge = model.nodes.length > 0 && model.members.length > 0
    if (this.emptyNote) this.emptyNote.hidden = hasBridge
    if (!hasBridge) {
      this.lastFrameKey = ''
      this.rig.frame(6, 2, 6)
      return
    }

    const resultMap = this.resultMap(state)
    const supportNodes = model.nodes.filter((node) => node.support !== 'free')
    const spanNodes = supportNodes.length > 0 ? supportNodes : model.nodes
    const minX = Math.min(...spanNodes.map((node) => node.x))
    const maxX = Math.max(...spanNodes.map((node) => node.x))
    const maxY = Math.max(...model.nodes.map((node) => node.y))
    const centerX = (minX + maxX) / 2
    const deckSpan = Math.max(1, maxX - minX)

    for (const node of model.nodes) {
      const base = new THREE.Vector3(node.x, node.y, 0)
      this.nodeBase.set(node.id, base)
      this.nodeDisplay.set(node.id, base.clone())
    }

    this.buildDeck(centerX, deckSpan)
    this.buildMembers(state, resultMap)
    this.buildSupports(model)
    this.buildLoads(state)

    const frameHeight = Math.max(2, maxY + 1.2)
    const frameKey = `${centerX.toFixed(2)}:${deckSpan.toFixed(2)}:${maxY.toFixed(2)}`
    if (frameKey !== this.lastFrameKey) {
      this.lastFrameKey = frameKey
      this.rig.frame(centerX, frameHeight, Math.max(deckSpan, frameHeight * 1.1))
    }
  }

  private buildDeck(centerX: number, span: number): void {
    if (!this.scene || !this.deckTexture) return
    const deckMaterial = new THREE.MeshStandardMaterial({
      color: '#d1b78e',
      map: this.deckTexture,
      roughness: 0.78,
      metalness: 0.04,
    })
    const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 0.14, 1.9), deckMaterial)
    deck.position.set(centerX, -0.02, 0)
    this.bridgeGroup.add(deck)

    const trimMaterial = new THREE.MeshStandardMaterial({
      color: '#8f724c',
      roughness: 0.65,
      metalness: 0.08,
    })
    for (const z of [-0.96, 0.96]) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(span, 0.06, 0.05), trimMaterial.clone())
      trim.position.set(centerX, 0.04, z)
      this.bridgeGroup.add(trim)
    }
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: '#6d5638',
      roughness: 0.7,
    })
    for (let x = -span / 2 + 1; x < span / 2; x += 1) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 1.84), lineMaterial.clone())
      line.position.set(centerX + x, 0.052, 0)
      this.bridgeGroup.add(line)
    }
  }

  private buildMembers(state: AppState, resultMap: Map<number, MemberResult>): void {
    const model = state.model
    const selectedId = state.selection.kind === 'member' ? state.selection.id : null
    const ranked = [...resultMap.values()].sort((a, b) => b.utilization - a.utilization)
    const labelIds = new Set(ranked.slice(0, 14).map((member) => member.memberId))
    if (selectedId !== null) labelIds.add(selectedId)
    const failure = state.test.status === 'done' ? state.test.result?.failure : null
    const showLabels = state.overlays.labels || state.overlays.forces || state.overlays.stress
    const sides = [1, -1]

    for (const member of model.members) {
      const a = this.nodeBase.get(member.a)
      const b = this.nodeBase.get(member.b)
      if (!a || !b) continue
      const result = resultMap.get(member.id)
      const color = memberBaseColor(result)
      const utilization = result?.utilization ?? 0
      const failed = result?.state === 'failed'
      const zero = result?.zeroForce ?? false
      const selected = selectedId === member.id
      const radius = failed ? 0.058 : zero ? 0.03 : 0.038 + Math.min(0.024, utilization * 0.024)
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: zero ? 0.85 : 0.42,
        metalness: zero ? 0 : 0.18,
        transparent: zero,
        opacity: zero ? 0.62 : 1,
        emissive: failed
          ? new THREE.Color(COLORS.failed)
          : result?.state === 'warning'
            ? new THREE.Color(COLORS.warning)
            : selected
              ? new THREE.Color(COLORS.gold)
              : new THREE.Color('#000000'),
        emissiveIntensity: failed ? 0.28 : result?.state === 'warning' ? 0.12 : selected ? 0.65 : 0,
      })
      const geometry = new THREE.CylinderGeometry(radius, radius, 1, 8, 1)
      const meshes: THREE.Mesh[] = []
      for (const side of sides) {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, side)
        this.bridgeGroup.add(mesh)
        meshes.push(mesh)
      }

      let label: CSS2DObject | null = null
      const isIncluded = labelIds.has(member.id) || selected || failure?.memberId === member.id
      if (showLabels && isIncluded) {
        const parts: string[] = []
        if (state.overlays.labels) parts.push(`M${member.id}`)
        if (result && state.overlays.forces) {
          parts.push(
            result.zeroForce
              ? '0 N'
              : `${typeLabel(result.force, result.zeroForce)} ${formatForceShort(Math.abs(result.force))}`,
          )
        }
        if (result && state.overlays.stress && !result.zeroForce) {
          parts.push(formatPercent(result.utilization, 0))
        }
        if (selected && parts.length === 0) parts.push(`M${member.id}`)
        if (parts.length > 0) {
          const element = document.createElement('div')
          element.className =
            `scene-label ${selected ? 'is-selected' : ''} ${failed ? 'is-failed' : ''}`.trim()
          const text = document.createElement('span')
          text.textContent = parts.join(' · ')
          element.appendChild(text)
          element.setAttribute('aria-hidden', 'true')
          this.labelElements.push(element)
          label = new CSS2DObject(element)
          label.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.16, 1.03)
          this.bridgeGroup.add(label)
        }
      }

      this.memberVisuals.push({
        memberId: member.id,
        a: member.a,
        b: member.b,
        radius,
        geometry,
        material,
        meshes,
        label,
      })
    }
  }

  private buildSupports(model: TrussModel): void {
    const metal = new THREE.MeshStandardMaterial({
      color: '#36453f',
      roughness: 0.42,
      metalness: 0.62,
    })
    const plate = new THREE.MeshStandardMaterial({
      color: '#4b5a53',
      roughness: 0.55,
      metalness: 0.35,
    })
    for (const node of model.nodes) {
      if (node.support === 'free') continue
      for (const side of [1, -1]) {
        const group = new THREE.Group()
        group.position.set(node.x, 0, side)
        if (node.support === 'pin') {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 4), metal)
          cone.rotation.y = Math.PI / 4
          cone.position.y = -0.22
          group.add(cone)
          const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.055, 0.36), plate)
          base.position.y = -0.37
          group.add(base)
        } else {
          const top = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.34), plate)
          top.position.y = -0.21
          group.add(top)
          for (const x of [-0.17, 0.17]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.15, 12), metal)
            wheel.rotation.x = Math.PI / 2
            wheel.position.set(x, -0.31, 0)
            group.add(wheel)
          }
          const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.045, 0.38), plate)
          base.position.y = -0.39
          group.add(base)
        }
        this.bridgeGroup.add(group)
      }
    }
  }

  private buildLoads(state: AppState): void {
    for (const load of state.model.loads) {
      const base = this.nodeBase.get(load.nodeId)
      if (!base) continue
      const magnitude = Math.hypot(load.fx, load.fy)
      if (magnitude < 0.01) continue
      const direction = new THREE.Vector3(load.fx, load.fy, 0).normalize()
      const origin = new THREE.Vector3(base.x - direction.x * 1.0, base.y - direction.y * 1.0, 0)
      const arrow = new THREE.ArrowHelper(
        direction,
        origin,
        1.05,
        new THREE.Color(COLORS.accent).getHex(),
        0.22,
        0.13,
      )
      const lineMaterial = arrow.line.material
      const materials = Array.isArray(lineMaterial) ? lineMaterial : [lineMaterial]
      for (const material of materials) {
        material.transparent = true
        material.opacity = 0.95
      }
      this.bridgeGroup.add(arrow)
      const element = document.createElement('div')
      element.className = 'scene-load-label'
      element.textContent = formatForceShort(magnitude)
      element.setAttribute('aria-hidden', 'true')
      this.labelElements.push(element)
      const label = new CSS2DObject(element)
      label.position.set(origin.x, origin.y + 0.22, 0)
      this.bridgeGroup.add(label)
      this.loadVisuals.push({
        nodeId: load.nodeId,
        arrow,
        label,
        direction,
        offset: 1.0,
      })
    }
  }

  private updateScene(now: number): void {
    const state = this.getState()
    const test = state.test
    const onTestRoute = state.route === 'test'
    const failure = onTestRoute && test.status === 'done' ? test.result?.failure : null
    let scale = 0
    if (onTestRoute && test.status === 'running') {
      const limit = test.result?.failure ? test.result.failure.scale : 1
      scale = test.progress * limit
    } else if (onTestRoute && test.status === 'done') {
      scale = failure ? failure.scale : 1
    } else if (state.overlays.deflection) {
      scale = 1
    }
    const deflectionOn = this.deflection.available && scale > 0
    for (const [id, base] of this.nodeBase) {
      const display = this.nodeDisplay.get(id)
      if (!display) continue
      display.copy(base)
      if (deflectionOn) {
        const entry = this.deflection.entries.get(id)
        if (entry) {
          display.x += entry.dx * this.deflection.factor * scale
          display.y += entry.dy * this.deflection.factor * scale
        }
      }
    }

    const reduced = state.preferences.reducedMotion
    const motion =
      failure && onTestRoute && test.status === 'done'
        ? failureMotion(now, test.completedAt, reduced)
        : null

    for (const visual of this.memberVisuals) {
      const a = this.nodeDisplay.get(visual.a)
      const b = this.nodeDisplay.get(visual.b)
      if (!a || !b) continue
      this.tmpA.copy(a)
      this.tmpB.copy(b)
      if (motion && motion.broken && failure?.memberId === visual.memberId) {
        this.tmpB.y -= motion.drop * 0.9
        this.tmpB.z += motion.shake * 0.22
        this.tmpA.y -= motion.drop * 0.08
        this.tmpA.z -= motion.shake * 0.08
      }
      this.tmpDir.subVectors(this.tmpB, this.tmpA)
      const length = this.tmpDir.length()
      if (length < 1e-5) continue
      this.tmpDir.multiplyScalar(1 / length)
      this.tmpQuat.setFromUnitVectors(UP, this.tmpDir)
      this.tmpMid.addVectors(this.tmpA, this.tmpB).multiplyScalar(0.5)
      for (const mesh of visual.meshes) {
        mesh.position.copy(this.tmpMid)
        mesh.quaternion.copy(this.tmpQuat)
        mesh.scale.set(1, length, 1)
      }
      if (visual.label) {
        visual.label.position.set(this.tmpMid.x, this.tmpMid.y + 0.16, 1.03)
      }
    }

    for (const load of this.loadVisuals) {
      const node = this.nodeDisplay.get(load.nodeId)
      if (!node) continue
      const x = node.x - load.direction.x * load.offset
      const y = node.y - load.direction.y * load.offset
      load.arrow.position.set(x, y, 0)
      load.label.position.set(x, y + 0.22, 0)
    }

    if (this.deflectionNote) {
      const show = deflectionOn && this.deflection.available
      this.deflectionNote.hidden = !show
      if (show) {
        this.deflectionNote.textContent = `변형 과장 ${deflectionFactorLabel(this.deflection.factor)} · 2D 해석`
      }
    }
  }

  private clearBridge(): void {
    for (const label of this.labelElements) label.remove()
    this.labelElements = []
    for (const visual of this.memberVisuals) {
      if (visual.label) visual.label.removeFromParent()
    }
    this.memberVisuals = []
    for (const load of this.loadVisuals) {
      load.arrow.removeFromParent()
      load.label.removeFromParent()
    }
    this.loadVisuals = []
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    for (const child of [...this.bridgeGroup.children]) {
      this.bridgeGroup.remove(child)
      child.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) geometries.add(mesh.geometry)
        if (mesh.material) {
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const material of list) materials.add(material)
        }
      })
    }
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
  }

  private showFallback(): void {
    this.host.replaceChildren()
    const note = document.createElement('div')
    note.className = 'scene-fallback'
    note.innerHTML =
      '<strong>3D 보기를 시작할 수 없습니다.</strong><span>브라우저의 WebGL을 확인하거나 2D 보기와 힘 표를 사용하세요.</span>'
    this.host.appendChild(note)
  }
}
