import { test } from "node:test";
import assert from "node:assert/strict";
import { Match, emptyInput } from "../src/rumble/simulation.ts";
import { ROSTER } from "../src/rumble/roster.ts";
import { cueForEvent } from "../src/rumble/audio.ts";
import type { FighterId } from "../src/rumble/roster.ts";
import { DIFFICULTIES } from "../src/rumble/difficulty.ts";
import type { Difficulty } from "../src/rumble/difficulty.ts";
const ready = (id: FighterId = "deepseek", second: FighterId = "claude") => {
  const m = new Match([id, second]);
  m.countdown = 0;
  return m;
};
const step = (m: Match, n = 60, inputs = [emptyInput(), emptyInput()]) => {
  for (let i = 0; i < n; i++) m.tick(1 / 60, inputs);
};
test("movement, double jump, gravity and main platform landing", () => {
  const m = ready();
  const f = m.fighters[0];
  step(m, 20, [{ ...emptyInput(), move: 1 }, emptyInput()]);
  assert.ok(f.x > -3);
  m.tick(1 / 60, [{ ...emptyInput(), jump: true }, emptyInput()]);
  assert.equal(f.jumps, 1);
  assert.ok(f.y > 0);
  step(m, 8);
  m.tick(1 / 60, [{ ...emptyInput(), jump: true }, emptyInput()]);
  assert.equal(f.jumps, 0);
  const vy = f.vy;
  m.tick(1 / 60, [{ ...emptyInput(), jump: true }, emptyInput()]);
  assert.ok(f.vy < vy);
  step(m, 180);
  assert.equal(f.grounded, true);
  assert.equal(f.jumps, 2);
});
test("drop-through platform cannot fall through main island", () => {
  const m = ready(),
    f = m.fighters[0];
  f.x = -4.3;
  f.y = 2.6;
  f.grounded = true;
  step(m, 90, [{ ...emptyInput(), drop: true }, emptyInput()]);
  assert.equal(f.y, 0);
  assert.equal(f.grounded, true);
});
test("melee range, cooldown, guard and increasing knockback", () => {
  const m = ready(),
    [a, b] = m.fighters;
  assert.equal(m.attack(a, "light"), true);
  assert.equal(b.damage, 0);
  a.attackTime = 0;
  a.cooldown.light = 0;
  a.x = b.x - 1.5;
  assert.equal(m.attack(a, "light"), true);
  assert.ok(b.damage > 0);
  assert.equal(m.attack(a, "light"), false);
  const firstDamage = b.damage;
  step(m, 45);
  a.x = b.x - 1.5;
  a.facing = 1;
  b.guard = true;
  m.attack(a, "light");
  assert.ok(b.damage - firstDamage < firstDamage * 0.4);
  b.guard = false;
  b.damage = 160;
  b.invincible = 0;
  m.hit(a, b, 12, 7, 1);
  assert.ok(b.vx > 10);
});
test("ring-out consumes stocks, respawns with invulnerability, resolves match", () => {
  const m = ready(),
    f = m.fighters[0];
  f.y = -6;
  m.tick(1 / 60, [emptyInput(), emptyInput()]);
  assert.equal(f.stocks, 2);
  assert.ok(f.invincible > 1);
  assert.equal(f.damage, 0);
  f.stocks = 1;
  f.x = 13;
  m.tick(1 / 60, [emptyInput(), emptyInput()]);
  assert.equal(m.winner, 1);
  assert.equal(f.stocks, 0);
});
test("timeout chooses stocks before damage, supports draws", () => {
  const m = ready();
  m.time = 0.001;
  m.fighters[0].damage = 30;
  m.tick(1 / 60, []);
  assert.equal(m.winner, 1);
  const draw = ready();
  draw.time = 0.001;
  draw.tick(1 / 60, []);
  assert.equal(draw.winner, -1);
});
test("ultimate needs 100 energy and consumes it exactly once", () => {
  const m = ready(),
    f = m.fighters[0];
  assert.equal(m.attack(f, "ultimate"), false);
  f.energy = 100;
  assert.equal(m.attack(f, "ultimate"), true);
  assert.equal(f.energy, 0);
  assert.equal(m.attack(f, "ultimate"), false);
  assert.equal(m.projectiles.length, 5);
});
test("DeepSeek compression heals and briefly evades", () => {
  const m = ready(),
    f = m.fighters[0];
  f.damage = 40;
  f.energy = 30;
  m.attack(f, "utility");
  assert.equal(f.damage, 26);
  assert.equal(f.energy, 48);
  assert.ok(f.invincible > 0);
});
test("Claude counter reverses the hit and shield reduces damage", () => {
  const m = ready("claude", "grok"),
    [a, b] = m.fighters;
  m.attack(a, "utility");
  m.hit(b, a, 12, 6, -1);
  assert.equal(a.damage, 0);
  assert.ok(b.damage > 10);
  assert.equal(a.counter, 0);
  assert.ok(m.events.some((event) => cueForEvent(event) === "counter"));
});

test("dodge and win events cannot fall through to swing or respawn sounds", () => {
  const m = ready();
  m.tick(1 / 60, [{ ...emptyInput(), dodge: true }, emptyInput()]);
  assert.ok(m.events.some((event) => cueForEvent(event) === "dodge"));
  m.events = [];
  m.fighters[0].stocks = 1;
  m.ko(m.fighters[0]);
  assert.deepEqual(m.events.map(cueForEvent), ["ko", null]);
});

test("Grok multi-strike ultimate plays the launch cue only once", () => {
  const m = ready("grok");
  m.fighters[0].energy = 100;
  m.attack(m.fighters[0], "ultimate");
  step(m, 100);
  const casts = m.events.filter((event) => event.type === "cast" && event.skill === "ultimate");
  assert.ok(casts.length > 1);
  assert.equal(casts.filter((event) => cueForEvent(event) === "ultimate").length, 1);
});
test("GPT routing trades speed for damage", () => {
  const m = ready("gpt"),
    f = m.fighters[0];
  m.attack(f, "utility");
  assert.equal(f.stance, 1);
  f.attackTime = 0;
  f.cooldown.utility = 0;
  m.attack(f, "utility");
  assert.equal(f.stance, 0);
});
test("Hachimi launches notes and its dash creates a delayed cat echo", () => {
  const m = ready("gemini"),
    f = m.fighters[0];
  m.attack(f, "special");
  assert.equal(m.projectiles.filter((p) => p.kind === "note").length, 3);
  f.attackTime = 0;
  m.attack(f, "utility");
  assert.ok(f.vx > 10);
  assert.ok(m.fields.some((x) => x.kind === "echo"));
});
test("Qwen summons actual autonomous projectiles", () => {
  const m = ready("qwen"),
    f = m.fighters[0];
  m.attack(f, "special");
  assert.equal(m.fields.length, 2);
  step(m, 30);
  assert.ok(m.projectiles.some((p) => p.kind === "paw"));
});
test("Grok rockets and overclock have the intended tradeoff", () => {
  const m = ready("grok"),
    f = m.fighters[0];
  m.attack(f, "special");
  assert.equal(m.projectiles.filter((p) => p.kind === "rocket").length, 3);
  f.attackTime = 0;
  m.attack(f, "utility");
  assert.equal(f.damage, 8);
  assert.equal(f.buff, 4);
});
test("Doubao comforts then bubble hit schedules a second explosion", () => {
  const m = ready("doubao"),
    [f, o] = m.fighters;
  f.damage = 30;
  m.attack(f, "utility");
  assert.equal(f.damage, 22);
  f.attackTime = 0;
  f.x = o.x - 2;
  m.attack(f, "special");
  step(m, 10);
  assert.ok(m.fields.some((x) => x.kind === "strike"));
  assert.ok(o.damage > 0);
});
test("Niu Lai wall absorbs hostile shots and flying ultimate lifts the cow", () => {
  const m = ready("glm", "grok"),
    [f, o] = m.fighters;
  f.x = -2;
  o.x = 3;
  f.facing = 1;
  o.facing = -1;
  m.attack(f, "special");
  m.projectile(o, 2, 1, -10, 0, 30, 3, "rocket");
  step(m, 20);
  assert.equal(m.fields.length, 0);
  assert.equal(f.damage, 0);
  f.attackTime = 0;
  f.energy = 100;
  m.attack(f, "ultimate");
  assert.ok(f.vy > 0);
  assert.equal(m.fields.filter((x) => x.kind === "strike").length, 3);
});
test("Kimi charges empowered strike and teleports behind target", () => {
  const m = ready("kimi"),
    [f, o] = m.fighters;
  m.attack(f, "special");
  assert.equal(f.empowered, true);
  assert.equal(f.energy, 47);
  f.attackTime = 0;
  m.attack(f, "utility");
  assert.ok(Math.abs(f.x - o.x) <= 1.71);
  assert.ok(o.damage > 0);
  assert.equal(f.empowered, false);
});
test("practice mode supplies energy, keeps dummy still and never ends on ring-out", () => {
  const m = new Match(["deepseek", "claude"], "medium", true);
  m.countdown = 0;
  assert.deepEqual(m.ai(1), emptyInput());
  m.fighters[0].energy = 0;
  step(m, 60);
  assert.ok(m.fighters[0].energy > 20);
  for (let i = 0; i < 5; i++) {
    m.fighters[1].x = 15;
    step(m, 1);
  }
  assert.equal(m.fighters[1].stocks, 3);
  assert.equal(m.winner, null);
});
test("all 324 CPU matchups across four difficulties resolve with finite state and hits", () => {
  const summary = [];
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[])
  for (const a of ROSTER)
    for (const b of ROSTER) {
      const m = new Match([a.id, b.id], difficulty);
      m.countdown = 0;
      for (let i = 0; i < 11000 && m.winner === null; i++) {
        m.tick(1 / 60, [m.ai(0), m.ai(1)]);
        m.events = [];
      }
      assert.notEqual(m.winner, null, `${a.id}/${b.id} never finished`);
      assert.ok(m.hits > 0, `${a.id}/${b.id} no fighting`);
      for (const f of m.fighters) {
        assert.ok(
          Number.isFinite(f.x) &&
            Number.isFinite(f.y) &&
            Number.isFinite(f.damage),
        );
        assert.ok(f.stocks >= 0 && f.energy >= 0 && f.energy <= 100);
      }
      summary.push({
        pair: `${a.id}/${b.id}`,
        seconds: Math.round(m.elapsed),
        hits: m.hits,
        winner: m.winner,
      });
    }
  console.log(
    "324 matchup sweep:",
    JSON.stringify({
      minSeconds: Math.min(...summary.map((x) => x.seconds)),
      maxSeconds: Math.max(...summary.map((x) => x.seconds)),
      minHits: Math.min(...summary.map((x) => x.hits)),
      totalHits: summary.reduce((s, x) => s + x.hits, 0),
    }),
  );
});

test("CPU tiers improve aggregate mirror-match results without stat bonuses", () => {
  const scores: number[] = [];
  for (const level of Object.keys(DIFFICULTIES) as Difficulty[]) {
    let wins = 0;
    for (const c of ROSTER) for (let seed = 1; seed <= 8; seed++) for (const side of [0, 1]) {
      const m = new Match([c.id, c.id], level, false, seed * 7919);
      assert.deepEqual(m.fighters[0].data.stats, m.fighters[1].data.stats);
      assert.notEqual(m.fighters[0].data.color, m.fighters[1].data.color);
      assert.equal(c.color, m.fighters[0].data.color);
      m.countdown = 0;
      for (let tick = 0; tick < 10801 && m.winner === null; tick++) {
        m.difficulty = side === 0 ? level : "medium";
        const a = m.ai(0);
        m.difficulty = side === 1 ? level : "medium";
        const b = m.ai(1);
        m.tick(1 / 60, [a, b]);
        m.events = [];
      }
      wins += Number(m.winner === side);
    }
    scores.push(wins);
  }
  assert.ok(scores[0] < scores[1] && scores[1] < scores[2] && scores[2] < scores[3], JSON.stringify(scores));
  console.log("Wins against Medium, 144 seeded mirror games per tier:", scores);
});

test("CPU waits for visible history, recovery uses its own state, practice stays passive", () => {
  for (const level of Object.keys(DIFFICULTIES) as Difficulty[]) {
    const m = new Match(["gpt", "gpt"], level);
    m.countdown = 0;
    m.fighters[0].x = 0; m.fighters[1].x = 1.2;
    for (let n = 0; n < Math.floor(DIFFICULTIES[level].reaction * 60); n++) {
      assert.deepEqual({ ...m.ai(1), attack: undefined }, { ...emptyInput(), attack: undefined });
      m.tick(1 / 60, []);
    }
    step(m, 60);
    const cpu = m.fighters[1];
    cpu.x = 8.8; cpu.y = -1; cpu.vy = -2; cpu.grounded = false; cpu.jumps = 1;
    const recover = m.ai(1);
    assert.equal(recover.move, -1);
    assert.equal(recover.jump, true);
    assert.equal(recover.attack, undefined);
    assert.deepEqual(new Match(["gpt", "gpt"], level, true).ai(1), emptyInput());
  }
});

test("every fighter emits distinct skill audio and separate light/heavy attack cues", () => {
  for (const c of ROSTER) for (const skill of ["light", "heavy", "special", "utility"] as const) {
    const m = ready(c.id);
    m.attack(m.fighters[0], skill);
    const cast = m.events.find((e) => e.type === "cast")!;
    assert.equal(cast.fighter, c.id);
    assert.equal(cueForEvent(cast), skill === "light" ? "swing" : skill === "heavy" ? "swing_heavy" : c.id);
  }
});
