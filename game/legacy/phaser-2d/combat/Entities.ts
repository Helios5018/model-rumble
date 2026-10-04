import Phaser from 'phaser'
import type { Fighter } from '../fighter/Fighter'
import type { MoveData } from '../data/types'
import { playFx } from '../visual/Fx'

/**
 * 场上的非角色实体：召唤物 / 墙体 / 力场 / 延时气泡 / 落雷 / 残影 / 冲击波。
 * 每一个都是某名角色签名机制的载体，别人没有。
 */

// ───────────────── Qwen：蒸馏分身 ─────────────────
export class Minion {
  readonly owner: Fighter
  dead = false
  private scene: Phaser.Scene
  private target: Fighter
  private cfg: { lifetimeMs: number; attackIntervalMs: number; damage: number }
  private g: Phaser.GameObjects.Graphics
  private x: number
  private y: number
  private nextAttackAt: number
  private diesAt: number

  constructor(
    scene: Phaser.Scene,
    owner: Fighter,
    target: Fighter,
    cfg: { lifetimeMs: number; attackIntervalMs: number; damage: number },
    index: number,
  ) {
    this.scene = scene
    this.owner = owner
    this.target = target
    this.cfg = cfg
    this.x = owner.x + (index === 0 ? -46 : 46)
    this.y = owner.y - 30
    this.diesAt = scene.time.now + cfg.lifetimeMs
    this.nextAttackAt = scene.time.now + cfg.attackIntervalMs * (0.5 + index * 0.5)
    this.g = scene.add.graphics().setDepth(19)
  }

  update(now: number, delta: number) {
    if (this.dead) return
    if (now >= this.diesAt || this.owner.isKO) {
      this.destroy()
      return
    }
    const tx = this.target.x - Math.sign(this.target.x - this.x) * 60
    const ty = this.target.y - 34
    const k = Math.min(1, (delta / 1000) * 3.2)
    this.x += (tx - this.x) * k
    this.y += (ty - this.y) * k

    const haste = now < this.owner.minionHasteUntil ? 0.5 : 1
    if (now >= this.nextAttackAt && !this.target.isKO && !this.target.isInvulnerable) {
      this.nextAttackAt = now + this.cfg.attackIntervalMs * haste
      if (Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y) < 140) {
        const move = this.owner.data2.moves.light
        this.target.takeHit(this.cfg.damage, move, this.owner)
        playFx(this.scene, 'seal', this.target.x, this.target.y - 20, {
          color: this.owner.data2.color,
          accent: this.owner.data2.accentColor,
          scale: 0.6,
        })
      }
    }

    const v = this.owner.data2.visual
    const bob = Math.sin(now / 250 + this.x * 0.01) * 3
    this.g.clear()
    this.g.setPosition(this.x, this.y + bob)
    this.g.fillStyle(v.primary, 0.92)
    this.g.fillPoints(
      [
        { x: -11, y: 14 },
        { x: -6, y: -10 },
        { x: 6, y: -10 },
        { x: 11, y: 14 },
      ],
      true,
      true,
    )
    this.g.fillStyle(0xf2e6d8, 1)
    this.g.fillCircle(0, -16, 6)
    this.g.lineStyle(1.6, v.secondary, 0.9)
    this.g.strokeEllipse(0, -2, 30, 16)
    this.g.lineStyle(1.2, v.secondary, 0.55)
    this.g.strokeEllipse(0, -2, 42, 22)
    this.g.setAlpha(Phaser.Math.Clamp((this.diesAt - now) / 800, 0, 1))
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.g.destroy()
  }
}

// ───────────────── GLM：上下文封域（可破坏墙体） ─────────────────
export class ContextWall {
  readonly owner: Fighter
  readonly sprite: Phaser.Physics.Arcade.Sprite
  hp: number
  dead = false
  private scene: Phaser.Scene
  private g: Phaser.GameObjects.Graphics
  private maxHp: number
  private diesAt: number

  constructor(
    scene: Phaser.Scene,
    owner: Fighter,
    group: Phaser.Physics.Arcade.StaticGroup,
    cfg: { width: number; height: number; hp: number; durationMs: number; offsetX: number },
  ) {
    this.scene = scene
    this.owner = owner
    this.hp = cfg.hp
    this.maxHp = cfg.hp
    this.diesAt = scene.time.now + cfg.durationMs
    const x = Phaser.Math.Clamp(owner.x + cfg.offsetX * owner.facing, 130, 1150)
    const y = owner.y + 44 - cfg.height / 2
    this.sprite = group.create(x, y, 'platform_float') as Phaser.Physics.Arcade.Sprite
    this.sprite.setDisplaySize(cfg.width, cfg.height).refreshBody()
    this.sprite.setVisible(false)
    this.g = scene.add.graphics().setDepth(15)
  }

  damage(n: number) {
    this.hp -= n
    playFx(this.scene, 'impact', this.sprite.x, this.sprite.y, {
      color: this.owner.data2.accentColor,
      accent: 0xffffff,
      scale: 0.5,
    })
    if (this.hp <= 0) this.destroy()
  }

  update(now: number) {
    if (this.dead) return
    if (now >= this.diesAt) {
      this.destroy()
      return
    }
    const v = this.owner.data2.visual
    const w = this.sprite.displayWidth
    const h = this.sprite.displayHeight
    const hpRatio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1)
    this.g.clear()
    this.g.setPosition(this.sprite.x, this.sprite.y)
    this.g.fillStyle(v.primary, 0.92)
    this.g.fillRect(-w / 2, -h / 2, w, h)
    this.g.lineStyle(2, v.secondary, 1)
    this.g.strokeRect(-w / 2, -h / 2, w, h)
    this.g.lineStyle(1, v.glow, 0.45)
    for (let i = 1; i < 6; i++) this.g.lineBetween(-w / 2, -h / 2 + (h / 6) * i, w / 2, -h / 2 + (h / 6) * i)
    this.g.fillStyle(0x000000, 0.5)
    this.g.fillRect(-w / 2, -h / 2 - 9, w, 4)
    this.g.fillStyle(v.secondary, 1)
    this.g.fillRect(-w / 2, -h / 2 - 9, w * hpRatio, 4)
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    playFx(this.scene, 'burst', this.sprite.x, this.sprite.y, {
      color: this.owner.data2.color,
      accent: this.owner.data2.accentColor,
      scale: 1.1,
    })
    this.sprite.destroy()
    this.g.destroy()
  }
}

// ───────────────── Gemini：百万上下文减速力场 ─────────────────
export class SlowZone {
  readonly owner: Fighter
  dead = false
  private g: Phaser.GameObjects.Graphics
  private diesAt: number
  private rect: Phaser.Geom.Rectangle
  private slowMul: number

  constructor(
    scene: Phaser.Scene,
    owner: Fighter,
    cfg: { width: number; height: number; durationMs: number; slowMul: number; offsetX: number },
  ) {
    this.owner = owner
    this.slowMul = cfg.slowMul
    this.diesAt = scene.time.now + cfg.durationMs
    const cx = Phaser.Math.Clamp(owner.x + cfg.offsetX * owner.facing, 110, 1170)
    const cy = owner.y - 10
    this.rect = new Phaser.Geom.Rectangle(cx - cfg.width / 2, cy - cfg.height / 2, cfg.width, cfg.height)
    this.g = scene.add.graphics().setDepth(14)
  }

  update(now: number, foe: Fighter) {
    if (this.dead) return
    if (now >= this.diesAt) {
      this.destroy()
      return
    }
    const v = this.owner.data2.visual
    const r = this.rect
    const pulse = 0.5 + 0.5 * Math.sin(now / 220)
    this.g.clear()
    this.g.fillStyle(v.primary, 0.1 + pulse * 0.06)
    this.g.fillRoundedRect(r.x, r.y, r.width, r.height, 18)
    this.g.lineStyle(2, v.glow, 0.4 + pulse * 0.35)
    this.g.strokeRoundedRect(r.x, r.y, r.width, r.height, 18)
    this.g.lineStyle(1, v.secondary, 0.35)
    for (let i = 0; i < 5; i++) {
      const yy = r.y + ((now / 12 + i * (r.height / 5)) % r.height)
      this.g.lineBetween(r.x + 6, yy, r.x + r.width - 6, yy)
    }
    if (!foe.isKO && Phaser.Geom.Rectangle.Contains(r, foe.x, foe.y)) {
      foe.externalSlow = Math.min(foe.externalSlow, this.slowMul)
    }
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.g.destroy()
  }
}

// ───────────────── Doubao：延时二段爆弹幕气泡 ─────────────────
export class Bubble {
  readonly owner: Fighter
  dead = false
  private scene: Phaser.Scene
  private g: Phaser.GameObjects.Graphics
  private x: number
  private y: number
  private cfg: { delayMs: number; damage: number; radius: number }
  private popAt: number

  constructor(
    scene: Phaser.Scene,
    owner: Fighter,
    x: number,
    y: number,
    cfg: { delayMs: number; damage: number; radius: number },
  ) {
    this.scene = scene
    this.owner = owner
    this.x = x
    this.y = y
    this.cfg = cfg
    this.popAt = scene.time.now + cfg.delayMs
    this.g = scene.add.graphics().setDepth(22)
  }

  update(now: number, foe: Fighter) {
    if (this.dead) return
    if (now >= this.popAt) {
      this.pop(foe)
      return
    }
    const p = 1 - (this.popAt - now) / this.cfg.delayMs
    const v = this.owner.data2.visual
    this.g.clear()
    this.g.setPosition(this.x, this.y - p * 18)
    this.g.fillStyle(v.secondary, 0.55 + p * 0.4)
    this.g.fillRoundedRect(-16, -8, 32, 16, 7)
    this.g.lineStyle(1.6, v.glow, 0.8)
    this.g.strokeRoundedRect(-16, -8, 32, 16, 7)
    this.g.fillStyle(0xffffff, 0.85)
    this.g.fillRect(-10, -2, 8, 3)
    this.g.fillRect(1, -2, 6, 3)
  }

  private pop(foe: Fighter) {
    this.dead = true
    const yy = this.y - 18
    playFx(this.scene, 'bubble', this.x, yy, {
      color: this.owner.data2.color,
      accent: this.owner.data2.accentColor,
      scale: 1.2,
    })
    if (!foe.isKO && !foe.isInvulnerable && Phaser.Math.Distance.Between(this.x, yy, foe.x, foe.y) < this.cfg.radius) {
      foe.takeHit(this.cfg.damage, this.owner.data2.moves.light, this.owner)
      this.owner.emit('blasthit', { x: foe.x, y: foe.y - 20 })
    }
    this.g.destroy()
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.g.destroy()
  }
}

// ───────────────── Grok 轨道打击 / Doubao 轨迹回放 ─────────────────
export class Blast {
  readonly owner: Fighter
  dead = false
  private scene: Phaser.Scene
  private g: Phaser.GameObjects.Graphics
  private x: number
  private y: number
  private cfg: { delayMs: number; radius: number; damage: number; kind: 'pillar' | 'ring' }
  private move: MoveData
  private bornAt: number
  private fireAt: number
  private fired = false

  constructor(
    scene: Phaser.Scene,
    owner: Fighter,
    x: number,
    y: number,
    cfg: { delayMs: number; radius: number; damage: number; kind: 'pillar' | 'ring' },
    move: MoveData,
  ) {
    this.scene = scene
    this.owner = owner
    this.x = x
    this.y = y
    this.cfg = cfg
    this.move = move
    this.bornAt = scene.time.now
    this.fireAt = scene.time.now + cfg.delayMs
    this.g = scene.add.graphics().setDepth(24)
  }

  update(now: number, foe: Fighter) {
    if (this.dead) return
    const v = this.owner.data2.visual
    this.g.clear()

    if (!this.fired) {
      const p = (now - this.bornAt) / Math.max(1, this.fireAt - this.bornAt)
      this.g.lineStyle(2, v.glow, 0.5 + 0.5 * Math.sin(now / 60))
      this.g.strokeCircle(this.x, this.y, this.cfg.radius * (1 - p * 0.35))
      this.g.fillStyle(v.glow, 0.12)
      this.g.fillCircle(this.x, this.y, this.cfg.radius * (1 - p * 0.35))
      if (now >= this.fireAt) {
        this.fired = true
        this.bornAt = now
        this.hit(foe)
      }
      return
    }

    const p = (now - this.bornAt) / 260
    if (p >= 1) {
      this.destroy()
      return
    }
    if (this.cfg.kind === 'pillar') {
      this.g.fillStyle(v.glow, (1 - p) * 0.7)
      this.g.fillRect(this.x - this.cfg.radius * 0.45, this.y - 620, this.cfg.radius * 0.9, 620)
      this.g.fillStyle(0xffffff, (1 - p) * 0.85)
      this.g.fillRect(this.x - this.cfg.radius * 0.16, this.y - 620, this.cfg.radius * 0.32, 620)
    }
    this.g.lineStyle(5 * (1 - p), v.glow, 1 - p)
    this.g.strokeCircle(this.x, this.y, this.cfg.radius * (0.5 + p))
  }

  private hit(foe: Fighter) {
    this.scene.cameras.main.shake(90, 0.006)
    if (foe.isKO || foe.isInvulnerable) return
    if (Phaser.Math.Distance.Between(this.x, this.y, foe.x, foe.y) < this.cfg.radius) {
      const move = this.move
      const dmg = this.cfg.damage * this.owner.damageMultiplier(move)
      foe.takeHit(dmg, move, this.owner)
      this.owner.onHitLanded(move, foe)
      this.owner.emit('blasthit', { x: this.x, y: this.y })
    }
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.g.destroy()
  }
}

// ───────────────── Gemini：残影分身 ─────────────────
export class Afterimage {
  readonly owner: Fighter
  dead = false
  private scene: Phaser.Scene
  private g: Phaser.GameObjects.Graphics
  private x: number
  private y: number
  private facing: number
  private copyMove: MoveData
  private bornAt: number
  private fireAt: number
  private fired = false

  constructor(
    scene: Phaser.Scene,
    owner: Fighter,
    x: number,
    y: number,
    facing: number,
    copyMove: MoveData,
    delayMs: number,
  ) {
    this.scene = scene
    this.owner = owner
    this.x = x
    this.y = y
    this.facing = facing
    this.copyMove = copyMove
    this.bornAt = scene.time.now
    this.fireAt = scene.time.now + delayMs
    this.g = scene.add.graphics().setDepth(17)
  }

  update(now: number, foe: Fighter) {
    if (this.dead) return
    const v = this.owner.data2.visual
    const life = this.fired
      ? (now - this.fireAt) / 300
      : (now - this.bornAt) / Math.max(1, this.fireAt - this.bornAt)
    if (this.fired && life >= 1) {
      this.destroy()
      return
    }
    this.g.clear()
    this.g.setPosition(this.x, this.y + 44)
    this.g.setScale(this.facing, 1)
    const a = this.fired ? 0.5 * (1 - life) : 0.42
    this.g.fillStyle(v.primary, a)
    this.g.fillRoundedRect(-14, -80, 28, 68, 11)
    this.g.fillStyle(v.secondary, a * 0.8)
    this.g.fillRoundedRect(0, -80, 14, 68, 8)
    this.g.fillStyle(v.glow, a)
    this.g.fillCircle(0, -96, 11)

    if (!this.fired && now >= this.fireAt) {
      this.fired = true
      this.fire(foe)
    }
  }

  private fire(foe: Fighter) {
    const m = this.copyMove
    const cx = this.x + m.hitbox.offsetX * this.facing
    const cy = this.y + m.hitbox.offsetY
    playFx(this.scene, 'beam', this.x + 18 * this.facing, cy, {
      color: this.owner.data2.color,
      accent: this.owner.data2.accentColor,
      facing: this.facing,
      width: m.hitbox.width,
      height: m.hitbox.height,
      durationMs: 300,
    })
    if (foe.isKO || foe.isInvulnerable) return
    const rect = new Phaser.Geom.Rectangle(
      cx - m.hitbox.width / 2,
      cy - m.hitbox.height / 2,
      m.hitbox.width,
      m.hitbox.height,
    )
    const fb = foe.body as Phaser.Physics.Arcade.Body
    if (
      Phaser.Geom.Intersects.RectangleToRectangle(rect, new Phaser.Geom.Rectangle(fb.x, fb.y, fb.width, fb.height))
    ) {
      const dmg = m.damage * 0.6 * this.owner.damageMultiplier(m)
      foe.takeHit(dmg, m, this.owner)
      this.owner.onHitLanded(m, foe)
      this.owner.emit('blasthit', { x: foe.x, y: foe.y - 20 })
    }
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.g.destroy()
  }
}

// ───────────────── GLM：贴地冲击波 ─────────────────
export class GroundShock {
  readonly owner: Fighter
  dead = false
  private g: Phaser.GameObjects.Graphics
  private y: number
  private dir: number
  private cfg: { distance: number; speed: number; height: number }
  private move: MoveData
  private x: number
  private startX: number
  private hit = false

  constructor(
    scene: Phaser.Scene,
    owner: Fighter,
    y: number,
    dir: number,
    cfg: { distance: number; speed: number; height: number },
    move: MoveData,
  ) {
    this.owner = owner
    this.y = y
    this.dir = dir
    this.cfg = cfg
    this.move = move
    this.x = owner.x + dir * 40
    this.startX = this.x
    this.g = scene.add.graphics().setDepth(16)
  }

  update(_now: number, delta: number, foe: Fighter) {
    if (this.dead) return
    this.x += this.dir * this.cfg.speed * (delta / 1000)
    const travelled = Math.abs(this.x - this.startX)
    if (travelled > this.cfg.distance) {
      this.destroy()
      return
    }
    const v = this.owner.data2.visual
    const prog = travelled / this.cfg.distance
    this.g.clear()
    this.g.setPosition(this.x, this.y)
    this.g.fillStyle(v.secondary, (1 - prog) * 0.85)
    this.g.fillTriangle(-14 * this.dir, 0, 0, -this.cfg.height, 14 * this.dir, 0)
    this.g.lineStyle(2, v.glow, (1 - prog) * 0.9)
    this.g.strokeTriangle(-14 * this.dir, 0, 0, -this.cfg.height, 14 * this.dir, 0)

    if (!this.hit && !foe.isKO && !foe.isInvulnerable) {
      if (Math.abs(foe.x - this.x) < 36 && Math.abs(foe.y + 44 - this.y) < 76) {
        this.hit = true
        const dmg = this.move.damage * 0.55 * this.owner.damageMultiplier(this.move)
        foe.takeHit(dmg, this.move, this.owner)
        this.owner.onHitLanded(this.move, foe)
        this.owner.emit('blasthit', { x: foe.x, y: foe.y - 10 })
        this.destroy()
      }
    }
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.g.destroy()
  }
}
