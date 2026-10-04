import Phaser from 'phaser'
import { CHARACTERS } from '../data/characters'
import { FACTIONS } from '../data/factions'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { AudioBus } from '../audio/AudioBus'
import { makePortrait } from '../visual/FighterArt'
import type { MatchSetup } from './CharacterSelectScene'

type ResultData = {
  winnerCharId: string
  winnerPlayer: number
  loserCharId: string
  p2IsCpu: boolean
  setup: MatchSetup
}

export class ResultScene extends Phaser.Scene {
  private result!: ResultData

  constructor() {
    super('Result')
  }

  init(data: ResultData) {
    this.result = data
  }

  create() {
    const winner = CHARACTERS[this.result.winnerCharId]
    const loser = CHARACTERS[this.result.loserCharId]
    const wFac = FACTIONS[winner.faction]

    if (this.textures.exists('menu_bg')) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu_bg')
      bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height))
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0c1e, 0.72)
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x10131f)
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, 200, wFac.color, 0.1)

    AudioBus.stopBgm(this)
    AudioBus.sfx(this, 'victory')
    this.time.delayedCall(2600, () => AudioBus.bgm(this, 'bgm_menu'))

    const whoLabel =
      this.result.p2IsCpu && this.result.winnerPlayer === 1 ? 'CPU' : `P${this.result.winnerPlayer + 1}`

    const title = this.add
      .text(GAME_WIDTH / 2, 132, `${winner.displayName} WINS!`, {
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#ffd866',
        fontFamily: 'Arial Black, sans-serif',
      })
      .setOrigin(0.5)
      .setShadow(0, 4, '#000000', 10)
    title.setScale(0)
    this.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.easeOut' })

    // 阵营播报
    const sameFaction = winner.faction === loser.faction
    const factionLine = sameFaction
      ? `${wFac.cnName} 内战 · ${winner.cnName} 胜出`
      : `${wFac.tag} ${wFac.cnName} 击败 ${FACTIONS[loser.faction].cnName}`
    this.add
      .text(GAME_WIDTH / 2, 194, factionLine, {
        fontSize: '24px',
        fontStyle: 'bold',
        color: Phaser.Display.Color.IntegerToColor(wFac.color).rgba,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 6)
    this.add
      .text(GAME_WIDTH / 2, 228, `${whoLabel} · ${winner.cnName} · ${winner.archetype}`, {
        fontSize: '17px',
        color: '#c3cbea',
      })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 6)
    this.add
      .text(GAME_WIDTH / 2, 254, wFac.slogan, { fontSize: '14px', color: '#8a93b5' })
      .setOrigin(0.5)

    // 胜者立绘（动态）
    const portrait = makePortrait(this, winner, 230, true)
    portrait.setPosition(GAME_WIDTH / 2, 520)
    const ring = this.add.circle(GAME_WIDTH / 2, 430, 140, winner.color, 0)
    ring.setStrokeStyle(4, wFac.color, 0.9)
    this.tweens.add({ targets: ring, scale: 1.12, alpha: 0.4, yoyo: true, repeat: -1, duration: 900 })

    const rematch = this.add
      .text(GAME_WIDTH / 2 - 130, 600, '[ R ] 再来一局', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 6)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.restart())
    this.add
      .text(GAME_WIDTH / 2 + 130, 600, '[ ESC ] 返回选人', { fontSize: '20px', color: '#aab3d5' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 6)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.backToSelect())

    this.tweens.add({ targets: rematch, alpha: 0.55, yoyo: true, repeat: -1, duration: 650 })

    this.input.keyboard!.on('keydown-R', () => this.restart())
    this.input.keyboard!.on('keydown-ESC', () => this.backToSelect())
  }

  private restart() {
    AudioBus.sfx(this, 'menu_confirm')
    this.scene.start('Arena', this.result.setup)
  }

  private backToSelect() {
    AudioBus.sfx(this, 'menu_confirm')
    this.scene.start('Select')
  }
}
