import type { AppState, Tool } from '../../app/state'
import type { MissionEvaluation } from '../../features/missions/missions'
import { MATERIALS, SECTION } from '../../struct/materials'
import type { MaterialId } from '../../struct/types'
import { el } from '../dom'
import { icon } from '../icons'
import type { UiActions } from './actions'
import { button, sectionHeader } from './common'
import { renderMissionSection } from './missionPanel'
import { renderTestPanel } from './testPanel'

interface ToolDefinition {
  id: Tool
  label: string
  key: string
  icon: Parameters<typeof button>[0]['icon']
  hint: string
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'select',
    label: '선택',
    key: 'V',
    icon: 'select',
    hint: '절점이나 부재를 클릭해 선택합니다. 절점을 끌어 옮길 수도 있습니다.',
  },
  {
    id: 'node',
    label: '절점',
    key: 'N',
    icon: 'node',
    hint: '격자를 클릭해 절점을 놓습니다. 1 m 격자에 맞춰집니다.',
  },
  {
    id: 'member',
    label: '부재',
    key: 'M',
    icon: 'member',
    hint: '절점 두 개를 차례로 클릭해 부재를 연결합니다.',
  },
  {
    id: 'pin',
    label: '핀',
    key: 'P',
    icon: 'pin',
    hint: '절점을 클릭해 수평·수직 반력을 받는 핀 지지대를 놓습니다.',
  },
  {
    id: 'roller',
    label: '롤러',
    key: 'R',
    icon: 'roller',
    hint: '절점을 클릭해 수직 반력만 받는 롤러 지지대를 놓습니다.',
  },
  {
    id: 'load',
    label: '하중',
    key: 'L',
    icon: 'load',
    hint: '절점을 클릭해 아래 방향 500 N 하중을 겁니다. 크기는 검사창에서 바꿉니다.',
  },
  {
    id: 'delete',
    label: '삭제',
    key: 'D',
    icon: 'trash',
    hint: '절점이나 부재를 클릭해 삭제합니다. 절점을 지우면 연결 부재도 함께 지워집니다.',
  },
]

function selectedMemberMaterial(state: AppState): MaterialId | null {
  if (state.selection.kind !== 'member' || state.selection.id === null) return null
  const member = state.model.members.find((item) => item.id === state.selection.id)
  return member?.materialId ?? null
}

function renderTools(state: AppState, actions: UiActions): HTMLElement {
  const active = TOOLS.find((tool) => tool.id === state.tool) ?? TOOLS[0]
  const grid = el('div', { class: 'tool-grid', role: 'group', 'aria-label': '설계 도구' })
  for (const tool of TOOLS) {
    const isActive = state.tool === tool.id
    const toolButton = el(
      'button',
      {
        class: `tool-button ${isActive ? 'is-active' : ''}`.trim(),
        type: 'button',
        'aria-pressed': String(isActive),
        'data-focus-key': `tool-${tool.id}`,
        title: `${tool.label} (${tool.key})`,
      },
      el('span', { class: 'tool-icon', html: icon(tool.icon ?? 'select', 19) }),
      el('span', { class: 'tool-label', text: tool.label }),
      el('span', { class: 'tool-key', text: tool.key }),
    )
    toolButton.addEventListener('click', () => actions.setTool(tool.id))
    grid.appendChild(toolButton)
  }
  return el(
    'section',
    { class: 'panel-section sheet-build' },
    sectionHeader('TOOLS', '만들기'),
    grid,
    el('p', { class: 'panel-hint', text: active.hint }),
  )
}

function renderMaterials(state: AppState, actions: UiActions): HTMLElement {
  const selectedMaterial = selectedMemberMaterial(state)
  const activeMaterial = selectedMaterial ?? state.materialId
  const list = el('div', { class: 'material-list', role: 'group', 'aria-label': '부재 재료' })
  for (const material of MATERIALS) {
    const isActive = activeMaterial === material.id
    const card = el(
      'button',
      {
        class: `material-card ${isActive ? 'is-active' : ''}`.trim(),
        type: 'button',
        'aria-pressed': String(isActive),
        'data-focus-key': `material-${material.id}`,
      },
      el('span', {
        class: 'material-swatch',
        style: { background: material.color },
        'aria-hidden': 'true',
      }),
      el(
        'span',
        { class: 'material-body' },
        el(
          'span',
          { class: 'material-name' },
          material.nameKo,
          el('span', { class: 'material-e', text: `E ${Math.round(material.E / 1e9)} GPa` }),
        ),
        el('span', {
          class: 'material-meta',
          text: `허용 ${Math.round(material.allowableTension / 1e6)}/${Math.round(material.allowableCompression / 1e6)} MPa · ${material.costPerMeter} cr/m`,
        }),
        el('span', { class: 'material-note', text: material.noteKo }),
      ),
    )
    card.addEventListener('click', () => actions.setMaterial(material.id))
    list.appendChild(card)
  }

  return el(
    'section',
    { class: 'panel-section sheet-build' },
    sectionHeader('MATERIAL', selectedMaterial ? '선택 부재의 재료' : '새 부재의 재료'),
    list,
    el(
      'p',
      { class: 'panel-hint' },
      selectedMaterial
        ? `선택한 부재 M${state.selection.id}의 재료가 바뀌고, 다음 부재에도 같은 재료가 쓰입니다.`
        : `모든 부재는 같은 단면(${SECTION.labelKo})을 씁니다. 재료만 바꿉니다.`,
    ),
  )
}

function renderShortcuts(): HTMLElement {
  const details = el('details', { class: 'shortcut-card sheet-build' })
  details.appendChild(el('summary', { text: '키보드로 만들기' }))
  details.appendChild(
    el('p', {
      text: 'V 선택 · N 절점 · M 부재 · P 핀 · R 롤러 · L 하중 · D 삭제 · 화살표 이동 · Shift+화살표 0.5 m · Enter 놓기 · Delete 삭제 · Esc 취소',
    }),
  )
  details.appendChild(
    el('p', {
      class: 'shortcut-note',
      text: '캔버스에 포커스를 두고 사용하세요. 아래 모델 목록에서 원하는 절점·부재를 바로 선택할 수도 있습니다.',
    }),
  )
  return details
}

function render3DInfo(actions: UiActions): HTMLElement {
  return el(
    'section',
    { class: 'panel-section sheet-build three-info' },
    sectionHeader('3D VIEW', '3D 교량 보기'),
    el('p', {
      class: 'three-info-note',
      text: '이 화면은 2D 정정 구조 해석 결과를 3D로 시각화한 것입니다. 별도의 3D 해석이 아니며, 편집은 2D에서 합니다.',
    }),
    el(
      'div',
      { class: 'three-legend' },
      el('span', {}, el('span', { class: 'legend-dot is-tension' }), 'T 인장'),
      el('span', {}, el('span', { class: 'legend-dot is-compression' }), 'C 압축'),
      el('span', {}, el('span', { class: 'legend-dot is-zero' }), '0 영부재'),
      el('span', {}, el('span', { class: 'legend-dot is-failed' }), '파괴'),
    ),
    el('p', {
      class: 'panel-hint',
      text: '드래그로 회전하고 스크롤로 확대합니다. 클릭한 부재의 상세는 오른쪽 힘 표에서 확인하세요.',
    }),
    button({
      label: '2D로 돌아가 편집',
      icon: 'layers',
      variant: 'primary',
      size: 'sm',
      focusKey: 'three-back-2d',
      onClick: () => actions.setView('2d'),
    }),
  )
}

export function renderLeftPanel(
  state: AppState,
  actions: UiActions,
  evaluation: MissionEvaluation | null,
): HTMLElement {
  if (state.route === 'test') {
    const inner = el('div', { class: 'panel-inner' })
    inner.appendChild(renderTestPanel(state, actions, evaluation))
    return inner
  }

  const inner = el('div', { class: 'panel-inner' })
  if (state.view === '3d') {
    if (state.mission.currentId) {
      inner.appendChild(renderMissionSection(state, actions, evaluation))
    }
    inner.appendChild(render3DInfo(actions))
    if (!state.mission.currentId) {
      inner.appendChild(renderMissionSection(state, actions, evaluation))
    }
    return inner
  }

  if (state.mission.currentId) {
    inner.appendChild(renderMissionSection(state, actions, evaluation))
  }
  inner.appendChild(renderTools(state, actions))
  inner.appendChild(renderMaterials(state, actions))
  inner.appendChild(renderShortcuts())
  if (!state.mission.currentId) {
    inner.appendChild(renderMissionSection(state, actions, evaluation))
  }
  return inner
}
