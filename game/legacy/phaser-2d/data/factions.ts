import type { Faction } from './types'

export type FactionData = {
  id: Faction
  name: string
  cnName: string
  tag: string
  slogan: string
  color: number
  accentColor: number
  passiveName: string
  passiveDesc: string
}

export const FACTIONS: Record<Faction, FactionData> = {
  us: {
    id: 'us',
    name: 'CLOSED ALLIANCE',
    cnName: '闭源联盟',
    tag: 'US',
    slogan: '算力即壁垒',
    color: 0x4d8dff,
    accentColor: 0xe8f1ff,
    passiveName: '算力壁垒 Compute Moat',
    passiveDesc: '算力每秒自然回充 +1.4 · 大招伤害 ×1.15 · 代价是更长的技能冷却',
  },
  cn: {
    id: 'cn',
    name: 'OPEN ALLIANCE',
    cnName: '开源联盟',
    tag: 'CN',
    slogan: '你封锁一次，我迭代十次',
    color: 0xff5a4d,
    accentColor: 0xffe0a8,
    passiveName: '开源迭代 Open Iteration',
    passiveDesc: '全技能冷却 ×0.85 · 受击算力 ×1.6 · 连续命中叠版本号 v1~v5，每层 +4% 伤害',
  },
}

/** 阵营被动的具体数值，Fighter 直接读这里 */
export const FACTION_PASSIVE = {
  us: {
    energyRegenPerSec: 1.4,
    ultimateDamageMul: 1.15,
  },
  cn: {
    cooldownMul: 0.85,
    hitEnergyMul: 1.6,
    versionDamagePerStack: 0.04,
    versionMaxStacks: 5,
    versionDecayMs: 3000,
  },
} as const
