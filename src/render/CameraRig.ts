import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls

  constructor(domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300)
    this.controls = new OrbitControls(this.camera, domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.minDistance = 3.5
    this.controls.maxDistance = 90
    this.controls.minPolarAngle = 0.12
    this.controls.maxPolarAngle = Math.PI * 0.49
    this.controls.screenSpacePanning = true
    this.controls.zoomSpeed = 0.85
    this.controls.rotateSpeed = 0.75
  }

  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  frame(centerX: number, height: number, span: number): void {
    const safeSpan = Math.max(3, span)
    const target = new THREE.Vector3(centerX, Math.max(0.8, height * 0.45), 0)
    const distance = Math.max(6, safeSpan * 1.15, height * 2.2)
    this.controls.target.copy(target)
    this.camera.position.set(centerX + distance * 0.52, target.y + distance * 0.44, distance * 0.78)
    this.camera.near = 0.1
    this.camera.far = Math.max(120, distance * 12)
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  update(): void {
    this.controls.update()
  }

  dispose(): void {
    this.controls.dispose()
  }
}
