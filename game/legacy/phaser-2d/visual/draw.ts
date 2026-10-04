import Phaser from 'phaser'
import type { CharacterData } from '../data/types'

/**
 * 程序化角色绘制。
 * 坐标系：原点在脚底中心，y 轴向上为负，角色高度约 100px。
 * 左右翻转由外层 container.scaleX 处理，绘制时一律按"面朝右"画。
 */
export type DrawCtx = {
  /** 秒 */
  t: number
  char: CharacterData
  /** 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'shield' | 'hitstun' | 'stunned' | 'channel' */
  state: string
  /** 当前招式进度 0~1，无招式时 -1 */
  atk: number
  /** 角色专属资源归一化 0~1（heat / think / stance 强度） */
  power: number
  /** 形态序号（GPT 专用） */
  stance: number
  /** 是否霸体 */
  armor: boolean
  /** 是否 meltdown */
  meltdown: boolean
  /** 横向速度绝对值 */
  speed: number
}

export type Pose = {
  /** 躯干整体上下位移 */
  bob: number
  /** 前倾 */
  lean: number
  /** 手臂摆动角（弧度） */
  arm: number
  /** 腿摆动幅度 */
  leg: number
  /** 压扁系数 1 = 正常 */
  squash: number
  /** 攻击前冲距离 */
  lunge: number
}

export function poseOf(ctx: DrawCtx): Pose {
  const t = ctx.t
  const p: Pose = { bob: 0, lean: 0, arm: 0, leg: 0, squash: 1, lunge: 0 }
  switch (ctx.state) {
    case 'run':
      p.bob = Math.abs(Math.sin(t * 13)) * -3
      p.lean = 5
      p.arm = Math.sin(t * 13) * 0.7
      p.leg = Math.sin(t * 13) * 12
      break
    case 'jump':
      p.bob = -4
      p.lean = 3
      p.arm = -0.7
      p.leg = -6
      p.squash = 1.06
      break
    case 'fall':
      p.bob = -2
      p.lean = -3
      p.arm = 0.8
      p.leg = 5
      p.squash = 0.96
      break
    case 'attack': {
      const a = Math.max(0, ctx.atk)
      const swing = Math.sin(Math.min(1, a * 1.35) * Math.PI)
      p.lunge = swing * 12
      p.lean = 4 + swing * 10
      p.arm = -1.5 * swing
      p.bob = -swing * 2
      break
    }
    case 'shield':
      p.bob = 3
      p.squash = 0.93
      p.lean = -3
      p.arm = 1.1
      break
    case 'hitstun':
      p.lean = -14
      p.bob = -3 + Math.sin(t * 45) * 2
      p.arm = 1.4
      p.leg = 8
      break
    case 'stunned':
      p.lean = Math.sin(t * 9) * 6
      p.bob = 2
      p.arm = 0.9
      break
    case 'channel':
      p.bob = -2 + Math.sin(t * 1.6) * 2
      p.squash = 0.99
      p.arm = 0.2
      break
    default:
      p.bob = Math.sin(t * 2.2) * 1.8
      p.arm = Math.sin(t * 2.2) * 0.09
      break
  }
  return p
}

/** 简单可复现随机，用来固定星点/铆钉位置 */
export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function pts(list: number[][]): Phaser.Types.Math.Vector2Like[] {
  return list.map(([x, y]) => ({ x, y }))
}

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a)
  const cb = Phaser.Display.Color.IntegerToColor(b)
  const r = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Phaser.Math.Clamp(t, 0, 1) * 100)
  return Phaser.Display.Color.GetColor(r.r, r.g, r.b)
}

/** 环绕元素统一的椭圆轨道位置（带前后深度） */
function orbit(t: number, i: number, n: number, rx: number, ry: number, speed: number) {
  const a = t * speed + (i / n) * Math.PI * 2
  return { x: Math.cos(a) * rx, y: Math.sin(a) * ry, front: Math.sin(a) > 0, depth: (Math.sin(a) + 1) / 2 }
}

// ═══════════════════════════════════════════════════════════════
//  1. Claude · 修士长袍 + 宪法石板
// ═══════════════════════════════════════════════════════════════
function drawRobe(g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) {
  const v = ctx.char.visual
  const y = p.bob
  const lx = p.lunge

  // 背后石板（后半圈）
  for (let i = 0; i < 3; i++) {
    const o = orbit(ctx.t, i, 3, 46, 15, 0.7)
    if (o.front) continue
    drawTablet(g, lx + o.x, y - 52 + o.y, 0.75 + o.depth * 0.3, v.shade, v.glow, 0.65)
  }

  // 长袍主体（钟形）
  g.fillStyle(v.primary, 1)
  g.fillPoints(
    pts([
      [-28 + lx * 0.2, 0],
      [-15 + lx * 0.6, -54 + y],
      [-17 + lx + p.lean * 0.4, -68 + y],
      [17 + lx + p.lean * 0.7, -68 + y],
      [15 + lx * 0.6, -54 + y],
      [28 + lx * 0.2, 0],
    ]),
    true,
    true,
  )
  // 中缝浅色经卷
  g.fillStyle(v.secondary, 0.92)
  g.fillPoints(
    pts([
      [-6 + lx * 0.8, -62 + y],
      [6 + lx * 0.8, -62 + y],
      [9 + lx * 0.3, -4],
      [-9 + lx * 0.3, -4],
    ]),
    true,
    true,
  )
  // 下摆暗部
  g.fillStyle(v.shade, 0.5)
  g.fillRect(-28 + lx * 0.2, -8, 56, 8)

  // 双袖
  const armY = -52 + y
  g.fillStyle(v.primary, 1)
  g.fillRoundedRect(-30 + lx * 0.5, armY - 4 + Math.sin(p.arm) * 6, 14, 30, 7)
  g.fillRoundedRect(18 + lx, armY - 4 - Math.sin(p.arm) * 6, 14, 30, 7)

  // 肩线
  g.fillStyle(v.shade, 0.85)
  g.fillRoundedRect(-20 + lx + p.lean * 0.4, -72 + y, 40, 9, 4)

  // 头：竖立印章板
  const hx = lx + p.lean * 0.55
  g.fillStyle(v.secondary, 1)
  g.fillRoundedRect(hx - 13, -96 + y, 26, 27, 5)
  g.lineStyle(2, v.shade, 0.8)
  g.strokeRoundedRect(hx - 13, -96 + y, 26, 27, 5)
  // 视线缝
  const glowA = ctx.armor ? 1 : 0.75 + Math.sin(ctx.t * 3) * 0.15
  g.fillStyle(v.glow, glowA)
  g.fillRoundedRect(hx - 9, -85 + y, 18, 4, 2)

  // 前方石板
  for (let i = 0; i < 3; i++) {
    const o = orbit(ctx.t, i, 3, 46, 15, 0.7)
    if (!o.front) continue
    drawTablet(g, lx + o.x, y - 52 + o.y, 0.75 + o.depth * 0.3, v.secondary, v.glow, 1)
  }

  if (ctx.armor) {
    g.lineStyle(3, 0xffe9c9, 0.85)
    g.strokeRoundedRect(-32, -100 + y, 64, 100, 12)
  }
}

function drawTablet(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  fill: number,
  edge: number,
  alpha: number,
) {
  const w = 11 * s
  const h = 15 * s
  g.fillStyle(fill, alpha)
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 2)
  g.lineStyle(1.5, edge, alpha)
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 2)
  g.lineStyle(1, edge, alpha * 0.7)
  for (let i = 1; i <= 2; i++) g.lineBetween(x - w / 2 + 2, y - h / 2 + (h / 3) * i, x + w / 2 - 2, y - h / 2 + (h / 3) * i)
}

// ═══════════════════════════════════════════════════════════════
//  2. GPT · 棱柱躯干 + 三卫星（分离悬浮肢体）
// ═══════════════════════════════════════════════════════════════
const STANCE_COLORS = [0xffc93c, 0x10a37f, 0xc9d4ff]

function drawPrism(g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) {
  const v = ctx.char.visual
  const y = p.bob
  const lx = p.lunge
  const sc = STANCE_COLORS[ctx.stance] ?? v.primary

  // 后侧卫星
  for (let i = 0; i < 3; i++) {
    const o = orbit(ctx.t, i, 3, 44, 16, 1.1)
    if (o.front) continue
    drawSatellite(g, lx + o.x, y - 52 + o.y, i === ctx.stance, STANCE_COLORS[i], 0.55)
  }

  // 悬浮腿块（与躯干不相连）
  g.fillStyle(v.secondary, 1)
  g.fillRoundedRect(-16 + lx * 0.3, -18 + p.leg * 0.3, 12, 18, 3)
  g.fillRoundedRect(5 + lx * 0.3, -18 - p.leg * 0.3, 12, 18, 3)
  g.lineStyle(1.5, sc, 0.8)
  g.strokeRoundedRect(-16 + lx * 0.3, -18 + p.leg * 0.3, 12, 18, 3)
  g.strokeRoundedRect(5 + lx * 0.3, -18 - p.leg * 0.3, 12, 18, 3)

  // 躯干：六边棱柱
  const bx = lx + p.lean * 0.4
  const body = pts([
    [bx, -74 + y],
    [bx + 21, -62 + y],
    [bx + 21, -32 + y],
    [bx, -20 + y],
    [bx - 21, -32 + y],
    [bx - 21, -62 + y],
  ])
  g.fillStyle(v.secondary, 1)
  g.fillPoints(body, true, true)
  g.lineStyle(2, v.primary, 1)
  g.strokePoints(body, true, true)
  // 内部切面
  g.lineStyle(1.5, sc, 0.75)
  g.lineBetween(bx - 21, -50 + y, bx + 21, -42 + y)
  g.lineBetween(bx, -74 + y, bx, -20 + y)
  g.fillStyle(sc, 0.18)
  g.fillPoints(
    pts([
      [bx, -74 + y],
      [bx + 21, -62 + y],
      [bx + 21, -42 + y],
      [bx - 21, -50 + y],
      [bx - 21, -62 + y],
    ]),
    true,
    true,
  )

  // 悬浮臂块
  const aY = -58 + y
  g.fillStyle(v.secondary, 1)
  const armL = { x: bx - 30, y: aY + Math.sin(p.arm) * 8 }
  const armR = { x: bx + 24, y: aY - Math.sin(p.arm) * 8 }
  for (const a of [armL, armR]) {
    g.fillRoundedRect(a.x, a.y, 10, 24, 3)
    g.lineStyle(1.5, v.primary, 0.9)
    g.strokeRoundedRect(a.x, a.y, 10, 24, 3)
  }

  // 头：开口环
  const hx = bx
  const hy = -94 + y
  g.lineStyle(5, v.primary, 1)
  g.beginPath()
  g.arc(hx, hy, 13, Phaser.Math.DegToRad(35), Phaser.Math.DegToRad(325), false)
  g.strokePath()
  g.fillStyle(sc, 0.9 + Math.sin(ctx.t * 4) * 0.1)
  g.fillCircle(hx, hy, 5)

  // 前侧卫星
  for (let i = 0; i < 3; i++) {
    const o = orbit(ctx.t, i, 3, 44, 16, 1.1)
    if (!o.front) continue
    drawSatellite(g, lx + o.x, y - 52 + o.y, i === ctx.stance, STANCE_COLORS[i], 1)
  }
}

function drawSatellite(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  active: boolean,
  color: number,
  alpha: number,
) {
  const r = active ? 9 : 4.5
  g.fillStyle(color, alpha * (active ? 1 : 0.5))
  g.fillCircle(x, y, r)
  if (active) {
    g.lineStyle(1.5, 0xffffff, alpha * 0.7)
    g.strokeCircle(x, y, r + 3.5)
  }
}

// ═══════════════════════════════════════════════════════════════
//  3. Grok · GPU 机甲 + 火箭助推器
// ═══════════════════════════════════════════════════════════════
function drawMech(g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) {
  const v = ctx.char.visual
  const y = p.bob
  const lx = p.lunge
  const heat = ctx.power
  const fin = lerpColor(v.secondary, v.glow, heat)

  // 背部助推器
  for (const sx of [-20, -8]) {
    g.fillStyle(0x2a2e38, 1)
    g.fillRoundedRect(sx - 6 + lx * 0.2, -66 + y, 12, 26, 3)
    g.fillStyle(fin, 0.9)
    g.fillRoundedRect(sx - 4 + lx * 0.2, -44 + y, 8, 5, 2)
    if (ctx.meltdown) {
      const fl = 10 + Math.sin(ctx.t * 30 + sx) * 5
      g.fillStyle(0xff7a1c, 0.85)
      g.fillTriangle(sx - 4 + lx * 0.2, -40 + y, sx + 4 + lx * 0.2, -40 + y, sx + lx * 0.2, -40 + y + fl)
    }
  }

  // 腿
  g.fillStyle(v.primary, 1)
  g.fillRoundedRect(-20 + lx * 0.2, -30 + p.leg * 0.25, 16, 30, 4)
  g.fillRoundedRect(5 + lx * 0.2, -30 - p.leg * 0.25, 16, 30, 4)
  g.fillStyle(0x2a2e38, 1)
  g.fillRoundedRect(-23 + lx * 0.2, -6, 22, 7, 3)
  g.fillRoundedRect(3 + lx * 0.2, -6, 22, 7, 3)

  // 躯干
  const bx = lx + p.lean * 0.4
  g.fillStyle(v.primary, 1)
  g.fillRoundedRect(bx - 24, -74 + y, 48, 46, 6)
  // 胸口裸露 GPU 散热鳍片
  g.fillStyle(0x0a0b0f, 1)
  g.fillRect(bx - 18, -70 + y, 36, 32)
  for (let i = 0; i < 7; i++) {
    const fx = bx - 17 + i * 5
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(ctx.t * 3 + i * 0.6))
    g.fillStyle(fin, 0.35 + heat * 0.5)
    g.fillRect(fx, -68 + y, 3, 28)
    g.fillStyle(fin, pulse * (0.4 + heat * 0.6))
    g.fillRect(fx, -68 + y + (1 - heat) * 14, 3, 28 - (1 - heat) * 14)
  }
  g.lineStyle(2, fin, 0.9)
  g.strokeRect(bx - 18, -70 + y, 36, 32)

  // 巨大肩甲
  g.fillStyle(0x2a2e38, 1)
  g.fillPoints(
    pts([
      [bx - 40, -78 + y],
      [bx - 18, -84 + y],
      [bx - 16, -62 + y],
      [bx - 38, -58 + y],
    ]),
    true,
    true,
  )
  g.fillPoints(
    pts([
      [bx + 40, -78 + y],
      [bx + 18, -84 + y],
      [bx + 16, -62 + y],
      [bx + 38, -58 + y],
    ]),
    true,
    true,
  )
  g.fillStyle(fin, 0.85)
  g.fillRect(bx - 36, -74 + y, 16, 3)
  g.fillRect(bx + 20, -74 + y, 16, 3)

  // 过长的双臂
  g.fillStyle(v.primary, 1)
  g.fillRoundedRect(bx - 40, -62 + y + Math.sin(p.arm) * 9, 15, 44, 6)
  g.fillRoundedRect(bx + 25, -62 + y - Math.sin(p.arm) * 9, 15, 44, 6)

  // 头：LED 光条眼
  const hx = bx
  g.fillStyle(0x1a1d24, 1)
  g.fillRoundedRect(hx - 14, -92 + y, 28, 18, 4)
  const jitter = ctx.meltdown ? Math.sin(ctx.t * 50) * 1.5 : 0
  g.fillStyle(fin, 0.95)
  g.fillRoundedRect(hx - 10 + jitter, -85 + y, 20, 4, 2)

  // 热浪蒸汽
  for (let i = 0; i < 5; i++) {
    const ph = (ctx.t * 0.6 + i * 0.2) % 1
    const a = (1 - ph) * (0.12 + heat * 0.3)
    g.fillStyle(ctx.meltdown ? 0xff6a2c : 0x9fd9ff, a)
    g.fillCircle(bx - 16 + i * 8, -74 + y - ph * 42, 3 + ph * 5)
  }
}

// ═══════════════════════════════════════════════════════════════
//  4. Gemini · 左右半身分裂 + 悬浮棱镜头
// ═══════════════════════════════════════════════════════════════
function drawTwin(g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) {
  const v = ctx.char.visual
  const y = p.bob
  const lx = p.lunge
  const flickL = 0.55 + 0.45 * Math.abs(Math.sin(ctx.t * 7))
  const flickR = 0.6 + 0.4 * Math.abs(Math.sin(ctx.t * 5 + 1.4))

  // 光谱残影
  if (ctx.speed > 60 || ctx.state === 'attack') {
    for (let i = 3; i >= 1; i--) {
      g.fillStyle(i === 1 ? v.primary : i === 2 ? v.secondary : v.glow, 0.13)
      g.fillRoundedRect(-14 - i * 11 + lx, -78 + y, 26, 66, 10)
    }
  }

  const bx = lx + p.lean * 0.4

  // 左半身：线稿（文本模态）
  const leftBody = pts([
    [bx - 1, -80 + y],
    [bx - 16, -66 + y],
    [bx - 13, -30 + y],
    [bx - 1, -22 + y],
  ])
  g.lineStyle(2.2, v.primary, flickL)
  g.strokePoints(leftBody, true, true)
  g.fillStyle(v.primary, 0.16 * flickL)
  g.fillPoints(leftBody, true, true)
  g.lineStyle(1.5, v.primary, flickL * 0.8)
  g.lineBetween(bx - 16 + Math.sin(p.arm) * 4, -64 + y, bx - 26 + Math.sin(p.arm) * 10, -34 + y)
  g.lineBetween(bx - 10, -24 + y, bx - 13 + p.leg * 0.4, 0)

  // 右半身：实心光谱（视觉模态）
  const rightBody = pts([
    [bx + 1, -80 + y],
    [bx + 16, -66 + y],
    [bx + 13, -30 + y],
    [bx + 1, -22 + y],
  ])
  g.fillStyle(v.secondary, flickR)
  g.fillPoints(rightBody, true, true)
  g.fillStyle(v.glow, 0.5 * flickR)
  g.fillPoints(
    pts([
      [bx + 1, -80 + y],
      [bx + 16, -66 + y],
      [bx + 14, -50 + y],
      [bx + 1, -54 + y],
    ]),
    true,
    true,
  )
  g.fillStyle(v.secondary, flickR)
  g.fillRoundedRect(bx + 14 - Math.sin(p.arm) * 4, -64 + y, 8, 30, 4)
  g.fillRoundedRect(bx + 4 - p.leg * 0.4, -24 + y, 9, 26, 4)

  // 中缝裂隙
  g.fillStyle(0xffffff, 0.85)
  g.fillRect(bx - 1.4, -80 + y, 2.8, 58)

  // 悬浮四芒星棱镜头（与身体不相连）
  const hy = -104 + y + Math.sin(ctx.t * 1.8) * 2
  const rot = ctx.t * 1.4
  drawFourStar(g, bx, hy, 15, rot, v.glow, 0.95)
  drawFourStar(g, bx, hy, 9, -rot * 0.7, 0xffffff, 0.9)
}

function drawFourStar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  rot: number,
  color: number,
  alpha: number,
) {
  const p: number[][] = []
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4
    const rr = i % 2 === 0 ? r : r * 0.34
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  g.fillStyle(color, alpha)
  g.fillPoints(pts(p), true, true)
}

// ═══════════════════════════════════════════════════════════════
//  5. Qwen · 道袍高冠 + 七枚模型法环
// ═══════════════════════════════════════════════════════════════
function drawSage(g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) {
  const v = ctx.char.visual
  const y = p.bob
  const lx = p.lunge

  // 背后七法环（全尺寸开源矩阵）
  for (let i = 0; i < 7; i++) {
    const a = ctx.t * (0.35 + i * 0.11) + i * 0.9
    const rx = Math.cos(a) * 40
    const ry = Math.sin(a) * 12 - 52
    const rad = 5 + i * 3.4
    const front = Math.sin(a) > 0
    g.lineStyle(2, front ? v.secondary : v.shade, front ? 0.95 : 0.5)
    g.strokeEllipse(lx * 0.4 + rx, y + ry, rad * 2, rad * 2 * (0.4 + 0.6 * Math.abs(Math.cos(a))))
  }

  const bx = lx + p.lean * 0.4

  // 道袍
  g.fillStyle(v.primary, 1)
  g.fillPoints(
    pts([
      [bx - 24, 0],
      [bx - 13, -56 + y],
      [bx - 15, -70 + y],
      [bx + 15, -70 + y],
      [bx + 13, -56 + y],
      [bx + 24, 0],
    ]),
    true,
    true,
  )
  // 交领
  g.fillStyle(v.secondary, 0.95)
  g.fillPoints(
    pts([
      [bx - 13, -70 + y],
      [bx + 13, -70 + y],
      [bx + 2, -48 + y],
      [bx - 11, -58 + y],
    ]),
    true,
    true,
  )
  // 云纹
  g.lineStyle(1.6, v.secondary, 0.75)
  for (let i = 0; i < 3; i++) {
    const cy = -34 + i * 11 + y * 0.4
    g.beginPath()
    g.arc(bx - 8, cy, 6, Math.PI, Math.PI * 1.9, false)
    g.strokePath()
    g.beginPath()
    g.arc(bx + 8, cy, 6, Math.PI, Math.PI * 1.9, false)
    g.strokePath()
  }

  // 宽袖
  const swing = Math.sin(p.arm) * 7
  g.fillStyle(v.primary, 1)
  g.fillRoundedRect(bx - 36, -62 + y + swing, 22, 32, 10)
  g.fillRoundedRect(bx + 14, -62 + y - swing, 22, 32, 10)
  g.fillStyle(v.secondary, 0.9)
  g.fillRect(bx - 36, -34 + y + swing, 22, 4)
  g.fillRect(bx + 14, -34 + y - swing, 22, 4)

  // 头 + 高冠
  const hx = bx
  g.fillStyle(0xf2e6d8, 1)
  g.fillCircle(hx, -84 + y, 11)
  g.fillStyle(v.shade, 1)
  g.fillPoints(
    pts([
      [hx - 15, -92 + y],
      [hx + 15, -92 + y],
      [hx + 11, -106 + y],
      [hx - 11, -106 + y],
    ]),
    true,
    true,
  )
  g.fillStyle(v.secondary, 1)
  g.fillRect(hx - 15, -95 + y, 30, 4)

  // 手持问符
  const tx = bx + 26 + Math.sin(ctx.t * 2) * 2
  const ty = -58 + y - swing
  g.fillStyle(v.secondary, 0.95)
  g.fillRoundedRect(tx - 8, ty - 10, 16, 20, 2)
  g.lineStyle(1.6, v.shade, 0.9)
  g.strokeRoundedRect(tx - 8, ty - 10, 16, 20, 2)
  g.lineBetween(tx - 4, ty - 5, tx + 4, ty - 5)
  g.lineBetween(tx, ty - 5, tx, ty + 2)
  g.fillStyle(v.shade, 1)
  g.fillCircle(tx, ty + 6, 1.6)
}

// ═══════════════════════════════════════════════════════════════
//  6. Doubao · Q 版豆形 + 弹幕气泡 + 自拍杆
// ═══════════════════════════════════════════════════════════════
function drawChibi(g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) {
  const v = ctx.char.visual
  const jelly = Math.sin(ctx.t * 3.4) * 0.05
  const sy = p.squash * (1 + jelly)
  const y = p.bob - jelly * 20
  const lx = p.lunge
  const bx = lx + p.lean * 0.35

  // 弹幕气泡（持续上浮）
  for (let i = 0; i < 6; i++) {
    const ph = (ctx.t * 0.5 + i * 0.17) % 1
    const bxo = bx + Math.sin(i * 2.3 + ctx.t) * 22
    g.fillStyle(i % 2 ? v.secondary : v.primary, (1 - ph) * 0.5)
    g.fillRoundedRect(bxo - 7, -60 - ph * 55, 14, 7, 3)
  }

  // 短腿
  g.fillStyle(v.primary, 1)
  g.fillRoundedRect(bx - 13 + p.leg * 0.25, -16 * sy, 10, 17 * sy, 5)
  g.fillRoundedRect(bx + 3 - p.leg * 0.25, -16 * sy, 10, 17 * sy, 5)

  // 圆润身体
  g.fillStyle(v.primary, 1)
  g.fillRoundedRect(bx - 17, -40 * sy + y, 34, 27 * sy, 11)
  g.fillStyle(v.secondary, 0.85)
  g.fillRoundedRect(bx - 17, -27 * sy + y, 34, 14 * sy, 9)

  // 短手
  const sw = Math.sin(p.arm) * 6
  g.fillStyle(v.primary, 1)
  g.fillCircle(bx - 20, -32 * sy + y + sw, 6)
  g.fillCircle(bx + 20, -32 * sy + y - sw, 6)

  // 豆形大头
  const hy = -62 * sy + y
  g.fillStyle(v.primary, 1)
  g.fillEllipse(bx, hy, 54, 50 * sy)
  g.fillStyle(v.secondary, 0.55)
  g.fillEllipse(bx + 6, hy + 6, 40, 34 * sy)
  g.fillStyle(v.glow, 0.9)
  g.fillEllipse(bx - 11, hy - 12, 13, 9)

  // 眼睛与嘴
  const blink = Math.sin(ctx.t * 1.3) > 0.97 ? 0.2 : 1
  g.fillStyle(0x14173a, 1)
  g.fillEllipse(bx - 9, hy - 2, 7, 9 * blink)
  g.fillEllipse(bx + 11, hy - 2, 7, 9 * blink)
  g.fillStyle(0xffffff, 1)
  g.fillCircle(bx - 7, hy - 4, 2)
  g.fillCircle(bx + 13, hy - 4, 2)
  g.lineStyle(2, 0x14173a, 0.9)
  g.beginPath()
  g.arc(bx + 2, hy + 9, 6, 0.15 * Math.PI, 0.85 * Math.PI, false)
  g.strokePath()

  // 天线
  g.lineStyle(2, v.secondary, 1)
  g.lineBetween(bx + 4, hy - 24, bx + 8, hy - 38)
  g.fillStyle(v.secondary, 1)
  g.fillCircle(bx + 8, hy - 40, 4)
  g.fillStyle(0xffffff, 0.5 + 0.5 * Math.abs(Math.sin(ctx.t * 4)))
  g.fillCircle(bx + 8, hy - 40, 2)

  // 自拍杆 + 摄像机
  const camX = bx + 40
  const camY = hy - 14 - sw
  g.lineStyle(3, 0x3a3f55, 1)
  g.lineBetween(bx + 20, -32 * sy + y - sw, camX, camY)
  g.fillStyle(0x2b2f42, 1)
  g.fillRoundedRect(camX - 9, camY - 8, 20, 16, 3)
  g.fillStyle(0x8fa8ff, 1)
  g.fillCircle(camX + 1, camY, 5)
  g.fillStyle(0xff3355, Math.sin(ctx.t * 6) > 0 ? 1 : 0.25)
  g.fillCircle(camX + 8, camY - 5, 2.2)
}

// ═══════════════════════════════════════════════════════════════
//  7. GLM · 方正官制 + 巨型玉玺 + 工程蓝图
// ═══════════════════════════════════════════════════════════════
function drawFort(g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) {
  const v = ctx.char.visual
  const y = p.bob
  const lx = p.lunge
  const bx = lx + p.lean * 0.35
  const breathe = 0.85 + Math.sin(ctx.t * 1.1) * 0.15

  // 工程蓝图网格（前后各一片）
  for (const side of [-1, 1]) {
    const gx = bx + side * 44
    g.fillStyle(v.glow, 0.08 * breathe)
    g.fillRect(gx - 16, -88 + y, 32, 76)
    g.lineStyle(1, v.glow, 0.3 * breathe)
    for (let i = 0; i <= 4; i++) g.lineBetween(gx - 16, -88 + y + i * 19, gx + 16, -88 + y + i * 19)
    for (let i = 0; i <= 4; i++) g.lineBetween(gx - 16 + i * 8, -88 + y, gx - 16 + i * 8, -12 + y)
    const nodeY = -88 + y + ((ctx.t * 40 + side * 30) % 76)
    g.fillStyle(v.glow, 0.9)
    g.fillCircle(gx - 16 + ((ctx.t * 25 + side * 12) % 32), nodeY, 2)
  }

  // 背负玉玺
  const sx = bx - 30
  const sealY = -70 + y + Math.sin(ctx.t * 1.4) * 2
  g.fillStyle(v.secondary, 1)
  g.fillRoundedRect(sx - 16, sealY - 16, 32, 32, 3)
  g.lineStyle(2, 0x8a6d1e, 1)
  g.strokeRoundedRect(sx - 16, sealY - 16, 32, 32, 3)
  g.lineStyle(1.4, 0x8a6d1e, 0.85)
  for (let i = 1; i < 3; i++) {
    g.lineBetween(sx - 16, sealY - 16 + i * 10.6, sx + 16, sealY - 16 + i * 10.6)
    g.lineBetween(sx - 16 + i * 10.6, sealY - 16, sx - 16 + i * 10.6, sealY + 16)
  }

  // 粗腿
  g.fillStyle(v.shade, 1)
  g.fillRect(bx - 20 + p.leg * 0.2, -26, 16, 26)
  g.fillRect(bx + 4 - p.leg * 0.2, -26, 16, 26)
  g.fillStyle(v.secondary, 0.8)
  g.fillRect(bx - 22 + p.leg * 0.2, -5, 20, 5)
  g.fillRect(bx + 2 - p.leg * 0.2, -5, 20, 5)

  // 方形躯干
  g.fillStyle(v.primary, 1)
  g.fillRect(bx - 26, -66 + y, 52, 42)
  g.fillStyle(v.shade, 0.7)
  g.fillRect(bx - 26, -40 + y, 52, 6)
  g.fillStyle(v.secondary, 0.9)
  g.fillRect(bx - 6, -66 + y, 12, 42)

  // 城楼式肩甲（带垛口）
  g.fillStyle(v.shade, 1)
  g.fillRect(bx - 40, -78 + y, 80, 14)
  g.fillStyle(v.secondary, 1)
  for (let i = 0; i < 5; i++) g.fillRect(bx - 38 + i * 16, -84 + y, 9, 7)

  // 双臂
  const sw = Math.sin(p.arm) * 6
  g.fillStyle(v.primary, 1)
  g.fillRect(bx - 40, -62 + y + sw, 14, 36)
  g.fillRect(bx + 26, -62 + y - sw, 14, 36)
  g.fillStyle(v.secondary, 0.85)
  g.fillRect(bx - 40, -30 + y + sw, 14, 5)
  g.fillRect(bx + 26, -30 + y - sw, 14, 5)

  // 方形官帽 + 印文面板
  const hx = bx
  g.fillStyle(v.shade, 1)
  g.fillRect(hx - 15, -102 + y, 30, 8)
  g.fillRect(hx - 11, -96 + y, 22, 5)
  g.fillStyle(v.secondary, 1)
  g.fillRect(hx - 12, -92 + y, 24, 22)
  g.lineStyle(1.6, v.shade, 0.9)
  g.strokeRect(hx - 12, -92 + y, 24, 22)
  g.lineStyle(1.4, v.primary, 0.9)
  g.lineBetween(hx - 8, -86 + y, hx + 8, -86 + y)
  g.lineBetween(hx - 8, -81 + y, hx + 8, -81 + y)
  g.lineBetween(hx - 8, -76 + y, hx + 8, -76 + y)
  g.lineBetween(hx, -88 + y, hx, -74 + y)

  if (ctx.armor) {
    g.lineStyle(3, v.secondary, 0.9)
    g.strokeRect(bx - 44, -106 + y, 88, 108)
  }
}

// ═══════════════════════════════════════════════════════════════
//  8. Kimi · 瘦长黑袍 + 缺月 + 896 星（激活 16）
// ═══════════════════════════════════════════════════════════════
const KIMI_STARS = (() => {
  const rnd = seeded(20260716)
  return Array.from({ length: 64 }, () => {
    const a = rnd() * Math.PI * 2
    const r = 34 + rnd() * 40
    return { x: Math.cos(a) * r, y: -60 + Math.sin(a) * r * 0.85, ph: rnd() * 6.28, s: 0.8 + rnd() * 1.4 }
  })
})()

function drawWraith(g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) {
  const v = ctx.char.visual
  const y = p.bob
  const lx = p.lunge
  const bx = lx + p.lean * 0.4
  const lit = Math.round(16 + ctx.power * 48)

  // 缺月环
  g.lineStyle(7, v.secondary, 0.5)
  g.beginPath()
  g.arc(bx, -66 + y, 40, Phaser.Math.DegToRad(-52), Phaser.Math.DegToRad(232), false)
  g.strokePath()
  g.lineStyle(2.5, v.glow, 0.75)
  g.beginPath()
  g.arc(bx, -66 + y, 40, Phaser.Math.DegToRad(-52), Phaser.Math.DegToRad(232), false)
  g.strokePath()

  // 896 专家星群（只有激活的在亮）
  KIMI_STARS.forEach((s, i) => {
    const on = i < lit
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(ctx.t * 2.2 + s.ph))
    g.fillStyle(on ? v.secondary : 0x2a2d45, on ? tw : 0.35)
    g.fillCircle(bx + s.x, y + s.y, on ? s.s * tw + 0.6 : s.s * 0.5)
  })

  // 袍身：上窄下散，底部雾化
  const hem = 6 + Math.sin(ctx.t * 1.3) * 2
  g.fillStyle(v.primary, 1)
  g.fillPoints(
    pts([
      [bx - 11, -84 + y],
      [bx + 11, -84 + y],
      [bx + 16, -30 + y],
      [bx + 20 + hem, -6],
      [bx - 20 - hem, -6],
      [bx - 16, -30 + y],
    ]),
    true,
    true,
  )
  // 银色边饰
  g.lineStyle(1.6, v.secondary, 0.65)
  g.lineBetween(bx - 11, -84 + y, bx - 20 - hem, -6)
  g.lineBetween(bx + 11, -84 + y, bx + 20 + hem, -6)

  // 袍角雾化
  for (let i = 0; i < 7; i++) {
    const ph = (ctx.t * 0.4 + i * 0.14) % 1
    g.fillStyle(v.primary, (1 - ph) * 0.4)
    g.fillCircle(bx - 18 + i * 6, -4 + ph * 6, 5 - ph * 3)
  }

  // 拢于袖中的双手
  const sw = Math.sin(p.arm) * 5
  g.fillStyle(v.shade, 1)
  g.fillRoundedRect(bx - 15, -58 + y + sw, 30, 14, 7)
  g.lineStyle(1.4, v.secondary, 0.5)
  g.strokeRoundedRect(bx - 15, -58 + y + sw, 30, 14, 7)

  // 兜帽
  g.fillStyle(v.primary, 1)
  g.fillPoints(
    pts([
      [bx - 13, -82 + y],
      [bx - 11, -100 + y],
      [bx, -108 + y],
      [bx + 11, -100 + y],
      [bx + 13, -82 + y],
    ]),
    true,
    true,
  )
  g.fillStyle(0x000000, 0.85)
  g.fillEllipse(bx, -92 + y, 18, 20)
  // 兜帽阴影里的弯月银光
  g.lineStyle(2.6, v.secondary, 0.95)
  g.beginPath()
  g.arc(bx + 1, -92 + y, 6.5, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60), false)
  g.strokePath()

  // 满层时的星环
  if (ctx.power >= 0.99) {
    g.lineStyle(2, v.glow, 0.5 + 0.3 * Math.sin(ctx.t * 5))
    g.strokeEllipse(bx, -60 + y, 130, 108)
  }
}

// ═══════════════════════════════════════════════════════════════

const DRAWERS: Record<string, (g: Phaser.GameObjects.Graphics, ctx: DrawCtx, p: Pose) => void> = {
  robe: drawRobe,
  prism: drawPrism,
  mech: drawMech,
  twin: drawTwin,
  sage: drawSage,
  chibi: drawChibi,
  fort: drawFort,
  wraith: drawWraith,
}

/** 画一个角色。g 已被 clear，坐标原点在脚底。 */
export function drawFighter(g: Phaser.GameObjects.Graphics, ctx: DrawCtx) {
  const pose = poseOf(ctx)
  // 地面投影
  if (ctx.state !== 'jump' && ctx.state !== 'fall') {
    g.fillStyle(0x000000, 0.28)
    g.fillEllipse(0, 2, 58, 12)
  }
  const fn = DRAWERS[ctx.char.visual.silhouette] ?? drawRobe
  fn(g, ctx, pose)
}
