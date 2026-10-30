export type IconName =
  | 'select'
  | 'node'
  | 'member'
  | 'pin'
  | 'roller'
  | 'load'
  | 'trash'
  | 'undo'
  | 'redo'
  | 'help'
  | 'layers'
  | 'label'
  | 'force'
  | 'gauge'
  | 'curve'
  | 'fit'
  | 'zoomIn'
  | 'zoomOut'
  | 'check'
  | 'close'
  | 'plus'
  | 'warning'
  | 'info'
  | 'play'
  | 'arrowRight'
  | 'printer'
  | 'reset'
  | 'rotate'
  | 'eye'
  | 'eyeOff'
  | 'grid'
  | 'cube'
  | 'flag'
  | 'ruler'
  | 'lock'

const paths: Record<IconName, string> = {
  select: '<path d="m5 3 6.2 17 2.2-6.6L20 11Z"/>',
  node: '<circle cx="12" cy="12" r="3.4"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',
  member: '<path d="M5 19 19 5"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="5" r="2.2"/>',
  pin: '<path d="m12 4-7 12h14Z"/><path d="M3 20h18"/><path d="m5 20 2-3M10 20l2-3M15 20l2-3M20 20l2-3"/>',
  roller:
    '<path d="m12 4-7 10h14Z"/><circle cx="8.5" cy="18" r="1.6"/><circle cx="15.5" cy="18" r="1.6"/><path d="M3 21h18"/>',
  load: '<path d="M12 3v13"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
  undo: '<path d="M9 8 4 12l5 4"/><path d="M4 12h9a6 6 0 0 1 0 12h-2"/>',
  redo: '<path d="m15 8 5 4-5 4"/><path d="M20 12h-9a6 6 0 0 0 0 12h2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 1-1 1.7v.5"/><path d="M12 17h.01"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  label: '<path d="M4 5h16v14H4Z"/><path d="M8 9h8M8 13h5"/>',
  force: '<path d="M12 20V5"/><path d="m7 10 5-5 5 5"/><path d="M5 20h14"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-5"/><path d="M4 18h2M18 18h2"/>',
  curve: '<path d="M3 17c4 0 4-10 9-10s5 6 9 6"/><path d="M3 21h18"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5M10.5 8v5M8 10.5h5"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5M8 10.5h5"/>',
  check: '<path d="m4 12 5.5 5.5L20 6"/>',
  close: '<path d="M5 5l14 14M19 5 5 19"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  warning: '<path d="M12 3 2.5 20h19Z"/><path d="M12 9v5M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  play: '<path d="M7 4v16l13-8Z"/>',
  arrowRight: '<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>',
  printer:
    '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6Z"/>',
  reset: '<path d="M4 10a8 8 0 1 1 2.3 7"/><path d="M4 4v6h6"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff:
    '<path d="m3 3 18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.8"/><path d="M6.2 6.8A17 17 0 0 0 2 12s3.5 6 10 6a9.8 9.8 0 0 0 4.1-.9"/>',
  grid: '<path d="M3 3h18v18H3Z"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4c5-3 9 3 14 0v9c-5 3-9-3-14 0"/>',
  ruler: '<path d="m4 16 12-12 4 4L8 20Z"/><path d="m8 12 2 2M11 9l2 2M14 6l2 2"/>',
  lock: '<path d="M5 11h14v10H5Z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
}

export function icon(name: IconName, size = 20, className = 'icon'): string {
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`
}

export function brandMark(size = 30): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="38" height="38" rx="8" fill="#c8451f"/>
    <path d="M8 29 20 11l12 18H8Z" stroke="#fff8ec" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M8 29h24M14 29V20M26 29V20M14 20h12" stroke="#fff8ec" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="20" cy="11" r="2.4" fill="#fff8ec"/>
    <circle cx="8" cy="29" r="2" fill="#fff8ec"/>
    <circle cx="32" cy="29" r="2" fill="#fff8ec"/>
  </svg>`
}
