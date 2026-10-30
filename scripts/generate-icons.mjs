import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const S = 1024
const buffer = Buffer.alloc(S * S * 4)
const hex = (value) => {
  const clean = value.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}
const ink = hex('#14211e')
const cream = hex('#f7f0df')
const accent = hex('#e4572e')

function setPixel(x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= S || y >= S) return
  const index = (y * S + x) * 4
  const a = alpha
  buffer[index] = Math.round(buffer[index] * (1 - a) + color[0] * a)
  buffer[index + 1] = Math.round(buffer[index + 1] * (1 - a) + color[1] * a)
  buffer[index + 2] = Math.round(buffer[index + 2] * (1 - a) + color[2] * a)
  buffer[index + 3] = Math.round(buffer[index + 3] * (1 - a) + 255 * a)
}

for (let y = 0; y < S; y += 1) {
  for (let x = 0; x < S; x += 1) {
    const inset = 44
    const radius = 150
    const inside =
      x > inset &&
      y > inset &&
      x < S - inset &&
      y < S - inset &&
      !(
        (x < inset + radius &&
          y < inset + radius &&
          Math.hypot(x - (inset + radius), y - (inset + radius)) > radius) ||
        (x > S - inset - radius &&
          y < inset + radius &&
          Math.hypot(x - (S - inset - radius), y - (inset + radius)) > radius) ||
        (x < inset + radius &&
          y > S - inset - radius &&
          Math.hypot(x - (inset + radius), y - (S - inset - radius)) > radius) ||
        (x > S - inset - radius &&
          y > S - inset - radius &&
          Math.hypot(x - (S - inset - radius), y - (S - inset - radius)) > radius)
      )
    if (inside) setPixel(x, y, ink, 1)
  }
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function line(x1, y1, x2, y2, width, color) {
  const half = width / 2
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - half - 2))
  const maxX = Math.min(S - 1, Math.ceil(Math.max(x1, x2) + half + 2))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - half - 2))
  const maxY = Math.min(S - 1, Math.ceil(Math.max(y1, y2) + half + 2))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = distanceToSegment(x, y, x1, y1, x2, y2)
      if (d <= half) {
        const edge = Math.min(1, half - d)
        setPixel(x, y, color, edge)
      }
    }
  }
}

function dot(cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius - 2); y <= cy + radius + 2; y += 1) {
    for (let x = Math.floor(cx - radius - 2); x <= cx + radius + 2; x += 1) {
      const d = Math.hypot(x - cx, y - cy)
      if (d <= radius) setPixel(x, y, color, Math.min(1, radius - d))
    }
  }
}

const apex = [512, 300]
const left = [280, 740]
const right = [744, 740]
const midLeft = [280, 740]
const midRight = [744, 740]
const centerBottom = [512, 740]
const centerMid = [512, 520]

line(...apex, ...left, 24, cream)
line(...apex, ...right, 24, cream)
line(...left, ...right, 26, cream)
line(...apex, ...centerBottom, 20, cream)
line(...left, ...centerMid, 16, cream)
line(...right, ...centerMid, 16, cream)
line(...centerMid, ...centerBottom, 14, cream)
dot(...apex, 32, accent)
dot(...left, 27, cream)
dot(...right, 27, cream)
dot(...centerBottom, 22, cream)

function downsample(source, sourceSize, targetSize) {
  const target = Buffer.alloc(targetSize * targetSize * 4)
  const factor = sourceSize / targetSize
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const index = ((y * factor + sy) * sourceSize + x * factor + sx) * 4
          r += source[index]
          g += source[index + 1]
          b += source[index + 2]
          a += source[index + 3]
        }
      }
      const count = factor * factor
      const index = (y * targetSize + x) * 4
      target[index] = Math.round(r / count)
      target[index + 1] = Math.round(g / count)
      target[index + 2] = Math.round(b / count)
      target[index + 3] = Math.round(a / count)
    }
  }
  return target
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-512.png', encodePng(512, 512, downsample(buffer, S, 512)))
writeFileSync('public/icon-192.png', encodePng(192, 192, downsample(buffer, S, 192)))
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#14211e"/>
  <path d="M14 48 32 20l18 28H14Z" fill="none" stroke="#f7f0df" stroke-width="3" stroke-linejoin="round"/>
  <path d="M14 48h36M23 48V36M41 48V36M23 36h18" fill="none" stroke="#f7f0df" stroke-width="2" stroke-linecap="round"/>
  <circle cx="32" cy="20" r="3.4" fill="#e4572e"/>
  <circle cx="14" cy="48" r="2.6" fill="#f7f0df"/>
  <circle cx="50" cy="48" r="2.6" fill="#f7f0df"/>
</svg>`,
)
