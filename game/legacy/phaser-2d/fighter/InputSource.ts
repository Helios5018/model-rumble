import Phaser from 'phaser'

export type FighterInput = {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  jumpPressed: boolean
  lightPressed: boolean
  heavyPressed: boolean
  special1Pressed: boolean
  special2Pressed: boolean
  ultimatePressed: boolean
  shieldHeld: boolean
  shieldPressed: boolean
}

export interface InputSource {
  poll(): FighterInput
}

type KeyMap = {
  left: string
  right: string
  up: string
  down: string
  light: string
  heavy: string
  special1: string
  special2: string
  ultimate: string
  shield: string
}

export const P1_KEYS: KeyMap = {
  left: 'A',
  right: 'D',
  up: 'W',
  down: 'S',
  light: 'J',
  heavy: 'K',
  special1: 'L',
  special2: 'U',
  ultimate: 'I',
  shield: 'SHIFT',
}

export const P2_KEYS: KeyMap = {
  left: 'LEFT',
  right: 'RIGHT',
  up: 'UP',
  down: 'DOWN',
  light: 'NUMPAD_ONE',
  heavy: 'NUMPAD_TWO',
  special1: 'NUMPAD_THREE',
  special2: 'NUMPAD_FOUR',
  ultimate: 'NUMPAD_FIVE',
  shield: 'NUMPAD_ZERO',
}

// P2 无小键盘的备用键位
export const P2_KEYS_ALT: KeyMap = {
  left: 'LEFT',
  right: 'RIGHT',
  up: 'UP',
  down: 'DOWN',
  light: 'COMMA',
  heavy: 'PERIOD',
  special1: 'FORWARD_SLASH',
  special2: 'M',
  ultimate: 'N',
  shield: 'B',
}

export class KeyboardSource implements InputSource {
  private keys: Record<keyof KeyMap, Phaser.Input.Keyboard.Key>
  private altKeys: Record<keyof KeyMap, Phaser.Input.Keyboard.Key> | null = null

  constructor(scene: Phaser.Scene, map: KeyMap, altMap?: KeyMap) {
    const kb = scene.input.keyboard!
    const bind = (m: KeyMap) =>
      Object.fromEntries(
        (Object.keys(m) as (keyof KeyMap)[]).map((k) => [
          k,
          kb.addKey(Phaser.Input.Keyboard.KeyCodes[m[k] as keyof typeof Phaser.Input.Keyboard.KeyCodes], false),
        ]),
      ) as Record<keyof KeyMap, Phaser.Input.Keyboard.Key>
    this.keys = bind(map)
    if (altMap) this.altKeys = bind(altMap)
  }

  private down(k: keyof KeyMap): boolean {
    return this.keys[k].isDown || (this.altKeys ? this.altKeys[k].isDown : false)
  }

  private justDown(k: keyof KeyMap): boolean {
    const a = Phaser.Input.Keyboard.JustDown(this.keys[k])
    const b = this.altKeys ? Phaser.Input.Keyboard.JustDown(this.altKeys[k]) : false
    return a || b
  }

  poll(): FighterInput {
    return {
      left: this.down('left'),
      right: this.down('right'),
      up: this.down('up'),
      down: this.down('down'),
      jumpPressed: this.justDown('up'),
      lightPressed: this.justDown('light'),
      heavyPressed: this.justDown('heavy'),
      special1Pressed: this.justDown('special1'),
      special2Pressed: this.justDown('special2'),
      ultimatePressed: this.justDown('ultimate'),
      shieldHeld: this.down('shield'),
      shieldPressed: this.justDown('shield'),
    }
  }
}

export const EMPTY_INPUT: FighterInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpPressed: false,
  lightPressed: false,
  heavyPressed: false,
  special1Pressed: false,
  special2Pressed: false,
  ultimatePressed: false,
  shieldHeld: false,
  shieldPressed: false,
}
