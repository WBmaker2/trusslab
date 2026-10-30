import type { AppState } from '../../app/state'
import type { MissionEvaluation } from '../../features/missions/missions'
import { totalLoadMagnitude } from '../../struct/failure'
import { getMaterial } from '../../struct/materials'
import {
  formatCost,
  formatForce,
  formatLength,
  formatPercent,
  formatSafetyFactor,
} from '../../struct/units'
import { formatFailureReason } from '../../struct/failure'
import { el } from '../dom'
import { icon } from '../icons'
import type { UiActions } from './actions'
import { button, missionCheckList, sectionHeader, statusBadge, utilizationMeter } from './common'

function metric(label: string, value: string, tone = ''): HTMLElement {
  return el(
    'div',
    { class: 'test-metric' },
    el('span', { class: 'test-metric-label', text: label }),
    el('strong', { class: `test-metric-value ${tone}`.trim(), text: value }),
  )
}

export function renderTestPanel(
  state: AppState,
  actions: UiActions,
  evaluation: MissionEvaluation | null,
): HTMLElement {
  const analysis = state.analysis
  const result = analysis.result
  const test = state.test
  const loadN = totalLoadMagnitude(state.model)
  const isTestRoute = state.route === 'test'
  const determinate = analysis.determinacy.status === 'determinate'
  const canRun = determinate && loadN > 0
  const failure = test.result?.failure ?? null
  const failedMember = failure
    ? state.model.members.find((member) => member.id === failure.memberId)
    : null
  const failedResult = failure
    ? result?.members.find((member) => member.memberId === failure.memberId)
    : null
  const done = test.status === 'done'
  const running = test.status === 'running'
  const passed = done && test.result?.passed === true && !test.result.unstable
  const started = test.status !== 'idle'

  const section = el('section', { class: 'panel-section test-panel' })
  section.appendChild(sectionHeader('LOAD TEST', '하중 시험'))

  section.appendChild(
    el(
      'div',
      { class: 'test-hero' },
      el(
        'div',
        {},
        el('span', { class: 'test-hero-label', text: '설계 하중' }),
        el('strong', {
          class: 'test-hero-value',
          text: loadN > 0 ? formatForce(loadN) : '하중 없음',
        }),
        el('span', {
          class: 'test-hero-sub',
          text: determinate
            ? '10단계로 0에서 설계 하중까지 올립니다.'
            : '구조가 정정·안정 상태일 때만 시험할 수 있습니다.',
        }),
      ),
      statusBadge(analysis.determinacy),
    ),
  )

  const progress = done ? 1 : test.progress
  const stepLabel = `${Math.min(10, Math.ceil(progress * 10))} / 10 단계`
  const currentLoad = loadN * progress * (failure ? failure.scale : 1)
  const currentUtil = (result?.maxUtilization ?? 0) * progress * (failure ? failure.scale : 1)

  const progressCard = el(
    'div',
    { class: `test-progress-card ${running ? 'is-running' : ''}`.trim() },
    el(
      'div',
      { class: 'test-progress-head' },
      el('span', {
        class: 'test-progress-title',
        text: running ? '하중을 올리는 중…' : done ? '시험 완료' : '시험 준비',
      }),
      el('span', { class: 'test-progress-step', id: 'test-progress-label', text: stepLabel }),
    ),
    el(
      'div',
      {
        class: 'test-progress-track',
        role: 'progressbar',
        'aria-label': '하중 시험 진행',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(Math.round(progress * 100)),
      },
      el('div', {
        class: 'test-progress-fill',
        id: 'test-progress-fill',
        style: { width: `${Math.round(progress * 100)}%` },
      }),
    ),
    el(
      'div',
      { class: 'test-progress-nums' },
      el(
        'span',
        {},
        '현재 하중 ',
        el('strong', { id: 'test-current-load', text: formatForce(currentLoad) }),
      ),
      el(
        'span',
        {},
        '최대 활용률 ',
        el('strong', { id: 'test-current-util', text: formatPercent(currentUtil, 0) }),
      ),
    ),
  )
  section.appendChild(progressCard)

  const actionRow = el('div', { class: 'test-actions' })
  actionRow.appendChild(
    button({
      label: running ? '시험 중…' : done ? '다시 시험' : '하중 시험 실행',
      icon: running ? 'rotate' : 'play',
      variant: 'primary',
      size: 'md',
      focusKey: 'test-run',
      disabled: running || !canRun,
      pulse: !running && !done && canRun,
      onClick: actions.runTest,
    }),
  )
  actionRow.appendChild(
    button({
      label: '설계로 돌아가기',
      icon: 'arrowRight',
      variant: 'secondary',
      size: 'md',
      focusKey: 'test-back',
      onClick: actions.backToDesign,
      className: isTestRoute ? '' : 'is-hidden',
    }),
  )
  section.appendChild(actionRow)

  if (!determinate) {
    section.appendChild(
      el(
        'div',
        { class: 'test-result-card tone-danger' },
        el('div', {
          class: 'test-result-head',
          html: `${icon('warning', 18)}<strong>구조가 아직 안정하지 않습니다</strong>`,
        }),
        el('p', { text: analysis.determinacy.reasonKo }),
        el('p', {
          class: 'test-result-note',
          text: '부재나 지지대를 추가해 삼각형 구속을 완성한 뒤 다시 시험하세요.',
        }),
      ),
    )
  } else if (loadN <= 0) {
    section.appendChild(
      el(
        'div',
        { class: 'test-result-card tone-warning' },
        el('div', {
          class: 'test-result-head',
          html: `${icon('info', 18)}<strong>하중이 없습니다</strong>`,
        }),
        el('p', {
          text: '하중 도구로 절점을 클릭해 하중을 추가하세요. 하중이 없으면 시험할 것이 없습니다.',
        }),
      ),
    )
  }

  if (done && failure) {
    section.appendChild(
      el(
        'div',
        { class: 'test-result-card tone-danger' },
        el(
          'div',
          { class: 'test-result-head' },
          el('span', { class: 'test-result-icon', html: icon('warning', 20) }),
          el(
            'div',
            {},
            el('p', { class: 'eyebrow', text: 'FIRST FAILURE' }),
            el('strong', { text: '부재가 먼저 파괴됩니다' }),
          ),
        ),
        el('p', {
          class: 'failure-headline',
          text: `M${failure.memberId} · ${formatFailureReason(failure)}`,
        }),
        el(
          'div',
          { class: 'failure-grid' },
          el('span', {}, '파괴 하중', el('strong', { text: formatForce(failure.loadN) })),
          el('span', {}, '목표 대비', el('strong', { text: formatPercent(failure.scale, 0) })),
          el(
            'span',
            {},
            '종합 활용률',
            el('strong', { text: formatPercent(failure.utilization, 0) }),
          ),
          el(
            'span',
            {},
            '응력 / 좌굴',
            el('strong', {
              text: `${formatPercent(failure.stressUtilization, 0)} / ${formatPercent(failure.bucklingUtilization, 0)}`,
            }),
          ),
        ),
        el('p', {
          class: 'test-result-note',
          text: failedMember
            ? `M${failedMember.id}은 ${getMaterial(failedMember.materialId).nameKo} ${formatLength(failedResult?.length ?? 0)} 부재입니다. 좌굴이 응력보다 먼저 한계에 닿았는지 오른쪽 힘 표에서 함께 확인하세요.`
            : '첫 파괴 지점에서 시험을 멈췄습니다.',
        }),
        button({
          label: `M${failure.memberId} 선택`,
          icon: 'member',
          variant: 'secondary',
          size: 'sm',
          focusKey: 'select-failed-member',
          onClick: () => actions.select({ kind: 'member', id: failure.memberId }),
        }),
      ),
    )
  } else if (done && passed) {
    const safeLoad =
      result && result.maxUtilization > 0 ? loadN / result.maxUtilization : Number.POSITIVE_INFINITY
    section.appendChild(
      el(
        'div',
        { class: 'test-result-card tone-safe' },
        el(
          'div',
          { class: 'test-result-head' },
          el('span', { class: 'test-result-icon', html: icon('check', 20) }),
          el(
            'div',
            {},
            el('p', { class: 'eyebrow', text: 'PASS' }),
            el('strong', { text: '목표 하중에서 견딥니다' }),
          ),
        ),
        el(
          'div',
          { class: 'failure-grid' },
          el(
            'span',
            {},
            '최대 활용률',
            el('strong', { text: formatPercent(result?.maxUtilization ?? 0, 0) }),
          ),
          el(
            'span',
            {},
            '안전율',
            el('strong', {
              text: formatSafetyFactor(result?.factorOfSafety ?? Number.POSITIVE_INFINITY),
            }),
          ),
          el(
            'span',
            {},
            '예상 첫 파괴 하중',
            el('strong', { text: Number.isFinite(safeLoad) ? formatForce(safeLoad) : '없음' }),
          ),
          el('span', {}, '비용', el('strong', { text: formatCost(analysis.cost) })),
        ),
        el('p', {
          class: 'test-result-note',
          text: '안전율은 1 ÷ 최대 활용률입니다. 시험은 첫 파괴에서 멈추므로, 여유가 큰 설계일수록 더 무거운 하중까지 버팁니다.',
        }),
      ),
    )
  } else if (done) {
    section.appendChild(
      el(
        'div',
        { class: 'test-result-card tone-warning' },
        el('div', {
          class: 'test-result-head',
          html: `${icon('warning', 18)}<strong>시험을 완료하지 못했습니다</strong>`,
        }),
        el('p', { text: '구조가 불안정하거나 하중이 없어 시험을 진행할 수 없습니다.' }),
      ),
    )
  }

  if (started && result) {
    section.appendChild(
      el(
        'div',
        { class: 'test-metrics-grid' },
        metric(
          '최대 활용률',
          formatPercent(result.maxUtilization, 0),
          result.maxUtilization > 1 ? 'is-danger' : '',
        ),
        metric('안전율', formatSafetyFactor(result.factorOfSafety)),
        metric('비용', formatCost(analysis.cost)),
        metric('부재', `${state.model.members.length}개`),
      ),
    )
    section.appendChild(
      el(
        'div',
        { class: 'test-bar-row' },
        el('span', { class: 'test-bar-label', text: '목표 하중 활용률' }),
        utilizationMeter(result.maxUtilization),
      ),
    )
  }

  if (!started && determinate && loadN > 0) {
    const predicted = result?.maxUtilization ?? 0
    section.appendChild(
      el(
        'div',
        { class: 'test-guide' },
        el('p', { class: 'eyebrow', text: 'HOW IT WORKS' }),
        el(
          'ol',
          { class: 'test-guide-list' },
          el('li', { text: '하중을 0에서 설계 하중까지 10단계로 올립니다.' }),
          el('li', { text: '각 단계에서 응력 활용률과 좌굴 활용률을 계산합니다.' }),
          el('li', { text: '종합 활용률이 1.0을 처음 넘는 부재에서 멈추고 파괴를 표시합니다.' }),
        ),
        el('p', {
          class: 'panel-hint',
          text:
            predicted > 1
              ? `현재 설계는 목표 하중에서 최대 활용률 ${formatPercent(predicted, 0)}로 예상 파괴됩니다.`
              : `현재 설계의 목표 하중 예상 최대 활용률은 ${formatPercent(predicted, 0)}입니다.`,
        }),
      ),
    )
  }

  if (evaluation) {
    section.appendChild(
      el(
        'div',
        { class: 'test-mission-checks' },
        el('p', { class: 'eyebrow', text: 'MISSION' }),
        missionCheckList(evaluation.checks),
        !evaluation.passed ? el('p', { class: 'mission-hint', text: evaluation.hintKo }) : null,
      ),
    )
  }

  return section
}
