import type { AppState } from '../../app/state'
import { TEACHER_PRESETS, getPreset } from '../../app/presets'
import { MISSIONS, missionProgress } from '../../features/missions/missions'
import { formatForce } from '../../struct/units'
import type { TrussModel } from '../../struct/types'
import { el } from '../dom'
import { icon } from '../icons'
import type { UiActions } from './actions'
import { badge, button, conceptBadge, difficultyDots, sectionHeader } from './common'

function miniSchematic(model: TrussModel): HTMLElement {
  const width = 160
  const height = 88
  const pad = 12
  if (model.nodes.length === 0) {
    return el('div', { class: 'mini-schematic', 'aria-hidden': 'true' })
  }
  const xs = model.nodes.map((node) => node.x)
  const ys = model.nodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  const position = (x: number, y: number) => ({
    x: offsetX + (x - minX) * scale,
    y: height - offsetY - (y - minY) * scale,
  })
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]))
  const lines: string[] = []
  for (const member of model.members) {
    const a = nodeMap.get(member.a)
    const b = nodeMap.get(member.b)
    if (!a || !b) continue
    const pa = position(a.x, a.y)
    const pb = position(b.x, b.y)
    lines.push(
      `<line x1="${pa.x.toFixed(1)}" y1="${pa.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}" />`,
    )
  }
  const dots: string[] = []
  for (const node of model.nodes) {
    const p = position(node.x, node.y)
    const support = node.support !== 'free' ? 'is-support' : ''
    dots.push(`<circle class="${support}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6" />`)
  }
  const load = model.loads[0]
  let arrow = ''
  if (load) {
    const node = nodeMap.get(load.nodeId)
    if (node) {
      const p = position(node.x, node.y)
      arrow = `<path class="is-load" d="M${p.x.toFixed(1)} ${p.y - 13} v8 m-3 -3 3 3 3 -3" />`
    }
  }
  return el('div', {
    class: 'mini-schematic',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 ${width} ${height}" role="img"><g class="mini-members">${lines.join('')}</g><g class="mini-nodes">${dots.join('')}</g>${arrow}</svg>`,
  })
}

function presetCard(presetId: string, actions: UiActions): HTMLElement {
  const preset = getPreset(presetId)
  return el(
    'article',
    { class: 'preset-card' },
    miniSchematic(preset.model),
    el(
      'div',
      { class: 'preset-body' },
      el(
        'div',
        { class: 'preset-title-row' },
        el('h3', { class: 'preset-title', text: preset.nameKo }),
        preset.badgeKo
          ? badge(preset.badgeKo, preset.badgeKo === '실패' ? 'danger' : 'neutral')
          : null,
      ),
      el('p', { class: 'preset-desc', text: preset.descriptionKo }),
      button({
        label: '캔버스에 불러오기',
        icon: 'arrowRight',
        variant: 'secondary',
        size: 'sm',
        focusKey: `preset-${preset.id}`,
        onClick: () => actions.loadPreset(preset.id),
      }),
    ),
  )
}

export function renderTeacherPage(state: AppState, actions: UiActions): HTMLElement {
  const progress = missionProgress(state.mission.completed)
  const showAnswers = state.preferences.teacherShowAnswers
  const page = el('div', { class: 'page page-teacher' })

  page.appendChild(
    el(
      'header',
      { class: 'page-hero teacher-hero' },
      el(
        'div',
        { class: 'page-hero-copy' },
        el('p', { class: 'eyebrow', text: 'TEACHER · CLASSROOM' }),
        el('h1', { class: 'page-title', text: '교실 운영 도구' }),
        el('p', {
          class: 'page-lede',
          text: '정답을 숨긴 채 투사하고, 준비된 모델을 불러오고, 활동지를 인쇄하세요. 모든 진행은 이 브라우저에만 저장됩니다.',
        }),
        el(
          'div',
          { class: 'teacher-status-row' },
          badge(`${progress.done} / ${progress.total} 미션 완료`, 'safe'),
          badge('서버 없음 · 오프라인 사용 가능', 'neutral'),
          badge('2D 수업용 모델', 'accent'),
        ),
      ),
      el(
        'div',
        { class: 'teacher-quick-actions' },
        button({
          label: showAnswers ? '정답 숨기기' : '정답 보기',
          icon: showAnswers ? 'eyeOff' : 'eye',
          variant: 'secondary',
          size: 'md',
          pressed: showAnswers,
          focusKey: 'teacher-toggle-answers',
          onClick: actions.toggleTeacherAnswers,
        }),
        button({
          label: '활동지 인쇄',
          icon: 'printer',
          variant: 'primary',
          size: 'md',
          focusKey: 'teacher-print',
          onClick: actions.printWorksheet,
        }),
      ),
    ),
  )

  page.appendChild(
    el(
      'section',
      { class: 'teacher-section' },
      sectionHeader('PRESETS', '준비된 모델'),
      el('p', {
        class: 'section-lede',
        text: '삼각형, 불안정한 네모, 워런 트러스, 좌굴 실패, 영부재, 빠진 부재를 바로 열 수 있습니다. 모델을 연 뒤 자유롭게 편집하세요.',
      }),
      el('div', { class: 'preset-grid' }, ...TEACHER_PRESETS.map((id) => presetCard(id, actions))),
    ),
  )

  const answersList = el('div', { class: 'teacher-answer-list' })
  MISSIONS.forEach((mission, index) => {
    const card = el('article', { class: 'answer-card' })
    card.appendChild(
      el(
        'div',
        { class: 'answer-head' },
        el('span', {
          class: 'answer-number',
          'aria-hidden': 'true',
          text: String(index + 1).padStart(2, '0'),
        }),
        el(
          'div',
          { class: 'answer-title-block' },
          el('h3', { class: 'answer-title', text: mission.titleKo }),
          el(
            'div',
            { class: 'answer-meta' },
            conceptBadge(mission.concept),
            difficultyDots(mission.difficulty),
          ),
        ),
        showAnswers ? badge('정답 표시 중', 'warning') : badge('정답 숨김', 'neutral'),
      ),
    )
    card.appendChild(el('p', { class: 'answer-prompt', text: mission.promptKo }))
    if (showAnswers) {
      const options = el('ol', { class: 'answer-options' })
      mission.options.forEach((option, optionIndex) => {
        const correct = option === mission.answer
        options.appendChild(
          el(
            'li',
            { class: `answer-option ${correct ? 'is-correct' : ''}`.trim() },
            el('span', {
              class: 'answer-option-index',
              text: String.fromCharCode(65 + optionIndex),
            }),
            el('span', { text: option }),
            correct ? el('span', { class: 'answer-correct-mark', html: icon('check', 15) }) : null,
          ),
        )
      })
      card.appendChild(options)
      card.appendChild(
        el(
          'div',
          { class: 'answer-explanation' },
          el('p', { class: 'eyebrow', text: 'EXPLANATION' }),
          el('p', { text: mission.explanationKo }),
          el(
            'p',
            { class: 'answer-takeaway' },
            el('strong', { text: '한 줄 정리 · ' }),
            mission.takeawayKo,
          ),
        ),
      )
    } else {
      card.appendChild(
        el('p', {
          class: 'answer-hidden-note',
          text: '수업 투사 중에는 정답과 해설을 숨겨 두고, 위의 “정답 보기”를 눌러 확인할 수 있습니다.',
        }),
      )
    }
    card.appendChild(
      el(
        'div',
        { class: 'answer-actions' },
        button({
          label: '이 모델로 수업 열기',
          icon: 'arrowRight',
          variant: 'secondary',
          size: 'sm',
          focusKey: `teacher-start-${mission.id}`,
          onClick: () => actions.startMission(mission.id),
        }),
        el('span', {
          class: 'answer-setup',
          text: mission.setup.targetLoadN ? `목표 ${formatForce(mission.setup.targetLoadN)}` : '',
        }),
      ),
    )
    answersList.appendChild(card)
  })

  page.appendChild(
    el(
      'section',
      { class: 'teacher-section' },
      el(
        'div',
        { class: 'teacher-answer-header' },
        sectionHeader('ANSWER KEY', '미션 정답과 해설'),
        button({
          label: showAnswers ? '정답 숨기기' : '정답 보기',
          variant: 'ghost',
          size: 'sm',
          pressed: showAnswers,
          focusKey: 'teacher-toggle-answers-2',
          onClick: actions.toggleTeacherAnswers,
        }),
      ),
      answersList,
    ),
  )

  page.appendChild(
    el(
      'section',
      { class: 'teacher-section teacher-danger-section' },
      sectionHeader('WORKSPACE', '진행 초기화와 인쇄'),
      el(
        'div',
        { class: 'teacher-utility-grid' },
        el(
          'div',
          { class: 'utility-card' },
          el('span', { class: 'utility-icon', html: icon('printer', 22) }),
          el('h3', { text: '활동지 인쇄' }),
          el('p', {
            text: '빈 12 × 8 m 격자와 부재 힘 표, 반력·판정 칸이 있는 A4 활동지를 인쇄합니다.',
          }),
          button({
            label: '활동지 인쇄',
            icon: 'printer',
            variant: 'secondary',
            size: 'sm',
            focusKey: 'teacher-print-2',
            onClick: actions.printWorksheet,
          }),
        ),
        el(
          'div',
          { class: 'utility-card utility-danger' },
          el('span', { class: 'utility-icon', html: icon('reset', 22) }),
          el('h3', { text: '진행 초기화' }),
          el('p', {
            text: '완료한 미션, 예측 답, 마지막 모델을 모두 지우고 예시 구조로 돌아갑니다. 확인 후 실행됩니다.',
          }),
          button({
            label: '진행 초기화',
            icon: 'trash',
            variant: 'danger',
            size: 'sm',
            focusKey: 'teacher-reset',
            onClick: actions.resetProgress,
          }),
        ),
      ),
    ),
  )

  page.appendChild(
    el(
      'section',
      { class: 'teacher-section teacher-notes' },
      sectionHeader('NOTES', '모델 가정과 수업 메모'),
      el(
        'div',
        { class: 'notes-grid' },
        el(
          'div',
          { class: 'note-card' },
          el('h3', { text: '이 모델이 가정하는 것' }),
          el(
            'ul',
            {},
            el('li', { text: '2D 평면 트러스, 모든 절점은 핀(휨모멘트 없음)' }),
            el('li', { text: '정정 구조만 해석합니다. 부정정 구조는 지원하지 않습니다.' }),
            el('li', { text: '고정 정사각 단면 22.4 mm × 22.4 mm, 재료는 목재와 강재 두 가지' }),
            el('li', { text: '좌굴은 핀-핀(K=1.0) 오일러 좌굴 한 가지 경우만 계산합니다.' }),
            el('li', { text: '첫 파괴에서 시험을 멈춥니다. 연쇄 붕괴는 계산하지 않습니다.' }),
          ),
        ),
        el(
          'div',
          { class: 'note-card' },
          el('h3', { text: '수업에서 짚을 것' }),
          el(
            'ul',
            {},
            el('li', { text: '색은 보조 수단입니다. T/C 라벨과 힘의 부호를 함께 읽게 하세요.' }),
            el('li', { text: '영부재는 “쓸모없는 부재”가 아니라 “지금 힘이 0인 부재”입니다.' }),
            el('li', { text: '긴 압축재가 먼저 좌굴하는 이유를 길이 제곱과 연결해 설명하세요.' }),
            el('li', { text: '예산 미션에서는 싼 재료와 안전율을 함께 비교하게 하세요.' }),
            el('li', { text: '이 앱은 실제 시공 설계나 안전 인증 도구가 아닙니다.' }),
          ),
        ),
        el(
          'div',
          { class: 'note-card' },
          el('h3', { text: '키보드와 접근성' }),
          el(
            'ul',
            {},
            el('li', { text: '캔버스 포커스 후 V/N/M/P/R/L/D로 도구를 바꿉니다.' }),
            el('li', { text: '화살표로 1 m, Shift+화살표로 0.5 m 이동하고 Enter로 놓습니다.' }),
            el('li', {
              text: '오른쪽 모델 목록과 힘 표의 버튼으로 모든 절점·부재를 선택할 수 있습니다.',
            }),
            el('li', { text: 'OS의 “동작 줄이기”가 켜져 있으면 붕괴 애니메이션을 건너뜁니다.' }),
            el('li', { text: '활동지는 인쇄 대화상자에서 A4 세로로 인쇄하세요.' }),
          ),
        ),
      ),
    ),
  )

  return page
}
