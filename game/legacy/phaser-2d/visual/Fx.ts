import Phaser from 'phaser'

export type FxStyle = 'slash' | 'impact' | 'spark' | 'beam' | 'ring' | 'burst' | 'seal' | 'star' | 'bubble'

type FxOpts = {
  color: number
  accent?: number
  facing?: number
  scale?: number
  width?: number
  height?: number
  durationMs?: number
}

/**
 * 程序化特效。和角色一样全部矢量绘制，风格统一、不依赖外部素材。
 */
export function playFx(scene: Phaser.Scene, style: FxStyle, x: number, y: number, opts: FxOpts) {
  const g = scene.add.graphics({ x, y }).setDepth(45)
  const color = opts.color
  const accent = opts.accent ?? 0xffffff
  const face = opts.facing ?? 1
  const s = opts.scale ?? 1
  const dur = opts.durationMs ?? 260
  const w = opts.width ?? 90
  const h = opts.height ?? 90

  const render: Record<FxStyle, (p: number) => void> = {
    slash: (p) => {
      const sweep = Phaser.Math.DegToRad(-70 + p * 150)
      const r = 34 * s * (0.7 + p * 0.6)
      g.lineStyle(11 * s * (1 - p * 0.6), color, 1 - p)
      g.beginPath()
      g.arc(0, 0, r, sweep - 0.9, sweep + 0.4, false)
      g.strokePath()
      g.lineStyle(3 * s, accent, (1 - p) * 0.9)
      g.beginPath()
      g.arc(0, 0, r + 4 * s, sweep - 0.9, sweep + 0.4, false)
      g.strokePath()
    },
    impact: (p) => {
      const r = 12 + p * 46 * s
      g.lineStyle(6 * (1 - p) * s, color, 1 - p)
      g.strokeCircle(0, 0, r)
      const spikes = 7
      g.lineStyle(4 * (1 - p) * s, accent, 1 - p)
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + p
        g.lineBetween(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4)
      }
    },
    spark: (p) => {
      g.fillStyle(accent, 1 - p)
      g.fillCircle(0, 0, (10 - p * 8) * s)
      g.lineStyle(3 * (1 - p) * s, color, 1 - p)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4
        const d = 8 + p * 30 * s
        g.lineBetween(Math.cos(a) * d * 0.4, Math.sin(a) * d * 0.4, Math.cos(a) * d, Math.sin(a) * d)
      }
    },
    beam: (p) => {
      const a = Math.sin(p * Math.PI)
      g.fillStyle(color, a * 0.55)
      g.fillRect(0, (-h / 2) * a, w * face, h * a)
      g.fillStyle(accent, a)
      g.fillRect(0, (-h / 6) * a, w * face, (h / 3) * a)
    },
    ring: (p) => {
      g.lineStyle(5 * (1 - p) + 1, color, 1 - p)
      g.strokeCircle(0, 0, 14 + p * 56 * s)
      g.lineStyle(2, accent, (1 - p) * 0.8)
      g.strokeCircle(0, 0, 8 + p * 34 * s)
    },
    burst: (p) => {
      g.fillStyle(color, (1 - p) * 0.45)
      g.fillCircle(0, 0, 16 + p * 70 * s)
      g.lineStyle(4 * (1 - p), accent, 1 - p)
      g.strokeCircle(0, 0, 20 + p * 84 * s)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const d = (24 + p * 80) * s
        g.fillStyle(accent, (1 - p) * 0.9)
        g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, 4 * (1 - p) + 1)
      }
    },
    seal: (p) => {
      const sz = (46 - p * 8) * s
      const k = 1 + (1 - p) * 0.8
      g.lineStyle(4, color, 1 - p)
      g.strokeRect((-sz * k) / 2, (-sz * k) / 2, sz * k, sz * k)
      g.lineStyle(2, accent, (1 - p) * 0.9)
      g.strokeRect((-sz * k) / 2 + 5, (-sz * k) / 2 + 5, sz * k - 10, sz * k - 10)
      g.lineBetween((-sz * k) / 2 + 8, 0, (sz * k) / 2 - 8, 0)
      g.lineBetween(0, (-sz * k) / 2 + 8, 0, (sz * k) / 2 - 8)
    },
    star: (p) => {
      const r = (18 + p * 44) * s
      const rot = p * 2
      const pts: Phaser.Types.Math.Vector2Like[] = []
      for (let i = 0; i < 8; i++) {
        const a = rot + (i * Math.PI) / 4
        const rr = i % 2 === 0 ? r : r * 0.3
        pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr })
      }
      g.fillStyle(color, (1 - p) * 0.8)
      g.fillPoints(pts, true, true)
      g.lineStyle(2, accent, 1 - p)
      g.strokePoints(pts, true, true)
    },
    bubble: (p) => {
      const k = 1 + p * 0.9
      g.fillStyle(color, (1 - p) * 0.8)
      g.fillRoundedRect(-22 * k * s, -11 * k * s, 44 * k * s, 22 * k * s, 9 * k * s)
      g.fillStyle(accent, (1 - p) * 0.9)
      g.fillRoundedRect(-14 * k * s, -5 * k * s, 12 * s, 4 * s, 2)
      g.fillRoundedRect(2 * k * s, -5 * k * s, 8 * s, 4 * s, 2)
    },
  }

  const tw = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: dur,
    onUpdate: (t) => {
      g.clear()
      render[style](t.getValue() as number)
    },
    onComplete: () => g.destroy(),
  })
  g.once(Phaser.GameObjects.Events.DESTROY, () => tw.remove())
}

/** 持续型光环，返回一个 stop 函数 */
export function auraFx(
  scene: Phaser.Scene,
  follow: () => { x: number; y: number },
  color: number,
  durationMs: number,
  radius = 52,
) {
  const g = scene.add.graphics().setDepth(18)
  const start = scene.time.now
  const ev = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      const now = scene.time.now
      const p = (now - start) / durationMs
      if (p >= 1) {
        ev.remove()
        g.destroy()
        return
      }
      const pos = follow()
      g.clear()
      g.setPosition(pos.x, pos.y)
      const pulse = 0.5 + 0.5 * Math.sin(now / 110)
      g.lineStyle(3, color, 0.35 + pulse * 0.4)
      g.strokeCircle(0, 0, radius + pulse * 5)
      g.fillStyle(color, 0.1 + pulse * 0.08)
      g.fillCircle(0, 0, radius)
    },
  })
  return () => {
    ev.remove()
    g.destroy()
  }
}
