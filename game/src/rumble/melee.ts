import * as T from "three";
import type { FighterId } from "./roster";

// The same attack timing drives both pose and trail; no delayed cosmetic hit.
export const MELEE_STYLES: Record<FighterId, { light: string; heavy: string }> = {
  deepseek: { light: "水刃拍击", heavy: "鲸尾横扫" },
  claude: { light: "短脚戳击", heavy: "方块盖章" },
  gpt: { light: "工具直拳", heavy: "终端重锤" },
  gemini: { light: "双子猫爪", heavy: "旋身星爪" },
  qwen: { light: "熊掌推击", heavy: "双掌拍落" },
  grok: { light: "火箭拳", heavy: "引擎冲拳" },
  doubao: { light: "气泡拍击", heavy: "气泡大摆拳" },
  glm: { light: "牛蹄顶击", heavy: "牛角重顶" },
  kimi: { light: "月牙爪", heavy: "月轮回旋" },
};

export function createMelee(root: T.Group, body: T.Group, limbs: T.Object3D[], id: FighterId, color: string) {
  const effect = new T.Group();
  effect.name = `melee-${id}`;
  effect.visible = false;
  root.add(effect);
  const ink = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide });
  const white = new T.MeshBasicMaterial({ color: "#fff6df", transparent: true, opacity: 0.9, depthWrite: false });
  const pieces: T.Mesh[] = [];
  const add = (geo: T.BufferGeometry, x: number, y: number, scale: number[], mat = ink) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, 0.7);
    m.scale.set(scale[0], scale[1], scale[2]);
    effect.add(m); pieces.push(m);
    return m;
  };
  const arc = (r: number, start: number, sweep: number, y = 1) =>
    add(new T.RingGeometry(r - 0.09, r, 28, 1, start, sweep), 0.35, y, [1, 1, 1]);
  switch (id) {
    case "deepseek":
      arc(1.15, -0.75, 1.6); arc(0.95, -0.65, 1.4);
      for (let i = 0; i < 3; i++) add(new T.SphereGeometry(0.13, 10, 8), 1.25 + i * 0.15, 0.6 + i * 0.25, [1.5, 0.6, 0.6]);
      break;
    case "claude":
      add(new T.BoxGeometry(0.7, 0.65, 0.3), 1.25, 0.85, [1, 1, 1]);
      add(new T.BoxGeometry(0.38, 0.08, 0.08), 1.28, 0.85, [1, 1, 1], white);
      break;
    case "gpt":
      add(new T.BoxGeometry(0.7, 0.48, 0.3), 1.2, 1.15, [1, 1, 1]);
      for (let i = 0; i < 3; i++) add(new T.BoxGeometry(0.48, 0.045, 0.06), 0.6 - i * 0.16, 0.9 + i * 0.2, [1, 1, 1], white);
      break;
    case "gemini":
      for (let i = 0; i < 3; i++) arc(0.86 + i * 0.17, -0.65, 1.2, 0.9 + i * 0.1);
      break;
    case "qwen":
      add(new T.SphereGeometry(0.32, 12, 10), 1.17, 1.05, [1, 0.85, 0.4]);
      for (let i = 0; i < 3; i++) add(new T.SphereGeometry(0.13, 10, 8), 1.18 + (i - 1) * 0.22, 1.39, [1, 1, 0.5], white);
      break;
    case "grok":
      add(new T.ConeGeometry(0.25, 0.85, 12), 0.9, 1.1, [1, 1, 1]).rotation.z = -Math.PI / 2;
      add(new T.SphereGeometry(0.3, 12, 10), 1.35, 1.1, [1, 0.85, 0.65], white);
      break;
    case "doubao":
      for (let i = 0; i < 4; i++) add(new T.TorusGeometry(0.18 + i * 0.035, 0.045, 8, 20), 0.7 + i * 0.23, 0.8 + Math.sin(i) * 0.35, [1, 1, 1]);
      break;
    case "glm":
      for (const y of [0.8, 1.3]) add(new T.ConeGeometry(0.16, 0.85, 4), 1.05, y, [1, 1, 1]).rotation.z = -Math.PI / 2;
      add(new T.BoxGeometry(0.32, 0.28, 0.25), 1.2, 0.5, [1, 1, 1]);
      break;
    case "kimi":
      arc(1.15, -0.9, 2); arc(0.85, -0.7, 1.5);
      add(new T.OctahedronGeometry(0.2), 1.5, 1.35, [1, 1, 0.3], white);
      break;
  }
  const heavyRing = add(new T.RingGeometry(0.65, 0.76, 32), 1.2, 1, [1, 1, 1], white);
  const rests = limbs.map((l) => ({ position: l.position.clone(), rotation: l.rotation.clone() }));
  return (remaining: number, heavy: boolean, facing: number) => {
    effect.visible = remaining > 0;
    if (!effect.visible) return;
    const progress = T.MathUtils.clamp(1 - remaining / (heavy ? 0.42 : 0.25), 0, 1);
    const strike = Math.pow(1 - progress, 0.65);
    const strength = heavy ? 1.6 : 1;
    effect.scale.set(facing * strength, strength, 1);
    effect.position.y = heavy ? -0.3 : 0;
    effect.rotation.z = facing * (progress - 0.2) * (id === "kimi" || id === "gemini" ? 1.5 : 0.25);
    ink.opacity = 0.9 * (1 - progress);
    white.opacity = 0.95 * (1 - progress);
    heavyRing.visible = heavy;
    heavyRing.scale.setScalar(0.55 + progress * 1.1);
    body.position.x += facing * strike * (heavy ? 0.32 : 0.14);
    const lean = { deepseek: 0.35, claude: 0.22, gpt: 0.16, gemini: 0.48, qwen: 0.3, grok: 0.4, doubao: 0.28, glm: 0.5, kimi: 0.42 }[id];
    body.rotation.z -= facing * strike * lean * strength;
    if (id === "claude" || id === "qwen") {
      body.scale.y *= 1 - strike * (heavy ? 0.22 : 0.08);
      body.scale.x *= 1 + strike * 0.15;
    }
    if (id === "gemini" || id === "kimi") body.rotation.y += facing * strike * (heavy ? 1.25 : 0.22);
    if (id === "glm") body.position.y -= strike * (heavy ? 0.25 : 0.06);
    // Extend the front limbs from their rest positions; each frame resets them.
    limbs.forEach((l, i) => {
      if (i < 2 && !["claude", "glm"].includes(id)) return;
      const front = Math.sign(rests[i].position.x) === facing;
      if (!front && !(heavy && id === "qwen")) return;
      l.position.x += facing * strike * strength * 0.36;
      l.position.y += strike * (heavy ? 0.2 : 0.08);
      l.rotation.z -= facing * strike * strength * 0.75;
    });
  };
}
