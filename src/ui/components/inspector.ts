import type { AppState } from '../../app/state'
import { MAX_HEIGHT_METERS, MAX_SPAN_METERS } from '../../struct/constants'
import { memberGeometry, nodeMap } from '../../struct/geometry'
import { getMaterial } from '../../struct/materials'
import {
  formatCost,
  formatForce,
  formatLength,
  formatPercent,
  formatStress,
} from '../../struct/units'
import type { MaterialId, SupportType } from '../../struct/types'
import { el } from '../dom'
import { icon } from '../icons'
import type { UiActions } from './actions'
import {
  badge,
  button,
  iconButton,
  memberStateBadge,
  memberTypeBadge,
  sectionHeader,
  utilizationMeter,
} from './common'

function closeButton(actions: UiActions): HTMLButtonElement {
  return iconButton('close', '선택 해제', () => actions.select({ kind: null, id: null }), {
    focusKey: 'inspector-close',
    size: 'sm',
  })
}

function dataRow(label: string, value: string, tone = ''): HTMLElement {
  return el(
    'div',
    { class: 'data-row' },
    el('dt', { text: label }),
    el('dd', { class: tone, text: value }),
  )
}

function renderMemberInspector(state: AppState, actions: UiActions): HTMLElement {
  const member = state.model.members.find((item) => item.id === state.selection.id)
  if (!member) {
    return el('p', { class: 'empty-note', text: '선택한 부재를 찾을 수 없습니다.' })
  }
  const geometry = memberGeometry(member, nodeMap(state.model))
  const result = state.analysis.result?.members.find((item) => item.memberId === member.id)
  const material = getMaterial(member.materialId)
  const angle = geometry ? (Math.atan2(geometry.dy, geometry.dx) * 180) / Math.PI : 0
  const normalizedAngle = angle < 0 ? angle + 360 : angle
  const cost = geometry ? geometry.length * material.costPerMeter : 0
  const allowable = result
    ? result.force >= 0
      ? material.allowableTension
      : material.allowableCompression
    : material.allowableTension
  const governing =
    result && result.bucklingUtilization > result.stressUtilization ? '좌굴' : '응력'

  const section = el('section', { class: 'panel-section' })
  const head = sectionHeader('INSPECTOR', `부재 M${member.id}`, closeButton(actions))
  section.appendChild(head)

  if (result) {
    section.appendChild(
      el(
        'div',
        { class: 'inspector-hero' },
        memberTypeBadge(result),
        el(
          'div',
          { class: 'inspector-force' },
          el('strong', { text: formatForce(Math.abs(result.force)) }),
          el('span', { text: result.zeroForce ? '힘 0' : result.force > 0 ? '인장' : '압축' }),
        ),
        memberStateBadge(result),
      ),
    )
  } else {
    section.appendChild(
      el('p', {
        class: 'empty-note',
        text: '구조가 정정·안정 상태가 아니어서 부재 힘을 계산하지 못했습니다.',
      }),
    )
  }

  const materialRow = el('div', {
    class: 'material-mini',
    role: 'group',
    'aria-label': '부재 재료 변경',
  })
  for (const id of ['wood', 'steel'] as MaterialId[]) {
    const item = getMaterial(id)
    materialRow.appendChild(
      el('button', {
        class: `material-mini-button ${member.materialId === id ? 'is-active' : ''}`.trim(),
        type: 'button',
        'aria-pressed': String(member.materialId === id),
        'data-focus-key': `member-material-${id}`,
        title: `${item.nameKo}로 변경`,
        html: `<span class="material-mini-swatch" style="background:${item.color}"></span><span>${item.nameKo}</span><span class="material-mini-cost">${item.costPerMeter} cr/m</span>`,
      }),
    )
    const buttonEl = materialRow.lastElementChild as HTMLButtonElement
    buttonEl.addEventListener('click', () => actions.changeMemberMaterial(member.id, id))
  }
  section.appendChild(materialRow)

  const details = el('dl', { class: 'data-list' })
  details.appendChild(dataRow('길이', geometry ? formatLength(geometry.length) : '—'))
  details.appendChild(dataRow('방향', `${normalizedAngle.toFixed(1)}°`))
  details.appendChild(dataRow('재료', `${material.nameKo} · E ${Math.round(material.E / 1e9)} GPa`))
  details.appendChild(
    dataRow(
      '허용응력',
      result
        ? `${result.force >= 0 ? '인장' : '압축'} ${formatStress(allowable)}`
        : formatStress(allowable),
    ),
  )
  details.appendChild(dataRow('부재 비용', formatCost(cost)))
  if (result) {
    details.appendChild(
      dataRow(
        '응력',
        `${formatStress(result.stress)} (${formatPercent(result.stressUtilization, 1)})`,
      ),
    )
    if (result.force < 0) {
      details.appendChild(
        dataRow(
          '좌굴하중',
          `${formatForce(result.bucklingLoad ?? 0)} (K=1.0, ${formatLength((geometry?.length ?? 0) * 1)})`,
        ),
      )
      details.appendChild(
        dataRow(
          '좌굴 활용률',
          formatPercent(result.bucklingUtilization, 1),
          result.bucklingUtilization > 1 ? 'is-danger' : '',
        ),
      )
    } else {
      details.appendChild(dataRow('좌굴', '인장 부재 — 해당 없음'))
    }
    details.appendChild(
      dataRow(
        '지배 모드',
        result.zeroForce ? '힘 0' : governing === '좌굴' ? '압좌굴 (Euler)' : '응력',
        result.state === 'failed' ? 'is-danger' : '',
      ),
    )
  }
  section.appendChild(details)

  if (result) {
    section.appendChild(
      el(
        'div',
        { class: 'utilization-stack' },
        el('p', { class: 'eyebrow', text: 'UTILIZATION' }),
        el(
          'div',
          { class: 'util-row' },
          el('span', { text: '응력' }),
          utilizationMeter(result.stressUtilization),
        ),
        result.force < 0
          ? el(
              'div',
              { class: 'util-row' },
              el('span', { text: '좌굴' }),
              utilizationMeter(result.bucklingUtilization),
            )
          : null,
        el(
          'div',
          { class: 'util-row util-total' },
          el('span', { text: '종합' }),
          utilizationMeter(result.utilization),
        ),
      ),
    )
  }

  if (result?.zeroForce) {
    section.appendChild(
      el(
        'div',
        { class: 'callout callout-neutral' },
        el('span', { class: 'callout-icon', html: icon('info', 17) }),
        el('p', {
          text: '힘이 0에 가까운 부재입니다. 지금은 힘을 받지 않지만, 구조의 형태를 고정하거나 다른 부재의 좌굴 길이를 줄이는 역할을 할 수 있습니다.',
        }),
      ),
    )
  }

  if (result && result.state !== 'ok' && !result.zeroForce) {
    section.appendChild(
      el(
        'div',
        { class: `callout ${result.state === 'failed' ? 'callout-danger' : 'callout-warning'}` },
        el('span', { class: 'callout-icon', html: icon('warning', 17) }),
        el('p', {
          text:
            result.state === 'failed'
              ? `${governing}이 한계를 넘었습니다. 길이를 줄이거나, 더 강한 재료로 바꾸거나, 부재를 추가해 힘을 나누세요.`
              : '활용률이 80%를 넘었습니다. 여유가 크지 않으니 재료나 배치를 점검하세요.',
        }),
      ),
    )
  }

  section.appendChild(
    button({
      label: '부재 삭제',
      icon: 'trash',
      variant: 'danger',
      size: 'sm',
      focusKey: 'delete-member',
      onClick: () => actions.deleteMember(member.id),
      className: 'inspector-delete',
    }),
  )

  return section
}

function renderNodeInspector(state: AppState, actions: UiActions): HTMLElement {
  const node = state.model.nodes.find((item) => item.id === state.selection.id)
  if (!node) {
    return el('p', { class: 'empty-note', text: '선택한 절점을 찾을 수 없습니다.' })
  }
  const load = state.model.loads.find((item) => item.nodeId === node.id) ?? null
  const attached = state.model.members.filter(
    (member) => member.a === node.id || member.b === node.id,
  )
  const section = el('section', { class: 'panel-section' })
  section.appendChild(sectionHeader('INSPECTOR', `절점 N${node.id}`, closeButton(actions)))

  const positionRow = el(
    'div',
    { class: 'field-row' },
    el(
      'label',
      { class: 'field' },
      el('span', { text: 'x (m)' }),
      el('input', {
        type: 'number',
        step: '1',
        min: '0',
        max: String(MAX_SPAN_METERS),
        value: String(node.x),
        'data-focus-key': 'node-x',
        inputmode: 'decimal',
      }),
    ),
    el(
      'label',
      { class: 'field' },
      el('span', { text: 'y (m)' }),
      el('input', {
        type: 'number',
        step: '1',
        min: '0',
        max: String(MAX_HEIGHT_METERS),
        value: String(node.y),
        'data-focus-key': 'node-y',
        inputmode: 'decimal',
      }),
    ),
  )
  const [xInput, yInput] = positionRow.querySelectorAll<HTMLInputElement>('input')
  const commitPosition = () => {
    const x = Number(xInput.value)
    const y = Number(yInput.value)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    actions.updateNodePosition(node.id, x, y)
  }
  xInput.addEventListener('change', commitPosition)
  yInput.addEventListener('change', commitPosition)
  section.appendChild(positionRow)

  const supportRow = el('div', { class: 'support-row', role: 'group', 'aria-label': '지지대 종류' })
  const supports: Array<{ id: SupportType; label: string; icon: 'close' | 'pin' | 'roller' }> = [
    { id: 'free', label: '없음', icon: 'close' },
    { id: 'pin', label: '핀', icon: 'pin' },
    { id: 'roller', label: '롤러', icon: 'roller' },
  ]
  for (const support of supports) {
    const active = node.support === support.id
    const supportButton = el('button', {
      class: `support-button ${active ? 'is-active' : ''}`.trim(),
      type: 'button',
      'aria-pressed': String(active),
      'data-focus-key': `support-${support.id}`,
      html: `${icon(support.icon, 17)}<span>${support.label}</span>`,
    })
    supportButton.addEventListener('click', () => actions.setSupport(node.id, support.id))
    supportRow.appendChild(supportButton)
  }
  section.appendChild(
    el(
      'div',
      { class: 'inspector-subsection' },
      el('p', { class: 'eyebrow', text: 'SUPPORT' }),
      supportRow,
      el('p', {
        class: 'panel-hint',
        text:
          node.support === 'pin'
            ? '핀은 수평·수직 반력 두 개를 받습니다.'
            : node.support === 'roller'
              ? '롤러는 수직 반력 한 개만 받습니다.'
              : '지지대가 없으면 하중을 받을 때 구조가 떠다닐 수 있습니다.',
      }),
    ),
  )

  const loadSection = el('div', { class: 'inspector-subsection' })
  loadSection.appendChild(el('p', { class: 'eyebrow', text: 'POINT LOAD' }))
  if (load) {
    const loadRow = el(
      'div',
      { class: 'field-row' },
      el(
        'label',
        { class: 'field' },
        el('span', { text: 'Fx (N)' }),
        el('input', {
          type: 'number',
          step: '50',
          min: '-5000',
          max: '5000',
          value: String(load.fx),
          'data-focus-key': 'load-fx',
          inputmode: 'decimal',
        }),
      ),
      el(
        'label',
        { class: 'field' },
        el('span', { text: 'Fy (N)' }),
        el('input', {
          type: 'number',
          step: '50',
          min: '-5000',
          max: '5000',
          value: String(load.fy),
          'data-focus-key': 'load-fy',
          inputmode: 'decimal',
        }),
      ),
    )
    const [fxInput, fyInput] = loadRow.querySelectorAll<HTMLInputElement>('input')
    const commitLoad = () => {
      const fx = Number(fxInput.value)
      const fy = Number(fyInput.value)
      if (!Number.isFinite(fx) || !Number.isFinite(fy)) return
      actions.updateLoad(load.id, fx, fy)
    }
    fxInput.addEventListener('change', commitLoad)
    fyInput.addEventListener('change', commitLoad)
    loadSection.appendChild(loadRow)
    loadSection.appendChild(
      el(
        'div',
        { class: 'load-actions' },
        el(
          'span',
          { class: 'load-summary' },
          `하중 ${formatForce(Math.hypot(load.fx, load.fy))} · ${load.fy < 0 ? '아래' : load.fy > 0 ? '위' : ''}${load.fx < 0 ? ' 왼쪽' : load.fx > 0 ? ' 오른쪽' : ''}`,
        ),
        button({
          label: '하중 삭제',
          variant: 'quiet',
          size: 'sm',
          focusKey: 'delete-load',
          onClick: () => actions.removeLoad(load.id),
        }),
      ),
    )
  } else {
    loadSection.appendChild(el('p', { class: 'panel-hint', text: '이 절점에는 하중이 없습니다.' }))
    loadSection.appendChild(
      button({
        label: '아래로 500 N 추가',
        icon: 'load',
        variant: 'secondary',
        size: 'sm',
        focusKey: 'add-load',
        onClick: () => actions.addLoad(node.id),
      }),
    )
  }
  section.appendChild(loadSection)

  section.appendChild(
    el(
      'div',
      { class: 'inspector-subsection' },
      el('p', { class: 'eyebrow', text: `ATTACHED MEMBERS · ${attached.length}` }),
      attached.length > 0
        ? el(
            'div',
            { class: 'chip-list' },
            ...attached.map((member) =>
              el(
                'button',
                {
                  class:
                    `chip ${state.selection.kind === 'member' && state.selection.id === member.id ? 'is-active' : ''}`.trim(),
                  type: 'button',
                  'data-focus-key': `attached-${member.id}`,
                  onClick: () => actions.select({ kind: 'member', id: member.id }),
                },
                `M${member.id}`,
                el('span', { class: 'chip-sub', text: getMaterial(member.materialId).nameKo }),
              ),
            ),
          )
        : el('p', {
            class: 'panel-hint',
            text: '연결된 부재가 없습니다. 부재 도구로 다른 절점과 연결하세요.',
          }),
    ),
  )

  section.appendChild(
    button({
      label: '절점 삭제',
      icon: 'trash',
      variant: 'danger',
      size: 'sm',
      focusKey: 'delete-node',
      onClick: () => actions.deleteNode(node.id),
      className: 'inspector-delete',
    }),
  )
  return section
}

function renderEmptyInspector(state: AppState): HTMLElement {
  const section = el('section', { class: 'panel-section' })
  section.appendChild(sectionHeader('INSPECTOR', '선택 없음'))
  section.appendChild(
    el(
      'div',
      { class: 'inspector-empty' },
      el('span', { class: 'inspector-empty-icon', html: icon('select', 22) }),
      el('p', { text: '캔버스에서 절점이나 부재를 클릭하면 상세 정보가 표시됩니다.' }),
      el('p', {
        class: 'panel-hint',
        text: '키보드로는 아래 모델 목록에서 원하는 항목을 선택할 수 있습니다. 절점을 끌어 위치를 옮길 수도 있습니다.',
      }),
    ),
  )
  section.appendChild(
    el(
      'div',
      { class: 'assumption-note' },
      badge('2D 이상화', 'accent'),
      el('p', {
        text: `핀 절점, 휨 없음, 좌굴 K=1.0의 수업용 모델입니다. 실제 시공 설계가 아닙니다. 현재 재료 기본값은 ${getMaterial(state.materialId).nameKo}입니다.`,
      }),
    ),
  )
  return section
}

export function renderInspector(state: AppState, actions: UiActions): HTMLElement {
  if (state.selection.kind === 'member' && state.selection.id !== null) {
    return renderMemberInspector(state, actions)
  }
  if (state.selection.kind === 'node' && state.selection.id !== null) {
    return renderNodeInspector(state, actions)
  }
  return renderEmptyInspector(state)
}
