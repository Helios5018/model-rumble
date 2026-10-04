import "./style.css";
import { World } from "./rumble/world";
import { ROSTER, character, RESEARCH_DATE } from "./rumble/roster";
import type { FighterId, Skill } from "./rumble/roster";
import { Match, emptyInput } from "./rumble/simulation";
import type { Input } from "./rumble/simulation";
import { DIFFICULTIES } from "./rumble/difficulty";
import type { Difficulty } from "./rumble/difficulty";
import { fighterAppearance, PLAYER_COLORS } from "./rumble/appearance";
import { MELEE_STYLES } from "./rumble/melee";
import { AudioBus } from "./rumble/audio";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<div id="world"></div><div class="vignette"></div><div id="interface"></div><div id="floaters" aria-hidden="true"></div><div id="announcement" aria-live="polite"></div>`;
let world: World;
try {
  world = new World(document.querySelector("#world")!);
} catch (error) {
  app.innerHTML =
    '<div class="fatal"><h1>竞技场还没能启动</h1><p>请使用支持 WebGL 2 的浏览器，并开启硬件加速。</p><button onclick="location.reload()">重新载入</button></div>';
  throw error;
}
const ui = document.querySelector<HTMLDivElement>("#interface")!,
  sound = new AudioBus(),
  params = new URLSearchParams(location.search);
let selected: FighterId = "deepseek",
  opponent: FighterId = "claude",
  mode = "cpu",
  difficulty: Difficulty = "medium",
  picking: "p1" | "p2" = "p1";
let match: Match | null = null,
  paused = false,
  screen: "lobby" | "battle" | "result" = "lobby",
  resultShown = false,
  help = false;
const held = new Set<string>(),
  pressed = new Set<string>(),
  touchHeld = new Set<string>();
let last = performance.now(),
  accumulator = 0,
  hudCounter = 0;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function buttonSound() {
  sound.unlock();
  sound.play("menu_move", 0.22);
}
function header() {
  return `<header class="topbar"><a class="brand" href="/" aria-label="Model Rumble 首页"><span class="brand-mark">m<span>r</span></span><span>MODEL<span class="brand-light">RUMBLE</span><small>大模型格斗场</small></span></a><div class="top-center"><span class="status-dot"></span> SEASON 03 <span class="sep">/</span> THE DIMENSION SHIFT</div><nav><button class="icon-button" id="help" aria-label="操作说明">?<span>玩法</span></button><button class="icon-button" id="quality" aria-label="切换画质">◈<span>${world.quality ? "高画质" : "流畅"}</span></button><button class="icon-button" id="sound" aria-label="切换声音">${sound.muted ? "♫̸" : "♫"}<span>${sound.muted ? "静音" : "声音"}</span></button></nav></header>`;
}
function bindHeader() {
  document.querySelector("#sound")?.addEventListener("click", () => {
    sound.unlock();
    sound.toggle();
    const b = document.querySelector("#sound")!;
    b.innerHTML = `${sound.muted ? "♫̸" : "♫"}<span>${sound.muted ? "静音" : "声音"}</span>`;
  });
  document.querySelector("#quality")?.addEventListener("click", () => {
    world.setQuality(!world.quality);
    document.querySelector("#quality")!.innerHTML =
      `◈<span>${world.quality ? "高画质" : "流畅"}</span>`;
  });
  document.querySelector("#help")?.addEventListener("click", showHelp);
}
function lobby() {
  sound.stopEffects();
  sound.resume();
  screen = "lobby";
  match = null;
  paused = false;
  resultShown = false;
  world.mode(false);
  world.setAvatars([selected, opponent]);
  sound.bgm("menu");
  held.clear();
  pressed.clear();
  const c = character(picking === "p1" ? selected : opponent);
  ui.innerHTML = `${header()}<main class="lobby"><section class="intro"><div class="eyebrow"><span></span> 模型已就位，准备开打。</div><h1>大模型，<br>真<span class="outline">打</span>起来。</h1><p class="intro-copy">离开排行榜，走进竞技场。<br>九位 AI 选手，一个属于你的 3D 主场。</p><div class="character-detail" style="--fighter:${c.color}"><div class="detail-kicker">${picking === "p1" ? "PLAYER 01" : "CHALLENGER"} <span> / </span> ${c.role}</div><h2>${c.name}<span>${c.title}</span></h2><div class="model-tag">${c.model}</div><p>${c.description}</p><div class="stats">${["速度", "防御", "攻击", "效率"].map((s, i) => `<div><span>${s}</span><div class="stat-track"><i style="width:${c.stats[i] * 10}%"></i></div><b>${c.stats[i]}</b></div>`).join("")}</div><div class="skill-chips">${c.skills.map((s, i) => `<span title="${c.mechanics[i]}"><kbd>${["L", "U", "I"][i]}</kbd>${s}</span>`).join("")}</div></div></section><div class="stage-label"><span class="tiny-cross">＋</span> LIVE 3D CHARACTER <span class="stage-line"></span><span>拖动旋转 · 实时 3D</span></div><div class="hero-name" style="--fighter:${character(selected).color}"><span>01 / ${character(selected).role}</span><strong>${character(selected).name.toUpperCase()}</strong></div><div class="opponent-label"><span>VS</span><button id="choose-opponent">${character(opponent).name} <small>${selected === opponent ? "P2 替代配色 · " : ""}更换对手 ↗</small></button></div><aside class="arena-label"><span>ARENA 001</span><strong>云端竞技场</strong><small>THE INFERENCE DECK</small></aside><section class="selection"><div class="selection-heading"><div class="selection-tabs"><button class="${picking === "p1" ? "active" : ""}" id="pick-p1">01 选择角色</button><button class="${picking === "p2" ? "active" : ""}" id="pick-p2">02 选择对手</button></div><span>9 FIGHTERS <i>·</i> 无限可能</span></div><div class="roster">${ROSTER.map((r, i) => `<button class="fighter-card ${r.id === (picking === "p1" ? selected : opponent) ? "selected" : ""}" data-fighter="${r.id}" style="--fighter:${r.color}" aria-label="选择 ${r.name}" aria-pressed="${r.id === (picking === "p1" ? selected : opponent)}"><span class="card-index">0${i + 1}</span><img src="${world.thumbnails[r.id]}" alt="${r.title} 3D 模型"><strong>${r.name}</strong><span class="card-role">${r.role}</span>${r.id === selected ? "<em>P1</em>" : ""}${r.id === opponent ? '<em class="p2">P2</em>' : ""}</button>`).join("")}</div><div class="play-row"><div class="mode-group" aria-label="游戏模式"><button data-mode="cpu" class="${mode === "cpu" ? "active" : ""}">人机对战</button><button data-mode="local" class="${mode === "local" ? "active" : ""}">本地双人</button><button data-mode="training" class="${mode === "training" ? "active" : ""}">练习场</button></div><label class="difficulty-label">电脑难度 <select id="difficulty" ${mode !== "cpu" ? "disabled" : ""}>${Object.entries(DIFFICULTIES).map(([id, d]) => `<option value="${id}" ${difficulty === id ? "selected" : ""}>${d.label}</option>`).join("")}</select><small id="difficulty-hint">${mode === "cpu" ? DIFFICULTIES[difficulty].description : "仅人机对战使用"}</small></label><span class="play-hint">3 条命 · 180 秒 · 算力全开</span><button id="start" class="primary-button">进入竞技场 <span>↗</span></button></div></section></main><footer class="lobby-footer"><span><span class="status-dot"></span> 全部角色可用 <i>/</i> 无需下载</span><button id="intel">模型情报 · ${RESEARCH_DATE} ↗</button><span>BUILT FOR PLAY. NOT FOR BENCHMARKS.</span></footer>`;
  bindHeader();
  document.querySelectorAll<HTMLButtonElement>("[data-fighter]").forEach(
    (b) =>
      (b.onclick = () => {
        buttonSound();
        if (picking === "p1") selected = b.dataset.fighter as FighterId;
        else opponent = b.dataset.fighter as FighterId;
        lobby();
      }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode!;
        buttonSound();
        lobby();
      }),
  );
  document.querySelector("#pick-p1")!.addEventListener("click", () => {
    picking = "p1";
    lobby();
  });
  document.querySelector("#pick-p2")!.addEventListener("click", () => {
    picking = "p2";
    lobby();
  });
  document.querySelector("#choose-opponent")!.addEventListener("click", () => {
    picking = "p2";
    lobby();
  });
  document.querySelector<HTMLSelectElement>("#difficulty")!.onchange = (e) => {
    difficulty = (e.target as HTMLSelectElement).value as Difficulty;
    buttonSound();
    document.querySelector("#difficulty-hint")!.textContent = DIFFICULTIES[difficulty].description;
  };
  document.querySelector("#start")!.addEventListener("click", start);
  document.querySelector("#intel")!.addEventListener("click", showIntel);
}
function start() {
  sound.stopEffects();
  sound.resume();
  sound.unlock();
  sound.play("menu_confirm");
  sound.bgm("battle");
  screen = "battle";
  paused = false;
  resultShown = false;
  match = new Match([selected, opponent], difficulty, mode === "training");
  world.mode(true);
  world.setAvatars([selected, opponent]);
  held.clear();
  pressed.clear();
  accumulator = 0;
  renderBattle();
}
function fighterHUD(index: number) {
  const c = fighterAppearance([selected, opponent], index);
  return `<section class="fighter-hud ${index ? "right" : ""}" style="--fighter:${c.color};--player:${PLAYER_COLORS[index]}"><img src="${world.thumbnails[c.id]}" alt=""><div class="fighter-readout"><div class="fighter-top"><span>${index ? (mode === "local" ? "PLAYER 02" : mode === "training" ? "P2 TRAINING" : "P2 CPU · " + DIFFICULTIES[difficulty].label) : "PLAYER 01"}</span><span class="stocks" id="stocks-${index}">● ● ●</span></div><h2>${c.name} <span id="damage-${index}">0<small>%</small></span></h2><div class="energy-track"><i id="energy-${index}"></i></div><div class="energy-label"><span id="status-${index}">${c.title}</span><span id="power-${index}">25 / 100</span></div></div></section>`;
}
function renderBattle() {
  ui.innerHTML = `${header()}<div class="battle-hud">${fighterHUD(0)}<div class="match-clock"><span>云端竞技场</span><strong id="timer">180</strong><small>${mode === "training" ? "自由练习" : "3 STOCK · KNOCKOUT"}</small></div>${fighterHUD(1)}</div><div class="battle-notice" id="battle-notice"></div><div class="battle-bottom"><div class="battle-actions"><button id="pause">Ⅱ 暂停</button><button id="back">↙ 返回选人</button><span id="fps"></span></div><div class="movebar">${(["light", "heavy", "special", "utility", "ultimate"] as Skill[]).map((k, i) => `<div class="move" id="move-${k}"><kbd>${["J", "K", "L", "U", "I"][i]}</kbd><span title="${i < 2 ? "按住连续攻击" : character(selected).mechanics[i - 2]}">${[MELEE_STYLES[selected].light, MELEE_STYLES[selected].heavy, ...character(selected).skills][i]}</span><small></small></div>`).join("")}</div><div class="control-hint"><span><kbd>A</kbd><kbd>D</kbd> 移动</span><span><kbd>W</kbd> 二段跳</span><span><kbd>S</kbd> 下落</span><span><kbd>Shift</kbd> 格挡 / 方向闪避</span>${mode === "local" ? "<span>P2：方向键 · , . / M N · B 防御</span>" : ""}</div></div><div class="touch-controls"><div><button data-key="KeyA" aria-label="向左">←</button><button data-key="KeyD" aria-label="向右">→</button><button data-key="KeyW" aria-label="跳跃">↑</button><button data-key="ShiftLeft" aria-label="格挡">盾</button></div><div><button data-key="KeyJ">J</button><button data-key="KeyK">K</button><button data-key="KeyL">L</button><button data-key="KeyU">U</button><button data-key="KeyI">I</button></div></div>`;
  bindHeader();
  document.querySelector("#pause")!.addEventListener("click", togglePause);
  document.querySelector("#back")!.addEventListener("click", () => {
    buttonSound();
    lobby();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((b) => {
    b.onpointerdown = (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      const key = b.dataset.key!;
      touchHeld.add(key);
      pressed.add(key);
    };
    const release = () => touchHeld.delete(b.dataset.key!);
    b.onpointerup = release;
    b.onpointercancel = release;
    b.onlostpointercapture = release;
  });
  updateHUD();
}
function updateHUD() {
  if (!match) return;
  for (const f of match.fighters) {
    const i = f.index;
    document.querySelector(`#damage-${i}`)!.innerHTML =
      `${Math.floor(f.damage)}<small>%</small>`;
    (document.querySelector(`#damage-${i}`) as HTMLElement).style.color =
      f.damage > 100 ? "#ff9b79" : "";
    document.querySelector(`#stocks-${i}`)!.textContent =
      "● ".repeat(Math.max(0, f.stocks)) +
      "○ ".repeat(Math.max(0, 3 - f.stocks));
    (document.querySelector(`#energy-${i}`) as HTMLElement).style.width =
      f.energy + "%";
    document.querySelector(`#power-${i}`)!.textContent =
      f.energy >= 100 ? "ULTIMATE READY" : `${Math.floor(f.energy)} / 100`;
    document.querySelector(`#status-${i}`)!.textContent =
      f.counter > 0
        ? "拒绝反击"
        : f.guard
          ? "格挡中"
          : f.shield > 0
            ? "护盾生效"
            : f.buff > 0
              ? "算力加速"
              : f.data.id === "gpt"
                ? f.stance
                  ? "推理姿态"
                  : "效率姿态"
                : f.combo >= 2
                  ? `${f.combo} HIT COMBO`
                  : f.data.title;
  }
  document.querySelector("#timer")!.textContent =
    mode === "training" ? "∞" : String(Math.ceil(match.time)).padStart(3, "0");
  const f = match.fighters[0];
  for (const k of [
    "light",
    "heavy",
    "special",
    "utility",
    "ultimate",
  ] as Skill[]) {
    const el = document.querySelector(`#move-${k}`)!;
    el.classList.toggle("cooldown", f.cooldown[k] > 0);
    el.classList.toggle("ready", k === "ultimate" && f.energy >= 100);
    el.querySelector("small")!.textContent =
      f.cooldown[k] > 0
        ? `${f.cooldown[k].toFixed(1)}s`
        : k === "ultimate" && f.energy < 100
          ? `${Math.floor(f.energy)}%`
          : "";
  }
  document.querySelector("#fps")!.textContent =
    `${world.fps} FPS · ${world.quality ? "HIGH" : "LITE"}`;
  const notice = document.querySelector("#battle-notice")!;
  notice.textContent =
    match.countdown > 0
      ? match.countdown > 0.7
        ? String(Math.ceil(match.countdown))
        : "开打！"
      : match.elapsed < 0.7
        ? "开打！"
        : "";
}
function modal(html: string, onClose?: () => void) {
  help = true;
  const wrapper = document.createElement("div");
  wrapper.className = "modal-scrim";
  wrapper.innerHTML = `<section class="modal" role="dialog" aria-modal="true"><button class="close-modal" aria-label="关闭">×</button>${html}</section>`;
  ui.appendChild(wrapper);
  const close = () => {
    wrapper.remove();
    help = false;
    onClose?.();
  };
  wrapper.querySelector(".close-modal")!.addEventListener("click", close);
  wrapper.addEventListener("click", (e) => {
    if (e.target === wrapper) close();
  });
  wrapper.querySelector<HTMLButtonElement>(".close-modal")!.focus();
  return wrapper;
}
function showHelp() {
  const wasPaused = paused;
  if (screen === "battle") {
    paused = true;
    sound.pause();
  }
  modal(
    `<div class="eyebrow">HOW TO RUMBLE</div><h2>把对手，打出上下文。</h2><p>攻击会累积对手的 <b>幻觉率 %</b>；数值越高，击飞越远。被打出场外损失一条命，先耗尽 3 条命的一方落败。时间耗尽时比较剩余命数，再比较幻觉率。</p><div class="help-grid"><div><h3>PLAYER 01</h3><p><kbd>A / D</kbd> 左右移动<br><kbd>W</kbd> 跳跃 / 二段跳<br><kbd>S</kbd> 快速下落 / 穿过浮台<br><kbd>J / K</kbd> 普攻 / 重击<br><kbd>L / U</kbd> 角色专属技<br><kbd>I</kbd> 大招（100 算力）<br><kbd>Shift</kbd> 按住格挡，配合方向闪避</p></div><div><h3>PLAYER 02</h3><p><kbd>← / →</kbd> 左右移动<br><kbd>↑ / ↓</kbd> 跳跃 / 下落<br><kbd>, / .</kbd> 普攻 / 重击<br><kbd>/ / M</kbd> 角色专属技<br><kbd>N</kbd> 大招<br><kbd>B</kbd> 格挡 / 闪避<br><kbd>Esc</kbd> 暂停，<kbd>R</kbd> 结算后再战</p></div></div><p class="muted">算力通过命中、受击和时间积累。练习场快速回复算力，对手保持站立。掉出平台后，向场内移动并用二段跳回场。</p>`,
    () => {
      paused = wasPaused;
      if (screen === "battle" && !wasPaused) sound.resume();
    },
  );
}
function showIntel() {
  modal(
    `<div class="eyebrow">MODEL INTELLIGENCE · ${RESEARCH_DATE}</div><h2>现实里的能力，竞技场里的招式。</h2><p class="muted">基于可核验官方资料制作的粉丝向角色。造型与招式是创作演绎；1–10 属性为游戏平衡值，不是模型性能排名，也不代表官方形象。</p><div class="intel-list">${ROSTER.map((c) => `<article><img src="${world.thumbnails[c.id]}" alt=""><div><h3>${c.name} <small>${c.model}</small></h3><p>${c.news}</p><p class="muted">${c.skills.map((s, i) => `${s}：${c.mechanics[i]}`).join("；")}</p><a href="${c.source}" target="_blank" rel="noopener noreferrer">官方资料 ↗</a></div></article>`).join("")}</div>`,
  );
}
function togglePause() {
  if (screen !== "battle" || help) return;
  paused = !paused;
  held.clear();
  pressed.clear();
  touchHeld.clear();
  if (paused) {
    sound.pause();
    const p = document.createElement("div");
    p.id = "pause-overlay";
    p.className = "pause-overlay";
    p.innerHTML =
      '<span>TAKE A BREATH</span><h2>对战已暂停</h2><button class="primary-button" id="resume">继续战斗 ↗</button><small>按 Esc 继续</small>';
    ui.appendChild(p);
    document.querySelector("#resume")!.addEventListener("click", togglePause);
  } else {
    document.querySelector("#pause-overlay")?.remove();
    sound.resume();
  }
}
function result() {
  if (resultShown || !match) return;
  resultShown = true;
  screen = "result";
  sound.play("victory", 0.4);
  const winner = match.winner!,
    c = winner < 0 ? null : match.fighters[winner].data;
  const box = document.createElement("div");
  box.className = "result-overlay";
  box.innerHTML = `<section class="result-card"><div class="eyebrow">CONTEXT COMPLETE</div><h1>${c ? `P${winner + 1} · ${c.name} 获胜` : "势均力敌"}</h1><p>${c ? c.title + "，拿下这一局。" : "本局平局，再来一次。"}</p>${c ? `<img class="winner-art" src="${world.thumbnails[c.id]}" alt="${c.title}">` : ""}<div class="result-stats"><div><strong>${Math.ceil(match.elapsed)}s</strong><span>对局时长</span></div><div><strong>${match.hits}</strong><span>命中次数</span></div><div><strong>${c ? match.fighters[winner].stocks : "—"}</strong><span>剩余命数</span></div></div><button class="primary-button" id="rematch">再战一局 <span>R ↗</span></button><button class="secondary-button" id="return-lobby">返回选人</button></section>`;
  ui.appendChild(box);
  document.querySelector("#rematch")!.addEventListener("click", start);
  document.querySelector("#return-lobby")!.addEventListener("click", lobby);
}
function input(index: number): Input {
  const keys = index
    ? {
        left: "ArrowLeft",
        right: "ArrowRight",
        up: "ArrowUp",
        down: "ArrowDown",
        guard: "KeyB",
        attacks: ["Comma", "Period", "Slash", "KeyM", "KeyN"],
      }
    : {
        left: "KeyA",
        right: "KeyD",
        up: "KeyW",
        down: "KeyS",
        guard: "ShiftLeft",
        attacks: ["KeyJ", "KeyK", "KeyL", "KeyU", "KeyI"],
      };
  const isHeld = (k: string) =>
    held.has(k) ||
    touchHeld.has(k) ||
    (k === "ShiftLeft" && held.has("ShiftRight"));
  const move = Number(isHeld(keys.right)) - Number(isHeld(keys.left));
  const a = emptyInput();
  a.move = move;
  a.jump = pressed.has(keys.up);
  a.drop = isHeld(keys.down);
  a.guard = isHeld(keys.guard);
  a.dodge =
    (pressed.has(keys.guard) ||
      (keys.guard === "ShiftLeft" && pressed.has("ShiftRight"))) &&
    move !== 0;
  keys.attacks.forEach((key, i) => {
    if (pressed.has(key) || (i < 2 && isHeld(key)))
      a.attack = (
        ["light", "heavy", "special", "utility", "ultimate"] as Skill[]
      )[i];
  });
  return a;
}
const gameKeys = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "KeyJ",
  "KeyK",
  "KeyL",
  "KeyU",
  "KeyI",
  "ShiftLeft",
  "ShiftRight",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Comma",
  "Period",
  "Slash",
  "KeyM",
  "KeyN",
  "KeyB",
  "Space",
]);
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (help) {
      document.querySelector<HTMLButtonElement>(".close-modal")?.click();
      return;
    }
    togglePause();
    return;
  }
  if (help) return;
  if (e.code === "KeyR" && screen === "result") {
    start();
    return;
  }
  if (e.code === "Enter" && screen === "lobby") {
    start();
    return;
  }
  if (screen === "battle" && gameKeys.has(e.code)) {
    e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  }
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => {
  held.clear();
  pressed.clear();
  touchHeld.clear();
  if (screen === "battle" && !paused && !help) togglePause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    held.clear();
    pressed.clear();
    if (screen === "battle" && !paused && !help) togglePause();
  }
});
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (screen === "battle" && match && !paused && !help) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= 1 / 60 && steps < 3) {
      const p1 = params.get("autop1") === "1" ? match.ai(0) : input(0),
        p2 = mode === "local" ? input(1) : match.ai(1);
      match.tick(1 / 60, [p1, p2]);
      pressed.clear();
      accumulator -= 1 / 60;
      steps++;
    }
    for (const e of match.events) {
      if (!reducedMotion) world.emit(e);
      sound.event(e);
      if (e.text && e.type !== "win") {
        const el = document.createElement("span");
        el.className = "floater " + (e.type === "cast" ? "skill-floater" : "");
        el.textContent = e.text;
        const p = world.screenPosition(e.x, e.y + 1.4);
        el.style.left = Math.max(50, Math.min(innerWidth - 120, p.x)) + "px";
        el.style.top = Math.max(160, Math.min(innerHeight - 150, p.y)) + "px";
        el.style.color = e.color;
        document.querySelector("#floaters")!.appendChild(el);
        setTimeout(() => el.remove(), 950);
      }
    }
    match.events = [];
    hudCounter += dt;
    if (hudCounter > 0.08) {
      updateHUD();
      hudCounter = 0;
    }
    if (match.winner !== null) result();
  }
  world.render(dt, match, paused || help);
  requestAnimationFrame(frame);
}
lobby();
requestAnimationFrame(frame);
// Read-only telemetry supports browser smoke tests without exposing gameplay mutations.
(window as unknown as { __RUMBLE__: unknown }).__RUMBLE__ = {
  snapshot: () => ({
    screen,
    paused,
    mode,
    selected,
    opponent,
    difficulty,
    visuals: world.avatars.map((a, i) => ({ player: i + 1, badge: !!a.root.getObjectByName(`player-${i + 1}`), color: fighterAppearance([selected, opponent], i).color, meleeVisible: a.root.getObjectByName(`melee-${i ? opponent : selected}`)?.visible, bodyX: a.body.position.x, bodyLean: a.body.rotation.z })),
    renderer: "Three.js / WebGL2",
    audio: sound.snapshot(),
    fps: world.fps,
    drawCalls: world.renderer.info.render.calls,
    triangles: world.renderer.info.render.triangles,
    geometries: world.renderer.info.memory.geometries,
    ...(match ? { match: match.snapshot() } : {}),
  }),
};
