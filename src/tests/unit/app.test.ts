import { describe, expect, it } from 'vitest'
import { analyzeModel } from '../../struct/analysis'
import { runLoadTest } from '../../struct/failure'
import { solveTruss } from '../../struct/methodOfJoints'
import { addMember, addNode, moveNode, removeNode, setSupport } from '../../editor/placement'
import { ModelHistory } from '../../editor/commands'
import { analyzeDeterminacy } from '../../struct/determinacy'
import { validateModel } from '../../struct/validate'
import { loadPresetModel, blankModel } from '../../app/presets'
import {
  evaluateMission,
  getMission,
  isPredictionCorrect,
  MISSIONS,
  nextMissionId,
} from '../../features/missions/missions'
import type { TrussModel } from '../../struct/types'
import { makeModel } from './helpers'

function addSteelTriangle(model: TrussModel): TrussModel {
  let next = model
  for (const [a, b] of [
    [1, 3],
    [2, 3],
    [1, 2],
  ]) {
    const result = addMember(next, a, b, 'steel')
    expect(result.ok).toBe(true)
    next = result.model
  }
  return next
}

function missionResult(model: TrussModel) {
  const analysis = analyzeModel(model)
  const test = runLoadTest(model, analysis.result)
  return { analysis, test }
}

describe('placement and validation', () => {
  it('adds nodes on the grid and rejects a near-duplicate', () => {
    const model = blankModel()
    const first = addNode(model, 2, 2)
    expect(first.ok).toBe(true)
    expect(first.model.nodes).toHaveLength(1)
    const second = addNode(first.model, 6, 4)
    expect(second.ok).toBe(true)
    expect(second.model.nodes).toHaveLength(2)
    const duplicate = addNode(second.model, 2, 2)
    expect(duplicate.ok).toBe(false)
    expect(duplicate.nodeId).toBe(first.nodeId)
  })

  it('rejects duplicate, self, and very short members', () => {
    let model = blankModel()
    model = addNode(model, 0, 0).model
    model = addNode(model, 4, 0).model
    const first = addMember(model, 1, 2, 'wood')
    expect(first.ok).toBe(true)
    expect(addMember(first.model, 2, 1, 'steel').ok).toBe(false)
    expect(addMember(first.model, 1, 1, 'wood').ok).toBe(false)
    const near = addNode(first.model, 4.2, 0)
    if (near.ok) {
      expect(addMember(near.model, 1, near.nodeId ?? 0, 'wood').ok).toBe(false)
    }
  })

  it('removes attached members and loads with a node', () => {
    const model = loadPresetModel('zero-force')
    const removed = removeNode(model, 4)
    expect(removed.ok).toBe(true)
    expect(removed.model.nodes.some((node) => node.id === 4)).toBe(false)
    expect(removed.model.members.some((member) => member.a === 4 || member.b === 4)).toBe(false)
  })

  it('moves a node but rejects collisions', () => {
    const model = loadPresetModel('warren')
    const moved = moveNode(model, 2, 2, 2)
    expect(moved.ok).toBe(true)
    expect(moved.model.nodes.find((node) => node.id === 2)?.x).toBe(2)
    expect(moveNode(model, 2, 0, 0).ok).toBe(false)
  })

  it('sets supports', () => {
    const model = loadPresetModel('warren')
    const changed = setSupport(model, 2, 'pin')
    expect(changed.ok).toBe(true)
    expect(changed.model.nodes.find((node) => node.id === 2)?.support).toBe('pin')
  })

  it('warns about crossing members and isolated nodes', () => {
    const crossing = makeModel({
      nodes: [
        { id: 1, x: 0, y: 0, support: 'pin' },
        { id: 2, x: 4, y: 4, support: 'roller' },
        { id: 3, x: 4, y: 0, support: 'free' },
        { id: 4, x: 0, y: 4, support: 'free' },
      ],
      members: [
        { id: 1, a: 1, b: 2, materialId: 'wood' },
        { id: 2, a: 3, b: 4, materialId: 'wood' },
      ],
    })
    expect(validateModel(crossing).some((warning) => warning.code === 'crossing-members')).toBe(
      true,
    )

    const isolated = makeModel({
      nodes: [
        { id: 1, x: 0, y: 0, support: 'pin' },
        { id: 2, x: 4, y: 0, support: 'roller' },
        { id: 3, x: 2, y: 3, support: 'free' },
        { id: 4, x: 2, y: 1, support: 'free' },
      ],
      members: [
        { id: 1, a: 1, b: 2, materialId: 'wood' },
        { id: 2, a: 1, b: 3, materialId: 'wood' },
        { id: 3, a: 2, b: 3, materialId: 'wood' },
      ],
    })
    expect(validateModel(isolated).some((warning) => warning.code === 'isolated-node')).toBe(true)
  })

  it('flags a duplicate member as a blocking error', () => {
    const model = loadPresetModel('triangle')
    model.members.push({ ...model.members[0], id: 99 })
    const warnings = validateModel(model)
    expect(
      warnings.some(
        (warning) => warning.code === 'duplicate-member' && warning.severity === 'error',
      ),
    ).toBe(true)
  })
})

describe('history', () => {
  it('undoes and redoes model changes', () => {
    const initial = blankModel()
    const history = new ModelHistory(initial)
    const withNode = addNode(initial, 2, 2).model
    history.push(withNode)
    expect(history.canUndo()).toBe(true)
    expect(history.undo()?.nodes).toHaveLength(0)
    expect(history.undo()).toBeNull()
    expect(history.redo()?.nodes).toHaveLength(1)
    expect(history.canRedo()).toBe(false)
  })

  it('replaces the current snapshot during a live edit', () => {
    const model = loadPresetModel('warren')
    const history = new ModelHistory(model)
    const moved = moveNode(model, 2, 2, 2).model
    history.replaceCurrent(moved)
    expect(history.current()?.nodes.find((node) => node.id === 2)?.x).toBe(2)
  })
})

describe('rectangle and diagonal', () => {
  it('is unstable before the diagonal and determinate after', () => {
    const rectangle = loadPresetModel('rectangle')
    expect(analyzeDeterminacy(rectangle).status).toBe('unstable')
    const withDiagonal = addMember(rectangle, 1, 3, 'wood')
    expect(withDiagonal.ok).toBe(true)
    const analysis = analyzeModel(withDiagonal.model)
    expect(analysis.determinacy.status).toBe('determinate')
    expect(analysis.result?.members.find((member) => member.memberId === 2)?.force).toBeCloseTo(
      -150,
      1,
    )
    const test = runLoadTest(withDiagonal.model, analysis.result)
    expect(test.passed).toBe(true)
  })
})

describe('missions', () => {
  it('has six missions and a stable answer for each', () => {
    expect(MISSIONS).toHaveLength(6)
    for (const mission of MISSIONS) {
      expect(mission.options).toContain(mission.answer)
    }
  })

  it('completes the triangle mission after adding one diagonal and testing', () => {
    const mission = getMission('triangle-vs-square')
    expect(mission).not.toBeNull()
    if (!mission) return
    const rectangle = loadPresetModel(mission.setup.presetModel)
    const before = missionResult(rectangle)
    const predictionWrong = evaluateMission(mission, {
      model: rectangle,
      analysis: before.analysis,
      predictionAnswer: '재료가 너무 약해서',
      testResult: before.test,
      selection: { kind: null, id: null },
    })
    expect(predictionWrong.passed).toBe(false)
    expect(isPredictionCorrect(mission, mission.answer)).toBe(true)

    const added = addMember(rectangle, 1, 3, 'wood')
    expect(added.ok).toBe(true)
    const after = missionResult(added.model)
    const evaluation = evaluateMission(mission, {
      model: added.model,
      analysis: after.analysis,
      predictionAnswer: mission.answer,
      testResult: after.test,
      selection: { kind: null, id: null },
    })
    expect(evaluation.passed).toBe(true)
    expect(after.test.passed).toBe(true)
  })

  it('completes the tension-compression mission with the preset', () => {
    const mission = getMission('tension-compression')
    if (!mission) return
    const model = loadPresetModel(mission.setup.presetModel)
    const { analysis, test } = missionResult(model)
    const ab = analysis.result?.members.find((member) => member.memberId === 3)
    expect(ab?.force).toBeGreaterThan(0)
    const evaluation = evaluateMission(mission, {
      model,
      analysis,
      predictionAnswer: mission.answer,
      testResult: test,
      selection: { kind: null, id: null },
    })
    expect(evaluation.passed).toBe(true)
  })

  it('completes the six-member design mission within budget', () => {
    const mission = getMission('six-members')
    if (!mission) return
    const base = loadPresetModel(mission.setup.presetModel)
    const model = addSteelTriangle(base)
    const { analysis, test } = missionResult(model)
    expect(analysis.determinacy.status).toBe('determinate')
    expect(model.members.length).toBe(3)
    expect(analysis.cost).toBeLessThanOrEqual(1200)
    expect(test.passed).toBe(true)
    const evaluation = evaluateMission(mission, {
      model,
      analysis,
      predictionAnswer: mission.answer,
      testResult: test,
      selection: { kind: null, id: null },
    })
    expect(evaluation.passed).toBe(true)
  })

  it('completes the budget mission with steel diagonals and a wood chord', () => {
    const mission = getMission('budget')
    if (!mission) return
    const base = loadPresetModel(mission.setup.presetModel)
    let model = addMember(base, 1, 3, 'steel')
    expect(model.ok).toBe(true)
    model = addMember(model.model, 2, 3, 'steel')
    expect(model.ok).toBe(true)
    model = addMember(model.model, 1, 2, 'wood')
    expect(model.ok).toBe(true)
    const { analysis, test } = missionResult(model.model)
    expect(analysis.cost).toBeLessThanOrEqual(1500)
    expect(test.passed).toBe(true)
    const evaluation = evaluateMission(mission, {
      model: model.model,
      analysis,
      predictionAnswer: mission.answer,
      testResult: test,
      selection: { kind: null, id: null },
    })
    expect(evaluation.passed).toBe(true)
  })

  it('completes the zero-force mission by selecting the zero-force member', () => {
    const mission = getMission('zero-force')
    if (!mission) return
    const model = loadPresetModel(mission.setup.presetModel)
    const { analysis, test } = missionResult(model)
    const zero = analysis.result?.members.find((member) => member.memberId === 5)
    expect(zero?.zeroForce).toBe(true)
    const evaluation = evaluateMission(mission, {
      model,
      analysis,
      predictionAnswer: mission.answer,
      testResult: test,
      selection: { kind: 'member', id: 5 },
    })
    expect(evaluation.passed).toBe(true)
  })

  it('fails the zero-force mission when the wrong member is selected', () => {
    const mission = getMission('zero-force')
    if (!mission) return
    const model = loadPresetModel(mission.setup.presetModel)
    const { analysis, test } = missionResult(model)
    const evaluation = evaluateMission(mission, {
      model,
      analysis,
      predictionAnswer: mission.answer,
      testResult: test,
      selection: { kind: 'member', id: 1 },
    })
    expect(evaluation.passed).toBe(false)
  })

  it('repairs the missing-member truss with DE', () => {
    const mission = getMission('repair')
    if (!mission) return
    const broken = loadPresetModel(mission.setup.presetModel)
    expect(analyzeDeterminacy(broken).status).toBe('unstable')
    const repaired = addMember(broken, 4, 5, 'wood')
    expect(repaired.ok).toBe(true)
    const { analysis, test } = missionResult(repaired.model)
    expect(analysis.determinacy.status).toBe('determinate')
    expect(test.passed).toBe(true)
    const evaluation = evaluateMission(mission, {
      model: repaired.model,
      analysis,
      predictionAnswer: mission.answer,
      testResult: test,
      selection: { kind: null, id: null },
    })
    expect(evaluation.passed).toBe(true)
  })

  it('suggests the next mission in order', () => {
    expect(nextMissionId('triangle-vs-square')).toBe('tension-compression')
    expect(nextMissionId('repair')).toBeNull()
  })
})

describe('solver integration', () => {
  it('solves the triangle with the expected reactions and forces', () => {
    const model = loadPresetModel('triangle')
    const solved = solveTruss(model)
    expect(solved.ok).toBe(true)
    expect(solved.memberForces.get(1)).toBeCloseTo(-300.5, 0)
    expect(solved.memberForces.get(2)).toBeCloseTo(-300.5, 0)
    expect(solved.memberForces.get(3)).toBeCloseTo(166.7, 0)
  })
})
