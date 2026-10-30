import { describe, expect, it } from 'vitest'
import { analyzeDeterminacy } from '../../struct/determinacy'
import { analyzeModel } from '../../struct/analysis'
import { computeDeflection } from '../../struct/deflection'
import { computeCost } from '../../struct/cost'
import { eulerBucklingLoad } from '../../struct/buckling'
import { memberGeometry, nodeMap } from '../../struct/geometry'
import { solveTruss } from '../../struct/methodOfJoints'
import { detectZeroForceCandidates } from '../../struct/zeroForce'
import { runLoadTest, totalLoadMagnitude } from '../../struct/failure'

import { makeModel, member, node, warrenTruss, workedTriangle } from './helpers'

describe('geometry', () => {
  it('computes length and direction for a 3-4-5 member', () => {
    const model = makeModel({
      nodes: [node(1, 0, 0), node(2, 3, 4)],
      members: [member(1, 1, 2)],
    })
    const geometry = memberGeometry(model.members[0], nodeMap(model))
    expect(geometry).not.toBeNull()
    expect(geometry?.length).toBeCloseTo(5, 9)
    expect(geometry?.cos).toBeCloseTo(0.6, 9)
    expect(geometry?.sin).toBeCloseTo(0.8, 9)
    expect(geometry?.midX).toBeCloseTo(1.5, 9)
    expect(geometry?.midY).toBeCloseTo(2, 9)
  })
})

describe('determinacy', () => {
  it('flags a triangle as determinate and stable', () => {
    const analysis = analyzeDeterminacy(workedTriangle())
    expect(analysis.status).toBe('determinate')
    expect(analysis.stable).toBe(true)
    expect(analysis.m).toBe(3)
    expect(analysis.r).toBe(3)
    expect(analysis.j).toBe(3)
  })

  it('flags a rectangle without a diagonal as unstable (m + r < 2j)', () => {
    const model = makeModel({
      nodes: [node(1, 0, 0, 'pin'), node(2, 4, 0, 'roller'), node(3, 4, 3), node(4, 0, 3)],
      members: [member(1, 1, 2), member(2, 2, 3), member(3, 3, 4), member(4, 4, 1)],
      loads: [{ id: 1, nodeId: 3, fx: 0, fy: -150 }],
    })
    const analysis = analyzeDeterminacy(model)
    expect(analysis.status).toBe('unstable')
    expect(analysis.stable).toBe(false)
  })

  it('flags an over-braced truss as indeterminate', () => {
    const model = workedTriangle()
    model.members.push(member(4, 1, 2))
    const analysis = analyzeDeterminacy(model)
    expect(analysis.status).toBe('indeterminate')
    expect(analysis.determinate).toBe(false)
  })

  it('flags a missing support as unstable', () => {
    const model = workedTriangle()
    model.nodes = model.nodes.map((item) => ({ ...item, support: 'free' }))
    expect(analyzeDeterminacy(model).status).toBe('unstable')
  })

  it('detects a mechanism even when m + r equals 2j', () => {
    const model = makeModel({
      nodes: [
        node(1, 0, 0, 'pin'),
        node(2, 4, 0, 'roller'),
        node(3, 4, 3),
        node(4, 0, 3, 'roller'),
      ],
      members: [member(1, 1, 2), member(2, 2, 3), member(3, 3, 4), member(4, 4, 1)],
    })
    const analysis = analyzeDeterminacy(model)
    expect(analysis.status).toBe('unstable')
    expect(analysis.rank).toBeLessThan(analysis.equations)
  })
})

describe('method of joints', () => {
  it('matches the hand-calculated worked triangle', () => {
    const solved = solveTruss(workedTriangle())
    expect(solved.ok).toBe(true)
    const forces = solved.memberForces
    expect(forces.get(1)).toBeCloseTo(-300.5, 0)
    expect(forces.get(2)).toBeCloseTo(-300.5, 0)
    expect(forces.get(3)).toBeCloseTo(166.7, 0)
    const reactions = new Map(solved.reactions.map((item) => [item.nodeId, item]))
    expect(reactions.get(1)?.fx).toBeCloseTo(0, 1)
    expect(reactions.get(1)?.fy).toBeCloseTo(250, 0)
    expect(reactions.get(2)?.fy).toBeCloseTo(250, 0)
  })

  it('matches the hand-calculated Warren truss', () => {
    const solved = solveTruss(warrenTruss())
    expect(solved.ok).toBe(true)
    expect(solved.memberForces.get(1)).toBeCloseTo(-250, 1)
    expect(solved.memberForces.get(2)).toBeCloseTo(250, 1)
    expect(solved.memberForces.get(3)).toBeCloseTo(250, 1)
    expect(solved.memberForces.get(4)).toBeCloseTo(-250, 1)
    expect(solved.memberForces.get(5)).toBeCloseTo(-300, 1)
    expect(solved.memberForces.get(6)).toBeCloseTo(150, 1)
    expect(solved.memberForces.get(7)).toBeCloseTo(150, 1)
  })

  it('uses tension positive and compression negative', () => {
    const solved = solveTruss(workedTriangle())
    expect(solved.memberForces.get(3)).toBeGreaterThan(0)
    expect(solved.memberForces.get(1)).toBeLessThan(0)
  })

  it('returns a warning instead of NaN for a singular matrix', () => {
    const model = makeModel({
      nodes: [node(1, 0, 0, 'pin'), node(2, 4, 0), node(3, 2, 3)],
      members: [member(1, 1, 3), member(2, 2, 3), member(3, 1, 2)],
      loads: [{ id: 1, nodeId: 3, fx: 0, fy: -500 }],
    })
    const solved = solveTruss(model)
    expect(solved.ok).toBe(false)
    expect(solved.memberForces.size).toBe(0)
    expect(solved.reasonKo).toBeTruthy()
  })

  it('is deterministic for repeated solves', () => {
    const first = analyzeModel(workedTriangle()).result
    const second = analyzeModel(workedTriangle()).result
    expect(first?.members.length).toBe(second?.members.length)
    for (let index = 0; index < (first?.members.length ?? 0); index += 1) {
      expect(first?.members[index].force).toBeCloseTo(second?.members[index].force ?? 0, 6)
    }
  })
})

describe('stress, buckling, cost', () => {
  it('computes stress utilization and factor of safety', () => {
    const analysis = analyzeModel(workedTriangle('steel', -500))
    expect(analysis.result).not.toBeNull()
    const ac = analysis.result?.members.find((item) => item.memberId === 1)
    expect(ac?.stress).toBeCloseTo((ac?.force ?? 0) / 5e-4, 6)
    expect(ac?.stressUtilization).toBeCloseTo(Math.abs(ac?.stress ?? 0) / 200e6, 8)
    expect(analysis.result?.factorOfSafety).toBeCloseTo(
      1 / (analysis.result?.maxUtilization ?? 1),
      8,
    )
  })

  it('computes a known Euler buckling load', () => {
    const critical = eulerBucklingLoad(200e9, 3)
    expect(critical).toBeCloseTo((Math.PI ** 2 * 200e9 * 2.08e-8) / 9, 3)
    expect(critical).toBeGreaterThan(4000)
  })

  it('shows a long wood compression member buckling before yielding', () => {
    const result = analyzeModel(workedTriangle('wood', -500)).result
    const ac = result?.members.find((item) => item.memberId === 1)
    expect(ac?.bucklingUtilization).toBeGreaterThan(1)
    expect(ac?.stressUtilization).toBeLessThan(1)
    expect(ac?.state).toBe('failed')
  })

  it('reports a lower utilization for steel than wood', () => {
    const wood = analyzeModel(workedTriangle('wood', -500)).result?.members.find(
      (m) => m.memberId === 1,
    )
    const steel = analyzeModel(workedTriangle('steel', -500)).result?.members.find(
      (m) => m.memberId === 1,
    )
    expect(steel?.utilization ?? 1).toBeLessThan(wood?.utilization ?? 0)
  })

  it('computes cost from member length and node count', () => {
    const cost = computeCost(workedTriangle())
    expect(cost.nodeCost).toBe(15)
    expect(cost.memberCost).toBeCloseTo((3.60555 * 2 + 4) * 20, 3)
    expect(cost.total).toBeCloseTo(cost.memberCost + 15, 6)
    expect(cost.byMember.get(3)).toBeCloseTo(80, 6)
  })
})

describe('zero-force members', () => {
  it('detects the classic two-member unloaded joint case', () => {
    const model = makeModel({
      nodes: [node(1, 0, 0, 'pin'), node(2, 4, 0, 'roller'), node(3, 2, 0), node(4, 2, 3)],
      members: [
        member(1, 1, 3),
        member(2, 2, 3),
        member(3, 1, 4),
        member(4, 2, 4),
        member(5, 3, 4),
      ],
      loads: [{ id: 1, nodeId: 3, fx: 0, fy: -500 }],
    })
    const candidates = detectZeroForceCandidates(model)
    expect(candidates.has(5)).toBe(false)
  })

  it('detects an unloaded three-member joint with two collinear members', () => {
    const model = makeModel({
      nodes: [node(1, 0, 0, 'pin'), node(2, 4, 0, 'roller'), node(3, 2, 3), node(4, 2, 0)],
      members: [
        member(1, 1, 3),
        member(2, 2, 3),
        member(3, 1, 4),
        member(4, 2, 4),
        member(5, 4, 3),
      ],
      loads: [{ id: 1, nodeId: 3, fx: 0, fy: -200 }],
    })
    const candidates = detectZeroForceCandidates(model)
    expect(candidates.has(5)).toBe(true)
  })

  it('flags a zero-force member and keeps it in the model', () => {
    const result = analyzeModel(
      makeModel({
        nodes: [node(1, 0, 0, 'pin'), node(2, 4, 0, 'roller'), node(3, 2, 3), node(4, 2, 0)],
        members: [
          member(1, 1, 3),
          member(2, 2, 3),
          member(3, 1, 4),
          member(4, 2, 4),
          member(5, 4, 3),
        ],
        loads: [{ id: 1, nodeId: 3, fx: 0, fy: -200 }],
      }),
    ).result
    const cd = result?.members.find((item) => item.memberId === 5)
    expect(cd?.zeroForce).toBe(true)
    expect(cd?.force).toBeCloseTo(0, 1)
    expect(result?.members.length).toBe(5)
  })
})

describe('deflection and load test', () => {
  it('keeps supports fixed and moves the loaded apex downward', () => {
    const model = workedTriangle()
    const solved = solveTruss(model)
    const deflection = computeDeflection(model, solved.memberForces)
    expect(deflection.ok).toBe(true)
    const entry = deflection.entries.find((item) => item.nodeId === 3)
    expect(entry?.dy ?? 0).toBeLessThan(0)
    expect(deflection.entries.find((item) => item.nodeId === 1)?.dx).toBeCloseTo(0, 12)
    expect(deflection.entries.find((item) => item.nodeId === 2)?.dy).toBeCloseTo(0, 12)
  })

  it('satisfies the member elongation equations', () => {
    const model = workedTriangle()
    const solved = solveTruss(model)
    const deflection = computeDeflection(model, solved.memberForces)
    const byId = new Map(deflection.entries.map((entry) => [entry.nodeId, entry]))
    for (const item of model.members) {
      const a = model.nodes.find((n) => n.id === item.a)
      const b = model.nodes.find((n) => n.id === item.b)
      if (!a || !b) continue
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      const nx = (b.x - a.x) / length
      const ny = (b.y - a.y) / length
      const ua = byId.get(item.a)
      const ub = byId.get(item.b)
      const projected =
        (ub?.dx ?? 0) * nx + (ub?.dy ?? 0) * ny - ((ua?.dx ?? 0) * nx + (ua?.dy ?? 0) * ny)
      const expected = ((solved.memberForces.get(item.id) ?? 0) * length) / (5e-4 * 1e10)
      expect(projected).toBeCloseTo(expected, 10)
    }
  })

  it('finds the first failure in a load ramp', () => {
    const model = workedTriangle('wood', -500)
    const result = analyzeModel(model).result
    const test = runLoadTest(model, result)
    expect(test.unstable).toBe(false)
    expect(test.passed).toBe(false)
    expect(test.failure?.memberId).toBe(1)
    expect(test.failure?.reason).toBe('buckling')
    expect(test.steps.length).toBe(10)
    expect(test.targetLoadN).toBe(500)
    expect(totalLoadMagnitude(model)).toBe(500)
  })

  it('passes a load test for a steel worked triangle', () => {
    const model = workedTriangle('steel', -500)
    const test = runLoadTest(model, analyzeModel(model).result)
    expect(test.passed).toBe(true)
    expect(test.failure).toBeNull()
  })
})
