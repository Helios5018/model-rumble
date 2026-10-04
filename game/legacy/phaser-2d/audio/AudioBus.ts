import Phaser from 'phaser'

const SFX_KEYS = [
  'hit_light',
  'hit_heavy',
  'swing',
  'jump',
  'shield',
  'dodge',
  'ko',
  'ultimate',
  'respawn',
  'menu_move',
  'menu_confirm',
  'counter',
  'victory',
] as const

const BGM_KEYS = ['bgm_battle', 'bgm_menu'] as const

export type SfxKey = (typeof SFX_KEYS)[number]
export type BgmKey = (typeof BGM_KEYS)[number]

const SFX_VOLUME: Partial<Record<SfxKey, number>> = {
  hit_light: 0.5,
  hit_heavy: 0.65,
  swing: 0.3,
  jump: 0.25,
  menu_move: 0.4,
  menu_confirm: 0.5,
  ko: 0.7,
  ultimate: 0.7,
  victory: 0.6,
}

/** 全局音频：SFX 即用即放，BGM 跨场景单例 */
export const AudioBus = {
  queueLoads(scene: Phaser.Scene) {
    for (const key of [...SFX_KEYS, ...BGM_KEYS]) {
      scene.load.audio(key, `assets/audio/${key}.mp3`)
    }
  },

  sfx(scene: Phaser.Scene, key: SfxKey, volume?: number) {
    if (!scene.cache.audio.exists(key)) return
    // 音频未解锁时直接丢弃，避免堆积待播 sound 对象
    if (scene.sound.locked) return
    scene.sound.play(key, { volume: volume ?? SFX_VOLUME[key] ?? 0.5 })
  },

  bgm(scene: Phaser.Scene, key: BgmKey) {
    if (!scene.cache.audio.exists(key)) return
    const game = scene.game
    if (scene.sound.locked) {
      // 解锁后再启动（只挂一次监听，播放最后请求的曲目）
      game.registry.set('bgm_pending', key)
      if (!game.registry.get('bgm_unlock_hooked')) {
        game.registry.set('bgm_unlock_hooked', true)
        scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
          game.registry.set('bgm_unlock_hooked', false)
          const pending = game.registry.get('bgm_pending') as BgmKey | undefined
          const active = game.scene.getScenes(true)[0]
          if (pending && active) this.bgm(active, pending)
        })
      }
      return
    }
    const current = game.registry.get('bgm_key') as string | undefined
    if (current === key) {
      const playing = game.registry.get('bgm_sound') as Phaser.Sound.BaseSound | undefined
      if (playing && playing.isPlaying) return
    }
    this.stopBgm(scene)
    const sound = scene.sound.add(key, { loop: true, volume: 0.32 })
    sound.play()
    game.registry.set('bgm_key', key)
    game.registry.set('bgm_sound', sound)
  },

  stopBgm(scene: Phaser.Scene) {
    const playing = scene.game.registry.get('bgm_sound') as Phaser.Sound.BaseSound | undefined
    if (playing) {
      playing.stop()
      playing.destroy()
    }
    scene.game.registry.set('bgm_sound', undefined)
    scene.game.registry.set('bgm_key', undefined)
  },
}
