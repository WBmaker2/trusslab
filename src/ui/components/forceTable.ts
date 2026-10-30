import type { AppState, TableSortKey } from '../../app/state'
import { getMaterial } from '../../struct/materials'
import type { MemberResult } from '../../struct/types'
import {
  formatForce,
  formatLength,
  formatPercent,
  formatSignedForce,
  formatStress,
} from '../../struct/units'
import { el } from '../dom'
import { icon } from '../icons'
import type { UiActions } from './actions'
import {
  button,
  emptyNote,
  sectionHeader,
  stateLabel,
  typeBadgeCompact,
  utilizationMeter,
} from './common'

interface ColumnDefinition {
  key: TableSortKey | null
  label: string
  className?: string
}

const COLUMNS: ColumnDefinition[] = [
  { key: 'member', label: '부재', className: 'col-member' },
  { key: 'force', label: '힘', className: 'col-force' },
  { key: 'utilization', label: '활용률', className: 'col-util' },
  { key: 'state', label: '상태', className: 'col-state' },
  { key: 'length', label: '길이', className: 'col-length' },
]

function sortMembers(
  members: MemberResult[],
  key: TableSortKey,
  direction: 'asc' | 'desc',
): MemberResult[] {
  const stateRank = (item: MemberResult) =>
    item.state === 'failed' ? 3 : item.state === 'warning' ? 2 : 1
  const sorted = [...members].sort((a, b) => {
    switch (key) {
      case 'member':
        return a.memberId - b.memberId
      case 'force':
        return Math.abs(a.force) - Math.abs(b.force)
      case 'stress':
        return Math.abs(a.stress) - Math.abs(b.stress)
      case 'length':
        return a.length - b.length
      case 'state':
        return stateRank(a) - stateRank(b)
      case 'utilization':
      default:
        return a.utilization - b.utilization
    }
  })
  return direction === 'asc' ? sorted : sorted.reverse()
}

export function renderForceTable(state: AppState, actions: UiActions): HTMLElement {
  const section = el('section', { class: 'panel-section force-section' })
  const result = state.analysis.result
  const action = result
    ? el('span', { class: 'table-count', text: `${result.members.length}개 부재` })
    : null
  section.appendChild(sectionHeader('FORCES', '부재 힘 표', action ?? undefined))

  if (!result) {
    const reason =
      state.analysis.determinacy.status === 'empty'
        ? '절점을 놓고 부재를 연결하면 힘 표가 나타납니다.'
        : state.analysis.determinacy.status === 'indeterminate'
          ? '부정정 구조는 아직 해석하지 않습니다. 여분 부재를 하나 줄여 정정 구조로 만드세요.'
          : '구조가 안정되면 부재 힘을 계산합니다. 부재나 지지대를 추가해 삼각형 구속을 완성하세요.'
    const box = el(
      'div',
      { class: 'table-empty' },
      el('span', { class: 'table-empty-icon', html: icon('gauge', 22) }),
      el('p', { class: 'table-empty-title', text: '아직 힘을 계산할 수 없습니다' }),
      el('p', { class: 'panel-hint', text: reason }),
      state.analysis.determinacy.reasonKo
        ? el('p', { class: 'table-empty-reason', text: state.analysis.determinacy.reasonKo })
        : null,
    )
    section.appendChild(box)
    return section
  }

  const sorted = sortMembers(result.members, state.tableSort.key, state.tableSort.direction)
  const wrapper = el('div', { class: 'table-scroll' })
  const table = el('table', { class: 'force-table' })
  table.appendChild(
    el(
      'caption',
      { class: 'sr-only' },
      '부재 힘 표. +는 인장, −는 압축. 활용률은 응력과 좌굴 중 큰 값입니다.',
    ),
  )
  const thead = el('thead')
  const headerRow = el('tr')
  for (const column of COLUMNS) {
    const isSorted = state.tableSort.key === column.key
    const th = el('th', {
      scope: 'col',
      class: column.className,
      'aria-sort': isSorted
        ? state.tableSort.direction === 'asc'
          ? 'ascending'
          : 'descending'
        : 'none',
    })
    if (column.key) {
      const label = el(
        'button',
        {
          class: `sort-button ${isSorted ? 'is-sorted' : ''}`.trim(),
          type: 'button',
          'data-focus-key': `sort-${column.key}`,
          'aria-label': `${column.label} 기준 정렬`,
        },
        el('span', { text: column.label }),
        el('span', {
          class: 'sort-arrow',
          'aria-hidden': 'true',
          text: isSorted ? (state.tableSort.direction === 'asc' ? '↑' : '↓') : '↕',
        }),
      )
      label.addEventListener('click', () => actions.setSort(column.key as TableSortKey))
      th.appendChild(label)
    } else {
      th.textContent = column.label
    }
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = el('tbody')
  for (const member of sorted) {
    const selected = state.selection.kind === 'member' && state.selection.id === member.memberId
    const row = el('tr', {
      class:
        `force-row ${selected ? 'is-selected' : ''} ${member.state === 'failed' ? 'is-failed' : ''}`.trim(),
      'data-member-id': member.memberId,
    })
    const memberCell = el('td', { class: 'col-member' })
    const selectButton = el('button', {
      class: 'row-select',
      type: 'button',
      'aria-pressed': String(selected),
      'data-focus-key': `row-member-${member.memberId}`,
      'aria-label': `부재 M${member.memberId} 선택`,
      text: `M${member.memberId}`,
    })
    selectButton.addEventListener('click', (event) => {
      event.stopPropagation()
      actions.select({ kind: 'member', id: member.memberId })
    })
    memberCell.appendChild(selectButton)
    row.appendChild(memberCell)

    row.appendChild(
      el(
        'td',
        { class: 'col-force' },
        el(
          'span',
          { class: 'force-cell' },
          typeBadgeCompact(member),
          el('span', {
            class: 'num',
            text: member.zeroForce ? '0.0 N' : formatSignedForce(member.force),
          }),
        ),
      ),
    )
    const utilCell = el('td', { class: 'col-util' })
    utilCell.appendChild(utilizationMeter(member.utilization))
    row.appendChild(utilCell)
    row.appendChild(
      el(
        'td',
        { class: 'col-state' },
        el('span', {
          class: `state-text state-${member.state}`,
          text: stateLabel(member.state),
        }),
      ),
    )
    row.appendChild(
      el('td', {
        class: 'col-length num',
        text: formatLength(member.length),
      }),
    )
    row.addEventListener('click', () => actions.select({ kind: 'member', id: member.memberId }))
    tbody.appendChild(row)
  }
  table.appendChild(tbody)
  wrapper.appendChild(table)
  section.appendChild(wrapper)
  section.appendChild(
    el(
      'p',
      { class: 'table-footnote' },
      '+ 인장 · − 압축. 활용률 80% 이상은 주의, 100% 초과는 파괴입니다.',
    ),
  )
  return section
}

export function renderReadTruss(state: AppState): HTMLElement | null {
  const result = state.analysis.result
  if (!result) return null
  const details = el('details', { class: 'read-truss' })
  details.appendChild(el('summary', {}, `글로 읽는 트러스 (${result.members.length}개 부재)`))
  const list = el('ul', { class: 'read-list' })
  for (const member of result.members) {
    const modelMember = state.model.members.find((item) => item.id === member.memberId)
    const material = getMaterial(modelMember?.materialId ?? member.materialId)
    const type = member.zeroForce ? '힘 0' : member.force > 0 ? '인장' : '압축'
    const governing = member.zeroForce
      ? '힘이 거의 걸리지 않습니다. 그래도 구조 안정성에 필요할 수 있습니다.'
      : member.bucklingUtilization > member.stressUtilization
        ? '좌굴이 지배적입니다.'
        : '응력이 지배적입니다.'
    list.appendChild(
      el(
        'li',
        {},
        el(
          'span',
          { class: 'read-member' },
          `M${member.memberId}`,
          el('span', { class: 'read-sep', text: '·' }),
          `${type} ${formatForce(Math.abs(member.force))}`,
          el('span', { class: 'read-sep', text: '·' }),
          `${material.nameKo} ${formatLength(member.length)}`,
        ),
        el('span', {
          class: 'read-detail',
          text: `응력 ${formatStress(member.stress)}, 응력 활용률 ${formatPercent(member.stressUtilization, 0)}, 좌굴 활용률 ${formatPercent(member.bucklingUtilization, 0)}. ${governing}`,
        }),
      ),
    )
  }
  details.appendChild(list)
  return details
}

export function renderModelList(state: AppState, actions: UiActions): HTMLElement {
  const details = el('details', { class: 'model-list' })
  details.appendChild(
    el(
      'summary',
      {},
      `모델 목록`,
      el('span', {
        class: 'model-list-count',
        text: `N${state.model.nodes.length} · M${state.model.members.length}`,
      }),
    ),
  )
  if (state.model.nodes.length === 0) {
    details.appendChild(emptyNote('아직 절점이 없습니다.'))
    return details
  }
  details.appendChild(el('p', { class: 'eyebrow', text: 'NODES' }))
  const nodeList = el('div', { class: 'chip-list' })
  for (const node of state.model.nodes) {
    const selected = state.selection.kind === 'node' && state.selection.id === node.id
    nodeList.appendChild(
      el(
        'button',
        {
          class: `chip ${selected ? 'is-active' : ''}`.trim(),
          type: 'button',
          'data-focus-key': `list-node-${node.id}`,
          onClick: () => actions.select({ kind: 'node', id: node.id }),
          'aria-pressed': String(selected),
        },
        `N${node.id}`,
        el('span', {
          class: 'chip-sub',
          text: `(${node.x}, ${node.y}) ${node.support === 'pin' ? '핀' : node.support === 'roller' ? '롤러' : ''}`.trim(),
        }),
      ),
    )
  }
  details.appendChild(nodeList)
  if (state.model.members.length > 0) {
    details.appendChild(el('p', { class: 'eyebrow', text: 'MEMBERS' }))
    const memberList = el('div', { class: 'chip-list' })
    for (const member of state.model.members) {
      const selected = state.selection.kind === 'member' && state.selection.id === member.id
      memberList.appendChild(
        el(
          'button',
          {
            class: `chip ${selected ? 'is-active' : ''}`.trim(),
            type: 'button',
            'data-focus-key': `list-member-${member.id}`,
            onClick: () => actions.select({ kind: 'member', id: member.id }),
            'aria-pressed': String(selected),
          },
          `M${member.id}`,
          el('span', {
            class: 'chip-sub',
            text: `N${member.a}–N${member.b} · ${getMaterial(member.materialId).nameKo}`,
          }),
        ),
      )
    }
    details.appendChild(memberList)
  }
  return details
}

export function renderRightPanel(
  state: AppState,
  actions: UiActions,
  inspector: HTMLElement,
): HTMLElement {
  const inner = el('div', { class: 'panel-inner' })
  const table = renderForceTable(state, actions)
  if (state.route === 'test') {
    inner.appendChild(table)
    inner.appendChild(inspector)
  } else {
    inner.appendChild(inspector)
    inner.appendChild(table)
  }
  const read = renderReadTruss(state)
  if (read) inner.appendChild(read)
  inner.appendChild(renderModelList(state, actions))
  if (state.route === 'test' && !state.analysis.result) {
    inner.appendChild(
      el(
        'div',
        { class: 'test-side-note' },
        button({
          label: '설계로 돌아가기',
          icon: 'arrowRight',
          variant: 'primary',
          size: 'sm',
          pulse: true,
          focusKey: 'test-side-back',
          onClick: actions.backToDesign,
        }),
      ),
    )
  }
  return inner
}
