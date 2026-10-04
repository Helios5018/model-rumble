import type { Fighter } from './Fighter'
import { EMPTY_INPUT, type FighterInput, type InputSource } from './InputSource'

const CENTER_X = 640
/** 主平台 260~1020，只有真正靠边才放弃进攻回场 */
const EDGE_LEFT = 225
const EDGE_RIGHT = 1055

/**
 * CPU：追身 → 进入射程出招 → 高幻觉率时改用击杀招 → 掉台优先回场。
 * v2 里需要驱动 8 套完全不同的招式，所以按"角色能不能远程"来分流。
 */
export class CpuSource implements InputSource {
  private me!: Fighter
  private foe!: Fighter
  private nextDecisionAt = 0
  private plan: Partial<FighterInput> = {}

  bind(me: Fighter, foe: Fighter) {
    this.me = me
    this.foe = foe
  }

  private get hasRanged(): boolean {
    const m = this.me.data2.moves
    return !!(m.light.projectile || m.heavy.projectile || m.special2.projectile)
  }

  /** 挑一个当前最合适的攻击键 */
  private pickAttack(dist: number, r: number): Partial<FighterInput> {
    const me = this.me
    const foe = this.foe
    const killTime = foe.rate > 110

    // 算力满就找机会放大招
    if (me.energy >= 100 && dist < 260 && r < 0.4) return { ultimatePressed: true }

    // 对手硬直中：追击重击
    if ((foe.fstate === 'hitstun' || foe.fstate === 'stunned') && dist < 150) {
      return killTime ? { heavyPressed: true } : { lightPressed: true }
    }

    if (killTime && dist < 130 && r < 0.55) return { heavyPressed: true }

    if (r < 0.34) return { lightPressed: true }
    if (r < 0.58) return { heavyPressed: true }
    if (r < 0.74) return { special2Pressed: true }
    if (r < 0.88) return { special1Pressed: true }
    return { shieldPressed: true, shieldHeld: true }
  }

  poll(): FighterInput {
    if (!this.me || !this.foe || this.me.isKO) return { ...EMPTY_INPUT }
    const now = this.me.scene.time.now
    const input: FighterInput = { ...EMPTY_INPUT }

    const dx = this.foe.x - this.me.x
    const dy = this.foe.y - this.me.y
    const dist = Math.abs(dx)

    if (now >= this.nextDecisionAt) {
      this.nextDecisionAt = now + 110 + Math.random() * 130
      this.plan = {}
      const r = Math.random()
      const nearEdge = this.me.x < EDGE_LEFT || this.me.x > EDGE_RIGHT

      if (this.foe.isKO) {
        this.plan.left = this.me.x > CENTER_X + 40
        this.plan.right = this.me.x < CENTER_X - 40
      } else if (nearEdge) {
        this.plan.left = this.me.x > CENTER_X
        this.plan.right = this.me.x < CENTER_X
      } else if (dy < -110) {
        // 对手在上方平台：跳上去
        this.plan.jumpPressed = true
        this.plan.left = dx < -20
        this.plan.right = dx > 20
      } else if (dy > 110) {
        this.plan.down = true
        this.plan.left = dx < -20
        this.plan.right = dx > 20
      } else if (dist > 300) {
        // 远距离：远程角色边走边打，近战角色纯追
        this.plan.left = dx < 0
        this.plan.right = dx > 0
        if (this.hasRanged && r < 0.5) this.plan.lightPressed = true
        else if (r < 0.62) this.plan.special1Pressed = true
      } else if (dist > 95) {
        // 中距离：贴近，偶尔用位移技切入
        this.plan.left = dx < 0
        this.plan.right = dx > 0
        if (r < 0.22) this.plan.special1Pressed = true
        else if (this.hasRanged && r < 0.42) this.plan.lightPressed = true
      } else {
        // 贴身：绝大多数时候出招
        Object.assign(this.plan, this.pickAttack(dist, r))
        // 朝向必须对：站在对方身上却背对着打是最常见的空砍来源
        const wantFacing = dx >= 0 ? 1 : -1
        if (this.me.facing !== wantFacing || dist > 68) {
          this.plan.left = dx < 0
          this.plan.right = dx > 0
        } else if (dist < 32) {
          // 完全重叠时两边都打空，拉开到有效距离
          this.plan.left = dx > 0
          this.plan.right = dx < 0
        }
      }
    }

    Object.assign(input, this.plan)

    // 回台优先级最高
    const offStage = this.me.x < 250 || this.me.x > 1030
    if (offStage || this.me.y > 600) {
      input.left = this.me.x > CENTER_X
      input.right = this.me.x < CENTER_X
      input.lightPressed = false
      input.heavyPressed = false
      input.shieldPressed = false
      input.shieldHeld = false
      if ((this.me.body as { velocity: { y: number } }).velocity.y > 40) input.jumpPressed = true
    }

    // 一次性按键只触发一帧
    this.plan.jumpPressed = false
    this.plan.lightPressed = false
    this.plan.heavyPressed = false
    this.plan.special1Pressed = false
    this.plan.special2Pressed = false
    this.plan.ultimatePressed = false
    this.plan.shieldPressed = false
    return input
  }
}
