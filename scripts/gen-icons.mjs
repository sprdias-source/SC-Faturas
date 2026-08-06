// Gera ícones PNG (192x192 e 512x512) sem dependências externas: monograma
// "C" desenhado por matemática de pixel (anel com abertura) + encoder PNG
// mínimo (zlib já vem no Node). Só serve pra ter um ícone decente no
// manifesto/instalação da PWA — troque por uma arte de verdade quando quiser.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function hexToRgb(hex) {
  const v = hex.replace('#', '')
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

function makeIcon(size, bg, fg) {
  const [br, bgc, bb] = hexToRgb(bg)
  const [fr, fg_, fb] = hexToRgb(fg)
  const raw = Buffer.alloc(size * (1 + size * 4))
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.34
  const innerR = size * 0.22
  // abertura do "C" apontando pra direita, ~70 graus
  const gapStart = -35 * (Math.PI / 180)
  const gapEnd = 35 * (Math.PI / 180)

  for (let y = 0; y < size; y++) {
    let rowStart = y * (1 + size * 4)
    raw[rowStart] = 0 // filtro "none"
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const r = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)
      let isRing = r >= innerR && r <= outerR
      if (isRing && angle >= gapStart && angle <= gapEnd) isRing = false
      const off = rowStart + 1 + x * 4
      if (isRing) {
        raw[off] = fr; raw[off + 1] = fg_; raw[off + 2] = fb; raw[off + 3] = 255
      } else {
        raw[off] = br; raw[off + 1] = bgc; raw[off + 2] = bb; raw[off + 3] = 255
      }
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const ACCENT = '#2d3f6b'
const WHITE = '#fbfbf8'

writeFileSync('public/icon-192.png', makeIcon(192, ACCENT, WHITE))
writeFileSync('public/icon-512.png', makeIcon(512, ACCENT, WHITE))
writeFileSync('public/apple-touch-icon.png', makeIcon(180, ACCENT, WHITE))
console.log('Ícones gerados em public/')
