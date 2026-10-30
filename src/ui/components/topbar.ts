import type { AppState } from '../../app/state'
import { ROUTES } from '../../app/routes'
import { brandMark, icon } from '../icons'
import { el } from '../dom'
import { iconButton } from './common'
import type { UiActions } from './actions'

export function renderTopbar(
  state: AppState,
  actions: UiActions,
  history: { canUndo: boolean; canRedo: boolean },
): HTMLElement {
  const brand = el(
    'a',
    { class: 'brand', href: '#/design', title: 'TrussLab 홈' },
    el('span', { class: 'brand-mark', html: brandMark(32) }),
    el(
      'span',
      { class: 'brand-text' },
      el('span', { class: 'brand-name', text: 'TrussLab' }),
      el('span', { class: 'brand-sub', text: '구조 실험실' }),
    ),
  )

  const nav = el('nav', { class: 'route-nav', 'aria-label': '주요 화면' })
  for (const route of ROUTES) {
    const isCurrent = state.route === route.id
    const tab = el(
      'button',
      {
        class: `route-tab ${isCurrent ? 'is-current' : ''}`.trim(),
        type: 'button',
        'data-focus-key': `route-${route.id}`,
        'aria-current': isCurrent ? 'page' : undefined,
      },
      el('span', { text: route.labelKo }),
    )
    tab.addEventListener('click', () => actions.navigate(route.id))
    nav.appendChild(tab)
  }

  const actionsBar = el(
    'div',
    { class: 'topbar-actions' },
    iconButton('undo', '실행 취소', actions.undo, {
      focusKey: 'undo',
      size: 'sm',
      disabled: !history.canUndo,
    }),
    iconButton('redo', '다시 실행', actions.redo, {
      focusKey: 'redo',
      size: 'sm',
      disabled: !history.canRedo,
    }),
    iconButton('reset', '새로 만들기', actions.resetModel, {
      focusKey: 'reset-model',
      size: 'sm',
    }),
    el('button', {
      class: 'btn btn-ghost btn-sm topbar-help',
      type: 'button',
      'data-focus-key': 'help',
      title: '도움말과 가정',
      html: `${icon('help', 18)}<span class="btn-label">도움말</span>`,
    }),
  )
  const helpButton = actionsBar.querySelector<HTMLButtonElement>('[data-focus-key="help"]')
  helpButton?.addEventListener('click', actions.openHelp)

  return el('div', { class: 'topbar-inner' }, brand, nav, actionsBar)
}
