import Phaser from 'phaser'
import { CHARACTERS } from '../data/characters'
import { FACTIONS } from '../data/factions'
import type { MoveData } from '../data/types'
import { Fighter } from '../fighter/Fighter'
import { CpuSource } from '../fighter/CpuSource'
import { KeyboardSource, P1_KEYS, P2_KEYS, P2_KEYS_ALT, type InputSource } from '../fighter/InputSource'
import { HUD } from '../ui/HUD'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { AudioBus } from '../audio/AudioBus'
import { FighterArt } from '../visual/FighterArt'
import { playFx, type FxStyle } from '../visual/Fx'
import { Afterimage, Blast, Bubble, ContextWall, GroundShock, Minion, SlowZone } from '../combat/Entities'
import type { MatchSetup } from './CharacterSelectScene'

type ProjectileSprite = Phaser.Physics.Arcade.Sprite & {
  owner?: Fighter
  moveData?: MoveData
  diesAt?: number
}

export class ArenaScene extends Phaser.Scene {
  private setup!: MatchSetup
  private p1!: Fighter
  private p2!: Fighter
  private art = new Map<Fighter, FighterArt>()
  private inputs: InputSource[] = []
  private hud!: HUD
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup
  private projectiles!: Phaser.GameObjects.Group
  private hitstopUntil = 0
  private matchOver = false
  private debugGfx: Phaser.GameObjects.Graphics | null = null
  private debugOn = false

  // 签名机制实体
  private minions: Minion[] = []
  private walls: ContextWall[] = []
  private zones: SlowZone[] = []
  private bubbles: Bubble[] = []
  private blasts: Blast[] = []
  private ghosts: Afterimage[] = []
  private shocks: GroundShock[] = []

  constructor() {
    super('Arena')
  }

  init(data: MatchSetup) {
    this.setup = data
    this.matchOver = false
    this.hitstopUntil = 0
    this.inputs = []
    this.debugGfx = null
    this.debugOn = false
    this.art = new Map()
    this.minions = []
    this.walls = []
    this.zones = []
    this.bubbles = []
    this.blasts = []
    this.ghosts = []
    this.shocks = []
  }

  create() {
    this.buildStage()

    const c1 = CHARACTERS[this.setup.p1CharId]
    const c2 = CHARACTERS[this.setup.p2CharId]

    this.p1 = new Fighter(this, 400, 420, c1, 0, 1)
    this.p2 = new Fighter(this, 880, 420, c2, 1, -1)
    this.p1.opponent = this.p2
    this.p2.opponent = this.p1
    for (const f of [this.p1, this.p2]) this.art.set(f, new FighterArt(this, f))

    if (new URLSearchParams(location.search).has('autop1')) {
      const cpu1 = new CpuSource()
      cpu1.bind(this.p1, this.p2)
      this.inputs.push(cpu1)
    } else {
      this.inputs.push(new KeyboardSource(this, P1_KEYS))
    }
    if (this.setup.p2IsCpu) {
      const cpu = new CpuSource()
      cpu.bind(this.p2, this.p1)
      this.inputs.push(cpu)
    } else {
      this.inputs.push(new KeyboardSource(this, P2_KEYS, P2_KEYS_ALT))
    }

    const canCollide: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (fObj, pObj) => {
      const fighter = fObj as unknown as Fighter
      const platform = pObj as unknown as Phaser.Physics.Arcade.Sprite
      if (platform.getData('oneway') && this.time.now < fighter.dropThroughUntil) return false
      return true
    }
    this.physics.add.collider(this.p1, this.platforms, undefined, canCollide)
    this.physics.add.collider(this.p2, this.platforms, undefined, canCollide)
    this.physics.add.collider(this.p1, this.wallGroup)
    this.physics.add.collider(this.p2, this.wallGroup)

    this.projectiles = this.add.group()

    for (const f of [this.p1, this.p2]) this.wireFighter(f)

    AudioBus.bgm(this, 'bgm_battle')
    this.hud = new HUD(this, this.p1, this.p2, this.setup.p2IsCpu)

    this.showIntro(c1.faction, c2.faction)

    this.input.keyboard!.on('keydown-H', () => {
      this.debugOn = !this.debugOn
      if (!this.debugOn && this.debugGfx) this.debugGfx.clear()
    })
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('Select'))
    this.debugGfx = this.add.graphics().setDepth(200)
  }

  // ───────────────────────── 事件接线 ─────────────────────────

  private wireFighter(f: Fighter) {
    const foe = () => (f === this.p1 ? this.p2 : this.p1)

    f.on('hit', (e: { move: MoveData; opp: Fighter; x: number; y: number; damage: number }) => this.onHit(f, e))
    f.on('ko', (e: { fighter: Fighter; stocksLeft: number }) => this.onKO(e))
    f.on('projectile', (move: MoveData) => this.fireProjectiles(f, move))
    f.on('buff', (move: MoveData) => {
      this.showBuffFx(f, move)
      AudioBus.sfx(this, 'shield')
    })
    f.on('swing', (move: MoveData) => {
      this.showSwingFx(f, move)
      AudioBus.sfx(this, 'swing')
    })
    f.on('movestart', (move: MoveData) => {
      if (move.kind === 'ultimate') {
        AudioBus.sfx(this, 'ultimate')
        this.flashText(f.x, f.y - 110, move.cnName, '#ffd866')
        this.cameras.main.flash(180, 40, 40, 60)
      }
    })
    f.on('jump', () => AudioBus.sfx(this, 'jump'))
    f.on('airjump', () => AudioBus.sfx(this, 'jump', 0.2))
    f.on('dodge', () => AudioBus.sfx(this, 'dodge'))
    f.on('respawn', () => AudioBus.sfx(this, 'respawn'))
    f.on('hurt', () => this.art.get(f)?.flash())
    f.on('counter', () => {
      this.flashText(f.x, f.y - 80, 'REFUSED!', '#ffd866')
      playFx(this, 'seal', f.x, f.y - 20, { color: f.data2.color, accent: f.data2.accentColor, scale: 1.3 })
      AudioBus.sfx(this, 'counter')
    })
    f.on('shieldhit', () => this.flashText(f.x, f.y - 80, 'BLOCK', '#4de8ff'))
    f.on('armorhit', () => {
      this.flashText(f.x, f.y - 80, 'ARMOR', '#ffe9c9')
      playFx(this, 'ring', f.x, f.y - 10, { color: 0xffe9c9, accent: 0xffffff, scale: 0.8 })
    })
    f.on('thorns', (n: number) => this.flashText(f.x, f.y - 100, `反伤 ${Math.round(n)}`, '#d4af37'))
    f.on('stunned', () => this.flashText(f.x, f.y - 96, 'STUN!', '#ff9f43'))
    f.on('drain', (n: number) => this.flashText(f.x, f.y - 100, `吸取算力 ${Math.round(n)}`, '#e8c37a'))
    f.on('teleport', () => {
      playFx(this, 'star', f.x, f.y - 20, { color: f.data2.color, accent: f.data2.accentColor, scale: 1.1 })
      AudioBus.sfx(this, 'dodge')
    })
    f.on('stance', (s: { cnName: string; color: number }) => {
      this.flashText(f.x, f.y - 100, s.cnName, '#ffffff')
      playFx(this, 'ring', f.x, f.y - 20, { color: s.color, accent: 0xffffff, scale: 1 })
    })
    f.on('pricecut', () => {
      this.flashText(f.x, f.y - 100, '冷却清空！', '#7dffd8')
      playFx(this, 'burst', f.x, f.y - 20, { color: f.data2.color, accent: 0x7dffd8, scale: 1.2 })
    })
    f.on('frenzy', () => {
      playFx(this, 'ring', f.x, f.y - 20, { color: f.data2.accentColor, accent: 0xffffff, scale: 1.2 })
    })
    f.on('meltdown', () => {
      this.flashText(f.x, f.y - 110, 'MELTDOWN!', '#ff4d1c')
      this.cameras.main.shake(220, 0.01)
    })
    f.on('thinkburst', (n: number) => {
      if (n > 0) this.flashText(f.x, f.y - 110, `思考 ×${n}`, '#c9d4ff')
    })
    f.on('channelstart', () => {
      this.flashText(f.x, f.y - 100, '深度思考', '#c9d4ff')
      playFx(this, 'star', f.x, f.y - 40, { color: 0x9d8bff, accent: 0xc9d4ff, scale: 1.4, durationMs: 600 })
    })
    f.on('blasthit', (e: { x: number; y: number }) => {
      this.hitstopUntil = this.time.now + 40
      this.art.get(foe())?.flash()
      playFx(this, 'impact', e.x, e.y, { color: f.data2.color, accent: 0xffffff, scale: 0.9 })
      AudioBus.sfx(this, 'hit_light')
    })

    // ── 签名机制 ──
    f.on('summon', (move: MoveData) => {
      const cfg = move.mech!.summon!
      for (let i = 0; i < cfg.count; i++) this.minions.push(new Minion(this, f, foe(), cfg, i))
      this.flashText(f.x, f.y - 100, `开源分发 ×${cfg.count}`, '#e8c37a')
      playFx(this, 'ring', f.x, f.y - 20, { color: f.data2.color, accent: f.data2.accentColor, scale: 1.3 })
    })
    f.on('wall', (move: MoveData) => {
      this.walls.push(new ContextWall(this, f, this.wallGroup, move.mech!.wall!))
      this.flashText(f.x, f.y - 100, '上下文封域', '#5fc9f8')
      AudioBus.sfx(this, 'shield')
    })
    f.on('zone', (move: MoveData) => {
      this.zones.push(new SlowZone(this, f, move.mech!.zone!))
      this.flashText(f.x, f.y - 100, '1M 上下文场', '#9168c0')
    })
    f.on('bubble', (e: { x: number; y: number; cfg: { delayMs: number; damage: number; radius: number } }) => {
      this.bubbles.push(new Bubble(this, f, e.x, e.y, e.cfg))
    })
    f.on('skystrike', (move: MoveData) => {
      const cfg = move.mech!.skyStrike!
      const target = foe()
      const baseX = target.x
      const groundY = target.y + 44
      for (let i = 0; i < cfg.count; i++) {
        const ox = ((i / (cfg.count - 1)) - 0.5) * cfg.spreadX
        this.blasts.push(
          new Blast(this, f, Phaser.Math.Clamp(baseX + ox, 60, GAME_WIDTH - 60), groundY, {
            delayMs: 280 + i * cfg.intervalMs,
            radius: cfg.radius,
            damage: cfg.damage,
            kind: 'pillar',
          }, move),
        )
      }
    })
    f.on('trailreplay', (move: MoveData) => {
      const cfg = move.mech!.trailReplay!
      const target = foe()
      const now = this.time.now
      const hist = target.trail.filter((s) => now - s.t <= cfg.lookbackMs)
      const picks: { x: number; y: number }[] = []
      for (let i = 0; i < cfg.samples; i++) {
        const idx = Math.floor((i / cfg.samples) * hist.length)
        const s = hist[idx] ?? { x: target.x, y: target.y }
        picks.push({ x: s.x, y: s.y })
      }
      picks.forEach((s, i) => {
        this.blasts.push(
          new Blast(this, f, s.x, s.y + 20, {
            delayMs: 200 + i * cfg.intervalMs,
            radius: cfg.radius,
            damage: cfg.damage,
            kind: 'ring',
          }, move),
        )
      })
      this.flashText(f.x, f.y - 100, 'Seedance 剪辑', '#ff6b9d')
    })
    f.on('afterimage', (e: { move: MoveData; x: number; y: number; facing: number }) => {
      const cfg = e.move.mech!.afterimage!
      this.ghosts.push(
        new Afterimage(this, f, e.x, e.y, e.facing, f.data2.moves[cfg.copyKind], cfg.delayMs),
      )
    })
    f.on('groundshock', (move: MoveData) => {
      const cfg = move.mech!.groundShock!
      this.shocks.push(new GroundShock(this, f, f.y + 44, f.facing, cfg, move))
    })
  }

  private showIntro(fa: string, fb: string) {
    const same = fa === fb
    const label = same
      ? `${FACTIONS[fa as 'us' | 'cn'].cnName} 内战`
      : `${FACTIONS.us.cnName} ⚔ ${FACTIONS.cn.cnName}`
    const banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 130, label, {
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setShadow(0, 3, '#000000', 8)
    const ready = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'READY?', {
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setShadow(0, 3, '#000000', 8)
    this.time.delayedCall(900, () => {
      ready.setText('RUMBLE!')
      this.time.delayedCall(700, () => {
        ready.destroy()
        banner.destroy()
      })
    })
  }

  private buildStage() {
    if (this.textures.exists('stage_bg')) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'stage_bg')
      bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height))
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x080a16, 0.35)
    } else {
      const g = this.add.graphics()
      g.fillGradientStyle(0x141a33, 0x141a33, 0x2a1740, 0x321f4e, 1)
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      for (let i = 0; i < 70; i++) {
        g.fillStyle(0xffffff, Math.random() * 0.5 + 0.1)
        g.fillCircle(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT * 0.7, Math.random() * 2)
      }
    }
    // 阵营旗帜背景
    this.add.rectangle(180, 360, 300, 720, FACTIONS.us.color, 0.05)
    this.add.rectangle(1100, 360, 300, 720, FACTIONS.cn.color, 0.05)

    this.platforms = this.physics.add.staticGroup()
    this.wallGroup = this.physics.add.staticGroup()
    const hasMainArt = this.textures.exists('stage_platform_main')
    const hasFloatArt = this.textures.exists('stage_platform_float')

    const main = this.platforms.create(GAME_WIDTH / 2, 560, 'platform_main') as Phaser.Physics.Arcade.Sprite
    main.setDisplaySize(760, 40).refreshBody()
    if (hasMainArt) {
      main.setVisible(false)
      const artImg = this.add.image(GAME_WIDTH / 2, 540, 'stage_platform_main').setOrigin(0.5, 0)
      artImg.setScale(780 / artImg.width)
    }

    const fa = this.platforms.create(GAME_WIDTH / 2 - 260, 340, 'platform_float') as Phaser.Physics.Arcade.Sprite
    fa.setDisplaySize(220, 20).refreshBody()
    const fb = this.platforms.create(GAME_WIDTH / 2 + 260, 340, 'platform_float') as Phaser.Physics.Arcade.Sprite
    fb.setDisplaySize(220, 20).refreshBody()
    if (hasFloatArt) {
      for (const p of [fa, fb]) {
        p.setVisible(false)
        const artImg = this.add.image(p.x, 330, 'stage_platform_float').setOrigin(0.5, 0)
        artImg.setScale(230 / artImg.width)
      }
    }
    for (const p of [fa, fb]) {
      p.setData('oneway', true)
      const body = p.body as Phaser.Physics.Arcade.StaticBody
      body.checkCollision.down = false
      body.checkCollision.left = false
      body.checkCollision.right = false
    }
  }

  // ───────────────────────── 主循环 ─────────────────────────

  update(time: number, delta: number) {
    if (this.matchOver) {
      this.art.forEach((a) => a.update(time))
      return
    }

    if (time < this.hitstopUntil) {
      this.physics.world.pause()
      return
    }
    this.physics.world.resume()

    this.p1.update(time, delta, this.inputs[0].poll())
    this.p2.update(time, delta, this.inputs[1].poll())

    this.zones = this.zones.filter((z) => {
      z.update(time, this.foeOf(z.owner))
      return !z.dead
    })
    this.minions = this.minions.filter((m) => {
      m.update(time, delta)
      return !m.dead
    })
    this.walls = this.walls.filter((w) => {
      w.update(time)
      return !w.dead
    })
    this.bubbles = this.bubbles.filter((b) => {
      b.update(time, this.foeOf(b.owner))
      return !b.dead
    })
    this.blasts = this.blasts.filter((b) => {
      b.update(time, this.foeOf(b.owner))
      return !b.dead
    })
    this.ghosts = this.ghosts.filter((gh) => {
      gh.update(time, this.foeOf(gh.owner))
      return !gh.dead
    })
    this.shocks = this.shocks.filter((s) => {
      s.update(time, delta, this.foeOf(s.owner))
      return !s.dead
    })

    this.updateProjectiles(time)
    this.art.forEach((a) => a.update(time))
    this.hud.update()
    if (this.debugOn) this.drawDebug()
  }

  private foeOf(f: Fighter): Fighter {
    return f === this.p1 ? this.p2 : this.p1
  }

  // ───────────────────────── 弹道 ─────────────────────────

  private fireProjectiles(owner: Fighter, move: MoveData) {
    const spread = move.mech?.spread
    if (spread) {
      const half = spread.angleSpreadDeg / 2
      for (let i = 0; i < spread.count; i++) {
        const a = -half + (spread.angleSpreadDeg / (spread.count - 1)) * i
        this.spawnProjectile(owner, move, a)
      }
    } else {
      this.spawnProjectile(owner, move, 0)
    }
    AudioBus.sfx(this, 'swing')
  }

  private spawnProjectile(owner: Fighter, move: MoveData, angleDeg: number) {
    const p = move.projectile!
    const key = `proj_${owner.data2.id}`
    const proj = this.physics.add.sprite(
      owner.x + 40 * owner.facing,
      owner.y + move.hitbox.offsetY,
      this.textures.exists(key) ? key : 'projectile_default',
    ) as ProjectileSprite
    const body = proj.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    const rad = Phaser.Math.DegToRad(angleDeg)
    // GPT 的形态会改变弹速
    const speedMul = owner.data2.resource === 'stance' ? owner.stance.speedMul : 1
    proj.setVelocity(Math.cos(rad) * p.speed * owner.facing * speedMul, Math.sin(rad) * p.speed)
    proj.setRotation(rad * owner.facing)
    proj.setFlipX(owner.facing < 0)
    proj.owner = owner
    proj.moveData = move
    proj.diesAt = this.time.now + p.lifetimeMs
    this.projectiles.add(proj)
  }

  private updateProjectiles(time: number) {
    for (const obj of this.projectiles.getChildren() as ProjectileSprite[]) {
      if (!obj.active) continue
      if (time > (obj.diesAt ?? 0) || obj.x < -60 || obj.x > GAME_WIDTH + 60 || obj.y > GAME_HEIGHT + 60) {
        obj.destroy()
        continue
      }
      const pRect = obj.getBounds()

      // 撞墙
      let blocked = false
      for (const w of this.walls) {
        if (w.dead || w.owner === obj.owner) continue
        const wb = w.sprite.getBounds()
        if (Phaser.Geom.Intersects.RectangleToRectangle(wb, pRect)) {
          w.damage(obj.moveData?.damage ?? 5)
          obj.destroy()
          blocked = true
          break
        }
      }
      if (blocked) continue

      const target = obj.owner === this.p1 ? this.p2 : this.p1
      if (target.isKO || target.isInvulnerable) continue
      const tb = target.body as Phaser.Physics.Arcade.Body
      const rect = new Phaser.Geom.Rectangle(tb.x, tb.y, tb.width, tb.height)
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, pRect)) {
        const move = obj.moveData!
        const owner = obj.owner!
        const dmg = move.damage * owner.damageMultiplier(move)
        const result = target.takeHit(dmg, move, owner)
        if (result === 'hit') {
          owner.energy = Math.min(100, owner.energy + move.energyGain)
          owner.onHitLanded(move, target)
          this.onHit(owner, { move, opp: target, x: obj.x, y: obj.y, damage: dmg })
        }
        obj.destroy()
      }
    }
  }

  // ───────────────────────── 反馈 ─────────────────────────

  private onHit(
    attacker: Fighter,
    e: { move: MoveData; opp: Fighter; x: number; y: number; damage: number },
  ) {
    const isHeavy = e.move.kind === 'heavy' || e.move.kind === 'ultimate'
    AudioBus.sfx(this, isHeavy ? 'hit_heavy' : 'hit_light')
    this.hitstopUntil = this.time.now + (isHeavy ? 90 : 45)
    this.cameras.main.shake(isHeavy ? 140 : 70, isHeavy ? 0.008 : 0.003)

    playFx(this, (e.move.fxKey as FxStyle) ?? 'impact', e.x, e.y, {
      color: attacker.data2.color,
      accent: attacker.data2.accentColor,
      facing: attacker.facing,
      scale: isHeavy ? 1.25 : 0.9,
    })
    this.art.get(e.opp)?.flash()

    const dmgText = this.add
      .text(e.x, e.y - 40, `${Math.round(e.damage)}`, {
        fontSize: isHeavy ? '26px' : '20px',
        fontStyle: 'bold',
        color: isHeavy ? '#ffb347' : '#ffee88',
      })
      .setOrigin(0.5)
      .setDepth(60)
    this.tweens.add({
      targets: dmgText,
      y: e.y - 92,
      alpha: 0,
      duration: 520,
      onComplete: () => dmgText.destroy(),
    })
  }

  private showSwingFx(f: Fighter, move: MoveData) {
    const rect = f.getActiveHitbox(move)
    if (!rect) return
    const style = (move.fxKey as FxStyle) ?? 'slash'
    playFx(this, style, rect.centerX, rect.centerY, {
      color: f.data2.color,
      accent: f.data2.accentColor,
      facing: f.facing,
      scale: Math.max(0.8, Math.min(2.2, rect.width / 80)),
      width: rect.width,
      height: rect.height,
      durationMs: style === 'beam' ? (move.activeFrames / 60) * 1000 + 120 : 260,
    })
  }

  private showBuffFx(f: Fighter, move: MoveData) {
    const label = move.cnName
    this.flashText(f.x, f.y - 96, label, '#4de8ff')
    playFx(this, (move.fxKey as FxStyle) ?? 'ring', f.x, f.y - 10, {
      color: f.data2.color,
      accent: f.data2.accentColor,
      scale: 1.2,
      durationMs: 420,
    })
  }

  private flashText(x: number, y: number, text: string, color: string) {
    const t = this.add
      .text(Phaser.Math.Clamp(x, 70, GAME_WIDTH - 70), y, text, {
        fontSize: '20px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setShadow(0, 2, '#000000', 5)
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 760, onComplete: () => t.destroy() })
  }

  private onKO(e: { fighter: Fighter; stocksLeft: number }) {
    const f = e.fighter
    const x = Phaser.Math.Clamp(f.x, 60, GAME_WIDTH - 60)
    const y = Phaser.Math.Clamp(f.y, 60, GAME_HEIGHT - 60)
    playFx(this, 'burst', x, y, { color: f.data2.color, accent: 0xffffff, scale: 2.4, durationMs: 520 })
    this.cameras.main.shake(250, 0.012)
    this.flashText(GAME_WIDTH / 2, 260, 'CONTEXT COLLAPSE!', '#ff5566')
    AudioBus.sfx(this, 'ko')

    if (e.stocksLeft <= 0 && !this.matchOver) {
      this.matchOver = true
      const winner = f === this.p1 ? this.p2 : this.p1
      this.time.delayedCall(1200, () => {
        this.scene.start('Result', {
          winnerCharId: winner.data2.id,
          winnerPlayer: winner.playerIndex,
          loserCharId: f.data2.id,
          p2IsCpu: this.setup.p2IsCpu,
          setup: this.setup,
        })
      })
    }
  }

  private drawDebug() {
    const g = this.debugGfx!
    g.clear()
    for (const f of [this.p1, this.p2]) {
      if (f.isKO) continue
      const b = f.body as Phaser.Physics.Arcade.Body
      g.lineStyle(1, 0x00ff00).strokeRect(b.x, b.y, b.width, b.height)
      if (f.fstate === 'attack' && f.currentMove) {
        const rect = f.getActiveHitbox(f.currentMove)
        if (rect) g.lineStyle(1, 0xff0000).strokeRect(rect.x, rect.y, rect.width, rect.height)
      }
    }
  }
}
