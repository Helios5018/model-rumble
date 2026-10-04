import { fighterAppearance } from "./appearance.ts";
import { DIFFICULTIES } from "./difficulty.ts";
import type { Difficulty } from "./difficulty.ts";
import type { Character, FighterId, Skill } from "./roster.ts";
export interface Input {
  move: number;
  jump: boolean;
  drop: boolean;
  guard: boolean;
  dodge: boolean;
  attack?: Skill;
}
export const emptyInput = (): Input => ({
  move: 0,
  jump: false,
  drop: false,
  guard: false,
  dodge: false,
});
export interface Fighter {
  index: number;
  data: Character;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  damage: number;
  stocks: number;
  energy: number;
  grounded: boolean;
  jumps: number;
  stun: number;
  invincible: number;
  guard: boolean;
  shield: number;
  counter: number;
  buff: number;
  empowered: boolean;
  cooldown: Record<Skill, number>;
  attackTime: number;
  attackKind: Skill;
  combo: number;
  comboTime: number;
  stance: number;
  dodgeCooldown: number;
  dropTime: number;
}
export interface Projectile {
  id: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  radius: number;
  damage: number;
  knock: number;
  kind: string;
  hits: number[];
}
export interface Field {
  id: number;
  owner: number;
  x: number;
  y: number;
  life: number;
  tick: number;
  kind: "wall" | "summon" | "strike" | "echo";
  hp: number;
  count: number;
}
export interface GameEvent {
  type: "hit" | "cast" | "jump" | "ko" | "respawn" | "block" | "win";
  x: number;
  y: number;
  color: string;
  text?: string;
  skill?: Skill;
  power?: number;
  player?: number;
  cue?: "dodge" | "counter";
  fighter?: FighterId;
}
export const PLATFORMS = [
  { x: 0, y: 0, width: 16 },
  { x: -4.3, y: 2.6, width: 3.2 },
  { x: 4.3, y: 2.6, width: 3.2 },
];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export class Match {
  fighters: Fighter[];
  projectiles: Projectile[] = [];
  fields: Field[] = [];
  events: GameEvent[] = [];
  time = 180;
  elapsed = 0;
  countdown = 2.4;
  winner: number | null = null;
  serial = 0;
  hits = 0;
  difficulty: Difficulty;
  private cpu = [0, 1].map(() => ({ next: 0, input: emptyInput() }));
  private observations: { at: number; fighters: Fighter[]; projectiles: Projectile[] }[] = [];
  private randomState = 0x12345678;
  private random() {
    this.randomState ^= this.randomState << 13;
    this.randomState ^= this.randomState >>> 17;
    this.randomState ^= this.randomState << 5;
    return (this.randomState >>> 0) / 4294967296;
  }
  training: boolean;
  constructor(
    ids: [FighterId, FighterId],
    difficulty: Difficulty = "medium",
    training = false,
    seed = 0x12345678,
  ) {
    this.difficulty = difficulty;
    this.randomState = seed || 1;
    this.training = training;
    this.fighters = ids.map((_id, index) => ({
      index,
      data: fighterAppearance(ids, index),
      x: index ? 4 : -4,
      y: 0,
      vx: 0,
      vy: 0,
      facing: index ? -1 : 1,
      damage: 0,
      stocks: 3,
      energy: training ? 100 : 25,
      grounded: true,
      jumps: 2,
      stun: 0,
      invincible: 0,
      guard: false,
      shield: 0,
      counter: 0,
      buff: 0,
      empowered: false,
      cooldown: { light: 0, heavy: 0, special: 0, utility: 0, ultimate: 0 },
      attackTime: 0,
      attackKind: "light",
      combo: 0,
      comboTime: 0,
      stance: 0,
      dodgeCooldown: 0,
      dropTime: 0,
    }));
  }
  event(
    type: GameEvent["type"],
    f: Fighter,
    text?: string,
    skill?: Skill,
    power = 1,
    cue?: GameEvent["cue"],
  ) {
    this.events.push({
      type,
      x: f.x,
      y: f.y + 1,
      color: f.data.color,
      text,
      skill,
      power,
      player: f.index,
      fighter: f.data.id,
      cue,
    });
  }
  ai(i: number): Input {
    const a = emptyInput(), f = this.fighters[i], state = this.cpu[i];
    if ((this.training && i === 1) || this.countdown > 0 || this.winner !== null) return a;
    const p = DIFFICULTIES[this.difficulty];
    if (this.elapsed < state.next) {
      // Continuous movement/guard, but never repeat a jump, dodge or attack pulse.
      return { ...state.input, jump: false, dodge: false, attack: undefined };
    }
    state.next = this.elapsed + p.decision * (0.9 + this.random() * 0.2);
    const remember = () => { state.input = a; return a; };
    const seen = this.observations.findLast((s) => s.at <= this.elapsed - p.reaction);
    if (!seen) return remember();
    const o = seen.fighters[1 - i];
    const targetX = o.x + o.vx * p.prediction;
    const dx = targetX - f.x, d = Math.abs(dx), dy = o.y - f.y;
    const advanced = this.difficulty === "high" || this.difficulty === "ultra";
    // Self-preservation uses own position; opponent information is delayed.
    if (Math.abs(f.x) > 7.1 || f.y < -0.35) {
      a.move = -Math.sign(f.x);
      a.jump = !f.grounded && f.jumps > 0 && f.vy < 1 && f.y < p.recovery;
      return remember();
    }
    const ranged = ["deepseek", "qwen", "grok", "gpt"].includes(f.data.id);
    const spacing = advanced && ranged && f.cooldown.special < 0.4 ? 3.8 : 1.25;
    a.move = Math.sign(dx) * (d > spacing + 0.3 ? 1 : d < spacing - 0.45 ? -0.65 : 0);
    if (Math.abs(f.x) > 6.5 && Math.sign(a.move) === Math.sign(f.x)) a.move = -Math.sign(f.x);
    if (dy > 1.35 && f.jumps > 0 && (f.grounded || f.vy < 0)) a.jump = true;
    if (f.grounded && f.y > o.y + 1) a.drop = true;
    const incoming = seen.projectiles.some((b) => b.owner !== i && b.life > p.reaction &&
      (f.x - b.x) * b.vx > 0 && Math.abs(b.x + b.vx * (p.reaction + 0.15) - f.x) < 1.8 &&
      Math.abs(b.y - f.y - 1) < 1.5);
    const danger = (d < 2.7 && Math.abs(dy) < 1.8 && o.attackTime > 0.1) || incoming;
    if (danger && this.random() < p.defense) {
      if (advanced && incoming && f.dodgeCooldown <= 0 && Math.abs(f.x) < 5.8) {
        a.dodge = true;
        a.move = Math.sign(dx);
      } else {
        a.guard = f.grounded;
        a.move = 0;
      }
      if (advanced && f.data.id === "claude" && f.cooldown.utility <= 0) {
        a.guard = false;
        a.attack = "utility";
      }
      return remember();
    }
    if (f.stun > 0 || f.attackTime > 0 || this.random() > p.aggression) return remember();
    const ready = (skill: Skill) => f.cooldown[skill] <= 0;
    const aligned = Math.abs(dy) < 1.6;
    // Better levels wait out observed invulnerability and protect their resources.
    if (advanced && o.invincible > p.reaction + 0.15) return remember();
    if (f.energy >= 100 && ready("ultimate") && d < (advanced ? 4.5 : 6) && Math.abs(dy) < 2.5)
      a.attack = "ultimate";
    else if (ready("utility") && (
      (["deepseek", "doubao"].includes(f.data.id) && (f.damage > 16 || f.energy < 65)) ||
      (f.data.id === "kimi" && !f.empowered && d > 2) ||
      (f.data.id === "grok" && !f.buff && d < 5 && f.damage < 110) ||
      (f.data.id === "gpt" && f.stance !== Number(d < 2.3)) ||
      (["qwen", "gemini", "glm"].includes(f.data.id) && d < 3 && aligned) ||
      (f.data.id === "claude" && danger))) a.attack = "utility";
    else if (ready("special") && d < 7 && (aligned || ["qwen", "claude", "glm", "kimi"].includes(f.data.id)) &&
      (!advanced || f.data.id !== "claude" || (d < 3 && !f.shield))) a.attack = "special";
    else if (aligned && d < 2.35) {
      const punish = advanced && (o.stun > 0.1 || o.damage > 75 || o.guard);
      if (ready("heavy") && (punish || this.random() < 0.25)) a.attack = "heavy";
      else if (ready("light")) a.attack = "light";
    }
    if (a.attack) { a.guard = false; a.move = Math.sign(dx) * Math.abs(a.move); }
    return remember();
  }
  tick(dt: number, inputs: Input[]) {
    if (this.winner !== null) return;
    if (this.countdown > 0) {
      this.countdown = Math.max(0, this.countdown - dt);
      return;
    }
    this.observations.push({ at: this.elapsed,
      fighters: this.fighters.map((f) => ({ ...f, cooldown: { ...f.cooldown } })),
      projectiles: this.projectiles.map((b) => ({ ...b })),
    });
    while (this.observations.length && this.observations[0].at < this.elapsed - 0.6) this.observations.shift();
    this.elapsed += dt;
    if (!this.training) this.time = Math.max(0, this.time - dt);
    for (const f of this.fighters) {
      const input = inputs[f.index] ?? emptyInput();
      for (const k of Object.keys(f.cooldown) as Skill[])
        f.cooldown[k] = Math.max(0, f.cooldown[k] - dt);
      for (const k of [
        "stun",
        "invincible",
        "shield",
        "counter",
        "buff",
        "attackTime",
        "comboTime",
        "dodgeCooldown",
        "dropTime",
      ] as const)
        f[k] = Math.max(0, f[k] - dt);
      if (!f.comboTime) f.combo = 0;
      f.energy = clamp(f.energy + dt * (this.training ? 24 : 1.7), 0, 100);
      f.guard = input.guard && f.grounded && f.stun === 0 && f.attackTime === 0;
      if (f.stun === 0) {
        const speed =
          (3.8 + f.data.stats[0] * 0.22) *
          (f.buff > 0 ? 1.35 : 1) *
          (f.stance === 1 ? 0.82 : 1) *
          (f.guard ? 0.28 : 1);
        const factor = 1 - Math.exp(-dt * (f.grounded ? 22 : 8));
        f.vx += (input.move * speed - f.vx) * factor;
        if (input.move !== 0) f.facing = Math.sign(input.move);
        else if (f.attackTime <= 0)
          f.facing = Math.sign(this.fighters[1 - f.index].x - f.x) || f.facing;
        if (input.jump && f.jumps > 0 && !f.guard) {
          f.vy = f.jumps === 2 ? 9.4 : 8.7;
          f.jumps--;
          f.grounded = false;
          this.event("jump", f);
        }
        if (input.drop) {
          if (f.grounded && f.y > 1) {
            f.y -= 0.13;
            f.grounded = false;
            f.dropTime = 0.22;
          } else if (!f.grounded) f.vy -= 25 * dt;
        }
        if (input.dodge && f.dodgeCooldown <= 0) {
          f.vx = f.facing * 13;
          f.invincible = 0.25;
          f.stun = 0.16;
          f.dodgeCooldown = 1;
          this.event("cast", f, "闪避", undefined, 1, "dodge");
        }
        if (input.attack && !f.guard) this.attack(f, input.attack);
      } else f.vx *= Math.exp(-dt * 1.5);
      const oldY = f.y;
      f.x += f.vx * dt;
      f.vy -= 22 * dt;
      f.y += f.vy * dt;
      f.grounded = false;
      for (const p of PLATFORMS) {
        if (
          f.dropTime <= 0 &&
          f.vy <= 0 &&
          oldY >= p.y - 0.025 &&
          f.y <= p.y &&
          Math.abs(f.x - p.x) < p.width / 2 + 0.1
        ) {
          f.y = p.y;
          f.vy = 0;
          f.grounded = true;
          f.jumps = 2;
          break;
        }
      }
      if (Math.abs(f.x) > 12 || f.y < -5.5 || f.y > 13) this.ko(f);
      if (this.winner !== null) return;
    }
    // Soft body separation, without altering the depth lane or pushing a fighter through the floor.
    const [a, b] = this.fighters,
      dx = b.x - a.x;
    if (
      Math.abs(dx) < 1.15 &&
      Math.abs(a.y - b.y) < 1.35 &&
      a.invincible === 0 &&
      b.invincible === 0
    ) {
      const push = (1.15 - Math.abs(dx)) * 0.5,
        sign = Math.sign(dx) || 1;
      a.x -= push * sign;
      b.x += push * sign;
    }
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      for (const wall of this.fields) {
        if (
          wall.kind === "wall" &&
          wall.owner !== p.owner &&
          Math.abs(p.x - wall.x) < 0.6 + p.radius &&
          Math.abs(p.y - wall.y) < 1.5
        ) {
          wall.hp -= p.damage;
          p.life = 0;
          this.events.push({
            type: "block",
            x: p.x,
            y: p.y,
            color: this.fighters[wall.owner].data.color,
          });
        }
      }
      if (p.life <= 0) continue;
      const target = this.fighters[1 - p.owner];
      if (
        !p.hits.includes(target.index) &&
        Math.abs(p.x - target.x) < p.radius + 0.55 &&
        Math.abs(p.y - (target.y + 1)) < p.radius + 0.8
      ) {
        this.hit(
          this.fighters[p.owner],
          target,
          p.damage,
          p.knock,
          Math.sign(p.vx) || Math.sign(target.x - p.x) || 1,
        );
        p.hits.push(target.index);
        p.life = 0;
        if (p.kind === "note") target.stun = Math.max(target.stun, 0.3);
        if (p.kind === "voice") {
          const drain = Math.min(12, target.energy);
          target.energy -= drain;
          this.fighters[p.owner].energy = clamp(
            this.fighters[p.owner].energy + drain,
            0,
            100,
          );
        }
        if (p.kind === "bubble")
          this.fields.push({
            id: ++this.serial,
            owner: p.owner,
            x: target.x,
            y: target.y + 1,
            life: 0.8,
            tick: 0.55,
            kind: "strike",
            hp: 1,
            count: 1,
          });
      }
    }
    this.projectiles = this.projectiles.filter(
      (p) => p.life > 0 && Math.abs(p.x) < 15,
    );
    for (const field of this.fields) {
      field.life -= dt;
      field.tick -= dt;
      if (field.hp <= 0) field.life = 0;
      if (field.life <= 0) continue;
      if (field.kind === "summon" && field.tick <= 0) {
        field.tick = 0.8;
        const owner = this.fighters[field.owner],
          target = this.fighters[1 - field.owner];
        this.projectile(
          owner,
          field.x,
          field.y,
          Math.sign(target.x - field.x) * 8,
          0,
          field.count === 1 ? 8 : 5,
          3,
          "paw",
          0.22,
        );
      }
      if (field.kind === "echo" && field.tick <= 0) {
        const owner = this.fighters[field.owner],
          target = this.fighters[1 - field.owner];
        if (
          Math.abs(target.x - field.x) < 2 &&
          Math.abs(target.y + 1 - field.y) < 2
        )
          this.hit(owner, target, 9, 4, owner.facing);
        field.life = 0;
      }
      if (field.kind === "strike" && field.tick <= 0) {
        field.tick = 0.42;
        field.count--;
        const owner = this.fighters[field.owner],
          target = this.fighters[1 - field.owner];
        this.events.push({
          type: "cast",
          x: field.x,
          y: field.y,
          color: owner.data.color,
          text: "",
          skill: "ultimate",
          power: 1.2,
        });
        if (
          Math.abs(target.x - field.x) < 1.5 &&
          Math.abs(target.y + 1 - field.y) < 3.5
        )
          this.hit(
            owner,
            target,
            13,
            6,
            Math.sign(target.x - owner.x) || owner.facing,
          );
        if (field.count <= 0) field.life = 0;
      }
    }
    this.fields = this.fields.filter((f) => f.life > 0);
    if (this.time === 0) {
      const score = (f: Fighter) => f.stocks * 1000 - f.damage;
      this.finish(score(a) === score(b) ? -1 : score(a) > score(b) ? 0 : 1);
    }
  }
  attack(f: Fighter, kind: Skill) {
    if (
      f.cooldown[kind] > 0 ||
      f.attackTime > 0 ||
      f.stun > 0 ||
      f.invincible > 1
    )
      return false;
    if (kind === "ultimate" && f.energy < 100) return false;
    const o = this.fighters[1 - f.index];
    f.attackKind = kind;
    f.attackTime = kind === "light" ? 0.25 : kind === "ultimate" ? 0.7 : 0.42;
    f.cooldown[kind] =
      { light: 0.32, heavy: 0.78, special: 3.8, utility: 6, ultimate: 1.2 }[
        kind
      ] * (f.data.id === "deepseek" ? 0.83 : 1);
    if (kind === "ultimate") {
      f.energy = 0;
      this.ultimate(f, o);
      this.event("cast", f, f.data.skills[2], kind, 3);
      return true;
    }
    this.event(
      "cast",
      f,
      kind === "special"
        ? f.data.skills[0]
        : kind === "utility"
          ? f.data.skills[1]
          : undefined,
      kind,
    );
    if (kind === "light" || kind === "heavy") {
      const heavy = kind === "heavy",
        range = heavy ? 2.25 : 1.65,
        dist = (o.x - f.x) * f.facing;
      if (dist > -0.3 && dist < range && Math.abs(o.y - f.y) < 1.6)
        this.hit(f, o, heavy ? 12 : 5.5, heavy ? 6.5 : 2.8, f.facing);
      return true;
    }
    const id = f.data.id;
    if (kind === "special") {
      if (id === "deepseek") {
        for (let i = 0; i < 3; i++)
          this.projectile(
            f,
            f.x + f.facing * (0.9 - i * 0.45),
            f.y + 1 + i * 0.12,
            f.facing * (9 + i * 0.7),
            0,
            6,
            3.5,
            "water",
            0.25,
          );
      }
      if (id === "claude") {
        f.shield = 3;
        f.empowered = true;
      }
      if (id === "gpt") {
        for (let i = 0; i < 3; i++)
          this.projectile(
            f,
            f.x + f.facing * 0.7,
            f.y + 0.65 + i * 0.42,
            f.facing * (7 + i * 2),
            0,
            6,
            3,
            "tool",
            0.22,
          );
      }
      if (id === "gemini") {
        for (let i = 0; i < 3; i++)
          this.projectile(
            f,
            f.x - f.facing * i * 0.45,
            f.y + 0.85 + i * 0.23,
            f.facing * (8 + i),
            0,
            5,
            3,
            "note",
            0.3,
          );
      }
      if (id === "qwen") {
        this.fields.push(
          ...[-0.9, 0.9].map((offset) => ({
            id: ++this.serial,
            owner: f.index,
            x: clamp(f.x + offset, -7.5, 7.5),
            y: f.y + 0.55,
            life: 3.4,
            tick: 0.3,
            kind: "summon" as const,
            hp: 1,
            count: 0,
          })),
        );
      }
      if (id === "grok") {
        for (let i = -1; i <= 1; i++)
          this.projectile(
            f,
            f.x + f.facing * 0.8,
            f.y + 1,
            f.facing * 9,
            i * 2.3,
            8,
            5,
            "rocket",
            0.27,
          );
      }
      if (id === "doubao") {
        this.projectile(
          f,
          f.x + f.facing * 0.7,
          f.y + 1,
          f.facing * 7,
          0,
          8,
          3,
          "bubble",
          0.42,
        );
      }
      if (id === "glm") {
        this.fields = this.fields.filter(
          (w) => !(w.owner === f.index && w.kind === "wall"),
        );
        this.fields.push({
          id: ++this.serial,
          owner: f.index,
          x: clamp(f.x + f.facing * 1.4, -7, 7),
          y: f.y + 1,
          life: 4,
          tick: 0,
          kind: "wall",
          hp: 25,
          count: 0,
        });
        f.shield = 1.5;
      }
      if (id === "kimi") {
        f.energy = clamp(f.energy + 22, 0, 100);
        f.empowered = true;
        f.shield = 1;
      }
    } else {
      if (id === "deepseek") {
        f.damage = Math.max(0, f.damage - 14);
        f.energy = clamp(f.energy + 18, 0, 100);
        f.invincible = 0.35;
      }
      if (id === "claude") {
        f.counter = 0.9;
        f.shield = 0.9;
      }
      if (id === "gpt") {
        f.stance = 1 - f.stance;
        f.energy = clamp(f.energy + 10, 0, 100);
      }
      if (id === "gemini") {
        f.vx = f.facing * 16;
        f.stun = 0.22;
        f.invincible = 0.22;
        this.fields.push({
          id: ++this.serial,
          owner: f.index,
          x: f.x + f.facing * 2,
          y: f.y + 1,
          life: 0.7,
          tick: 0.4,
          kind: "echo",
          hp: 1,
          count: 1,
        });
        if (
          Math.abs(o.y - f.y) < 2 &&
          (o.x - f.x) * f.facing > 0 &&
          Math.abs(o.x - f.x) < 4.5
        )
          this.hit(f, o, 12, 6, f.facing);
      }
      if (id === "qwen") {
        this.projectile(
          f,
          f.x + f.facing * 0.7,
          f.y + 1,
          f.facing * 10,
          0,
          9,
          3,
          "voice",
          0.45,
        );
      }
      if (id === "grok") {
        f.buff = 4;
        f.damage += 8;
      }
      if (id === "doubao") {
        f.buff = 3;
        f.damage = Math.max(0, f.damage - 8);
        f.energy = clamp(f.energy + 20, 0, 100);
      }
      if (id === "glm") {
        f.invincible = 0.28;
        this.projectile(
          f,
          f.x + f.facing * 0.8,
          f.y + 0.45,
          f.facing * 10,
          0,
          10,
          5,
          "shock",
          0.45,
        );
      }
      if (id === "kimi") {
        f.x = clamp(o.x - o.facing * 1.7, -8.5, 8.5);
        f.y = o.y;
        f.facing = o.facing;
        f.invincible = 0.25;
        this.hit(f, o, 10, 5, f.facing);
      }
    }
    return true;
  }
  projectile(
    f: Fighter,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    knock: number,
    kind: string,
    radius = 0.3,
  ) {
    this.projectiles.push({
      id: ++this.serial,
      owner: f.index,
      x,
      y,
      vx,
      vy,
      life: 2.3,
      radius,
      damage,
      knock,
      kind,
      hits: [],
    });
  }
  ultimate(f: Fighter, o: Fighter) {
    const id = f.data.id;
    f.invincible = 0.8;
    if (id === "deepseek") {
      for (let i = 0; i < 5; i++)
        this.projectile(
          f,
          f.x - f.facing * i * 0.95,
          f.y + 1,
          f.facing * 11,
          0,
          9,
          7,
          "wave",
          0.8,
        );
    } else if (id === "qwen") {
      for (let i = 0; i < 3; i++)
        this.fields.push({
          id: ++this.serial,
          owner: f.index,
          x: clamp(f.x + (i - 1) * 1.2, -7.3, 7.3),
          y: f.y + 0.55,
          life: 4,
          tick: i * 0.15,
          kind: "summon",
          hp: 1,
          count: 1,
        });
    } else if (["claude", "grok", "glm", "kimi"].includes(id)) {
      if (id === "glm") {
        f.vy = 9;
        f.grounded = false;
        f.jumps = Math.max(1, f.jumps);
      }
      for (let i = 0; i < 3; i++)
        this.fields.push({
          id: ++this.serial,
          owner: f.index,
          x: clamp(o.x + (i - 1) * 1.9, -9, 9),
          y: o.y + 1,
          life: 2.4,
          tick: 0.3 + i * 0.3,
          kind: "strike",
          hp: 1,
          count: id === "kimi" ? 2 : 1,
        });
    } else {
      for (let i = 0; i < 7; i++)
        this.projectile(
          f,
          f.x - f.facing * i * 0.7,
          f.y + 0.6 + (i % 3) * 0.3,
          f.facing * (9 + i * 0.2),
          0,
          7,
          5,
          id === "doubao" ? "bubble" : id === "gemini" ? "note" : "tool",
          0.4,
        );
    }
  }
  hit(
    f: Fighter,
    o: Fighter,
    damage: number,
    knock: number,
    direction: number,
    canCounter = true,
  ) {
    if (o.invincible > 0 || this.winner !== null) return;
    if (o.counter > 0 && canCounter) {
      o.counter = 0;
      this.event("block", o, "拒绝反击", undefined, 1, "counter");
      this.hit(o, f, 18, 8, -direction, false);
      return;
    }
    const guarding = o.guard || o.shield > 0;
    const multiplier =
      (0.77 + f.data.stats[2] * 0.035) *
      (f.buff > 0 ? 1.2 : 1) *
      (f.empowered ? 1.5 : 1) *
      (f.stance ? 1.25 : 1);
    const amount = damage * multiplier * (guarding ? 0.25 : 1);
    f.empowered = false;
    o.damage += amount;
    o.energy = clamp(o.energy + amount * 0.65, 0, 100);
    f.energy = clamp(f.energy + 7, 0, 100);
    const weight = 1.23 - o.data.stats[1] * 0.035;
    const force = (knock + o.damage * 0.068) * weight * (guarding ? 0.22 : 1);
    o.vx = direction * force;
    o.vy = Math.max(o.vy, force * (knock > 5 ? 0.57 : 0.28));
    o.grounded = false;
    o.stun = guarding ? 0.08 : knock > 5 ? 0.32 : 0.17;
    if (f.data.id === "glm" && f.attackKind === "utility") o.stun = 0.6;
    f.combo++;
    f.comboTime = 1.5;
    this.hits++;
    this.event(
      guarding ? "block" : "hit",
      o,
      guarding ? "格挡" : `${Math.round(amount)}`,
      f.attackKind,
      knock > 5 ? 1.8 : 1,
    );
  }
  ko(f: Fighter) {
    if (this.training) {
      f.stocks = 3;
    } else f.stocks--;
    this.event("ko", f, "上下文崩溃", undefined, 3);
    if (f.stocks <= 0) {
      this.finish(1 - f.index);
      return;
    }
    f.x = f.index ? 3 : -3;
    f.y = 5;
    f.vx = 0;
    f.vy = 0;
    f.damage = 0;
    f.stun = 0;
    f.invincible = 1.7;
    f.jumps = 2;
    f.grounded = false;
    f.energy = Math.max(f.energy, 25);
    this.event("respawn", f);
  }
  finish(winner: number) {
    if (this.winner !== null) return;
    this.winner = winner;
    this.event("win", this.fighters[Math.max(0, winner)]);
  }
  snapshot() {
    return {
      elapsed: this.elapsed,
      time: this.time,
      difficulty: this.difficulty,
      countdown: this.countdown,
      winner: this.winner,
      hits: this.hits,
      projectiles: this.projectiles.length,
      fields: this.fields.map((f) => ({ kind: f.kind, life: f.life })),
      fighters: this.fighters.map((f) => ({
        id: f.data.id,
        x: f.x,
        y: f.y,
        damage: f.damage,
        stocks: f.stocks,
        energy: f.energy,
        grounded: f.grounded,
        jumps: f.jumps,
        guard: f.guard,
        stun: f.stun,
        stance: f.stance,
        cooldown: { ...f.cooldown },
      })),
    };
  }
}
