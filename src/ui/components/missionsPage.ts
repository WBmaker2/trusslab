import type { AppState } from '../../app/state'
import type { Mission } from '../../features/missions/missions'
import {
  MISSIONS,
  getMission,
  isPredictionCorrect,
  missionProgress,
} from '../../features/missions/missions'
import { formatForce } from '../../struct/units'
import { el } from '../dom'
import { icon } from '../icons'
import type { UiActions } from './actions'
import { badge, button, conceptBadge, difficultyDots } from './common'

function setupSummary(mission: Mission): string {
  const parts: string[] = []
  if (mission.setup.targetLoadN) parts.push(`목표 ${formatForce(mission.setup.targetLoadN)}`)
  if (mission.setup.maxMembers) parts.push(`부재 ≤ ${mission.setup.maxMembers}`)
  if (mission.setup.memberCount) parts.push(`부재 ${mission.setup.memberCount}개`)
  if (mission.setup.maxCost) parts.push(`예산 ${mission.setup.maxCost.toLocaleString('ko-KR')} cr`)
  if (mission.setup.selectZeroForceMember) parts.push('영부재 선택')
  return parts.join(' · ')
}

function missionCard(
  mission: Mission,
  index: number,
  state: AppState,
  actions: UiActions,
  recommended: boolean,
): HTMLElement {
  const completed = state.mission.completed.includes(mission.id)
  const current = state.mission.currentId === mission.id
  const answer = state.mission.answers[mission.id]
  const predicted = isPredictionCorrect(mission, answer)
  const card = el('article', {
    class: `mission-tile ${completed ? 'is-complete' : ''} ${current ? 'is-current' : ''}`.trim(),
  })
  card.appendChild(
    el(
      'div',
      { class: 'mission-tile-top' },
      el('span', {
        class: 'mission-number',
        'aria-hidden': 'true',
        text: String(index + 1).padStart(2, '0'),
      }),
      el(
        'div',
        { class: 'mission-tile-meta' },
        conceptBadge(mission.concept),
        difficultyDots(mission.difficulty),
      ),
      completed
        ? badge('완료', 'safe')
        : current
          ? badge('진행 중', 'accent')
          : recommended
            ? badge('추천', 'warning')
            : null,
    ),
  )
  card.appendChild(el('h2', { class: 'mission-tile-title', text: mission.titleKo }))
  card.appendChild(el('p', { class: 'mission-tile-prompt', text: mission.promptKo }))
  card.appendChild(el('p', { class: 'mission-tile-summary', text: setupSummary(mission) }))
  const footer = el('div', { class: 'mission-tile-footer' })
  if (current) {
    footer.appendChild(
      button({
        label: predicted ? '이어서 설계' : '예측하고 이어서',
        icon: 'arrowRight',
        variant: 'primary',
        size: 'sm',
        pulse: true,
        focusKey: `mission-continue-${mission.id}`,
        onClick: predicted ? () => actions.navigate('design') : actions.openPrediction,
      }),
    )
  } else if (completed) {
    footer.appendChild(
      button({
        label: '다시 도전',
        icon: 'rotate',
        variant: 'secondary',
        size: 'sm',
        focusKey: `mission-restart-${mission.id}`,
        onClick: () => actions.startMission(mission.id),
      }),
    )
  } else {
    footer.appendChild(
      button({
        label: '미션 시작',
        icon: 'play',
        variant: 'primary',
        size: 'sm',
        pulse: recommended,
        focusKey: `mission-start-${mission.id}`,
        onClick: () => actions.startMission(mission.id),
      }),
    )
  }
  card.appendChild(footer)
  if (completed) {
    const details = el('details', { class: 'mission-explanation' })
    details.appendChild(el('summary', { text: '해설과 한 줄 정리' }))
    details.appendChild(el('p', { text: mission.explanationKo }))
    details.appendChild(
      el(
        'p',
        { class: 'mission-takeaway' },
        el('strong', { text: '한 줄 정리 · ' }),
        mission.takeawayKo,
      ),
    )
    card.appendChild(details)
  }
  return card
}

export function renderMissionsPage(state: AppState, actions: UiActions): HTMLElement {
  const progress = missionProgress(state.mission.completed)
  const current = getMission(state.mission.currentId)
  const recommended = MISSIONS.find((mission) => !state.mission.completed.includes(mission.id))
  const page = el('div', { class: 'page page-missions' })

  const header = el(
    'header',
    { class: 'page-hero' },
    el(
      'div',
      { class: 'page-hero-copy' },
      el('p', { class: 'eyebrow', text: 'MISSIONS · 6 EXPERIMENTS' }),
      el('h1', { class: 'page-title', text: '여섯 번의 구조 실험' }),
      el('p', {
        class: 'page-lede',
        text: '예측하고, 짓고, 시험하고, 힘의 증거로 설명하세요. 각 미션은 하나의 오해를 정면으로 다룹니다.',
      }),
      el(
        'div',
        { class: 'mission-progress-row' },
        el(
          'div',
          { class: 'progress-track progress-track-lg', 'aria-hidden': 'true' },
          el('div', {
            class: 'progress-fill',
            style: { width: `${Math.round(progress.ratio * 100)}%` },
          }),
        ),
        el('span', {
          class: 'mission-progress-label',
          text: `${progress.done} / ${progress.total} 완료`,
        }),
      ),
    ),
    el(
      'div',
      { class: 'mission-loop' },
      ...[
        ['01', '예측', '왜 그럴지 먼저 고릅니다.'],
        ['02', '설계', '격자 위에 직접 짓습니다.'],
        ['03', '시험', '힘과 파괴를 확인합니다.'],
        ['04', '설명', '힘 표를 근거로 말합니다.'],
      ].map(([number, title, text]) =>
        el(
          'div',
          { class: 'loop-step' },
          el('span', { class: 'loop-number', text: number }),
          el('span', { class: 'loop-title', text: title }),
          el('span', { class: 'loop-text', text }),
        ),
      ),
    ),
  )
  page.appendChild(header)

  if (current) {
    const predicted = isPredictionCorrect(current, state.mission.answers[current.id])
    page.appendChild(
      el(
        'div',
        { class: 'current-mission-banner' },
        el('span', { class: 'current-mission-dot', 'aria-hidden': 'true' }),
        el('p', {}, el('strong', { text: '진행 중 · ' }), current.titleKo),
        el(
          'div',
          { class: 'current-mission-actions' },
          button({
            label: predicted ? '이어서 설계' : '예측하기',
            icon: predicted ? 'arrowRight' : 'flag',
            variant: 'primary',
            size: 'sm',
            pulse: true,
            focusKey: 'mission-current-continue',
            onClick: predicted ? () => actions.navigate('design') : actions.openPrediction,
          }),
          button({
            label: '처음부터',
            variant: 'quiet',
            size: 'sm',
            focusKey: 'mission-current-restart',
            onClick: actions.restartMission,
          }),
        ),
      ),
    )
  }

  const grid = el('div', { class: 'mission-grid' })
  MISSIONS.forEach((mission, index) => {
    grid.appendChild(missionCard(mission, index, state, actions, recommended?.id === mission.id))
  })
  page.appendChild(grid)

  page.appendChild(
    el(
      'aside',
      { class: 'page-note' },
      el('span', { class: 'page-note-icon', html: icon('info', 18) }),
      el('p', {
        text: '평가는 공개 순위가 아니라 통과/미통과와 강도·비용 요약으로만 기록됩니다. 진행 상황은 이 브라우저에 저장되며 서버로 전송되지 않습니다.',
      }),
    ),
  )
  return page
}
