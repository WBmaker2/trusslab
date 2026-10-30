type Child = Node | string | number | null | undefined | false

type AttributeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | EventListener
  | Record<string, string | number | boolean | null | undefined>

export interface ElementAttributes {
  class?: string
  text?: string
  html?: string
  dataset?: Record<string, string | number | boolean | null | undefined>
  style?: Record<string, string | number | null | undefined>
  [key: string]: AttributeValue | undefined
}

function appendChild(parent: Element | DocumentFragment, child: Child): void {
  if (child === null || child === undefined || child === false) return
  if (child instanceof Node) {
    parent.appendChild(child)
    return
  }
  parent.appendChild(document.createTextNode(String(child)))
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElementAttributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue
    if (key === 'class') {
      node.className = String(value)
      continue
    }
    if (key === 'text') {
      node.textContent = String(value)
      continue
    }
    if (key === 'html') {
      node.innerHTML = String(value)
      continue
    }
    if (key === 'dataset' && typeof value === 'object') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        if (dataValue === undefined || dataValue === null || dataValue === false) continue
        node.dataset[dataKey] = String(dataValue)
      }
      continue
    }
    if (key === 'style' && typeof value === 'object') {
      for (const [styleKey, styleValue] of Object.entries(value)) {
        if (styleValue === undefined || styleValue === null) continue
        node.style.setProperty(styleKey, String(styleValue))
      }
      continue
    }
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
      continue
    }
    if (typeof value === 'boolean') {
      if (value) node.setAttribute(key, '')
      continue
    }
    node.setAttribute(key, String(value))
  }
  for (const child of children) appendChild(node, child)
  return node
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export function fragment(...children: Child[]): DocumentFragment {
  const frag = document.createDocumentFragment()
  for (const child of children) appendChild(frag, child)
  return frag
}

export function qs<T extends Element = Element>(
  selector: string,
  root: ParentNode = document,
): T | null {
  return root.querySelector<T>(selector)
}

export function qsa<T extends Element = Element>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector))
}

export function setText(node: Element | null, text: string): void {
  if (node) node.textContent = text
}

export function formatOneDecimal(value: number): string {
  return Number(value.toFixed(1)).toString()
}
