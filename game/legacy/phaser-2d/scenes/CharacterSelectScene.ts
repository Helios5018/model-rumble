import Phaser from 'phaser'
import { CHARACTERS, CHARACTER_IDS } from '../data/characters'
import { FACTIONS } from '../data/factions'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { AudioBus } from '../audio/AudioBus'
import { makePortrait } from '../visual/FighterArt'

export type MatchSetup = {
  p1CharId: string
  p2CharId: string
  p2IsCpu: boolean
}

type Step = 'mode' | 'p1' | 'p2'

const CARD_W = 236
const CARD_H = 182
/** 每个阵营 2 列 × 2 行，左右各一块 */
const FACTION_CX = { us: 322, cn: 958 }
const COL_DX = 124
const ROW_Y = [340, 528]

export class CharacterSelectScene extends Phaser.Scene {
  private step: Step = 'mode'
  private modeIndex = 0
  private p1Index = 0
  private p2Index = 4
  private p1CharId = ''
  private cards: Phaser.GameObjects.Container[] = []
  private modeButtons: Phaser.GameObjects.Container[] = []
  private factionHeaders: Phaser.GameObjects.Container[] = []
  private hintText!: Phaser.GameObjects.Text
  private stepText!: Phaser.GameObjects.Text
  private detailText!: Phaser.GameObjects.Text
  private loreText!: Phaser.GameObjects.Text
  private lastStepAt = 0

  constructor() {
    super('Select')
  }

  create() {
    this.step = 'mode'
    this.cards = []
    this.modeButtons = []
    this.factionHeaders = []
    this.p1Index = 0
    this.p2Index = 4

    this.buildBackground()
    this.buildTitle()

    this.stepText = this.add
      .text(GAME_WIDTH / 2, 180, '', { fontSize: '22px', color: '#ffd866', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 6)

    this.buildModeButtons()
    this.buildFactionHeaders()
    this.buildCards()

    this.detailText = this.add
      .text(GAME_WIDTH / 2, 648, '', { fontSize: '15px', color: '#e6ecff', align: 'center' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 5)
      .setVisible(false)
    this.loreText = this.add
      .text(GAME_WIDTH / 2, 672, '', { fontSize: '12px', color: '#7f89ad', align: 'center' })
      .setOrigin(0.5)
      .setVisible(false)

    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 22, '', { fontSize: '15px', color: '#aab3d5', align: 'center' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 4)

    const kb = this.input.keyboard!
    kb.on('keydown-W', () => this.nav(-1, 'row', 1))
    kb.on('keydown-S', () => this.nav(1, 'row', 1))
    kb.on('keydown-A', () => this.nav(-1, 'col', 1))
    kb.on('keydown-D', () => this.nav(1, 'col', 1))
    kb.on('keydown-UP', () => this.nav(-1, this.step === 'mode' ? 'mode' : 'row', 2))
    kb.on('keydown-DOWN', () => this.nav(1, this.step === 'mode' ? 'mode' : 'row', 2))
    kb.on('keydown-LEFT', () => this.nav(-1, 'col', 2))
    kb.on('keydown-RIGHT', () => this.nav(1, 'col', 2))
    kb.on('keydown-J', () => this.confirm(1))
    kb.on('keydown-ENTER', () => this.confirm(this.step === 'p2' ? 2 : 1))
    kb.on('keydown-NUMPAD_ONE', () => this.confirm(2))
    kb.on('keydown-COMMA', () => this.confirm(2))

    AudioBus.bgm(this, 'bgm_menu')
    this.input.keyboard!.once('keydown', () => AudioBus.bgm(this, 'bgm_menu'))
    this.input.once('pointerdown', () => AudioBus.bgm(this, 'bgm_menu'))

    this.refreshUI()
  }

  private buildBackground() {
    if (this.textures.exists('menu_bg')) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu_bg')
      bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height))
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x080a16, 0.62)
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x101427)
    }
    // 左右阵营底色
    this.add.rectangle(GAME_WIDTH * 0.25, 440, GAME_WIDTH / 2, 540, FACTIONS.us.color, 0.07)
    this.add.rectangle(GAME_WIDTH * 0.75, 440, GAME_WIDTH / 2, 540, FACTIONS.cn.color, 0.07)
    this.add.rectangle(GAME_WIDTH / 2, 440, 3, 540, 0xffffff, 0.12)
  }

  private buildTitle() {
    if (this.textures.exists('logo')) {
      const logo = this.add.image(GAME_WIDTH / 2, 88, 'logo')
      logo.setScale(Math.min(400 / logo.width, 130 / logo.height))
      this.tweens.add({
        targets: logo,
        scale: logo.scale * 1.03,
        yoyo: true,
        repeat: -1,
        duration: 1600,
        ease: 'Sine.easeInOut',
      })
    } else {
      this.add
        .text(GAME_WIDTH / 2, 74, 'MODEL RUMBLE', {
          fontSize: '52px',
          fontStyle: 'bold',
          color: '#ffffff',
          fontFamily: 'Arial Black, sans-serif',
        })
        .setOrigin(0.5)
    }
    this.add
      .text(GAME_WIDTH / 2, 158, '大模型格斗场 · 闭源联盟 ⚔ 开源联盟 · 2026', {
        fontSize: '16px',
        color: '#c3cbea',
      })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 6)
  }

  private buildFactionHeaders() {
    ;(['us', 'cn'] as const).forEach((fid) => {
      const fac = FACTIONS[fid]
      const cx = FACTION_CX[fid]
      const c = this.add.container(cx, 218)
      const bg = this.add.rectangle(0, 0, 520, 46, fac.color, 0.16).setStrokeStyle(2, fac.color, 0.75)
      const name = this.add
        .text(0, -9, `${fac.tag} · ${fac.name} · ${fac.cnName}`, {
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5)
      const passive = this.add
        .text(0, 11, fac.passiveDesc, { fontSize: '11px', color: '#c6cee9' })
        .setOrigin(0.5)
      c.add([bg, name, passive])
      c.setVisible(false)
      this.factionHeaders.push(c)
    })
  }

  private buildModeButtons() {
    const modes = ['单人 VS CPU', '双人同屏对战']
    modes.forEach((label, i) => {
      const y = 372 + i * 92
      const btn = this.add.container(GAME_WIDTH / 2, y)
      const bg = this.add.rectangle(0, 0, 340, 64, 0x141a33, 0.9).setStrokeStyle(2, 0x3a4466)
      bg.setName('bg')
      const txt = this.add.text(0, 0, label, { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      txt.setName('label')
      btn.add([bg, txt])
      bg.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.modeIndex = i
          this.confirmMode()
        })
        .on('pointerover', () => {
          if (this.modeIndex !== i) {
            this.modeIndex = i
            AudioBus.sfx(this, 'menu_move')
            this.refreshUI()
          }
        })
      this.modeButtons.push(btn)
    })
  }

  private buildCards() {
    CHARACTER_IDS.forEach((id, i) => {
      const char = CHARACTERS[id]
      const fid = char.faction
      const rem = i % 4
      const row = Math.floor(rem / 2)
      const col = rem % 2
      const x = FACTION_CX[fid] + (col === 0 ? -COL_DX : COL_DX)
      const y = ROW_Y[row]

      const card = this.add.container(x, y)
      const fac = FACTIONS[fid]
      const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x0c1122, 0.94).setStrokeStyle(3, 0x39415f)
      bg.setName('bg')
      card.add(bg)

      // 阵营角标
      card.add(this.add.rectangle(-CARD_W / 2 + 3, -CARD_H / 2 + 3, 6, CARD_H - 6, fac.color, 0.9).setOrigin(0, 0))

      const portrait = makePortrait(this, char, 102)
      portrait.setPosition(0, 14)
      card.add(portrait)

      card.add(
        this.add
          .text(0, 30, char.displayName, { fontSize: '21px', color: '#ffffff', fontStyle: 'bold' })
          .setOrigin(0.5)
          .setShadow(0, 2, '#000000', 4),
      )
      card.add(
        this.add
          .text(0, 52, char.cnName, { fontSize: '13px', color: '#c8d0ec' })
          .setOrigin(0.5)
          .setShadow(0, 1, '#000000', 3),
      )
      const sig = this.add
        .text(0, 66, char.signature, { fontSize: '11px', color: Phaser.Display.Color.IntegerToColor(char.accentColor).rgba })
        .setOrigin(0.5)
      card.add(sig)
      card.add(
        this.add
          .text(0, 80, `速${char.stats.speed} 攻${char.stats.attack} 重${char.stats.weight} 稳${char.stats.stability}`, {
            fontSize: '11px',
            color: '#6a7395',
          })
          .setOrigin(0.5),
      )

      bg.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.step === 'p1') {
            this.p1Index = i
            this.confirmPick(1)
          } else if (this.step === 'p2') {
            this.p2Index = i
            this.confirmPick(2)
          }
        })
        .on('pointerover', () => {
          if (this.step === 'p1' && this.p1Index !== i) {
            this.p1Index = i
            AudioBus.sfx(this, 'menu_move')
            this.refreshUI()
          } else if (this.step === 'p2' && this.p2Index !== i) {
            this.p2Index = i
            AudioBus.sfx(this, 'menu_move')
            this.refreshUI()
          }
        })
      card.setVisible(false)
      this.cards.push(card)
    })
  }

  /** 索引 ↔ (全局列 0~3, 行 0~1) */
  private idxToGrid(i: number) {
    const f = Math.floor(i / 4)
    const rem = i % 4
    return { gcol: f * 2 + (rem % 2), row: Math.floor(rem / 2) }
  }

  private gridToIdx(gcol: number, row: number) {
    const g = (gcol + 4) % 4
    return Math.floor(g / 2) * 4 + row * 2 + (g % 2)
  }

  private nav(dir: number, axis: 'col' | 'row' | 'mode', player: number) {
    if (this.step === 'mode') {
      if (axis === 'mode' || axis === 'row') {
        this.modeIndex = (this.modeIndex + dir + 2) % 2
        AudioBus.sfx(this, 'menu_move')
        this.refreshUI()
      }
      return
    }
    const isP1 = this.step === 'p1'
    if (isP1 && player !== 1) return
    if (!isP1 && player !== 2 && this.modeIndex === 1) return

    const cur = isP1 ? this.p1Index : this.p2Index
    const { gcol, row } = this.idxToGrid(cur)
    const next =
      axis === 'col' ? this.gridToIdx(gcol + dir, row) : this.gridToIdx(gcol, (row + dir + 2) % 2)
    if (isP1) this.p1Index = next
    else this.p2Index = next
    AudioBus.sfx(this, 'menu_move')
    this.refreshUI()
  }

  private confirm(player: number) {
    const now = this.time.now
    if (now - this.lastStepAt < 250) return
    this.lastStepAt = now
    if (this.step === 'mode') this.confirmMode()
    else if (this.step === 'p1' && player === 1) this.confirmPick(1)
    else if (this.step === 'p2' && (this.modeIndex === 0 || player === 2)) this.confirmPick(2)
  }

  private confirmMode() {
    this.lastStepAt = this.time.now
    AudioBus.sfx(this, 'menu_confirm')
    this.step = 'p1'
    this.modeButtons.forEach((b) => b.setVisible(false))
    this.cards.forEach((c) => c.setVisible(true))
    this.factionHeaders.forEach((h) => h.setVisible(true))
    this.detailText.setVisible(true)
    this.loreText.setVisible(true)
    this.refreshUI()
  }

  private confirmPick(player: number) {
    this.lastStepAt = this.time.now
    AudioBus.sfx(this, 'menu_confirm')
    if (player === 1) {
      this.p1CharId = CHARACTER_IDS[this.p1Index]
      if (this.modeIndex === 0) {
        this.p2Index = Phaser.Math.Between(0, CHARACTER_IDS.length - 1)
        this.startMatch()
      } else {
        this.step = 'p2'
        this.refreshUI()
      }
    } else {
      this.startMatch()
    }
  }

  private startMatch() {
    const setup: MatchSetup = {
      p1CharId: this.p1CharId,
      p2CharId: CHARACTER_IDS[this.p2Index],
      p2IsCpu: this.modeIndex === 0,
    }
    this.cameras.main.fadeOut(280, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Arena', setup))
  }

  private refreshUI() {
    if (this.step === 'mode') {
      this.stepText.setText('选 择 模 式')
      this.hintText.setText('W/S 或 ↑/↓ 选择 · J / Enter 确认 · 也可以鼠标点击')
      this.modeButtons.forEach((btn, i) => {
        const bg = btn.getByName('bg') as Phaser.GameObjects.Rectangle
        const label = btn.getByName('label') as Phaser.GameObjects.Text
        const active = i === this.modeIndex
        bg.setStrokeStyle(active ? 3 : 2, active ? 0xffd866 : 0x3a4466)
        bg.setFillStyle(active ? 0x1e2749 : 0x141a33, 0.9)
        label.setColor(active ? '#ffd866' : '#ffffff')
        btn.setScale(active ? 1.06 : 1)
      })
      return
    }

    const isP1 = this.step === 'p1'
    this.stepText.setText(isP1 ? 'P1 选择角色' : 'P2 选择角色')
    this.hintText.setText(
      isP1
        ? 'P1：A/D 换列 · W/S 换行 · J 确认 · 左半屏是闭源联盟，右半屏是开源联盟'
        : 'P2：方向键选择 · 小键盘1 或 , 确认',
    )
    const activeIndex = isP1 ? this.p1Index : this.p2Index
    const color = isP1 ? 0xffa757 : 0x4de8ff
    this.cards.forEach((c, i) => {
      const bg = c.getByName('bg') as Phaser.GameObjects.Rectangle
      const active = i === activeIndex
      const takenByP1 = !isP1 && CHARACTER_IDS[i] === this.p1CharId
      bg.setStrokeStyle(active ? 4 : 3, active ? color : takenByP1 ? 0xffa757 : 0x39415f)
      bg.setFillStyle(active ? 0x18203f : 0x0c1122, 0.94)
      c.setScale(active ? 1.06 : 1)
      c.setDepth(active ? 10 : 1)
    })

    const char = CHARACTERS[CHARACTER_IDS[activeIndex]]
    this.detailText.setText(`【${char.signature}】${char.desc}`)
    this.loreText.setText(`现实依据：${char.lore}`)
  }
}
