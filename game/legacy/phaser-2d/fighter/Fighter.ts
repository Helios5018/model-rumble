import Phaser from 'phaser'
import type { CharacterData, MoveData, MoveKind } from '../data/types'
import { STANCES } from '../data/characters'
import { FACTION_PASSIVE } from '../data/factions'
import type { FighterInput } from './InputSource'
import {
  BLAST_BOTTOM,
  BLAST_LEFT,
  BLAST_RIGHT,
  BLAST_TOP,
  COYOTE_MS,
  INPUT_BUFFER_MS,
  MAX_ENERGY,
  MAX_RATE,
  RESPAWN_INVULN_MS,
  STOCKS,
} from '../config'

export type FighterState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'attack'
  | 'shield'
  | 'dodge'
  | 'hitstun'
  | 'stunned'
  | 'channel'
  | 'ko'

type BufferedAction = { kind: MoveKind | 'jump'; time: number }

const FRAME_MS = 1000 / 60

export const HEAT_MAX = 100
export const MELTDOWN_AT = 85
export const THINK_MAX = 5
const THINK_IDLE_INTERVAL_MS = 800
/** 思考层数的通用收益 */
const THINK_DAMAGE_PER_STACK = 0.06
const THINK_KNOCKBACK_PER_STACK = 0.06

export class Fighter extends Phaser.Physics.Arcade.Sprite {
  readonly data2: CharacterData
  readonly playerIndex: number
  opponent!: Fighter

  fstate: FighterState = 'idle'
  facing = 1
  stocks = STOCKS
  rate = 0 // 幻觉率
  energy = 0 // 算力
  koCount = 0

  // ── 角色专属资源 ──
  heat = 0 // Grok
  thinkStacks = 0 // Kimi
  stanceIndex = 1 // GPT，默认 Terra
  versionStacks = 0 // 中国阵营被动
  private versionExpireAt = 0
  private nextThinkAt = 0

  private moveSpeed: number
  private jumpVel: number
  private airJumpsMax = 1
  private airJumps = 0
  private lastGroundedAt = 0
  private buffered: BufferedAction | null = null

  // 攻击状态
  currentMove: MoveData | null = null
  private moveFrame = 0
  private hitsDone = 0
  private victims = new Set<Fighter>()
  private cooldowns = new Map<string, number>() // moveId -> readyAt(ms)

  // 受击/防御状态
  private hitstunUntil = 0
  private invulnUntil = 0
  private dodgeUntil = 0
  private dodgeCooldownUntil = 0
  shieldBuffUntil = 0
  counterBuffUntil = 0
  cdrBuffUntil = 0
  private empowerLightMul = 1

  // ── 新机制状态 ──
  armorUntil = 0
  private armorReduction = 0
  thornsUntil = 0
  private thornsRatio = 0
  stunnedUntil = 0
  frenzyUntil = 0
  private frenzySpeedMul = 1
  private frenzyAttackMul = 1
  channelUntil = 0
  private channelReduction = 0
  private channelStackInterval = 0
  private nextChannelStackAt = 0
  /** 由减速力场每帧写入，1 = 不减速 */
  externalSlow = 1
  /** 大招期间给召唤物的加速标记 */
  minionHasteUntil = 0

  /** 位置轨迹，供 Doubao 的轨迹回放读取 */
  readonly trail: { x: number; y: number; t: number }[] = []

  private respawnX: number
  private respawnY: number
  private spawnFacing: number
  dropThroughUntil = 0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    charData: CharacterData,
    playerIndex: number,
    facing: number,
  ) {
    super(scene, x, y, `placeholder_${charData.id}`)
    this.data2 = charData
    this.playerIndex = playerIndex
    this.respawnX = x
    this.respawnY = y
    this.facing = facing
    this.spawnFacing = facing

    scene.add.existing(this)
    scene.physics.add.existing(this)
    // 视觉全部交给 FighterArt 程序化绘制，物理精灵本身不可见
    this.setVisible(false)

    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(48, 88)
    body.setMaxVelocityY(1600)

    this.moveSpeed = 200 + charData.stats.speed * 24
    this.jumpVel = -(560 + charData.stats.jumpPower * 38)
  }

  // ───────────────────────── 查询 ─────────────────────────

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnUntil || this.scene.time.now < this.dodgeUntil
  }

  get isShielding(): boolean {
    return this.fstate === 'shield'
  }

  get isKO(): boolean {
    return this.fstate === 'ko'
  }

  get shieldBuffActive(): boolean {
    return this.scene.time.now < this.shieldBuffUntil
  }

  get counterBuffActive(): boolean {
    return this.scene.time.now < this.counterBuffUntil
  }

  get cdrBuffActive(): boolean {
    return this.scene.time.now < this.cdrBuffUntil
  }

  get armorActive(): boolean {
    return this.scene.time.now < this.armorUntil
  }

  get thornsActive(): boolean {
    return this.scene.time.now < this.thornsUntil
  }

  get meltdown(): boolean {
    return this.data2.resource === 'heat' && this.heat >= MELTDOWN_AT
  }

  get stance() {
    return STANCES[this.stanceIndex]
  }

  /** 出招速度倍率：形态 + 狂暴 + 过热 */
  get attackSpeedMul(): number {
    let m = 1
    if (this.data2.resource === 'stance') m *= this.stance.speedMul
    if (this.scene.time.now < this.frenzyUntil) m *= this.frenzyAttackMul
    if (this.meltdown) m *= 1.2
    return m
  }

  /** 移动速度倍率 */
  get moveSpeedMul(): number {
    let m = this.externalSlow
    if (this.data2.resource === 'stance') m *= this.stance.moveMul
    if (this.scene.time.now < this.frenzyUntil) m *= this.frenzySpeedMul
    if (this.data2.resource === 'heat') m *= 1 + (this.heat / 10) * 0.015
    return m
  }

  /** 当前招式进度 0~1，无招式时 -1（外观动画用） */
  get attackProgress(): number {
    const m = this.currentMove
    if (!m) return -1
    return this.moveFrame / (m.startupFrames + m.activeFrames + m.recoveryFrames)
  }

  cooldownRemaining(kind: MoveKind): number {
    const move = this.data2.moves[kind]
    const readyAt = this.cooldowns.get(move.id) ?? 0
    return Math.max(0, readyAt - this.scene.time.now)
  }

  /** 综合伤害倍率（不含招式自身机制） */
  damageMultiplier(move: MoveData): number {
    let m = 0.7 + this.data2.stats.attack * 0.06
    if (this.data2.resource === 'stance') m *= this.stance.damageMul
    if (this.data2.resource === 'heat') m *= 1 + (this.heat / 10) * 0.03
    if (this.data2.resource === 'think') m *= 1 + this.thinkStacks * THINK_DAMAGE_PER_STACK
    if (this.data2.faction === 'cn') m *= 1 + this.versionStacks * FACTION_PASSIVE.cn.versionDamagePerStack
    if (this.data2.faction === 'us' && move.kind === 'ultimate') m *= FACTION_PASSIVE.us.ultimateDamageMul
    if (this.meltdown) m *= 1.25
    return m
  }

  // ───────────────────────── 主循环 ─────────────────────────

  update(_time: number, delta: number, input: FighterInput) {
    if (this.fstate === 'ko') return
    const now = this.scene.time.now
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down || body.touching.down

    if (onGround) {
      this.lastGroundedAt = now
      this.airJumps = 0
    }

    this.tickResources(delta, now, input)
    this.recordTrail(now)

    this.checkBlastZones()
    if ((this.fstate as FighterState) === 'ko') return

    // 缓冲输入
    if (input.jumpPressed) this.buffered = { kind: 'jump', time: now }
    else if (input.lightPressed) this.buffered = { kind: 'light', time: now }
    else if (input.heavyPressed) this.buffered = { kind: 'heavy', time: now }
    else if (input.special1Pressed) this.buffered = { kind: 'special1', time: now }
    else if (input.special2Pressed) this.buffered = { kind: 'special2', time: now }
    else if (input.ultimatePressed) this.buffered = { kind: 'ultimate', time: now }
    if (this.buffered && now - this.buffered.time > INPUT_BUFFER_MS) this.buffered = null

    switch (this.fstate) {
      case 'hitstun':
        // 空中击飞时横向速度逐渐衰减，避免无限飘飞
        if (!onGround) body.velocity.x *= Math.pow(0.992, delta / FRAME_MS)
        if (now >= this.hitstunUntil && (onGround || Math.abs(body.velocity.x) < 520)) {
          this.fstate = onGround ? 'idle' : 'fall'
        }
        break
      case 'stunned':
        this.setVelocityX(0)
        if (now >= this.stunnedUntil) this.fstate = onGround ? 'idle' : 'fall'
        break
      case 'channel':
        this.setVelocityX(0)
        if (now >= this.nextChannelStackAt) {
          this.addThink(1)
          this.nextChannelStackAt = now + this.channelStackInterval
        }
        if (now >= this.channelUntil) this.fstate = onGround ? 'idle' : 'fall'
        break
      case 'attack':
        this.updateAttack(delta)
        break
      case 'dodge':
        if (now >= this.dodgeUntil) {
          this.fstate = onGround ? 'idle' : 'fall'
        }
        break
      case 'shield':
        if (!input.shieldHeld) this.fstate = 'idle'
        this.setVelocityX(0)
        break
      default:
        this.updateMovement(input, onGround)
    }

    // 通用：尝试起手缓冲的动作
    if (['idle', 'run', 'jump', 'fall'].includes(this.fstate) && this.buffered) {
      const act = this.buffered
      if (act.kind === 'jump') {
        if (this.tryJump(now)) this.buffered = null
      } else if (this.tryStartMove(act.kind)) {
        this.buffered = null
      }
    }

    // 防御/闪避
    if (['idle', 'run'].includes(this.fstate) && input.shieldPressed) {
      if ((input.left || input.right) && now >= this.dodgeCooldownUntil) {
        this.startDodge(input.left ? -1 : 1, now)
      } else {
        this.fstate = 'shield'
        this.setVelocityX(0)
      }
    }

    this.setFlipX(this.facing < 0)
    // 力场每帧重新写入，这里先复位
    this.externalSlow = 1
  }

  /** 阵营被动 + 角色资源的每帧结算 */
  private tickResources(delta: number, now: number, input: FighterInput) {
    const dt = delta / 1000

    // 🇺🇸 算力壁垒：算力自然回充
    if (this.data2.faction === 'us') {
      this.energy = Math.min(MAX_ENERGY, this.energy + FACTION_PASSIVE.us.energyRegenPerSec * dt)
    }
    // 🇨🇳 开源迭代：版本号超时清空
    if (this.data2.faction === 'cn' && this.versionStacks > 0 && now > this.versionExpireAt) {
      this.versionStacks = 0
    }

    // Grok：热量自然散去 + 过热自伤
    if (this.data2.resource === 'heat') {
      this.heat = Phaser.Math.Clamp(this.heat - 6 * dt, 0, HEAT_MAX)
      if (this.heat > 0) {
        const burn = (this.heat / 10) * 0.3 * dt * (this.meltdown ? 2 : 1)
        this.rate = Math.min(MAX_RATE, this.rate + burn)
      }
    }

    // Kimi：站定思考
    if (this.data2.resource === 'think') {
      const still =
        (this.fstate === 'idle' || this.fstate === 'shield') && !input.left && !input.right && !input.down
      if (still) {
        if (now >= this.nextThinkAt) {
          this.addThink(1)
          this.nextThinkAt = now + THINK_IDLE_INTERVAL_MS
        }
      } else if (this.fstate !== 'channel') {
        this.nextThinkAt = now + THINK_IDLE_INTERVAL_MS
      }
    }
  }

  private recordTrail(now: number) {
    const last = this.trail[this.trail.length - 1]
    if (!last || now - last.t > 60) {
      this.trail.push({ x: this.x, y: this.y, t: now })
      while (this.trail.length > 0 && now - this.trail[0].t > 3000) this.trail.shift()
    }
  }

  addThink(n: number) {
    this.thinkStacks = Phaser.Math.Clamp(this.thinkStacks + n, 0, THINK_MAX)
  }

  addHeat(n: number) {
    if (this.data2.resource !== 'heat') return
    const before = this.meltdown
    this.heat = Phaser.Math.Clamp(this.heat + n, 0, HEAT_MAX)
    if (!before && this.meltdown) this.emit('meltdown')
  }

  private updateMovement(input: FighterInput, onGround: boolean) {
    let vx = 0
    const speed = this.moveSpeed * this.moveSpeedMul
    if (input.left) vx -= speed
    if (input.right) vx += speed
    this.setVelocityX(vx)
    if (vx !== 0) this.facing = vx > 0 ? 1 : -1

    const body = this.body as Phaser.Physics.Arcade.Body
    if (onGround) {
      this.fstate = vx !== 0 ? 'run' : 'idle'
    } else {
      this.fstate = body.velocity.y < 0 ? 'jump' : 'fall'
    }
    if (!onGround && input.down && body.velocity.y > -100) {
      body.velocity.y += 60
    }
    if (onGround && input.down) {
      this.dropThroughUntil = this.scene.time.now + 260
    }
  }

  private tryJump(now: number): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down || body.touching.down
    const coyote = now - this.lastGroundedAt < COYOTE_MS
    if (onGround || coyote) {
      this.setVelocityY(this.jumpVel)
      this.fstate = 'jump'
      this.emit('jump')
      return true
    }
    if (this.airJumps < this.airJumpsMax) {
      this.airJumps++
      this.setVelocityY(this.jumpVel * 0.92)
      this.fstate = 'jump'
      this.emit('airjump')
      return true
    }
    return false
  }

  private startDodge(dir: number, now: number) {
    this.fstate = 'dodge'
    this.facing = dir
    this.dodgeUntil = now + 320
    this.dodgeCooldownUntil = now + 1100
    this.setVelocityX(dir * 520)
    this.emit('dodge')
  }

  tryStartMove(kind: MoveKind): boolean {
    const now = this.scene.time.now
    const move = this.data2.moves[kind]
    if ((this.cooldowns.get(move.id) ?? 0) > now) return false
    if (move.energyCost > 0 && this.energy < move.energyCost) return false

    this.energy = Math.max(0, this.energy - move.energyCost)
    let cd = move.cooldownMs
    if (this.data2.faction === 'cn') cd *= FACTION_PASSIVE.cn.cooldownMul
    if (this.cdrBuffActive) cd *= 0.4
    this.cooldowns.set(move.id, now + cd)

    this.fstate = 'attack'
    this.currentMove = move
    this.moveFrame = 0
    this.hitsDone = 0
    this.victims.clear()

    // 起手即霸体的招式（Claude 审慎裁决 / 宪法审判 / GLM 高塔）
    if (move.mech?.armor && move.hitbox.width > 0) {
      const totalMs = ((move.startupFrames + move.activeFrames + move.recoveryFrames) / 60) * 1000
      this.armorUntil = now + totalMs
      this.armorReduction = move.mech.armor.damageReduction
    }

    if (!move.dash) this.setVelocityX(0)
    this.emit('movestart', move)
    return true
  }

  private updateAttack(delta: number) {
    const move = this.currentMove!
    const prevFrame = this.moveFrame
    this.moveFrame += (delta / FRAME_MS) * this.attackSpeedMul

    const startup = move.startupFrames
    const activeEnd = startup + move.activeFrames
    const total = activeEnd + move.recoveryFrames

    if (move.dash && this.moveFrame >= startup && this.moveFrame < activeEnd) {
      this.setVelocityX(move.dash.velocityX * this.facing * this.moveSpeedMul)
      if (move.dash.velocityY) this.setVelocityY(move.dash.velocityY)
    }

    if (prevFrame < startup && this.moveFrame >= startup) {
      this.onActiveStart(move)
    }

    if (this.moveFrame >= startup && this.moveFrame < activeEnd) {
      this.checkHits(move)
    }

    if (this.moveFrame >= total) {
      this.currentMove = null
      const body = this.body as Phaser.Physics.Arcade.Body
      const onGround = body.blocked.down || body.touching.down
      this.fstate = onGround ? 'idle' : 'fall'
    }
  }

  /** 招式进入有效帧的瞬间：触发所有"施放型"机制 */
  private onActiveStart(move: MoveData) {
    const now = this.scene.time.now
    const m = move.mech

    if (m?.heat) this.addHeat(m.heat)
    if (m?.instantEnergy) this.energy = Math.min(MAX_ENERGY, this.energy + m.instantEnergy)
    if (m?.empowerLight) this.empowerLightMul = m.empowerLight

    if (m?.switchStance) {
      this.stanceIndex = (this.stanceIndex + 1) % STANCES.length
      this.invulnUntil = Math.max(this.invulnUntil, now + 400)
      this.emit('stance', this.stance)
    }

    if (m?.resetCooldowns) {
      const selfId = move.id
      const keep = this.cooldowns.get(selfId)
      this.cooldowns.clear()
      if (keep !== undefined) this.cooldowns.set(selfId, keep)
      this.emit('pricecut')
    }

    if (m?.frenzy) {
      this.frenzyUntil = now + m.frenzy.durationMs
      this.frenzySpeedMul = m.frenzy.speedMul
      this.frenzyAttackMul = m.frenzy.attackSpeedMul
      this.emit('frenzy', m.frenzy)
    }

    if (m?.thorns) {
      this.thornsUntil = now + m.thorns.durationMs
      this.thornsRatio = m.thorns.ratio
    }
    // 无判定框的霸体类招式（GLM MIT 许可）
    if (m?.armor && move.hitbox.width === 0) {
      const dur = m.thorns?.durationMs ?? 2000
      this.armorUntil = now + dur
      this.armorReduction = m.armor.damageReduction
    }

    if (m?.teleportBehind && this.opponent && !this.opponent.isKO) {
      const opp = this.opponent
      const dir = Math.sign(opp.x - this.x) || 1
      this.setPosition(Phaser.Math.Clamp(opp.x + dir * m.teleportBehind.offset, 90, 1190), opp.y - 6)
      this.facing = -dir
      this.setVelocity(0, 0)
      this.emit('teleport')
    }

    if (m?.channel) {
      this.fstate = 'channel'
      this.channelUntil = now + m.channel.durationMs
      this.channelReduction = m.channel.damageReduction
      this.channelStackInterval = m.channel.stackIntervalMs
      this.nextChannelStackAt = now + m.channel.stackIntervalMs
      this.currentMove = null
      this.emit('channelstart', m.channel)
      return
    }

    if (m?.summon) {
      this.emit('summon', move)
      return
    }
    if (m?.wall) {
      this.emit('wall', move)
      return
    }
    if (m?.zone) {
      this.emit('zone', move)
    }
    if (m?.skyStrike) {
      this.emit('skystrike', move)
      return
    }
    if (m?.trailReplay) {
      this.emit('trailreplay', move)
      return
    }
    if (m?.afterimage) {
      this.emit('afterimage', { move, x: this.x, y: this.y, facing: this.facing })
    }
    if (m?.groundShock) {
      this.emit('groundshock', move)
    }

    if (move.projectile) {
      this.emit('projectile', move)
      return
    }
    if (move.buff) {
      if (move.buff.type === 'shield') this.shieldBuffUntil = now + move.buff.durationMs
      if (move.buff.type === 'counter') this.counterBuffUntil = now + move.buff.durationMs
      if (move.buff.type === 'cooldown') this.cdrBuffUntil = now + move.buff.durationMs
      this.emit('buff', move)
      return
    }
    if (move.hitbox.width === 0) {
      this.emit('buff', move)
      return
    }
    if (move.kind === 'ultimate') this.minionHasteUntil = now + 3000
    this.emit('swing', move)
  }

  getActiveHitbox(move: MoveData): Phaser.Geom.Rectangle | null {
    if (move.hitbox.width === 0) return null
    const cx = this.x + move.hitbox.offsetX * this.facing
    const cy = this.y + move.hitbox.offsetY
    return new Phaser.Geom.Rectangle(
      cx - move.hitbox.width / 2,
      cy - move.hitbox.height / 2,
      move.hitbox.width,
      move.hitbox.height,
    )
  }

  private checkHits(move: MoveData) {
    const rect = this.getActiveHitbox(move)
    if (!rect) return
    const opp = this.opponent
    if (!opp || opp.isKO || opp.isInvulnerable) return

    const maxHits = move.multiHit?.count ?? 1
    if (this.hitsDone >= maxHits) return

    if (move.multiHit) {
      const startup = move.startupFrames
      const hitFrame = startup + this.hitsDone * move.multiHit.intervalFrames
      if (this.moveFrame < hitFrame) return
    } else if (this.victims.has(opp)) {
      return
    }

    const oppBody = opp.body as Phaser.Physics.Arcade.Body
    const oppRect = new Phaser.Geom.Rectangle(oppBody.x, oppBody.y, oppBody.width, oppBody.height)
    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, oppRect)) {
      this.victims.add(opp)
      this.hitsDone++
      this.landHit(move, opp, rect)
    }
  }

  /** 计算最终伤害，含只在"首次命中"结算一次的消耗型加成 */
  private computeDamage(move: MoveData, consume: boolean): number {
    let dmg = move.damage * this.damageMultiplier(move)
    const m = move.mech
    if (m?.consumeThink && this.thinkStacks > 0) {
      dmg *= 1 + this.thinkStacks * m.consumeThink.perStackDamageMul
      if (consume) {
        this.emit('thinkburst', this.thinkStacks)
        this.thinkStacks = 0
      }
    }
    if (this.empowerLightMul > 1 && move.kind === 'light') {
      dmg *= this.empowerLightMul
      if (consume) this.empowerLightMul = 1
    }
    return dmg
  }

  private landHit(move: MoveData, opp: Fighter, hitRect: Phaser.Geom.Rectangle) {
    const firstHit = this.hitsDone === 1
    const dmg = this.computeDamage(move, firstHit)
    const result = opp.takeHit(dmg, move, this)
    if (result === 'countered') return

    this.energy = Math.min(MAX_ENERGY, this.energy + move.energyGain)
    this.onHitLanded(move, opp)
    this.emit('hit', { move, opp, x: hitRect.centerX, y: hitRect.centerY, damage: dmg })
  }

  /** 命中后触发的机制（弹道命中也会走这里） */
  onHitLanded(move: MoveData, opp: Fighter) {
    const now = this.scene.time.now
    const m = move.mech

    // 🇨🇳 版本号滚雪球
    if (this.data2.faction === 'cn') {
      this.versionStacks = Math.min(FACTION_PASSIVE.cn.versionMaxStacks, this.versionStacks + 1)
      this.versionExpireAt = now + FACTION_PASSIVE.cn.versionDecayMs
    }
    if (this.data2.resource === 'heat' && move.kind === 'light') this.addHeat(3)

    if (!m) return
    if (m.stun) opp.applyStun(m.stun.durationMs)
    if (m.gainThink) this.addThink(m.gainThink)
    if (m.drain) {
      const taken = Math.min(opp.energy, m.drain.energy)
      opp.energy -= taken
      this.energy = Math.min(MAX_ENERGY, this.energy + taken)
      this.emit('drain', taken)
    }
    if (m.pull) {
      const dir = Math.sign(this.x - opp.x) || 1
      opp.setVelocity(dir * m.pull.strength, -140)
    }
    if (m.drag) {
      opp.setVelocityX(this.facing * m.drag.distance * 3)
    }
    if (m.bubble) {
      this.emit('bubble', { x: opp.x, y: opp.y - 20, cfg: m.bubble })
    }
  }

  applyStun(durationMs: number) {
    if (this.isKO || this.armorActive) return
    this.stunnedUntil = Math.max(this.stunnedUntil, this.scene.time.now + durationMs)
    this.fstate = 'stunned'
    this.currentMove = null
    this.setVelocityX(0)
    this.emit('stunned', durationMs)
  }

  /** 返回 'hit' | 'shielded' | 'countered' | 'invuln' */
  takeHit(
    damage: number,
    move: MoveData,
    attacker: Fighter,
  ): 'hit' | 'shielded' | 'countered' | 'invuln' {
    if (this.isInvulnerable || this.isKO) return 'invuln'

    // 拒绝反击
    if (this.counterBuffActive) {
      this.counterBuffUntil = 0
      this.facing = attacker.x > this.x ? 1 : -1
      const counterMove = this.data2.moves.special2
      attacker.applyKnockback(counterMove.baseKnockback, counterMove.knockbackAngle, this)
      attacker.rate = Math.min(MAX_RATE, attacker.rate + counterMove.damage)
      if (counterMove.mech?.stun) attacker.applyStun(counterMove.mech.stun.durationMs)
      this.emit('counter', { attacker })
      return 'countered'
    }

    // 主动防御
    if (this.isShielding) {
      this.rate = Math.min(MAX_RATE, this.rate + damage * 0.25)
      this.gainEnergyFromHit(damage * 0.4)
      const dir = this.x > attacker.x ? 1 : -1
      this.setVelocityX(dir * 120)
      this.emit('shieldhit')
      return 'shielded'
    }

    let rateGain = damage
    let kbScale = 1

    if (this.shieldBuffActive) {
      rateGain *= 0.3
      kbScale = 0.35
      this.emit('shieldhit')
    }
    if (this.fstate === 'channel') {
      rateGain *= 1 - this.channelReduction
      kbScale *= 0.5
    }

    // 反伤
    if (this.thornsActive) {
      const back = damage * this.thornsRatio
      attacker.rate = Math.min(MAX_RATE, attacker.rate + back)
      attacker.emit('hurt', { damage: back, kb: 0 })
      this.emit('thorns', back)
    }

    // 霸体：不被击飞、伤害减免、不进硬直
    if (this.armorActive) {
      rateGain *= 1 - this.armorReduction
      this.rate = Math.min(MAX_RATE, this.rate + rateGain)
      this.gainEnergyFromHit(damage * 0.5)
      this.emit('armorhit')
      return 'hit'
    }

    this.rate = Math.min(MAX_RATE, this.rate + rateGain)
    this.gainEnergyFromHit(damage * 0.5)
    this.applyKnockback(move.baseKnockback * kbScale, move.knockbackAngle, attacker)
    return 'hit'
  }

  private gainEnergyFromHit(base: number) {
    const mul = this.data2.faction === 'cn' ? FACTION_PASSIVE.cn.hitEnergyMul : 1
    this.energy = Math.min(MAX_ENERGY, this.energy + base * mul)
  }

  applyKnockback(baseKnockback: number, angleDeg: number, attacker: Fighter) {
    const now = this.scene.time.now
    const weightMod = 10 / (this.data2.stats.weight + 4)
    let kb = baseKnockback * (0.35 + this.rate / 44) * weightMod
    if (attacker.data2.resource === 'think') kb *= 1 + attacker.thinkStacks * THINK_KNOCKBACK_PER_STACK
    const dir = this.x >= attacker.x ? 1 : -1
    const rad = Phaser.Math.DegToRad(angleDeg)
    this.setVelocity(Math.cos(rad) * kb * dir, Math.sin(rad) * kb)

    const stabilityMod = 1 - this.data2.stats.stability * 0.03
    const stun = Phaser.Math.Clamp(kb * 0.45 * stabilityMod, 100, 1000)
    this.hitstunUntil = now + stun
    this.fstate = 'hitstun'
    this.currentMove = null
    this.facing = -dir
    this.emit('hurt', { damage: 0, kb })
  }

  private checkBlastZones() {
    if (this.x < BLAST_LEFT || this.x > BLAST_RIGHT || this.y > BLAST_BOTTOM || this.y < BLAST_TOP) {
      this.doKO()
    }
  }

  private doKO() {
    if (this.fstate === 'ko') return
    this.fstate = 'ko'
    this.stocks--
    this.currentMove = null
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setEnable(false)
    this.emit('ko', { fighter: this, stocksLeft: this.stocks })

    if (this.stocks > 0) {
      this.scene.time.delayedCall(1400, () => this.respawn())
    }
  }

  private respawn() {
    if (!this.scene) return
    this.rate = 0
    this.heat = 0
    this.thinkStacks = 0
    this.versionStacks = 0
    this.armorUntil = 0
    this.thornsUntil = 0
    this.stunnedUntil = 0
    this.frenzyUntil = 0
    this.setPosition(this.respawnX, this.respawnY - 160)
    this.facing = this.spawnFacing
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setEnable(true)
    this.setVelocity(0, 0)
    this.fstate = 'fall'
    this.invulnUntil = this.scene.time.now + RESPAWN_INVULN_MS
    this.emit('respawn')
  }
}
