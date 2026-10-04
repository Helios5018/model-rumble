export const DIFFICULTIES = {
  low: { label: "Low", description: "慢速反应，进攻留空隙，基础回场", reaction: 0.42, decision: 0.24, aggression: 0.5, defense: 0.12, prediction: 0, recovery: 0.8 },
  medium: { label: "Medium", description: "稳定进攻，基础格挡与技能搭配", reaction: 0.26, decision: 0.14, aggression: 0.76, defense: 0.4, prediction: 0.04, recovery: 0.4 },
  high: { label: "High", description: "预判走位，闪避弹道，择机连击", reaction: 0.16, decision: 0.085, aggression: 0.92, defense: 0.7, prediction: 0.12, recovery: 0 },
  ultra: { label: "Ultra", description: "快速反应，反击惩罚，精准控距与回场", reaction: 0.1, decision: 0.05, aggression: 0.99, defense: 0.9, prediction: 0.2, recovery: -0.3 },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;
