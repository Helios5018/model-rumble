import Phaser from 'phaser'
import type { Fighter } from '../fighter/Fighter'
import type { CharacterData } from '../data/types'
import { HEAT_MAX, THINK_MAX } from '../fighter/Fighter'
import { drawFighter, type DrawCtx } from './draw'

/** 角色资源归一化到 0~1，供外观动效使用 */
export function resourceRatio(f: Fighter): number {
  switch (f.data2.resource) {
    case 'heat':
      return f.heat / HEAT_MAX
    case 'think':
      return f.thinkStacks / THINK_MAX
    default:
      return 0
  }
}

/**
 * 跟随 Fighter 的程序化外观。
 * Fighter 自身的 Sprite 不可见，所有视觉都在这里逐帧重绘。
 */
export class FighterArt {
  private g: Phaser.GameObjects.Graphics
  private root: Phaser.GameObjects.Container
  private flashUntil = 0
  private fighter: Fighter

  constructor(scene: Phaser.Scene, fighter: Fighter) {
    this.fighter = fighter
    this.g = scene.add.graphics()
    this.root = scene.add.container(fighter.x, fighter.y + 44, [this.g]).setDepth(20)
  }

  flash(durationMs = 90) {
    this.flashUntil = this.fighter.scene.time.now + durationMs
  }

  update(timeMs: number) {
    const f = this.fighter
    if (f.isKO) {
      this.root.setVisible(false)
      return
    }
    this.root.setVisible(true)

    const spec = f.data2.visual
    const body = f.body as Phaser.Physics.Arcade.Body
    this.root.setPosition(f.x, f.y + 44)
    this.root.setScale(f.facing * spec.scale, spec.scale)
    this.root.setAlpha(f.fstate === 'dodge' ? 0.4 : 1)

    const ctx: DrawCtx = {
      t: timeMs / 1000,
      char: f.data2,
      state: f.fstate,
      atk: f.attackProgress,
      power: resourceRatio(f),
      stance: f.stanceIndex,
      armor: f.armorActive,
      meltdown: f.meltdown,
      speed: Math.abs(body.velocity.x),
    }

    this.g.clear()
    drawFighter(this.g, ctx)

    // 受击闪白
    if (timeMs < this.flashUntil) {
      const a = ((this.flashUntil - timeMs) / 90) * 0.65
      this.g.fillStyle(0xffffff, a)
      this.g.fillRoundedRect(-30, -104, 60, 106, 14)
    }
    // 无敌闪烁
    if (f.isInvulnerable && f.fstate !== 'dodge') {
      this.root.setAlpha(0.45 + 0.4 * Math.abs(Math.sin(timeMs / 90)))
    }
  }

  destroy() {
    this.root.destroy(true)
  }
}

/** 生成静态立绘（选人卡 / HUD 头像 / 结算画面复用） */
export function makePortrait(
  scene: Phaser.Scene,
  char: CharacterData,
  targetHeight: number,
  animated = false,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics()
  const container = scene.add.container(0, 0, [g])
  const scale = targetHeight / 118
  container.setScale(scale)

  const render = (t: number) => {
    g.clear()
    drawFighter(g, {
      t,
      char,
      state: 'idle',
      atk: -1,
      power: char.resource === 'think' ? 0.35 : char.resource === 'heat' ? 0.4 : 0,
      stance: 1,
      armor: false,
      meltdown: false,
      speed: 0,
    })
  }
  render(0)

  if (animated) {
    const ev = scene.time.addEvent({
      delay: 33,
      loop: true,
      callback: () => render(scene.time.now / 1000),
    })
    container.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove())
  }
  // 立绘按脚底对齐：容器原点在脚底，向上是负方向
  return container
}
