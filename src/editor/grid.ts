import {
  GRID_METERS,
  MAX_HEIGHT_METERS,
  MAX_SPAN_METERS,
  MIN_NODE_DISTANCE,
} from '../struct/constants'

export function snapToGrid(value: number, step = GRID_METERS): number {
  return Math.round(value / step) * step
}

export function snapPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(MAX_SPAN_METERS, Math.max(0, snapToGrid(x))),
    y: Math.min(MAX_HEIGHT_METERS, Math.max(0, snapToGrid(y))),
  }
}

export function isInsideGrid(x: number, y: number): boolean {
  return x >= 0 && x <= MAX_SPAN_METERS && y >= 0 && y <= MAX_HEIGHT_METERS
}

export function withinMergeDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  distance = MIN_NODE_DISTANCE,
): boolean {
  return Math.hypot(x2 - x1, y2 - y1) < distance
}
