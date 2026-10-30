import type { AppState, MobileTab } from '../../app/state'
import type { MissionEvaluation } from '../../features/missions/missions'
import { getMission } from '../../features/missions/missions'
import { formatCost, formatSafetyFactor } from '../../struct/units'
import { computeDisplayDeflection, deflectionFactorLabel } from '../../render/Deflection'
import { el } from '../dom'
import { icon } from '../icons'
import type { UiActions } from './actions'
import {
  badge,
  button,
  conceptBadge,
  firstWarning,
  iconButton,
  statusBadge,
  utilizationMeter,
  warningTone,
} from './common'

export function renderStageHeader(
  state: AppState,
  actions: UiActions,
  zoomLabel: string,
): HTMLElement {
  const mission = getMission(state.mission.currentId)
  const isTest = state.route === 'test'
  const is3d = state.view === '3d'
  const title = isTest ? '하중 시험' : '트러스 설계'
  const sub = is3d
    ? isTest
      ? '같은 2D 해석 결과를 3D 교량으로 봅니다. 드래그로 회전하고 스크롤로 확대하세요. 편집은 2D에서 합니다.'
      : '2D 해석을 3D 교량으로 표현합니다. 드래그로 회전하고 스크롤로 확대하세요. 편집은 2D로 돌아가서 합니다.'
    : isTest
      ? '10단계 하중 램프로 첫 파괴 부재를 찾습니다. 초록은 안전, 노랑은 주의, 빨강은 파괴입니다.'
      : '격자를 클릭해 절점을 놓고, 부재 도구로 연결하세요. 왼쪽 지지대와 아래쪽 하중을 먼저 확인하세요.'

  const titleBlock = el(
    'div',
    { class: 'stage-title-block' },
    el('p', {
      class: 'eyebrow',
      text: isTest ? `LOAD TEST · ${is3d ? '3D' : '2D'}` : `WORKBENCH · ${is3d ? '3D' : '2D'}`,
    }),
    el(
      'div',
      { class: 'stage-title-row' },
      el('h1', { class: 'stage-title', text: title }),
      mission
        ? el(
            'span',
            { class: 'mission-chip' },
            conceptBadge(mission.concept),
            el('span', { text: mission.titleKo }),
          )
        : null,
    ),
    el('p', { class: 'stage-sub', text: sub }),
  )

  const overlayDefs: Array<{
    key: 'grid' | 'labels' | 'forces' | 'stress' | 'deflection'
    label: string
    icon: Parameters<typeof iconButton>[0]
  }> = [
    { key: 'grid', label: '격자', icon: 'grid' },
    { key: 'labels', label: '라벨', icon: 'label' },
    { key: 'forces', label: '힘', icon: 'force' },
    { key: 'stress', label: '활용률', icon: 'gauge' },
    { key: 'deflection', label: '변형', icon: 'curve' },
  ]

  const overlays = el('div', { class: 'overlay-toggles', role: 'group', 'aria-label': '표시 항목' })
  for (const def of overlayDefs) {
    if (state.view === '3d' && def.key === 'grid') continue
    if (state.route === 'test' && def.key === 'deflection') continue
    const active = state.overlays[def.key]
    const toggle = iconButton(
      def.icon,
      `${def.label} 표시`,
      () => actions.setOverlay(def.key, !active),
      {
        focusKey: `overlay-${def.key}`,
        pressed: active,
        variant: active ? 'secondary' : 'ghost',
        size: 'sm',
        className: `overlay-toggle ${active ? 'is-active' : ''}`.trim(),
      },
    )
    toggle.appendChild(el('span', { class: 'overlay-toggle-label', text: def.label }))
    overlays.appendChild(toggle)
  }

  const zoomControls =
    state.view === '2d'
      ? el(
          'div',
          { class: 'zoom-controls', role: 'group', 'aria-label': '확대 및 화면 맞춤' },
          iconButton('fit', '화면 맞춤', actions.fitCanvas, { focusKey: 'zoom-fit', size: 'sm' }),
          iconButton('zoomOut', '축소', () => actions.zoomCanvas(1 / 1.2), {
            focusKey: 'zoom-out',
            size: 'sm',
          }),
          el('span', {
            class: 'zoom-readout',
            id: 'zoom-readout',
            text: zoomLabel,
            'aria-live': 'polite',
          }),
          iconButton('zoomIn', '확대', () => actions.zoomCanvas(1.2), {
            focusKey: 'zoom-in',
            size: 'sm',
          }),
        )
      : el(
          'div',
          { class: 'three-badge' },
          el('span', { class: 'badge badge-accent', text: '3D' }),
          el('span', { text: '2D 해석을 3D로 표현' }),
        )

  const viewToggle = el('div', {
    class: 'segmented view-toggle',
    role: 'group',
    'aria-label': '보기 방식',
  })
  for (const view of ['2d', '3d'] as const) {
    const isActive = state.view === view
    const viewButton = button({
      label: view === '2d' ? '2D' : '3D',
      icon: view === '2d' ? 'layers' : 'cube',
      size: 'sm',
      variant: isActive ? 'secondary' : 'quiet',
      pressed: isActive,
      focusKey: `view-${view}`,
      onClick: () => actions.setView(view),
    })
    viewToggle.appendChild(viewButton)
  }

  return el(
    'div',
    { class: 'stage-head' },
    titleBlock,
    el('div', { class: 'stage-controls' }, overlays, zoomControls, viewToggle),
  )
}

export function renderWarningBanner(state: AppState, actions: UiActions): Node {
  if (state.analysis.warnings.length === 0) return document.createDocumentFragment()
  const warning = firstWarning(state.analysis.warnings)
  if (!warning) return document.createDocumentFragment()
  const tone = warningTone(warning)
  const extra = state.analysis.warnings.length - 1
  const banner = el(
    'div',
    { class: `warning-banner tone-${tone}`, role: 'status' },
    el('span', { class: 'warning-icon', html: icon(tone === 'danger' ? 'warning' : 'info', 17) }),
    el('span', { class: 'warning-text', text: warning.messageKo }),
    extra > 0
      ? button({
          label: `모두 보기 (${extra + 1})`,
          variant: 'ghost',
          size: 'sm',
          focusKey: 'warnings-all',
          onClick: actions.openWarnings,
        })
      : null,
  )
  return banner
}

export function renderStageStatus(
  state: AppState,
  actions: UiActions,
  evaluation: MissionEvaluation | null,
): HTMLElement {
  const analysis = state.analysis
  const result = analysis.result
  const mission = getMission(state.mission.currentId)
  const budget = mission?.setup.maxCost
  const isTest = state.route === 'test'

  const metrics = el('div', { class: 'status-metrics' })
  if (result) {
    metrics.append(
      el(
        'div',
        { class: 'status-metric' },
        el('span', { class: 'status-metric-label', text: '최대 활용률' }),
        utilizationMeter(result.maxUtilization),
      ),
      el(
        'div',
        { class: 'status-metric' },
        el('span', { class: 'status-metric-label', text: '안전율' }),
        el('strong', {
          class: 'status-metric-value',
          text: formatSafetyFactor(result.factorOfSafety),
        }),
      ),
    )
  } else {
    metrics.appendChild(
      el(
        'div',
        { class: 'status-metric' },
        el('span', { class: 'status-metric-label', text: '해석' }),
        el('strong', { class: 'status-metric-value is-muted', text: '대기' }),
      ),
    )
  }
  metrics.appendChild(
    el(
      'div',
      { class: 'status-metric' },
      el('span', { class: 'status-metric-label', text: '비용' }),
      el('strong', {
        class:
          `status-metric-value ${budget !== undefined && analysis.cost > budget ? 'is-danger' : ''}`.trim(),
        text:
          budget !== undefined
            ? `${formatCost(analysis.cost)} / ${formatCost(budget)}`
            : formatCost(analysis.cost),
      }),
    ),
  )

  const testButton = isTest
    ? button({
        label: '다시 시험',
        icon: 'rotate',
        variant: 'secondary',
        size: 'sm',
        focusKey: 'test-rerun',
        onClick: actions.runTest,
      })
    : button({
        label: '하중 시험',
        icon: 'play',
        variant: 'primary',
        size: 'md',
        focusKey: 'test-cta',
        pulse: analysis.determinacy.status === 'determinate',
        onClick: actions.runTest,
      })

  const actionsBar = el(
    'div',
    { class: 'status-actions' },
    isTest
      ? button({
          label: '설계로',
          icon: 'arrowRight',
          variant: 'quiet',
          size: 'sm',
          focusKey: 'back-to-design',
          onClick: actions.backToDesign,
        })
      : null,
    testButton,
  )

  return el(
    'div',
    { class: 'stage-status' },
    el(
      'div',
      { class: 'status-main' },
      statusBadge(analysis.determinacy),
      el(
        'span',
        { class: 'status-counts' },
        `N${state.model.nodes.length} · M${state.model.members.length} · 하중 ${state.model.loads.length}`,
      ),
      evaluation?.passed ? badge('미션 통과', 'safe') : null,
    ),
    metrics,
    actionsBar,
  )
}

export interface MobileTabDefinition {
  id: MobileTab
  label: string
  icon: Parameters<typeof iconButton>[0]
}

export function mobileTabsFor(route: AppState['route']): MobileTabDefinition[] {
  if (route === 'test') {
    return [
      { id: 'test', label: '시험', icon: 'play' },
      { id: 'forces', label: '힘', icon: 'gauge' },
    ]
  }
  return [
    { id: 'build', label: '도구', icon: 'select' },
    { id: 'forces', label: '힘', icon: 'gauge' },
    { id: 'mission', label: '미션', icon: 'flag' },
  ]
}

export function renderMobileTabs(state: AppState, actions: UiActions): HTMLElement {
  const tabs = mobileTabsFor(state.route)
  const bar = el('div', {
    class: 'mobile-tabs',
    role: 'tablist',
    'aria-label': '작업 패널',
  })
  for (const tab of tabs) {
    const active = state.mobileTab === tab.id
    const tabButton = el('button', {
      class: `mobile-tab ${active ? 'is-active' : ''}`.trim(),
      type: 'button',
      role: 'tab',
      'aria-selected': String(active),
      'aria-controls':
        tab.id === 'forces' ? 'panel-right' : tab.id === 'test' ? 'panel-left' : 'panel-left',
      'data-focus-key': `mobile-tab-${tab.id}`,
      tabindex: active ? '0' : '-1',
      html: `${icon(tab.icon, 17)}<span>${tab.label}</span>`,
    })
    tabButton.addEventListener('click', () => actions.setMobileTab(tab.id))
    tabButton.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const index = tabs.findIndex((item) => item.id === tab.id)
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = tabs[(index + delta + tabs.length) % tabs.length]
      actions.setMobileTab(next.id)
      window.setTimeout(() => {
        document
          .querySelector<HTMLButtonElement>(`[data-focus-key="mobile-tab-${next.id}"]`)
          ?.focus()
      }, 0)
    })
    bar.appendChild(tabButton)
  }
  return bar
}

export function renderHud(state: AppState): HTMLElement {
  const deflection = computeDisplayDeflection(state.analysis.result)
  const showDeflection =
    deflection.available &&
    ((state.route === 'test' && state.test.status !== 'idle') || state.overlays.deflection)
  return el(
    'div',
    { class: 'canvas-hud', 'aria-hidden': 'true' },
    el(
      'div',
      { class: 'hud-chip hud-coord' },
      el('span', { class: 'hud-dot' }),
      el('span', { id: 'cursor-readout', text: 'x —, y —' }),
    ),
    el(
      'div',
      { class: 'hud-badges' },
      badge(state.view === '2d' ? '2D 이상화 모델' : '2D 해석을 3D로 표현', 'accent'),
      showDeflection
        ? badge(`변형 ${deflectionFactorLabel(deflection.factor)}`, 'warning', 'hud-deflection')
        : null,
      badge('정정 구조만 해석', 'neutral'),
    ),
  )
}
