import Phaser from 'phaser'
import { CHARACTERS } from '../data/characters'
import { AudioBus } from '../audio/AudioBus'

export type AssetManifest = {
  characters: Record<string, unknown>
  fx: Record<string, unknown>
  stage?: { background?: string; platformMain?: string; platformFloat?: string }
}

/**
 * v2 起角色与特效全部程序化绘制，这里只加载场景/菜单底图与音频。
 * 旧的 spritesheet 仍在 public/assets 里，但不再参与加载。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    this.load.json('manifest', 'assets/manifest.json')
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key === 'manifest') console.warn('未找到素材清单，使用纯程序化模式')
    })
    this.load.image('menu_bg', 'assets/ui/menu_bg.png')
    this.load.image('logo', 'assets/ui/logo.png')
    AudioBus.queueLoads(this)
  }

  create() {
    this.createPlaceholderTextures()
    const manifest = this.cache.json.get('manifest') as AssetManifest | undefined
    if (manifest?.stage) {
      this.scene.start('Preload', { manifest })
    } else {
      this.scene.start('Select')
    }
  }

  private createPlaceholderTextures() {
    // Fighter 的物理精灵需要一张贴图（不可见），另外为每个角色生成一枚弹道贴图
    for (const char of Object.values(CHARACTERS)) {
      const g = this.add.graphics()
      g.fillStyle(char.color, 1)
      g.fillRoundedRect(0, 0, 56, 92, 8)
      g.generateTexture(`placeholder_${char.id}`, 56, 92)
      g.destroy()

      const p = this.add.graphics()
      p.fillStyle(char.color, 0.95)
      p.fillEllipse(18, 12, 34, 20)
      p.fillStyle(char.accentColor, 1)
      p.fillEllipse(18, 12, 18, 9)
      p.fillStyle(0xffffff, 0.85)
      p.fillCircle(24, 12, 3)
      p.generateTexture(`proj_${char.id}`, 36, 24)
      p.destroy()
    }
    // 平台
    const p = this.add.graphics()
    p.fillStyle(0x3a4466, 1)
    p.fillRoundedRect(0, 0, 760, 40, 6)
    p.fillStyle(0x5a6988, 1)
    p.fillRect(0, 0, 760, 8)
    p.generateTexture('platform_main', 760, 40)
    p.clear()
    p.fillStyle(0x3a4466, 1)
    p.fillRoundedRect(0, 0, 220, 20, 6)
    p.fillStyle(0x5a6988, 1)
    p.fillRect(0, 0, 220, 5)
    p.generateTexture('platform_float', 220, 20)
    p.destroy()

    const proj = this.add.graphics()
    proj.fillStyle(0xffee88, 1)
    proj.fillEllipse(12, 8, 24, 16)
    proj.generateTexture('projectile_default', 24, 16)
    proj.destroy()
  }
}

/** 只加载场景底图 */
export class PreloadScene extends Phaser.Scene {
  private manifest!: AssetManifest

  constructor() {
    super('Preload')
  }

  init(data: { manifest: AssetManifest }) {
    this.manifest = data.manifest
  }

  preload() {
    const m = this.manifest
    const { width, height } = this.scale
    const bar = this.add.rectangle(width / 2, height / 2, 400, 8, 0x4d6bfe).setScale(0, 1)
    this.add
      .text(width / 2, height / 2 - 30, 'LOADING STAGE...', { fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5)
    this.load.on('progress', (v: number) => bar.setScale(v, 1))

    if (m.stage?.background) this.load.image('stage_bg', m.stage.background)
    if (m.stage?.platformMain) this.load.image('stage_platform_main', m.stage.platformMain)
    if (m.stage?.platformFloat) this.load.image('stage_platform_float', m.stage.platformFloat)
  }

  create() {
    this.scene.start('Select')
  }
}
