export type MoveKind = 'light' | 'heavy' | 'special1' | 'special2' | 'ultimate'

/** 阵营：us = 闭源联盟，cn = 开源联盟 */
export type Faction = 'us' | 'cn'

/** 角色专属资源，决定 HUD 上显示哪条附加条 */
export type ResourceKind = 'none' | 'heat' | 'think' | 'stance'

/** 程序化外观的骨架类型，一个角色一种，互不复用 */
export type SilhouetteKind =
  | 'robe' // Claude：修士长袍 + 宪法石板
  | 'prism' // GPT：棱柱躯干 + 三卫星
  | 'mech' // Grok：GPU 机甲 + 助推器
  | 'twin' // Gemini：左右半身分裂 + 棱镜头
  | 'sage' // Qwen：道袍 + 模型法环
  | 'chibi' // Doubao：Q 版豆形 + 弹幕气泡
  | 'fort' // GLM：方正官制 + 玉玺 + 蓝图
  | 'wraith' // Kimi：瘦长黑袍 + 缺月 + 星群

export type VisualSpec = {
  silhouette: SilhouetteKind
  /** 主色 */
  primary: number
  /** 副色 */
  secondary: number
  /** 高光/描边 */
  glow: number
  /** 阴影/暗部 */
  shade: number
  /** 整体缩放，用来拉开体型差 */
  scale: number
}

export type HitboxSpec = {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

/**
 * 招式机制原语。每个角色至少有一个别人没有的字段，
 * 这样八个人的核心循环在机制层面就是不同的，而不只是数值不同。
 */
export type MoveMechanic = {
  /** 起手即霸体：不被击飞，且受到的伤害按比例减免（Claude） */
  armor?: { damageReduction: number }
  /** 命中附带定身（GLM / Claude 反击） */
  stun?: { durationMs: number }
  /** 扇形散射弹：一次射出多发（Grok） */
  spread?: { count: number; angleSpreadDeg: number }
  /** 天降柱状打击，逐一延时触发（Grok） */
  skyStrike?: { count: number; intervalMs: number; spreadX: number; radius: number; damage: number }
  /** 残影：原地留影，延时后复制释放指定招式（Gemini） */
  afterimage?: { delayMs: number; copyKind: MoveKind }
  /** 减速力场（Gemini） */
  zone?: { width: number; height: number; durationMs: number; slowMul: number; offsetX: number }
  /** 召唤蒸馏分身（Qwen） */
  summon?: { count: number; lifetimeMs: number; attackIntervalMs: number; damage: number }
  /** 把对手拉向自己（Qwen） */
  pull?: { strength: number }
  /** 吸取对手算力（Qwen） */
  drain?: { energy: number }
  /** 记录对手历史轨迹并逐点引爆（Doubao） */
  trailReplay?: { samples: number; lookbackMs: number; intervalMs: number; radius: number; damage: number }
  /** 命中留下延时二段爆弹幕气泡（Doubao） */
  bubble?: { delayMs: number; damage: number; radius: number }
  /** 造一堵可破坏的实体墙（GLM） */
  wall?: { width: number; height: number; hp: number; durationMs: number; offsetX: number }
  /** 反伤（GLM） */
  thorns?: { ratio: number; durationMs: number }
  /** 瞬移到对手背后（Kimi） */
  teleportBehind?: { offset: number }
  /** 原地引导入定，持续攒思考层数（Kimi） */
  channel?: { durationMs: number; damageReduction: number; stackIntervalMs: number }
  /** 消耗全部思考层换伤害（Kimi） */
  consumeThink?: { perStackDamageMul: number }
  /** 命中后获得思考层（Kimi） */
  gainThink?: number
  /** 贴地冲击波：沿地面前进的判定（GLM） */
  groundShock?: { distance: number; speed: number; height: number }
  /** 切换形态（GPT） */
  switchStance?: boolean
  /** 立刻清空自身全部技能冷却（GPT） */
  resetCooldowns?: boolean
  /** 增加热量（Grok） */
  heat?: number
  /** 短时间攻速/移速强化（Grok / Doubao） */
  frenzy?: { durationMs: number; speedMul: number; attackSpeedMul: number }
  /** 施放瞬间直接回复算力（Doubao） */
  instantEnergy?: number
  /** 强化下一次轻击的倍率（Claude） */
  empowerLight?: number
  /** 命中后把对手横向拖拽（Doubao 一镜到底） */
  drag?: { distance: number }
}

export type MoveData = {
  id: string
  name: string
  cnName: string
  kind: MoveKind
  /** 前摇/有效/后摇，单位：帧（60fps 逻辑帧） */
  startupFrames: number
  activeFrames: number
  recoveryFrames: number
  damage: number
  baseKnockback: number
  /** 击飞角度（度），0=水平向前，负数向上 */
  knockbackAngle: number
  cooldownMs: number
  energyCost: number
  energyGain: number
  hitbox: HitboxSpec
  /** 多段攻击：每隔 N 帧重复判定一次 */
  multiHit?: { count: number; intervalFrames: number }
  /** 弹道类技能 */
  projectile?: {
    speed: number
    lifetimeMs: number
    width: number
    height: number
    fx: string
  }
  /** 位移类技能：施放时向面朝方向冲刺 */
  dash?: { velocityX: number; velocityY: number }
  /** buff 类技能 */
  buff?: {
    type: 'shield' | 'cooldown' | 'counter'
    durationMs: number
  }
  /** 角色签名机制 */
  mech?: MoveMechanic
  fxKey?: string
  /** 一句话说明，展示在选人界面 */
  desc: string
}

export type CharacterStats = {
  speed: number // 1-10 → 移动速度
  weight: number // 1-10 → 抗击飞
  stability: number // 1-10 → 硬直抗性
  attack: number // 伤害系数
  jumpPower: number
}

export type CharacterData = {
  id: string
  displayName: string
  cnName: string
  brand: string
  faction: Faction
  archetype: string
  /** 签名机制的短标签，选人界面用 */
  signature: string
  color: number
  accentColor: number
  stats: CharacterStats
  resource: ResourceKind
  visual: VisualSpec
  moves: Record<MoveKind, MoveData>
  desc: string
  /** 现实依据：这个设计来自哪条新闻 */
  lore: string
}
