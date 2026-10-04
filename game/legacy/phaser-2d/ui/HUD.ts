import Phaser from 'phaser'
import type { Fighter } from '../fighter/Fighter'
import { HEAT_MAX, THINK_MAX } from '../fighter/Fighter'
import { GAME_WIDTH, MAX_ENERGY } from '../config'
import type { MoveKind } from '../data/types'
import { FACTIONS, FACTION_PASSIVE } from '../data/factions'
import { STANCES } from '../data/characters'
import { makePortrait } from '../visual/FighterArt'

const SKILL_SLOTS: { kind: MoveKind; k1: string; k2: string }[] = [
  { kind: 'light', k1: 'J', k2: ',' },
  { kind: 'heavy', k1: 'K', k2: '.' },
  { kind: 'special1', k1: 'L', k2: '/' },
  { kind: 'special2', k1: 'U', k2: 'M' },
  { kind: 'ultimate', k1: 'I', k2: 'N' },
]

const PANEL_W = 342

class PlayerPanel {
  private fighter: Fighter
  private rateText: Phaser.GameObjects.Text
  private stockIcons: Phaser.GameObjects.Arc[] = []
  private energyBar: Phaser.GameObjects.Rectangle
  private ultGlow: Phaser.GameObjects.Rectangle
  private cdOverlays: Phaser.GameObjects.Rectangle[] = []
  private resBar: Phaser.GameObjects.Rectangle | null = null
  private resLabel: Phaser.GameObjects.Text | null = null
  private resPips: Phaser.GameObjects.Rectangle[] = []
  private versionPips: Phaser.GameObjects.Rectangle[] = []

  constructor(scene: Phaser.Scene, fighter: Fighter, side: 'left' | 'right', isCpu: boolean) {
    this.fighter = fighter
    const isLeft = side === 'left'
    const baseX = isLeft ? 24 : GAME_WIDTH - PANEL_W - 24
    const y = 18
    const char = fighter.data2
    const fac = FACTIONS[char.faction]

    scene.add
      .rectangle(baseX + PANEL_W / 2, y + 56, PANEL_W, 132, 0x05070f, 0.55)
      .setOrigin(0.5)
      .setDepth(90)
      .setStrokeStyle(2, fac.color, 0.8)

    // 阵营条
    scene.add.rectangle(baseX, y - 8, PANEL_W, 5, fac.color, 0.95).setOrigin(0, 0.5).setDepth(91)

    // 立绘
    const portrait = makePortrait(scene, char, 74)
    portrait.setPosition(baseX + 40, y + 82).setDepth(91)

    scene.add
      .text(baseX + 78, y + 2, `${char.displayName}`, {
        fontSize: '19px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setDepth(91)
    scene.add
      .text(baseX + 78 + char.displayName.length * 11 + 8, y + 5, `${fac.tag} · ${fac.cnName}`, {
        fontSize: '12px',
        color: Phaser.Display.Color.IntegerToColor(fac.color).rgba,
      })
      .setDepth(91)
    scene.add
      .text(baseX + 78, y + 24, isCpu ? `CPU · ${char.cnName}` : `P${fighter.playerIndex + 1} · ${char.cnName}`, {
        fontSize: '12px',
        color: '#8a93b5',
      })
      .setDepth(91)

    // 幻觉率
    this.rateText = scene.add
      .text(baseX + 78, y + 40, '0%', { fontSize: '30px', fontStyle: 'bold', color: '#7dff8a' })
      .setDepth(91)

    // 生命
    for (let i = 0; i < fighter.stocks; i++) {
      this.stockIcons.push(scene.add.circle(baseX + 196 + i * 22, y + 50, 7, char.color).setDepth(91))
    }

    // 算力条
    scene.add.rectangle(baseX + 78, y + 78, 176, 9, 0x2b3150).setOrigin(0, 0.5).setDepth(91)
    this.energyBar = scene.add.rectangle(baseX + 78, y + 78, 0, 9, 0x4de8ff).setOrigin(0, 0.5).setDepth(92)
    this.ultGlow = scene.add
      .rectangle(baseX + 78, y + 78, 176, 9, 0xffee55, 0)
      .setOrigin(0, 0.5)
      .setDepth(93)
    scene.add.text(baseX + 258, y + 71, '算力', { fontSize: '11px', color: '#6a7395' }).setDepth(92)

    // 角色专属资源条
    this.buildResource(scene, baseX, y, fighter)

    // 中国阵营版本号
    if (char.faction === 'cn') {
      scene.add.text(baseX + 232, y + 88, 'ver', { fontSize: '10px', color: '#6a7395' }).setDepth(92)
      for (let i = 0; i < FACTION_PASSIVE.cn.versionMaxStacks; i++) {
        this.versionPips.push(
          scene.add.rectangle(baseX + 256 + i * 12, y + 93, 9, 9, fac.color, 0.18).setDepth(92),
        )
      }
    }

    // 技能冷却
    SKILL_SLOTS.forEach((s, i) => {
      const sx = baseX + 22 + i * 34
      const sy = y + 120
      scene.add.rectangle(sx, sy, 29, 29, 0x1b2038).setDepth(91).setStrokeStyle(1, 0x3a4466)
      scene.add
        .text(sx, sy - 5, isCpu ? '·' : fighter.playerIndex === 0 ? s.k1 : s.k2, {
          fontSize: '12px',
          color: '#aab3d5',
        })
        .setOrigin(0.5)
        .setDepth(92)
      scene.add
        .text(sx, sy + 8, fighter.data2.moves[s.kind].cnName.slice(0, 2), {
          fontSize: '9px',
          color: '#6a7395',
        })
        .setOrigin(0.5)
        .setDepth(92)
      const overlay = scene.add.rectangle(sx, sy + 15, 29, 29, 0x000000, 0.78).setOrigin(0.5, 1).setDepth(93)
      overlay.setScale(1, 0)
      this.cdOverlays.push(overlay)
    })
  }

  private buildResource(scene: Phaser.Scene, baseX: number, y: number, f: Fighter) {
    const res = f.data2.resource
    if (res === 'none') return
    const label = res === 'heat' ? '热量' : res === 'think' ? '思考' : '形态'
    this.resLabel = scene.add
      .text(baseX + 78, y + 88, label, { fontSize: '11px', color: '#8a93b5' })
      .setDepth(92)

    if (res === 'heat') {
      scene.add.rectangle(baseX + 108, y + 93, 116, 8, 0x2b3150).setOrigin(0, 0.5).setDepth(91)
      this.resBar = scene.add.rectangle(baseX + 108, y + 93, 0, 8, 0x1d9bf0).setOrigin(0, 0.5).setDepth(92)
    } else if (res === 'think') {
      for (let i = 0; i < THINK_MAX; i++) {
        this.resPips.push(scene.add.rectangle(baseX + 112 + i * 16, y + 93, 12, 12, 0xc9d4ff, 0.16).setDepth(92))
      }
    } else if (res === 'stance') {
      for (let i = 0; i < STANCES.length; i++) {
        this.resPips.push(
          scene.add.rectangle(baseX + 112 + i * 26, y + 93, 22, 12, STANCES[i].color, 0.2).setDepth(92),
        )
        scene.add
          .text(baseX + 112 + i * 26, y + 93, STANCES[i].name[0], { fontSize: '10px', color: '#0a0c18' })
          .setOrigin(0.5)
          .setDepth(93)
      }
    }
  }

  update() {
    const f = this.fighter
    const now = f.scene.time.now
    const rate = Math.round(f.rate)
    this.rateText.setText(`${rate}%`)
    const t = Math.min(rate / 150, 1)
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      new Phaser.Display.Color(125, 255, 138),
      new Phaser.Display.Color(255, 60, 60),
      100,
      t * 100,
    )
    this.rateText.setColor(Phaser.Display.Color.RGBToString(c.r, c.g, c.b))

    this.stockIcons.forEach((icon, i) => icon.setAlpha(i < f.stocks ? 1 : 0.15))

    const ratio = f.energy / MAX_ENERGY
    this.energyBar.width = 176 * ratio
    this.ultGlow.setFillStyle(0xffee55, ratio >= 1 ? 0.45 + 0.3 * Math.sin(now / 120) : 0)

    // 专属资源
    const res = f.data2.resource
    if (res === 'heat' && this.resBar) {
      const h = f.heat / HEAT_MAX
      this.resBar.width = 116 * h
      const hc = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(29, 155, 240),
        new Phaser.Display.Color(255, 77, 28),
        100,
        h * 100,
      )
      this.resBar.setFillStyle(Phaser.Display.Color.GetColor(hc.r, hc.g, hc.b))
      if (f.meltdown && this.resLabel) {
        this.resLabel.setText('熔毁').setColor(Math.sin(now / 100) > 0 ? '#ff4d1c' : '#ffffff')
      } else if (this.resLabel) {
        this.resLabel.setText('热量').setColor('#8a93b5')
      }
    } else if (res === 'think') {
      this.resPips.forEach((p, i) => p.setAlpha(i < f.thinkStacks ? 1 : 0.16))
    } else if (res === 'stance') {
      this.resPips.forEach((p, i) => p.setAlpha(i === f.stanceIndex ? 1 : 0.2))
      if (this.resLabel) this.resLabel.setText(STANCES[f.stanceIndex].cnName)
    }

    this.versionPips.forEach((p, i) => p.setAlpha(i < f.versionStacks ? 1 : 0.18))

    SKILL_SLOTS.forEach((s, i) => {
      const remaining = f.cooldownRemaining(s.kind)
      const total = f.data2.moves[s.kind].cooldownMs
      const frac = total > 0 ? Math.min(remaining / total, 1) : 0
      this.cdOverlays[i].setScale(1, frac)
    })
  }
}

export class HUD {
  private panels: PlayerPanel[] = []

  constructor(scene: Phaser.Scene, p1: Fighter, p2: Fighter, p2IsCpu: boolean) {
    this.panels.push(new PlayerPanel(scene, p1, 'left', false))
    this.panels.push(new PlayerPanel(scene, p2, 'right', p2IsCpu))
  }

  update() {
    this.panels.forEach((p) => p.update())
  }
}
