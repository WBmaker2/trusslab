import type { Analysis } from '../../struct/analysis'
import type { TrussModel } from '../../struct/types'
import type { Determinacy, MemberResult, StructWarning, SupportType } from '../../struct/types'
import { formatPercent } from '../../struct/units'
import type { MissionCheck, MissionConcept, Mission } from '../../features/missions/missions'
import { CONCEPT_LABELS } from '../../features/missions/missions'
import { el } from '../dom'
import { icon, type IconName } from '../icons'

export type Tone = 'neutral' | 'safe' | 'warning' | 'danger' | 'info' | 'accent'

export interface ButtonOptions {
  label?: string
  icon?: IconName
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
  size?: 'sm' | 'md' | 'lg'
  onClick?: (event: MouseEvent) => void
  ariaLabel?: string
  title?: string
  focusKey?: string
  disabled?: boolean
  pressed?: boolean
  pulse?: boolean
  type?: 'button' | 'submit'
  className?: string
}

function iconOnly(opts: ButtonOptions): boolean {
  return Boolean(opts.icon && !opts.label)
}

export function button(opts: ButtonOptions): HTMLButtonElement {
  const classes = [
    'btn',
    `btn-${opts.variant ?? 'secondary'}`,
    opts.size ? `btn-${opts.size}` : '',
    iconOnly(opts) ? 'btn-icon' : '',
    opts.pulse ? 'btn-pulse' : '',
    opts.className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  const node = el('button', {
    class: classes,
    type: opts.type ?? 'button',
    'aria-label': opts.ariaLabel ?? opts.label,
    title: opts.title ?? opts.ariaLabel ?? opts.label,
    'data-focus-key': opts.focusKey,
    disabled: opts.disabled,
    'aria-pressed': opts.pressed === undefined ? undefined : String(opts.pressed),
  })
  if (opts.icon) {
    const iconSpan = el('span', {
      class: 'btn-icon-wrap',
      html: icon(opts.icon, opts.size === 'sm' ? 16 : 18),
    })
    node.appendChild(iconSpan)
  }
  if (opts.label) node.appendChild(el('span', { class: 'btn-label', text: opts.label }))
  if (opts.onClick) node.addEventListener('click', opts.onClick)
  return node
}

export function iconButton(
  name: IconName,
  label: string,
  onClick: (event: MouseEvent) => void,
  options: Partial<ButtonOptions> = {},
): HTMLButtonElement {
  return button({ icon: name, ariaLabel: label, onClick, variant: 'ghost', ...options })
}

export function badge(text: string, tone: Tone = 'neutral', extraClass = ''): HTMLElement {
  return el('span', { class: `badge badge-${tone} ${extraClass}`.trim(), text })
}

export function statusBadge(determinacy: Determinacy): HTMLElement {
  const tone: Tone =
    determinacy.status === 'determinate'
      ? 'safe'
      : determinacy.status === 'indeterminate'
        ? 'warning'
        : determinacy.status === 'unstable'
          ? 'danger'
          : 'neutral'
  return el(
    'span',
    { class: `status-badge status-${tone}`, title: determinacy.reasonKo },
    el('span', { class: 'status-dot', 'aria-hidden': 'true' }),
    el('span', { text: determinacy.labelKo }),
  )
}

export function memberTypeBadge(member: MemberResult): HTMLElement {
  const label = member.zeroForce ? '0' : member.force > 0 ? 'T' : 'C'
  const tone = member.zeroForce ? 'neutral' : member.force > 0 ? 'tension' : 'compression'
  const text = member.zeroForce ? '0' : member.force > 0 ? 'T 인장' : 'C 압축'
  return el('span', {
    class: `type-badge type-${tone}`,
    text,
    title: member.zeroForce ? '힘이 0에 가까운 부재' : label === 'T' ? '인장' : '압축',
  })
}

export function memberStateBadge(member: MemberResult): HTMLElement {
  const tone: Tone =
    member.state === 'failed' ? 'danger' : member.state === 'warning' ? 'warning' : 'safe'
  const label = member.state === 'failed' ? '파괴' : member.state === 'warning' ? '주의' : '안전'
  return el('span', { class: `state-badge state-${tone}`, text: label })
}

export function utilizationMeter(
  utilization: number,
  label?: string,
  toneOverride?: Tone,
): HTMLElement {
  const tone: Tone =
    toneOverride ?? (utilization > 1 ? 'danger' : utilization >= 0.8 ? 'warning' : 'safe')
  const fill = Math.min(100, Math.max(0, utilization * 100))
  const node = el(
    'div',
    { class: `meter meter-${tone}`, title: `${formatPercent(utilization, 1)} 활용` },
    el(
      'div',
      { class: 'meter-track', 'aria-hidden': 'true' },
      el('div', { class: 'meter-fill', style: { width: `${fill}%` } }),
    ),
    el('span', { class: 'meter-value', text: formatPercent(utilization, 0) }),
  )
  if (label) node.prepend(el('span', { class: 'meter-label', text: label }))
  return node
}

export function stateLabel(state: 'ok' | 'warning' | 'failed'): string {
  if (state === 'failed') return '파괴'
  if (state === 'warning') return '주의'
  return '안전'
}

export function typeBadgeCompact(member: MemberResult): HTMLElement {
  const label = member.zeroForce ? '0' : member.force > 0 ? 'T' : 'C'
  const tone = member.zeroForce ? 'neutral' : member.force > 0 ? 'tension' : 'compression'
  const name = member.zeroForce ? '힘 0' : member.force > 0 ? '인장' : '압축'
  return el('span', {
    class: `type-badge type-${tone} is-compact`,
    text: label,
    title: name,
    'aria-label': name,
  })
}

export function supportLabel(support: SupportType): string {
  if (support === 'pin') return '핀'
  if (support === 'roller') return '롤러'
  return '없음'
}

export function conceptBadge(concept: MissionConcept): HTMLElement {
  return el('span', { class: `concept-badge concept-${concept}`, text: CONCEPT_LABELS[concept] })
}

export function difficultyDots(difficulty: Mission['difficulty']): HTMLElement {
  const node = el('span', {
    class: 'difficulty',
    role: 'img',
    'aria-label': `난이도 ${difficulty} / 3`,
    title: `난이도 ${difficulty} / 3`,
  })
  for (let index = 1; index <= 3; index += 1) {
    node.appendChild(
      el('span', {
        class: `difficulty-dot ${index <= difficulty ? 'is-filled' : ''}`.trim(),
        'aria-hidden': 'true',
      }),
    )
  }
  return node
}

export function checkIcon(passed: boolean): HTMLElement {
  return el('span', {
    class: `check-mark ${passed ? 'is-pass' : 'is-todo'}`,
    html: icon(passed ? 'check' : 'close', 13),
    'aria-hidden': 'true',
  })
}

export function missionCheckList(checks: MissionCheck[]): HTMLElement {
  const list = el('ul', { class: 'check-list' })
  for (const check of checks) {
    if (!check.required) continue
    list.appendChild(
      el(
        'li',
        { class: `check-item ${check.passed ? 'is-pass' : 'is-todo'}`.trim() },
        checkIcon(check.passed),
        el('span', { text: check.labelKo }),
      ),
    )
  }
  return list
}

export function warningTone(warning: StructWarning): Tone {
  if (warning.severity === 'error') return 'danger'
  if (warning.severity === 'warning') return 'warning'
  return 'info'
}

export function severityRank(warning: StructWarning): number {
  if (warning.severity === 'error') return 3
  if (warning.severity === 'warning') return 2
  return 1
}

export function sortedWarnings(warnings: StructWarning[]): StructWarning[] {
  return [...warnings].sort((a, b) => severityRank(b) - severityRank(a))
}

export function firstWarning(warnings: StructWarning[]): StructWarning | null {
  return sortedWarnings(warnings)[0] ?? null
}

export function summaryText(state: { analysis: Analysis; model: TrussModel }): string {
  const { analysis, model } = state
  const supports = model.nodes.filter((node) => node.support !== 'free').length
  const parts = [
    `노드 ${model.nodes.length}개`,
    `부재 ${model.members.length}개`,
    `지지대 ${supports}개`,
    `하중 ${model.loads.length}개`,
    analysis.determinacy.labelKo,
  ]
  if (analysis.result) {
    parts.push(`최대 활용률 ${formatPercent(analysis.result.maxUtilization, 0)}`)
    parts.push(
      `안전율 ${Number.isFinite(analysis.result.factorOfSafety) ? analysis.result.factorOfSafety.toFixed(2) : '매우 큼'}`,
    )
  }
  if (analysis.warnings.length > 0) parts.push(`경고 ${analysis.warnings.length}개`)
  return parts.join(', ') + '.'
}

export function sectionHeader(eyebrow: string, title: string, action?: HTMLElement): HTMLElement {
  return el(
    'div',
    { class: 'section-head' },
    el(
      'div',
      {},
      el('p', { class: 'eyebrow', text: eyebrow }),
      el('h2', { class: 'section-title', text: title }),
    ),
    action ?? null,
  )
}

export function emptyNote(text: string): HTMLElement {
  return el('p', { class: 'empty-note', text })
}
