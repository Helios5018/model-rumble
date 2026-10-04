import { character } from "./roster.ts";
import type { FighterId } from "./roster.ts";

export const PLAYER_COLORS = ["#67e8f9", "#ff799c"] as const;
const ALTERNATES: Record<FighterId, string> = {
  deepseek: "#ff799c", claude: "#66cfed", gpt: "#ff96ca",
  gemini: "#ffbd63", qwen: "#67dec7", grok: "#db93ff",
  doubao: "#91b8ff", glm: "#b198ff", kimi: "#ffb86c",
};
export function fighterAppearance(ids: readonly FighterId[], index: number) {
  const base = character(ids[index]);
  return index === 1 && ids[0] === ids[1]
    ? { ...base, color: ALTERNATES[base.id], accent: "#fff0f8" }
    : base;
}
