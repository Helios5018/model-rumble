import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { fighterAppearance, PLAYER_COLORS } from "./appearance";
import { createAvatar, material, mesh } from "./models";
import type { Avatar } from "./models";
import { ROSTER, character } from "./roster";
import type { FighterId } from "./roster";
import { PLATFORMS } from "./simulation";
import type { Match, GameEvent } from "./simulation";

interface Particle {
  obj: T.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  grow: number;
}
export class World {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.OrthographicCamera(-12, 12, 6.75, -6.75, 0.1, 110);
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  arena = new T.Group();
  lobby = new T.Group();
  avatars: Avatar[] = [];
  avatarIds: FighterId[] = [];
  avatarPool = new Map<string, Avatar>();
  cinematic: {
    avatar: Avatar;
    life: number;
    max: number;
    x: number;
    y: number;
    dir: number;
    kind: string;
  }[] = [];
  thumbnails: Record<string, string> = {};
  particles: Particle[] = [];
  effects = new Map<number, T.Object3D>();
  visualTime = 0;
  shake = 0;
  quality = true;
  stars: T.Points;
  shadowLight: T.DirectionalLight;
  previewYaw = 0;
  dragging = false;
  dragX = 0;
  fps = 60;
  lastRender = 0;
  matchMode = false;
  frameCount = 0;
  fpsTime = 0;
  particleGeometry = new T.IcosahedronGeometry(0.075, 0);
  ringGeometry = new T.TorusGeometry(1, 0.035, 8, 48);
  constructor(container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      if (!this.matchMode) {
        this.dragging = true;
        this.dragX = e.clientX;
        this.renderer.domElement.setPointerCapture(e.pointerId);
      }
    });
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      if (this.dragging) {
        this.previewYaw += (e.clientX - this.dragX) * 0.012;
        this.dragX = e.clientX;
      }
    });
    this.renderer.domElement.addEventListener("pointerup", () => {
      this.dragging = false;
    });
    this.renderer.domElement.addEventListener("pointercancel", () => {
      this.dragging = false;
    });
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Model Rumble 3D 竞技场",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.scene.background = new T.Color("#09121d");
    this.scene.fog = new T.FogExp2("#09121d", 0.021);
    const pmrem = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new T.HemisphereLight("#d3e8ff", "#11232b", 1.6));
    this.shadowLight = new T.DirectionalLight("#ffe5ce", 3);
    this.shadowLight.position.set(-5, 10, 7);
    this.shadowLight.castShadow = true;
    this.shadowLight.shadow.mapSize.set(2048, 2048);
    Object.assign(this.shadowLight.shadow.camera, {
      left: -15,
      right: 15,
      top: 13,
      bottom: -10,
      near: 1,
      far: 40,
    });
    this.shadowLight.shadow.normalBias = 0.035;
    this.scene.add(this.shadowLight);
    const rim = new T.DirectionalLight("#73abff", 2.8);
    rim.position.set(4, 5, -6);
    this.scene.add(rim);
    const fill = new T.DirectionalLight("#9bf2d9", 1.5);
    fill.position.set(-9, 3, -2);
    this.scene.add(fill);
    this.scene.add(this.arena, this.lobby);
    this.buildArena();
    this.buildLobby();
    const pos = new Float32Array(260 * 3);
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 260; i++) {
      pos[i * 3] = (rand() - 0.5) * 75;
      pos[i * 3 + 1] = rand() * 24 - 5;
      pos[i * 3 + 2] = -8 - rand() * 30;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    this.stars = new T.Points(
      geo,
      new T.PointsMaterial({
        color: "#87b8ce",
        size: 0.045,
        transparent: true,
        opacity: 0.6,
      }),
    );
    this.scene.add(this.stars);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new T.Vector2(1280, 720), 0.14, 0.35, 2.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.makeThumbnails();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.setAvatars(["deepseek", "claude"]);
    this.mode(false);
  }
  makeThumbnails() {
    const scene = new T.Scene();
    scene.environment = this.scene.environment;
    scene.add(new T.HemisphereLight("#f4f6ff", "#465264", 3));
    const light = new T.DirectionalLight("#fff0d9", 4);
    light.position.set(-3, 4, 6);
    scene.add(light);
    const camera = new T.OrthographicCamera(-1.55, 1.55, 1.55, -1.55, 0.1, 20);
    camera.position.set(0, 2.4, 8);
    camera.lookAt(0, 1.2, 0);
    this.renderer.setSize(220, 220);
    this.renderer.setClearColor("#000000", 0);
    for (const c of ROSTER) {
      const a = createAvatar(c);
      a.root.rotation.y = -0.18;
      scene.add(a.root);
      this.renderer.render(scene, camera);
      this.thumbnails[c.id] = this.renderer.domElement.toDataURL("image/png");
      scene.remove(a.root);
      this.avatarPool.set(c.id + "-0", a);
    }
    this.renderer.setClearColor("#09121d", 1);
  }
  buildArena() {
    for (const p of PLATFORMS) {
      const main = p.y === 0;
      mesh(
        this.arena,
        new RoundedBoxGeometry(
          p.width,
          main ? 0.75 : 0.3,
          main ? 4.1 : 2.25,
          3,
          0.12,
        ),
        material(main ? "#233a46" : "#334d5d", 0.65),
        [p.x, p.y - (main ? 0.38 : 0.16), 0],
      );
      mesh(
        this.arena,
        new RoundedBoxGeometry(
          p.width - 0.13,
          0.1,
          main ? 3.94 : 2.14,
          3,
          0.045,
        ),
        material("#496270", 0.5),
        [p.x, p.y - 0.04, 0],
      );
      mesh(
        this.arena,
        new T.BoxGeometry(p.width - 0.3, 0.04, 0.04),
        material("#6cf2ca", 0.2, 2.5),
        [p.x, p.y - 0.11, main ? 2.02 : 1.12],
      );
      if (main) {
        for (let i = -7; i <= 7; i++) {
          mesh(
            this.arena,
            new T.BoxGeometry(0.015, 0.015, 3.7),
            material("#7ea4ae", 0.3),
            [i, 0.023, 0],
          );
        }
        for (let i = -1; i <= 1; i++)
          mesh(
            this.arena,
            new T.BoxGeometry(15.7, 0.012, 0.015),
            material("#5c8896", 0.2),
            [0, 0.028, i * 1.4],
          );
        for (const x of [-7.65, 7.65]) {
          mesh(
            this.arena,
            new T.BoxGeometry(0.12, 0.04, 3.8),
            material("#e9b886", 0.2, 1.4),
            [x, 0.025, 0],
          );
          for (let n = 0; n < 4; n++)
            mesh(
              this.arena,
              new T.BoxGeometry(0.22, 0.018, 0.13),
              material("#ffdb9f"),
              [x - Math.sign(x) * 0.28, 0.032, n * 0.45 - 0.7],
            );
        }
        const emblem = mesh(
          this.arena,
          new T.TorusGeometry(1.3, 0.023, 8, 64),
          material("#6d9e9c", 0.3),
          [0, 0.038, 0],
        );
        emblem.rotation.x = -Math.PI / 2;
        const inner = mesh(
          this.arena,
          new T.TorusGeometry(1.15, 0.01, 8, 64),
          material("#6d9e9c", 0.3),
          [0, 0.04, 0],
        );
        inner.rotation.x = -Math.PI / 2;
        mesh(
          this.arena,
          new T.CylinderGeometry(6.1, 4.7, 0.7, 6),
          material("#172936", 0.7),
          [0, -1.08, 0],
          [1, 1, 0.37],
        );
        for (const x of [-5.5, 0, 5.5]) {
          mesh(
            this.arena,
            new T.CylinderGeometry(0.45, 0.25, 0.5, 12),
            material("#283e4f", 0.7),
            [x, -1.3, 0],
          );
          mesh(
            this.arena,
            new T.CylinderGeometry(0.26, 0.13, 0.12, 16),
            material("#74e7df", 0.1, 3),
            [x, -1.58, 0],
          );
        }
      } else {
        for (const x of [-0.9, 0.9])
          mesh(
            this.arena,
            new T.ConeGeometry(0.12, 0.7, 5),
            material("#608895", 0.7),
            [p.x + x, p.y - 0.6, 0],
          );
      }
    }
    // Distant orbital architecture supplies real depth and parallax.
    for (let i = 0; i < 3; i++) {
      const ring = mesh(
        this.arena,
        new T.TorusGeometry(8 + i * 2.2, 0.07, 8, 100),
        material("#254953", 0.6, 0.15),
        [0, 3, -12 - i * 3],
      );
      ring.rotation.y = 0.2;
      ring.rotation.x = 0.3;
    }
    for (let i = 0; i < 22; i++) {
      const x = (i - 11) * 2.3,
        height = 1.5 + Math.sin(i * 8.3) ** 2 * 6;
      mesh(
        this.arena,
        new T.BoxGeometry(0.8, height, 0.9),
        material("#162b37", 0.5),
        [x, height / 2 - 3, -12 - Math.sin(i) * 3],
      );
      mesh(
        this.arena,
        new T.BoxGeometry(0.035, height * 0.8, 0.01),
        material("#467582", 0.3, 0.5),
        [x - 0.2, height / 2 - 3, -11.53 - Math.sin(i) * 3],
      );
    }
    const grid = new T.GridHelper(100, 50, "#21414d", "#142c38");
    grid.position.set(0, -4, -8);
    this.arena.add(grid);
  }
  buildLobby() {
    for (const [x, r, y] of [
      [2.5, 2.1, -0.2],
      [6.4, 1.1, -0.32],
    ]) {
      mesh(
        this.lobby,
        new T.CylinderGeometry(r, r * 1.08, 0.36, 80),
        material("#30484f", 0.55),
        [x, y, 0],
      );
      mesh(
        this.lobby,
        new T.CylinderGeometry(r * 0.95, r * 0.95, 0.08, 80),
        material("#4b6870", 0.5),
        [x, y + 0.2, 0],
      );
      const light = mesh(
        this.lobby,
        new T.TorusGeometry(r, 0.025, 8, 100),
        material("#8eeccc", 0.2, 2),
        [x, y + 0.17, 0],
      );
      light.rotation.x = -Math.PI / 2;
      mesh(
        this.lobby,
        new T.CylinderGeometry(r * 0.8, r * 0.65, 0.35, 64),
        material("#122a32", 0.7),
        [x, y - 0.35, 0],
      );
    }
    for (let i = 0; i < 3; i++) {
      const hoop = mesh(
        this.lobby,
        new T.TorusGeometry(4.3 + i * 0.7, 0.015, 6, 120),
        material("#214751", 0.2, 0.3),
        [3.3, 2, -3],
      );
      hoop.rotation.y = 0.4;
      hoop.rotation.x = 0.3;
    }
    const floor = mesh(
      this.lobby,
      new T.PlaneGeometry(100, 100),
      new T.MeshStandardMaterial({
        color: "#06111b",
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.1,
      }),
      [0, -0.8, 0],
    );
    floor.rotation.x = -Math.PI / 2;
    const grid = new T.GridHelper(80, 40, "#132c35", "#10212c");
    grid.position.y = -0.78;
    grid.visible = false;
    this.lobby.add(grid);
  }
  mode(match: boolean) {
    this.matchMode = match;
    this.dragging = false;
    this.previewYaw = 0;
    this.arena.visible = match;
    this.lobby.visible = !match;
    this.clearEffects();
  }
  setAvatars(ids: [FighterId, FighterId]) {
    this.avatars.forEach((a) => this.scene.remove(a.root));
    this.avatarIds = ids;
    this.avatars = ids.map((id, i) => {
      const alternate = i === 1 && ids[0] === ids[1];
      const key = id + "-" + i + (alternate ? "-alt" : "");
      let a = this.avatarPool.get(key);
      if (!a) {
        a = createAvatar(fighterAppearance(ids, i), alternate);
        this.avatarPool.set(key, a);
      }
      // P1 can come from the thumbnail pool; add its badge on first arena use too.
      if (!a.root.getObjectByName(`player-${i + 1}`)) {
        const canvas = document.createElement("canvas");
        canvas.width = 128; canvas.height = 56;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = PLAYER_COLORS[i];
        ctx.beginPath(); ctx.roundRect(4, 4, 120, 48, 12); ctx.fill();
        ctx.fillStyle = "#101725"; ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center"; ctx.fillText(`P${i + 1}`, 64, 40);
        const badge = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthTest: false }));
        badge.name = `player-${i + 1}`;
        badge.position.set(0, 2.9, 0); badge.scale.set(0.82, 0.36, 1);
        badge.renderOrder = 10;
        a.root.add(badge);
      }
      this.scene.add(a.root);
      return a;
    });
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const aspect = w / h,
      halfWidth = Math.max(11.6, 6.5 * aspect),
      halfHeight = halfWidth / aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }
  setQuality(high: boolean) {
    this.quality = high;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.5 : 1));
    this.renderer.shadowMap.enabled = high;
    this.resize();
  }
  removeEffect(obj: T.Object3D) {
    this.scene.remove(obj);
    obj.traverse((child) => {
      if (child instanceof T.Mesh && !obj.userData.avatar) {
        if (
          child.geometry !== this.ringGeometry &&
          child.geometry !== this.particleGeometry
        )
          child.geometry.dispose();
        if (child.material.transparent) child.material.dispose();
      }
    });
  }
  clearEffects() {
    for (const p of this.particles) {
      this.scene.remove(p.obj);
      (p.obj.material as T.Material).dispose();
    }
    this.particles = [];
    for (const obj of this.effects.values()) this.removeEffect(obj);
    this.effects.clear();
    for (const c of this.cinematic) this.scene.remove(c.avatar.root);
    this.cinematic = [];
  }
  emit(e: GameEvent) {
    const id = this.avatarIds[e.player ?? 0];
    if (
      e.type === "cast" &&
      e.skill === "ultimate" &&
      (e.power ?? 1) >= 3 &&
      id
    ) {
      const player = e.player ?? 0;
      const alternate = player === 1 && this.avatarIds[0] === this.avatarIds[1];
      const key = id + "-super-" + player + (alternate ? "-alt" : "");
      let avatar = this.avatarPool.get(key);
      if (!avatar) {
        avatar = createAvatar(fighterAppearance(this.avatarIds, player), alternate);
        this.avatarPool.set(key, avatar);
      }
      this.cinematic = this.cinematic.filter((c) => {
        if (c.avatar === avatar) {
          this.scene.remove(c.avatar.root);
          return false;
        }
        return true;
      });
      this.scene.add(avatar.root);
      avatar.root.visible = true;
      this.cinematic.push({
        avatar,
        life: 1.2,
        max: 1.2,
        x: e.x,
        y: e.y,
        dir: e.x < 0 ? 1 : -1,
        kind: id,
      });
    }

    if (e.type === "cast" && (e.skill === "light" || e.skill === "heavy")) return;
    if (
      e.type === "hit" ||
      e.type === "block" ||
      e.type === "ko" ||
      e.type === "jump" ||
      e.type === "cast"
    ) {
      const count =
        e.type === "ko"
          ? 45
          : e.type === "hit"
            ? 18
            : e.type === "block"
              ? 10
              : e.skill === "ultimate"
                ? 34
                : 7;
      for (let i = 0; i < count; i++) {
        const mat = new T.MeshBasicMaterial({
          color: i % 3 === 0 ? "#f9f2d3" : e.color,
          transparent: true,
          opacity: 1,
        });
        const p = mesh(this.scene, this.particleGeometry, mat, [e.x, e.y, 0]);
        p.castShadow = false;
        const power = e.power ?? 1;
        this.particles.push({
          obj: p,
          vx: (Math.random() - 0.5) * 7 * power,
          vy: Math.random() * 5 * power,
          vz: (Math.random() - 0.5) * 5,
          life: 0.45 + Math.random() * 0.35,
          max: 0.8,
          grow: 0,
        });
      }
      if (e.type === "hit" || e.type === "ko" || e.type === "cast") {
        const mat = new T.MeshBasicMaterial({
          color: e.color,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        });
        const ring = mesh(this.scene, this.ringGeometry, mat, [e.x, e.y, 0.1]);
        ring.castShadow = false;
        ring.scale.setScalar(0.3);
        ring.rotation.y = Math.random() * 0.4;
        this.particles.push({
          obj: ring,
          vx: 0,
          vy: 0,
          vz: 0,
          life: 0.42,
          max: 0.42,
          grow: e.skill === "ultimate" ? 12 : 5,
        });
      }
      if (e.type === "hit" || e.type === "ko")
        this.shake = Math.max(this.shake, (e.power ?? 1) * 0.06);
    }
    while (this.particles.length > 260) {
      const p = this.particles.shift()!;
      this.scene.remove(p.obj);
      (p.obj.material as T.Material).dispose();
    }
  }
  effectObject(
    id: number,
    kind: string,
    color: string,
    brand?: FighterId,
  ): T.Object3D {
    let obj = this.effects.get(id);
    if (obj) return obj;
    const group = new T.Group();
    const mat = material(
      kind === "note"
        ? ["#70a7ff", "#ed91da", "#f6d078", "#87e9bc"][id % 4]
        : color,
      0.3,
      1.4,
    );
    if ((kind === "summon" || kind === "echo") && brand) {
      const key = brand + "-summon-" + color;
      let template = this.avatarPool.get(key);
      if (!template) {
        template = createAvatar({ ...character(brand), color }, color !== character(brand).color);
        this.avatarPool.set(key, template);
      }
      const model = template.root.clone(true);
      model.scale.setScalar(0.48);
      model.position.y = -0.5;
      group.add(model);
      group.userData.avatar = true;
      const r = mesh(
        group,
        this.ringGeometry,
        mat,
        [0, -0.5, 0],
        [0.46, 0.46, 0.46],
      );
      r.rotation.x = -Math.PI / 2;
    } else if (kind === "wall") {
      mesh(
        group,
        new RoundedBoxGeometry(0.4, 2.5, 0.7, 2, 0.08),
        new T.MeshPhysicalMaterial({
          color,
          transparent: true,
          opacity: 0.4,
          metalness: 0.4,
          roughness: 0.2,
        }),
        [0, 0, 0],
      );
      for (let i = -2; i <= 2; i++)
        mesh(group, new T.BoxGeometry(0.43, 0.025, 0.73), mat, [
          0,
          i * 0.46,
          0,
        ]);
    } else if (kind === "strike") {
      const circle = mesh(
        group,
        this.ringGeometry,
        mat,
        [0, -0.8, 0],
        [1.25, 1.25, 1.25],
      );
      circle.rotation.x = -Math.PI / 2;
      if (brand === "grok") {
        const rocket = new T.Group();
        rocket.name = "drop";
        group.add(rocket);
        mesh(
          rocket,
          new T.CylinderGeometry(0.18, 0.22, 1.6, 16),
          material("#ccd6df", 0.8),
        );
        mesh(
          rocket,
          new T.ConeGeometry(0.18, 0.45, 16),
          material("#f5f2e8", 0.5),
          [0, 1.02, 0],
        );
        const flame = mesh(
          rocket,
          new T.ConeGeometry(0.2, 0.7, 12),
          material("#ffbb72", 0.2, 2),
          [0, -1.05, 0],
        );
        flame.rotation.z = Math.PI;
        for (const x of [-0.75, 0.75]) {
          const arm = mesh(
            group,
            new T.BoxGeometry(0.06, 2.4, 0.1),
            material("#c7dce9", 0.7),
            [x, 0.2, 0],
          );
          arm.rotation.z = -x * 0.18;
        }
      } else if (brand === "claude") {
        const stamp = mesh(
          group,
          new T.BoxGeometry(1.3, 0.4, 1.3),
          material(color, 0.4, 0.2),
          [0, 2, 0],
        );
        stamp.name = "drop";
        mesh(group, new T.BoxGeometry(0.035, 5, 0.035), mat, [0, 1.5, 0]);
      } else if (brand === "kimi") {
        const key = "kimi-summon-" + color;
        let template = this.avatarPool.get(key);
        if (!template) {
          template = createAvatar({ ...character("kimi"), color }, color !== character("kimi").color);
          this.avatarPool.set(key, template);
        }
        const cat = template.root.clone(true);
        cat.name = "drop";
        cat.scale.setScalar(0.5);
        group.add(cat);
        group.userData.avatar = true;
      } else {
        mesh(group, new T.CylinderGeometry(0.04, 0.16, 5, 6), mat, [0, 1.6, 0]);
        for (let i = 0; i < 4; i++)
          mesh(group, new T.BoxGeometry(0.18, 0.18, 0.18), mat, [
            Math.cos(i * 1.57) * 0.8,
            0.4 + i * 0.4,
            Math.sin(i * 1.57) * 0.6,
          ]);
      }
    } else if (kind === "summon") {
      mesh(group, new T.OctahedronGeometry(0.32), mat);
      const r = mesh(
        group,
        this.ringGeometry,
        mat,
        [0, 0, 0],
        [0.45, 0.45, 0.45],
      );
      r.rotation.x = 0.4;
    } else if (kind === "rocket") {
      const rocket = mesh(
        group,
        new T.CylinderGeometry(0.16, 0.2, 0.8, 12),
        material("#d2d9e1", 0.8),
      );
      rocket.rotation.z = -Math.PI / 2;
      const nose = mesh(
        group,
        new T.ConeGeometry(0.16, 0.35, 12),
        material("#f1f1eb", 0.5),
        [0.56, 0, 0],
      );
      nose.rotation.z = -Math.PI / 2;
      const flame = mesh(
        group,
        new T.ConeGeometry(0.17, 0.65, 10),
        material("#ffb064", 0.1, 2),
        [-0.65, 0, 0],
      );
      flame.rotation.z = Math.PI / 2;
      for (const z of [-0.18, 0.18])
        mesh(
          group,
          new T.BoxGeometry(0.32, 0.06, 0.23),
          material("#59616f", 0.5),
          [-0.3, 0, z],
        );
    } else if (kind === "note") {
      mesh(
        group,
        new T.SphereGeometry(0.17, 12, 10),
        mat,
        [0, -0.13, 0],
        [1.2, 0.8, 0.65],
      );
      mesh(group, new T.BoxGeometry(0.045, 0.52, 0.06), mat, [0.14, 0.1, 0]);
      mesh(group, new T.BoxGeometry(0.22, 0.07, 0.06), mat, [0.23, 0.33, 0]);
      const r = mesh(group, this.ringGeometry, mat, [0, 0, 0], [0.4, 0.4, 0.4]);
      r.rotation.y = 0.4;
    } else if (kind === "paw") {
      mesh(group, new T.SphereGeometry(0.22, 14, 10), mat);
      for (const x of [-0.2, 0, 0.2])
        mesh(group, new T.SphereGeometry(0.1, 10, 8), mat, [x, 0.26, 0]);
    } else {
      mesh(
        group,
        new T.SphereGeometry(kind === "wave" ? 0.72 : 0.27, 20, 14),
        mat,
      );
      const r = mesh(
        group,
        this.ringGeometry,
        mat,
        [0, 0, 0],
        [kind === "wave" ? 1 : 0.4, kind === "wave" ? 1 : 0.4, 0.4],
      );
      r.rotation.y = Math.PI / 2;
      const tail = mesh(
        group,
        new T.ConeGeometry(
          kind === "wave" ? 0.45 : 0.12,
          kind === "wave" ? 1.8 : 0.9,
          10,
        ),
        mat,
        [-0.6, 0, 0],
      );
      tail.rotation.z = Math.PI / 2;
    }
    this.scene.add(group);
    this.effects.set(id, group);
    return group;
  }
  render(dt: number, match: Match | null, paused = false) {
    this.renderer.info.reset();
    const step = paused ? 0 : dt;
    this.visualTime += step;
    const t = this.visualTime;
    this.frameCount++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.frameCount / this.fpsTime);
      this.frameCount = 0;
      this.fpsTime = 0;
    }
    const target = new T.Vector3(0, 1.7, 0);
    this.camera.position.set(0, 7.5, 23);
    this.camera.lookAt(target);
    if (this.matchMode && match) {
      this.avatars.forEach((a, i) => {
        const f = match.fighters[i];
        a.root.position.set(f.x, f.y, 0.15);
        a.root.scale.setScalar(1);
        const facing = f.facing * 0.35;
        a.root.rotation.y = T.MathUtils.lerp(a.root.rotation.y, facing, 0.18);
        a.animate(
          t,
          f.vx,
          Math.min(1, f.attackTime * 2.5),
          f.invincible,
          f.guard,
        );
        a.body.rotation.z += f.stun > 0 ? -f.facing * 0.17 : 0;
        if (f.attackTime > 0 && (f.attackKind === "light" || f.attackKind === "heavy")) {
          a.melee(f.attackTime, f.attackKind === "heavy", f.facing);
        } else if (f.attackTime > 0) {
          const swing = Math.sin(Math.min(1, f.attackTime / 0.42) * Math.PI);
          if (f.data.id === "glm" && f.attackKind === "utility") {
            a.body.rotation.z = f.facing * 1.15;
            a.body.position.y = -0.18;
          } else if (f.data.id === "deepseek" && f.attackKind === "utility") {
            a.body.rotation.z = -f.facing * 0.55;
            a.body.scale.y = 0.65;
          } else if (f.data.id === "claude" && f.attackKind === "ultimate") {
            a.body.position.y += Math.abs(Math.sin(t * 22)) * 0.4;
          } else if (a.limbs.length) {
            a.limbs[0].rotation.z = -f.facing * swing * 1.15;
          }
        }
        const shieldId = -10 - i;
        if (f.guard || f.shield > 0 || f.counter > 0) {
          let s = this.effects.get(shieldId);
          if (!s) {
            s = mesh(
              this.scene,
              new T.SphereGeometry(1.25, 32, 24),
              new T.MeshPhysicalMaterial({
                color: f.data.color,
                transparent: true,
                opacity: 0.18,
                metalness: 0.5,
                roughness: 0.08,
                side: T.DoubleSide,
              }),
            );
            this.effects.set(shieldId, s);
          }
          s.position.set(f.x, f.y + 1, 0);
          s.visible = true;
        } else if (this.effects.has(shieldId))
          this.effects.get(shieldId)!.visible = false;
      });
      const active = new Set<number>();
      for (const p of match.projectiles) {
        const obj = this.effectObject(
          p.id,
          p.kind,
          match.fighters[p.owner].data.color,
          match.fighters[p.owner].data.id,
        );
        obj.position.set(p.x, p.y, 0);
        obj.rotation.x = t * 6;
        obj.rotation.y = p.vx < 0 ? Math.PI : 0;
        active.add(p.id);
      }
      for (const f of match.fields) {
        const obj = this.effectObject(
          f.id,
          f.kind,
          match.fighters[f.owner].data.color,
          match.fighters[f.owner].data.id,
        );
        obj.position.set(f.x, f.y, 0);
        if (f.kind === "summon") obj.rotation.y = Math.sin(t * 2) * 0.3;
        const drop = obj.getObjectByName("drop");
        if (drop) drop.position.y = Math.max(-0.2, f.tick * 8);
        active.add(f.id);
      }
      for (const [id, obj] of this.effects) {
        if (id >= 0 && !active.has(id)) {
          this.removeEffect(obj);
          this.effects.delete(id);
        }
      }
    } else {
      this.avatars.forEach((a, i) => {
        a.root.visible = true;
        a.root.position.set(i ? 6.4 : 2.5, i ? -0.1 : 0, 0);
        a.root.scale.setScalar(i ? 1.12 : 1.82);
        a.root.rotation.y = i
          ? -0.38
          : Math.sin(t * 0.25) * 0.24 - 0.18 + this.previewYaw;
        a.animate(t + i, 0, 0, 0, false);
      });
    }
    for (const c of this.cinematic) {
      c.life -= step;
      const progress = 1 - c.life / c.max;
      c.avatar.root.visible = c.life > 0;
      c.avatar.root.scale.setScalar(c.kind === "deepseek" ? 2.4 : 1.65);
      c.avatar.root.rotation.y =
        c.kind === "deepseek"
          ? c.dir * 0.35
          : Math.sin(progress * 8) * 0.25;
      c.avatar.root.position.set(
        c.x + c.dir * progress * (c.kind === "deepseek" ? 10 : 2),
        c.y + Math.sin(progress * Math.PI) * (c.kind === "glm" ? 5 : 2.8),
        -0.9,
      );
      c.avatar.animate(t, 0, progress, 0, false);
    }
    this.cinematic = this.cinematic.filter((c) => {
      if (c.life <= 0) {
        this.scene.remove(c.avatar.root);
        return false;
      }
      return true;
    });
    for (const p of this.particles) {
      p.life -= step;
      p.obj.position.x += p.vx * step;
      p.obj.position.y += p.vy * step;
      p.obj.position.z += p.vz * step;
      p.vy -= 9 * step;
      if (p.grow) p.obj.scale.addScalar(p.grow * step);
      else {
        p.obj.rotation.x += step * 4;
        p.obj.rotation.z += step * 5;
      }
      (p.obj.material as T.MeshBasicMaterial).opacity = Math.max(
        0,
        p.life / p.max,
      );
    }
    this.particles = this.particles.filter((p) => {
      if (p.life <= 0) {
        this.scene.remove(p.obj);
        (p.obj.material as T.Material).dispose();
        return false;
      }
      return true;
    });
    this.shake *= Math.exp(-step * 14);
    this.camera.position.x += (Math.random() - 0.5) * this.shake;
    this.camera.position.y += (Math.random() - 0.5) * this.shake;
    this.stars.rotation.z = Math.sin(t * 0.02) * 0.02;
    if (this.quality) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
  screenPosition(x: number, y: number) {
    const v = new T.Vector3(x, y, 0).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * innerWidth,
      y: (-0.5 * v.y + 0.5) * innerHeight,
    };
  }
}
