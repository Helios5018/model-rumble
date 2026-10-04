export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720

export const GRAVITY = 2200

// 出界判定（上下文崩溃）
export const BLAST_LEFT = -120
export const BLAST_RIGHT = GAME_WIDTH + 120
export const BLAST_TOP = -260
export const BLAST_BOTTOM = GAME_HEIGHT + 140

export const STOCKS = 3
export const RESPAWN_INVULN_MS = 2000
export const INPUT_BUFFER_MS = 120
export const COYOTE_MS = 100

export const MAX_ENERGY = 100
export const MAX_RATE = 999

// 逻辑帧率（攻击帧数据基于 60fps）
export const LOGIC_FPS = 60
