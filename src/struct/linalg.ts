import { MATRIX_TOLERANCE } from './constants'
import type { SolveSystemResult } from './types'

function cloneMatrix(a: number[][]): number[][] {
  return a.map((row) => row.slice())
}

function maxAbs(a: number[][]): number {
  let max = 0
  for (const row of a) {
    for (const value of row) {
      if (Number.isFinite(value)) max = Math.max(max, Math.abs(value))
    }
  }
  return max
}

function toleranceFor(a: number[][]): number {
  return MATRIX_TOLERANCE * Math.max(1, maxAbs(a))
}

/**
 * 가우스 소거법 + 부분 피벗. 특이 행렬이면 NaN을 만들지 않고 실패를 돌려준다.
 */
export function solveLinearSystem(
  matrix: number[][],
  rhs: number[],
  tolerance?: number,
): SolveSystemResult {
  const n = matrix.length
  if (n === 0 || matrix.some((row) => row.length !== n) || rhs.length !== n) {
    return { ok: false, x: null, rank: 0, reasonKo: '연립방정식의 크기가 맞지 않습니다.' }
  }

  const a = cloneMatrix(matrix)
  const b = rhs.slice()
  const tol = tolerance ?? toleranceFor(a)
  let rank = 0

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col
    let pivotValue = Math.abs(a[col][col])
    for (let row = col + 1; row < n; row += 1) {
      const candidate = Math.abs(a[row][col])
      if (candidate > pivotValue) {
        pivotValue = candidate
        pivotRow = row
      }
    }

    if (pivotValue <= tol) continue

    if (pivotRow !== col) {
      const tempRow = a[pivotRow]
      a[pivotRow] = a[col]
      a[col] = tempRow
      const tempValue = b[pivotRow]
      b[pivotRow] = b[col]
      b[col] = tempValue
    }

    const pivot = a[col][col]
    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row][col] / pivot
      if (factor === 0) continue
      for (let k = col; k < n; k += 1) {
        a[row][k] -= factor * a[col][k]
      }
      b[row] -= factor * b[col]
    }
    rank += 1
  }

  if (rank < n) {
    return {
      ok: false,
      x: null,
      rank,
      reasonKo: '행렬이 특이합니다. 구조가 기구이거나 지지대가 부족합니다.',
    }
  }

  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row]
    for (let col = row + 1; col < n; col += 1) {
      sum -= a[row][col] * x[col]
    }
    x[row] = sum / a[row][row]
  }

  if (x.some((value) => !Number.isFinite(value))) {
    return { ok: false, x: null, rank, reasonKo: '해가 유한하지 않습니다.' }
  }

  return { ok: true, x, rank }
}

/** 소거법으로 행렬의 계수(rank)를 구한다. */
export function matrixRank(matrix: number[][], tolerance?: number): number {
  const rows = matrix.length
  if (rows === 0) return 0
  const cols = matrix[0].length
  const a = cloneMatrix(matrix)
  const tol = tolerance ?? toleranceFor(a)
  let rank = 0
  let rowIndex = 0

  for (let col = 0; col < cols && rowIndex < rows; col += 1) {
    let pivotRow = rowIndex
    let pivotValue = Math.abs(a[pivotRow][col])
    for (let row = rowIndex + 1; row < rows; row += 1) {
      const candidate = Math.abs(a[row][col])
      if (candidate > pivotValue) {
        pivotValue = candidate
        pivotRow = row
      }
    }
    if (pivotValue <= tol) continue

    if (pivotRow !== rowIndex) {
      const temp = a[pivotRow]
      a[pivotRow] = a[rowIndex]
      a[rowIndex] = temp
    }

    const pivot = a[rowIndex][col]
    for (let row = rowIndex + 1; row < rows; row += 1) {
      const factor = a[row][col] / pivot
      if (factor === 0) continue
      for (let k = col; k < cols; k += 1) {
        a[row][k] -= factor * a[rowIndex][k]
      }
    }
    rank += 1
    rowIndex += 1
  }

  return rank
}
