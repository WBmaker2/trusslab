import { cloneModel } from '../app/presets'
import type { TrussModel } from '../struct/types'

const MAX_HISTORY = 60

/** 모델 스냅샷 기반 undo/redo. 드래그 중간 상태는 replaceCurrent로 다룬다. */
export class ModelHistory {
  private stack: TrussModel[] = []
  private index = -1

  constructor(initial: TrussModel) {
    this.reset(initial)
  }

  reset(model: TrussModel): void {
    this.stack = [cloneModel(model)]
    this.index = 0
  }

  push(model: TrussModel): void {
    this.stack = this.stack.slice(0, this.index + 1)
    this.stack.push(cloneModel(model))
    if (this.stack.length > MAX_HISTORY) this.stack.shift()
    this.index = this.stack.length - 1
  }

  replaceCurrent(model: TrussModel): void {
    if (this.index < 0) {
      this.reset(model)
      return
    }
    this.stack[this.index] = cloneModel(model)
  }

  undo(): TrussModel | null {
    if (this.index <= 0) return null
    this.index -= 1
    return cloneModel(this.stack[this.index])
  }

  redo(): TrussModel | null {
    if (this.index >= this.stack.length - 1) return null
    this.index += 1
    return cloneModel(this.stack[this.index])
  }

  current(): TrussModel | null {
    if (this.index < 0) return null
    return cloneModel(this.stack[this.index])
  }

  canUndo(): boolean {
    return this.index > 0
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1
  }
}
