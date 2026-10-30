import type { AppState } from '../../app/state'
import {
  getMission,
  isPredictionCorrect,
  missionProgress,
  nextMissionId,
  type MissionEvaluation,
} from '../../features/missions/missions'
import { el } from '../dom'
import { icon } from '../icons'
import type { UiActions } from './actions'
import {
  badge,
  button,
  conceptBadge,
  difficultyDots,
  missionCheckList,
  sectionHeader,
} from './common'

export function renderMissionSection(
  state: AppState,
  actions: UiActions,
  evaluation: MissionEvaluation | null,
): HTMLElement {
  const mission = getMission(state.mission.currentId)
  if (!mission) {
    const progress = missionProgress(state.mission.completed)
    return el(
      'div',
      { class: 'panel-section sheet-mission mission-panel' },
      sectionHeader('MISSIONS', '미션으로 배우기'),
      el(
        'div',
        { class: 'mission-cta-card' },
        el(
          'div',
          { class: 'mission-cta-top' },
          el('span', { class: 'mission-cta-index', text: '01–06' }),
          badge(
            `${progress.done} / ${progress.total} 완료`,
            progress.done > 0 ? 'safe' : 'neutral',
          ),
        ),
        el('p', {
          class: 'mission-cta-text',
          text: '삼각형의 안정, 인장과 압축, 6부재 설계, 예산, 영부재, 구조 보수를 차례로 실험합니다.',
        }),
        el(
          'div',
          { class: 'progress-track', 'aria-hidden': 'true' },
          el('div', {
            class: 'progress-fill',
            style: { width: `${Math.round(progress.ratio * 100)}%` },
          }),
        ),
        button({
          label: '미션 둘러보기',
          icon: 'arrowRight',
          variant: 'primary',
          size: 'sm',
          pulse: true,
          focusKey: 'mission-browse-left',
          onClick: () => actions.navigate('missions'),
        }),
      ),
    )
  }

  const completed = state.mission.completed.includes(mission.id)
  const answer = state.mission.answers[mission.id]
  const predictionPassed = isPredictionCorrect(mission, answer)
  const nextId = nextMissionId(mission.id)
  const hasTest = state.test.result !== null && state.test.status === 'done'

  const header = sectionHeader('MISSION', completed ? '완료한 미션' : '진행 중인 미션')
  const card = el('div', { class: 'mission-card' })
  card.appendChild(
    el(
      'div',
      { class: 'mission-card-head' },
      conceptBadge(mission.concept),
      difficultyDots(mission.difficulty),
      completed
        ? badge('완료', 'safe')
        : predictionPassed
          ? badge('예측 통과', 'info')
          : badge('예측 필요', 'warning'),
    ),
  )
  card.appendChild(el('h3', { class: 'mission-card-title', text: mission.titleKo }))
  card.appendChild(el('p', { class: 'mission-card-prompt', text: mission.promptKo }))

  if (completed) {
    card.appendChild(
      el(
        'div',
        { class: 'mission-complete-note' },
        el('span', { class: 'mission-complete-mark', html: icon('check', 17) }),
        el(
          'div',
          {},
          el('strong', { text: '미션을 완료했습니다.' }),
          el('p', { text: mission.takeawayKo }),
          el('p', {
            class: 'mission-complete-sub',
            text: '해설과 정답은 미션 목록에서 다시 볼 수 있습니다.',
          }),
        ),
      ),
    )
  } else if (evaluation) {
    card.appendChild(missionCheckList(evaluation.checks))
    if (!evaluation.passed) {
      card.appendChild(
        el(
          'p',
          { class: 'mission-hint' },
          el('strong', { text: '힌트 · ' }),
          predictionPassed
            ? evaluation.hintKo
            : '아직 예측을 통과하지 않았습니다. 예측 카드에서 답을 고르세요.',
        ),
      )
    } else {
      card.appendChild(
        el(
          'p',
          { class: 'mission-hint is-success' },
          el('strong', { text: '통과 · ' }),
          '미션 조건을 모두 만족했습니다. 해설과 다음 미션을 확인하세요.',
        ),
      )
    }
  } else if (!predictionPassed) {
    card.appendChild(
      el(
        'p',
        { class: 'mission-hint' },
        el('strong', { text: '예측 · ' }),
        '먼저 예측 카드에서 답을 고르세요. 예측을 통과해야 미션을 완료할 수 있습니다.',
      ),
    )
  }

  const actionsRow = el('div', { class: 'mission-card-actions' })
  if (!predictionPassed && !completed) {
    actionsRow.appendChild(
      button({
        label: '예측하기',
        icon: 'flag',
        variant: 'primary',
        size: 'sm',
        pulse: true,
        focusKey: 'mission-predict',
        onClick: actions.openPrediction,
      }),
    )
  } else if (!completed) {
    actionsRow.appendChild(
      button({
        label: hasTest ? '다시 시험' : '하중 시험',
        icon: 'play',
        variant: 'primary',
        size: 'sm',
        pulse: !evaluation?.passed,
        focusKey: 'mission-test',
        onClick: actions.runTest,
      }),
    )
  } else {
    actionsRow.appendChild(
      button({
        label: '다시 도전',
        icon: 'rotate',
        variant: 'secondary',
        size: 'sm',
        focusKey: 'mission-retry',
        onClick: actions.restartMission,
      }),
    )
  }
  actionsRow.appendChild(
    button({
      label: '미션 목록',
      variant: 'quiet',
      size: 'sm',
      focusKey: 'mission-list-link',
      onClick: () => actions.navigate('missions'),
    }),
  )
  card.appendChild(actionsRow)

  if (completed && nextId) {
    card.appendChild(
      button({
        label: '다음 미션',
        icon: 'arrowRight',
        variant: 'primary',
        size: 'sm',
        pulse: true,
        focusKey: 'mission-next',
        onClick: actions.startMission.bind(null, nextId),
        className: 'mission-next',
      }),
    )
  }

  return el('div', { class: 'panel-section sheet-mission mission-panel' }, header, card)
}
