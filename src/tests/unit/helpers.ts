import type { TrussModel } from '../../struct/types'

export function makeModel(partial: Partial<TrussModel>): TrussModel {
  return {
    nodes: [],
    members: [],
    loads: [],
    nextNodeId: 1,
    nextMemberId: 1,
    nextLoadId: 1,
    ...partial,
  }
}

export function node(
  id: number,
  x: number,
  y: number,
  support: 'free' | 'pin' | 'roller' = 'free',
) {
  return { id, x, y, support }
}

export function member(id: number, a: number, b: number, materialId: 'wood' | 'steel' = 'wood') {
  return { id, a, b, materialId }
}

export function workedTriangle(materialId: 'wood' | 'steel' = 'wood', load = -500): TrussModel {
  return makeModel({
    nodes: [node(1, 0, 0, 'pin'), node(2, 4, 0, 'roller'), node(3, 2, 3)],
    members: [
      member(1, 1, 3, materialId),
      member(2, 2, 3, materialId),
      member(3, 1, 2, materialId),
    ],
    loads: [{ id: 1, nodeId: 3, fx: 0, fy: load }],
    nextNodeId: 4,
    nextMemberId: 4,
    nextLoadId: 2,
  })
}

export function warrenTruss(load = -400): TrussModel {
  return makeModel({
    nodes: [
      node(1, 0, 0, 'pin'),
      node(2, 3, 0),
      node(3, 6, 0, 'roller'),
      node(4, 1.5, 2),
      node(5, 4.5, 2),
    ],
    members: [
      member(1, 1, 4),
      member(2, 2, 4),
      member(3, 2, 5),
      member(4, 3, 5),
      member(5, 4, 5),
      member(6, 1, 2),
      member(7, 2, 3),
    ],
    loads: [{ id: 1, nodeId: 2, fx: 0, fy: load }],
    nextNodeId: 6,
    nextMemberId: 8,
    nextLoadId: 2,
  })
}
