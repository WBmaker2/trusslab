import type { AppState } from '../../app/state'
import type { Mission } from '../../features/missions/missions'
import type { StructWarning } from '../../struct/types'
import { DISCLAIMER_KO } from '../../struct/constants'
import { el } from '../../ui/dom'
import { icon } from '../../ui/icons'
import type { UiActions } from './actions'
import { button, badge, warningTone } from './common'

export interface DialogAction {
  label: string
  value: string
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  pulse?: boolean
  focusKey?: string
}

interface DialogOptions {
  eyebrow?: string
  title: string
  body: HTMLElement
  actions?: DialogAction[]
  className?: string
  labelledBy?: string
}

export interface DialogHandle {
  dialog: HTMLDialogElement
  close: () => void
}

function createDialog(options: DialogOptions, onAction: (value: string) => void): DialogHandle {
  let resolved = false
  const dialog = el('dialog', {
    class: `app-dialog ${options.className ?? ''}`.trim(),
    'aria-labelledby': 'dialog-title',
  }) as HTMLDialogElement
  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`
  dialog.setAttribute('aria-labelledby', titleId)

  const closeButton = el('button', {
    class: 'dialog-close',
    type: 'button',
    'aria-label': '닫기',
    html: icon('close', 18),
  })
  closeButton.addEventListener('click', () => dialog.close())

  const header = el(
    'div',
    { class: 'dialog-header' },
    el(
      'div',
      {},
      options.eyebrow ? el('p', { class: 'eyebrow', text: options.eyebrow }) : null,
      el('h2', { class: 'dialog-title', id: titleId, text: options.title }),
    ),
    closeButton,
  )

  const body = el('div', { class: 'dialog-body' }, options.body)
  dialog.appendChild(header)
  dialog.appendChild(body)

  if (options.actions && options.actions.length > 0) {
    const footer = el('div', { class: 'dialog-actions' })
    for (const action of options.actions) {
      const actionButton = button({
        label: action.label,
        variant: action.variant ?? 'secondary',
        size: 'md',
        pulse: action.pulse,
        focusKey: action.focusKey,
        onClick: () => {
          resolved = true
          onAction(action.value)
        },
      })
      footer.appendChild(actionButton)
    }
    dialog.appendChild(footer)
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
  dialog.addEventListener('close', () => {
    if (!resolved) onAction('cancel')
    dialog.remove()
  })

  document.body.appendChild(dialog)
  dialog.showModal()
  return { dialog, close: () => dialog.close() }
}

export function confirmDialog(options: {
  title: string
  message: string
  confirmLabel: string
  dangerous?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false
    const handle = createDialog(
      {
        eyebrow: 'CONFIRM',
        title: options.title,
        body: el('p', { class: 'dialog-text', text: options.message }),
        actions: [
          { label: '취소', value: 'cancel', variant: 'quiet' },
          {
            label: options.confirmLabel,
            value: 'confirm',
            variant: options.dangerous ? 'danger' : 'primary',
          },
        ],
        className: 'dialog-confirm',
      },
      (value) => {
        result = value === 'confirm'
        handle.close()
        resolve(result)
      },
    )
  })
}

export function openWarningsDialog(warnings: StructWarning[]): void {
  const list = el('ul', { class: 'warning-list' })
  for (const warning of warnings) {
    const tone = warningTone(warning)
    list.appendChild(
      el(
        'li',
        { class: `warning-item tone-${tone}` },
        el('span', {
          class: 'warning-icon',
          html: icon(tone === 'danger' ? 'warning' : 'info', 17),
        }),
        el(
          'div',
          {},
          el('strong', {
            text:
              warning.severity === 'error'
                ? '오류'
                : warning.severity === 'warning'
                  ? '주의'
                  : '안내',
          }),
          el('p', { text: warning.messageKo }),
        ),
      ),
    )
  }
  const handle = createDialog(
    {
      eyebrow: 'NOTICES',
      title: `구조 알림 ${warnings.length}개`,
      body: list,
      actions: [{ label: '확인', value: 'close', variant: 'primary' }],
    },
    () => handle.close(),
  )
}

export function openPredictionDialog(
  mission: Mission,
  currentAnswer: string | undefined,
  onSubmit: (answer: string) => { correct: boolean; hint: string },
): void {
  const form = el('form', { class: 'prediction-form' })
  form.appendChild(
    el(
      'div',
      { class: 'prediction-prompt' },
      el('span', { class: 'prediction-mark', html: icon('flag', 20) }),
      el('p', { text: mission.promptKo }),
    ),
  )
  const fieldset = el('fieldset', { class: 'prediction-options' })
  fieldset.appendChild(el('legend', { class: 'sr-only', text: '예측 답 선택' }))
  mission.options.forEach((option, index) => {
    const id = `prediction-option-${mission.id}-${index}`
    const label = el(
      'label',
      { class: 'prediction-option', for: id },
      el('input', {
        type: 'radio',
        name: 'prediction',
        id,
        value: option,
        checked: currentAnswer === option ? true : undefined,
      }),
      el('span', { class: 'prediction-option-letter', text: String.fromCharCode(65 + index) }),
      el('span', { class: 'prediction-option-text', text: option }),
    )
    fieldset.appendChild(label)
  })
  form.appendChild(fieldset)
  const feedback = el('p', {
    class: 'prediction-feedback',
    id: 'prediction-feedback',
    role: 'status',
  })
  form.appendChild(feedback)
  form.appendChild(
    el(
      'p',
      { class: 'prediction-note' },
      '정답을 맞혀야 미션을 완료할 수 있습니다. 틀려도 다시 고를 수 있고, 시험 결과를 본 뒤 생각을 고쳐도 됩니다.',
    ),
  )

  let submitted = false
  const submit = () => {
    const selected = form.querySelector<HTMLInputElement>('input[name="prediction"]:checked')
    if (!selected) {
      feedback.textContent = '답을 하나 선택하세요.'
      feedback.className = 'prediction-feedback is-warning'
      return
    }
    const result = onSubmit(selected.value)
    submitted = true
    if (result.correct) {
      feedback.textContent = '예측 통과! 이제 구조를 짓고 시험할 수 있습니다.'
      feedback.className = 'prediction-feedback is-success'
      window.setTimeout(() => handle.close(), 550)
    } else {
      feedback.textContent = result.hint
      feedback.className = 'prediction-feedback is-warning'
    }
  }

  const handle = createDialog(
    {
      eyebrow: `PREDICTION · ${mission.difficulty === 1 ? '기초' : mission.difficulty === 2 ? '보통' : '도전'}`,
      title: mission.titleKo,
      body: form,
      actions: [
        { label: '나중에', value: 'later', variant: 'quiet' },
        { label: '예측 제출', value: 'submit', variant: 'primary', pulse: true },
      ],
      className: 'dialog-prediction',
    },
    (value) => {
      if (value === 'submit') {
        submit()
        return
      }
      if (value === 'cancel' && !submitted) {
        // Closing without an answer is allowed; the mission panel keeps a CTA.
      }
      handle.close()
    },
  )
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submit()
  })
}

export function openCompletionDialog(
  mission: Mission,
  onNext: () => void,
  onMissions: () => void,
): void {
  const body = el(
    'div',
    { class: 'completion-body' },
    el('div', { class: 'completion-badge', html: icon('check', 26) }),
    el('p', { class: 'completion-lead', text: '미션 조건을 모두 만족했습니다.' }),
    el('h3', { text: mission.titleKo }),
    el(
      'div',
      { class: 'completion-section' },
      el('p', { class: 'eyebrow', text: 'WHY' }),
      el('p', { text: mission.explanationKo }),
    ),
    el(
      'div',
      { class: 'completion-takeaway' },
      el('span', { class: 'takeaway-mark', html: icon('info', 16) }),
      el('p', {}, el('strong', { text: '한 줄 정리 · ' }), mission.takeawayKo),
    ),
    el('p', {
      class: 'completion-note',
      text: '이 해설은 미션을 통과한 뒤에만 표시됩니다. 진행 상황은 이 브라우저에 저장됩니다.',
    }),
  )
  const handle = createDialog(
    {
      eyebrow: 'MISSION COMPLETE',
      title: '잘 했습니다',
      body,
      actions: [
        { label: '미션 목록', value: 'missions', variant: 'secondary' },
        { label: '다음 미션', value: 'next', variant: 'primary', pulse: true },
      ],
      className: 'dialog-completion',
    },
    (value) => {
      handle.close()
      if (value === 'next') onNext()
      if (value === 'missions') onMissions()
    },
  )
}

export function openHelpDialog(state: AppState, actions: UiActions): void {
  const motion = el('input', {
    type: 'checkbox',
    checked: state.preferences.reducedMotion ? true : undefined,
    id: 'help-reduced-motion',
    'data-focus-key': 'help-reduced-motion',
  }) as HTMLInputElement
  motion.addEventListener('change', () => actions.toggleReducedMotion())

  const body = el(
    'div',
    { class: 'help-body' },
    el(
      'section',
      { class: 'help-section' },
      el('h3', { text: 'TrussLab은 무엇인가요?' }),
      el('p', {
        text: '격자 위에 트러스를 짓고 하중을 걸면, 절점법으로 부재 힘을 계산해 인장·압축·좌굴·비용을 보여 주는 수업용 실험실입니다. 모든 계산은 브라우저 안에서 결정적으로 실행됩니다.',
      }),
    ),
    el(
      'section',
      { class: 'help-section' },
      el('h3', { text: '만드는 순서' }),
      el(
        'ol',
        {},
        el('li', { text: '절점 도구(N)로 격자를 클릭해 절점을 놓습니다.' }),
        el('li', { text: '부재 도구(M)로 두 절점을 차례로 클릭해 연결합니다.' }),
        el('li', { text: '핀(P)과 롤러(R)로 지지대를 만들고, 하중(L)으로 절점에 힘을 겁니다.' }),
        el('li', { text: '오른쪽 힘 표에서 T/C와 활용률을 확인합니다.' }),
        el('li', { text: '하중 시험으로 첫 파괴 부재를 확인합니다.' }),
      ),
    ),
    el(
      'section',
      { class: 'help-section' },
      el('h3', { text: '힘을 읽는 법' }),
      el('p', {
        text: '초록 계열 T는 인장(늘어남), 남색 계열 C는 압축(눌림), 회색 0은 힘이 0에 가까운 부재입니다. 색만 보지 말고 힘의 부호도 함께 읽으세요.',
      }),
      el('p', {
        text: '활용률 = |응력| ÷ 허용응력 또는 |압축력| ÷ 오일러 좌굴하중 중 큰 값. 80% 이상은 주의, 100%를 넘으면 파괴입니다.',
      }),
    ),
    el(
      'section',
      { class: 'help-section' },
      el('h3', { text: '키보드' }),
      el('p', {
        text: '캔버스에 포커스한 뒤 V 선택 · N 절점 · M 부재 · P 핀 · R 롤러 · L 하중 · D 삭제. 화살표로 이동(Shift+화살표 0.5 m), Enter로 놓기, Delete로 삭제, Esc로 취소합니다.',
      }),
    ),
    el(
      'section',
      { class: 'help-section' },
      el('h3', { text: '가정과 한계' }),
      el(
        'ul',
        {},
        el('li', { text: '2D 평면, 핀 절점, 휨모멘트 없음' }),
        el('li', { text: '정정 구조만 해석합니다. 부정정 구조는 제거를 권합니다.' }),
        el('li', { text: '좌굴은 핀-핀 K=1.0인 이상적 오일러 좌굴만 계산합니다.' }),
        el('li', { text: '재료와 단면 값은 수업용으로 조정된 값입니다.' }),
        el('li', { text: '실제 시공 설계나 안전 인증에 사용할 수 없습니다.' }),
      ),
    ),
    el(
      'section',
      { class: 'help-section help-settings' },
      el('h3', { text: '표시 설정' }),
      el(
        'label',
        { class: 'check-row', for: 'help-reduced-motion' },
        motion,
        el(
          'span',
          {},
          el('strong', { text: '움직임 줄이기' }),
          el('span', { class: 'check-sub', text: '붕괴와 변형 애니메이션을 정적으로 표시합니다.' }),
        ),
      ),
      el('p', {
        class: 'panel-hint',
        text: '진행 상황과 마지막 모델은 이 브라우저의 localStorage에만 저장됩니다. 서버나 AI로 전송되지 않습니다.',
      }),
    ),
    el(
      'p',
      { class: 'help-disclaimer' },
      badge('안전 안내', 'danger'),
      el('span', { text: DISCLAIMER_KO }),
    ),
  )
  const handle = createDialog(
    {
      eyebrow: 'HELP',
      title: '도움말과 가정',
      body,
      actions: [{ label: '닫기', value: 'close', variant: 'primary' }],
      className: 'dialog-help',
    },
    () => handle.close(),
  )
}
