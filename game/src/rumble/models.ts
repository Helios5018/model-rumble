import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createMelee } from "./melee";
import type { Character } from "./roster";

const sphereGeo = new T.SphereGeometry(1, 32, 24);
const materials = new Map<string, T.MeshPhysicalMaterial>();
const softMaterials = new WeakMap<T.MeshPhysicalMaterial, T.MeshPhysicalMaterial>();
export function material(color: string, metal = 0, glow = 0) {
  const key = `${color}/${metal}/${glow}`;
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshPhysicalMaterial({
        color,
        metalness: metal,
        roughness: 0.4,
        envMapIntensity: 0.5,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
        emissive: color,
        emissiveIntensity: glow,
      }),
    );
  return materials.get(key)!;
}
export function mesh(
  parent: T.Object3D,
  geo: T.BufferGeometry,
  mat: T.Material,
  pos: number[] = [0, 0, 0],
  scale: number[] = [1, 1, 1],
) {
  const obj = new T.Mesh(geo, mat);
  obj.position.set(pos[0], pos[1], pos[2]);
  obj.scale.set(scale[0], scale[1], scale[2]);
  obj.castShadow = true;
  obj.receiveShadow = true;
  parent.add(obj);
  return obj;
}
function ball(
  p: T.Object3D,
  color: string,
  pos: number[],
  scale: number[],
  metal = 0,
) {
  return mesh(p, sphereGeo, material(color, metal), pos, scale);
}
function box(
  p: T.Object3D,
  color: string,
  pos: number[],
  scale: number[],
  radius = 0.15,
) {
  return mesh(
    p,
    new RoundedBoxGeometry(...(scale as [number, number, number]), 3, radius),
    material(color, 0.2),
    pos,
  );
}
function ring(
  p: T.Object3D,
  color: string,
  pos: number[],
  radius: number,
  tube = 0.04,
) {
  return mesh(
    p,
    new T.TorusGeometry(radius, tube, 10, 64),
    material(color, 0.25, 0.2),
    pos,
  );
}
function curve(p: T.Object3D, color: string, pts: number[][], radius = 0.035) {
  return mesh(
    p,
    new T.TubeGeometry(
      new T.CatmullRomCurve3(
        pts.map((v) => new T.Vector3(...(v as [number, number, number]))),
      ),
      28,
      radius,
      8,
      false,
    ),
    material(color),
  );
}
function eyes(p: T.Object3D, y: number, z: number, spacing = 0.25, size = 0.1) {
  for (const x of [-spacing, spacing]) {
    ball(p, "#101725", [x, y, z], [size, size * 1.25, size * 0.5]);
    ball(
      p,
      "#ffffff",
      [x - 0.025, y + 0.04, z + 0.047],
      [size * 0.27, size * 0.27, size * 0.15],
    );
  }
}
function starShape(points = 4) {
  const s = new T.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points + Math.PI / 2,
      r = i % 2 ? 0.3 : 1;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return new T.ExtrudeGeometry(s, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.07,
    bevelThickness: 0.07,
  });
}
// Beveled silhouettes give hair, fabric and facial features a continuous contour.
function sculpt(
  p: T.Object3D,
  color: string,
  pos: number[],
  draw: (s: T.Shape) => void,
  depth = 0.08,
  bevel = 0.025,
) {
  const shape = new T.Shape();
  draw(shape);
  shape.closePath();
  return mesh(p, new T.ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true, bevelSegments: 3,
    bevelSize: bevel, bevelThickness: bevel, curveSegments: 18,
  }), material(color), pos);
}
function bow(p: T.Object3D, color: string, pos: number[], size: number) {
  const group = new T.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  group.scale.setScalar(size);
  p.add(group);
  for (const side of [-1, 1]) {
    sculpt(group, color, [0, 0, 0], (s) => {
      s.moveTo(0, 0);
      s.bezierCurveTo(side * 0.2, 0.12, side * 0.43, 0.32, side * 0.46, 0.18);
      s.bezierCurveTo(side * 0.52, -0.1, side * 0.43, -0.29, side * 0.31, -0.2);
      s.lineTo(0, -0.04);
    });
  }
  ball(group, color, [0, 0, 0.09], [0.11, 0.13, 0.09]);
  return group;
}
export interface Avatar {
  root: T.Group;
  body: T.Group;
  limbs: T.Object3D[];
  orbit: T.Group;
  melee: (remaining: number, heavy: boolean, facing: number) => void;
  animate: (
    t: number,
    speed: number,
    attack: number,
    hurt: number,
    guard: boolean,
  ) => void;
}
export function createAvatar(c: Character, alternate = false): Avatar {
  const root = new T.Group(),
    body = new T.Group(),
    orbit = new T.Group();
  root.add(body);
  body.add(orbit);
  const limbs: T.Object3D[] = [];
  if (c.id === "deepseek") {
    // Reference: sleepy blue-haired whale maid, white ruffles and a curled whale tail.
    const hair = "#34477f", tips = "#5398c6", navy = "#202d50", skin = "#ffe0d5";
    // Tail and long hair sit behind the dress, with depth visible when rotating.
    const tail = new T.Group();
    tail.position.set(0.35, 0.53, -0.25);
    tail.scale.setScalar(0.72);
    body.add(tail);
    limbs.push(tail);
    sculpt(tail, hair, [0, 0, 0], (s) => {
      s.moveTo(0, 0.03);
      s.bezierCurveTo(0.75, -0.37, 1.05, -0.02, 1.01, 0.39);
      s.bezierCurveTo(1.25, 0.49, 1.38, 0.69, 1.3, 0.9);
      s.bezierCurveTo(1.05, 0.88, 0.86, 0.69, 0.89, 0.48);
      s.bezierCurveTo(0.73, 0.65, 0.53, 0.59, 0.49, 0.51);
      s.bezierCurveTo(0.64, 0.26, 0.86, 0.29, 0.88, 0.33);
      s.bezierCurveTo(0.72, -0.04, 0.35, 0.13, 0.09, 0.28);
    }, 0.14, 0.045);
    ball(body, hair, [0, 1.5, -0.15], [0.79, 0.77, 0.43]);
    for (const side of [-1, 1]) {
      const locks = new T.Group();
      locks.scale.x = side;
      body.add(locks);
      for (let i = 0; i < 3; i++) {
        const lock = sculpt(locks, hair, [0.43 + i * 0.12, 0.36 + i * 0.04, -0.13 + i * 0.07], (s) => {
          s.moveTo(0, 1.26);
          s.bezierCurveTo(0.42, 1.13, 0.22, 0.8, 0.39, 0.55);
          s.bezierCurveTo(0.62, 0.26, 0.28, 0.2, 0.43, 0.05);
          s.bezierCurveTo(0.27, -0.02, 0.06, 0.03, 0.1, 0.17);
          s.bezierCurveTo(-0.19, 0.14, -0.11, 0.39, -0.07, 0.54);
          s.bezierCurveTo(0.07, 0.81, -0.16, 1.04, 0, 1.26);
        }, 0.17, 0.035);
        const colors = [];
        const positions = lock.geometry.getAttribute("position");
        for (let v = 0; v < positions.count; v++) {
          const color = new T.Color(tips).lerp(new T.Color(hair), T.MathUtils.smoothstep(positions.getY(v), 0.15, 0.95));
          colors.push(color.r, color.g, color.b);
        }
        lock.geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
        const mat = material("#ffffff").clone();
        mat.vertexColors = true;
        mat.roughness = 0.65;
        mat.clearcoat = 0.12;
        lock.material = mat;
      }
    }
    // Bell skirt, layered white hem, apron and gold piping.
    mesh(body, new T.CylinderGeometry(0.29, 0.73, 0.57, 48), material(navy), [0, 0.59, 0]);
    mesh(body, new T.CylinderGeometry(0.7, 0.76, 0.095, 48), material("#fff8f3"), [0, 0.31, 0]);
    for (let i = 0; i < 22; i++) {
      const a = i * Math.PI * 2 / 22;
      ball(body, "#fff8f3", [Math.cos(a) * 0.72, 0.3, Math.sin(a) * 0.72], [0.095, 0.065, 0.075]);
    }
    const trim = ring(body, "#ba9469", [0, 0.43, 0], 0.66, 0.016);
    trim.rotation.x = Math.PI / 2;
    ball(body, navy, [0, 0.98, 0], [0.35, 0.36, 0.28]);
    ball(body, "#fff8f3", [0, 1.0, 0.255], [0.245, 0.27, 0.06]);
    ball(body, "#fff8f3", [0, 0.59, 0.49], [0.41, 0.28, 0.08]);
    for (let i = 0; i < 13; i++) {
      const a = Math.PI + i * Math.PI / 12;
      ball(body, "#fff8f3", [Math.cos(a) * 0.41, 0.62 + Math.sin(a) * 0.29, 0.49], [0.065, 0.055, 0.06]);
    }
    box(body, navy, [0, 0.86, 0.31], [0.65, 0.095, 0.085], 0.025);
    for (const x of [-0.17, 0.17])
      ball(body, "#caa475", [x, 0.865, 0.364], [0.026, 0.026, 0.012]);
    for (const y of [0.98, 1.08])
      ball(body, navy, [0, y, 0.321], [0.025, 0.025, 0.013]);
    // Little whale embroidered on the apron.
    ball(body, hair, [0.1, 0.55, 0.57], [0.115, 0.065, 0.013]);
    curve(body, hair, [[0.16, 0.54, 0.575], [0.23, 0.57, 0.575], [0.25, 0.62, 0.575]], 0.023);
    ball(body, "#ffffff", [0.055, 0.56, 0.585], [0.012, 0.012, 0.008]);
    for (const side of [-1, 1]) {
      bow(body, "#c7a178", [side * 0.51, 0.48, 0.48], 0.24);
      limbs.push(ball(body, navy, [side * 0.27, 0.16, 0.12], [0.22, 0.13, 0.27]));
      ball(body, "#fff8f3", [side * 0.27, 0.23, 0.22], [0.13, 0.04, 0.12]);
      const arm = new T.Group();
      arm.position.set(side * 0.46, 0.99, 0.22);
      body.add(arm);
      limbs.push(arm);
      ball(arm, navy, [0, -0.04, 0], [0.18, 0.22, 0.2]);
      ring(arm, "#c7a178", [0, 0, 0.16], 0.125, 0.016);
      ball(arm, skin, [0, 0.04, 0.17], [0.13, 0.14, 0.1]);
      ball(body, "#fff8f3", [side * 0.33, 1.14, 0.16], [0.13, 0.15, 0.15]);
    }
    bow(body, navy, [0, 1.18, 0.34], 0.55);
    const jewel = box(body, "#72c6ea", [0, 1.2, 0.43], [0.085, 0.085, 0.035], 0.008);
    jewel.rotation.z = Math.PI / 4;
    // Broad, low chibi face and half-lidded gradient-blue eyes.
    ball(body, skin, [0, 1.62, 0.16], [0.66, 0.52, 0.38]);
    for (const side of [-1, 1]) {
      ball(body, "#ffc0b7", [side * 0.47, 1.43, 0.446], [0.145, 0.09, 0.027]);
      ball(body, "#1c233f", [side * 0.285, 1.64, 0.5], [0.168, 0.205, 0.034]);
      ball(body, "#4d64a4", [side * 0.285, 1.635, 0.528], [0.139, 0.17, 0.022]);
      ball(body, "#78b9d8", [side * 0.285, 1.575, 0.549], [0.128, 0.105, 0.012]);
      ball(body, "#b6e8f3", [side * 0.27, 1.52, 0.559], [0.066, 0.032, 0.008]);
      curve(body, "#222139", [[side * 0.105, 1.785, 0.535], [side * 0.28, 1.81, 0.555], [side * 0.46, 1.775, 0.51]], 0.036);
      for (let i = 0; i < 2; i++)
        curve(body, "#e99596", [[side * (0.42 + i * 0.075), 1.46, 0.474], [side * (0.44 + i * 0.075), 1.41, 0.474]], 0.012);
    }
    sculpt(body, "#a55a63", [0, 1.365, 0.533], (s) => {
      s.moveTo(-0.13, 0.01); s.bezierCurveTo(-0.19, 0.1, -0.06, 0.13, 0, 0.075);
      s.bezierCurveTo(0.12, 0.13, 0.2, 0.055, 0.12, -0.01);
      s.bezierCurveTo(0.04, -0.015, -0.06, -0.035, -0.13, 0.01);
    }, 0.012, 0.012);
    ball(body, "#f5b1a8", [0, 1.408, 0.559], [0.115, 0.036, 0.014]);
    curve(body, "#b2dfed", [[0.1, 1.38, 0.57], [0.11, 1.27, 0.58], [0.095, 1.2, 0.57]], 0.029);
    curve(body, "#f2fcff", [[0.085, 1.35, 0.592], [0.087, 1.24, 0.592]], 0.01);
    // White maid headband follows the crown; the fringe covers its lower edge.
    for (let i = 0; i < 11; i++) {
      const a = 0.12 + i * (Math.PI - 0.24) / 10;
      const ruffle = box(body, "#fff8f3", [Math.cos(a) * 0.765, 1.79 + Math.sin(a) * 0.56, 0.02], [0.2, 0.2, 0.17], 0.055);
      ruffle.rotation.z = a - Math.PI / 2;
    }
    for (const side of [-1, 1]) {
      const fringe = sculpt(body, hair, [0, 0, 0.38], (s) => {
        s.moveTo(side * 0.04, 2.19);
        s.bezierCurveTo(side * 0.72, 2.32, side * 0.82, 1.74, side * 0.63, 1.4);
        s.quadraticCurveTo(side * 0.43, 1.36, side * 0.51, 1.53);
        s.bezierCurveTo(side * 0.64, 1.78, side * 0.33, 1.93, side * 0.04, 2.19);
      }, 0.08, 0.035);
      fringe.name = "side-fringe";
      sculpt(body, hair, [side * 0.65, 1.67, -0.08], (s) => {
        s.moveTo(0, 0.2); s.quadraticCurveTo(side * 0.23, -0.08, side * 0.43, -0.12);
        s.quadraticCurveTo(side * 0.22, -0.24, 0, -0.05);
      }, 0.11, 0.025);
    }
    sculpt(body, hair, [0, 0, 0.46], (s) => {
      s.moveTo(-0.28, 2.18); s.bezierCurveTo(-0.12, 2.31, 0.16, 2.3, 0.2, 2.14);
      s.bezierCurveTo(0.26, 1.87, 0.13, 1.7, 0.02, 1.66);
      s.lineTo(0.07, 1.74); s.bezierCurveTo(-0.14, 1.65, -0.21, 1.88, -0.28, 2.18);
    }, 0.095, 0.035);
    curve(body, hair, [[-0.05, 2.27, 0], [-0.13, 2.5, 0], [-0.37, 2.49, 0], [-0.48, 2.4, 0]], 0.055);
    bow(body, "#589bca", [0.7, 1.99, 0.4], 0.46);
  } else if (c.id === "claude") {
    // The supplied Clawd silhouette: a flat-topped orange block, side arms and four legs.
    box(body, "#d97b57", [0, 1.29, 0], [1.38, 1.08, 0.67], 0.035);
    for (const x of [-0.86, 0.86])
      limbs.push(box(body, "#d97b57", [x, 1.33, 0], [0.4, 0.34, 0.52], 0.022));
    for (const x of [-0.6, -0.26, 0.26, 0.6])
      limbs.push(box(body, "#d97b57", [x, 0.5, 0], [0.18, 0.6, 0.48], 0.018));
    for (const x of [-0.42, 0.42])
      box(body, "#12100e", [x, 1.61, 0.343], [0.18, 0.18, 0.025], 0.006);
    // Tiny bevels keep the exact pixel profile while catching studio light.
  } else if (c.id === "gpt") {
    // User's desktop pet reference: blue cloud head and cyan terminal face.
    const blue = "#4e7fea", outline = "#243466", screen = "#182653", cyan = "#a1f4ee";
    const cloud = (shape: T.Shape) => {
      shape.moveTo(-0.6, -0.48);
      shape.bezierCurveTo(-0.79, -0.45, -0.84, -0.3, -0.78, -0.18);
      shape.bezierCurveTo(-0.97, -0.11, -0.87, 0.2, -0.73, 0.28);
      shape.bezierCurveTo(-0.73, 0.45, -0.57, 0.55, -0.44, 0.55);
      shape.bezierCurveTo(-0.4, 0.82, -0.12, 0.86, 0.02, 0.71);
      shape.bezierCurveTo(0.2, 0.83, 0.42, 0.67, 0.48, 0.52);
      shape.bezierCurveTo(0.72, 0.46, 0.78, 0.23, 0.75, 0.12);
      shape.bezierCurveTo(0.91, -0.03, 0.76, -0.26, 0.73, -0.29);
      shape.bezierCurveTo(0.74, -0.48, 0.56, -0.53, 0.4, -0.53);
      shape.lineTo(-0.37, -0.53);
      shape.quadraticCurveTo(-0.55, -0.54, -0.6, -0.48);
    };
    sculpt(body, outline, [0, 1.5, -0.27], cloud, 0.51, 0.065);
    const head = sculpt(body, blue, [0, 1.5, -0.235], cloud, 0.54, 0.06);
    head.scale.set(0.94, 0.94, 1);
    box(body, outline, [0, 0.72, -0.02], [0.85, 0.7, 0.53], 0.2);
    box(body, blue, [0, 0.74, 0.015], [0.77, 0.61, 0.51], 0.19);
    box(body, screen, [0, 1.43, 0.36], [1.02, 0.68, 0.15], 0.18);
    // Angular strokes preserve the >_ glyph even in the small roster portrait.
    for (const [y, z, scale] of [[1.45, 0.45, 1], [0.76, 0.293, 0.49]]) {
      const glyph = new T.Group();
      glyph.position.set(0, y, z);
      glyph.scale.setScalar(scale);
      body.add(glyph);
      curve(glyph, cyan, [[-0.26, 0.13, 0], [-0.13, 0.02, 0.01], [-0.25, -0.095, 0]], 0.034);
      box(glyph, cyan, [0.205, -0.095, 0], [0.22, 0.056, 0.028], 0.012);
    }
    for (const side of [-1, 1]) {
      const arm = new T.Group();
      arm.position.set(side * 0.46, 0.76, 0);
      arm.rotation.z = side * 0.32;
      body.add(arm);
      limbs.push(arm);
      ball(arm, outline, [0, -0.075, 0], [0.165, 0.285, 0.205]);
      ball(arm, blue, [0, -0.065, 0.02], [0.14, 0.25, 0.195]);
      const foot = new T.Group();
      foot.position.set(side * 0.225, 0.25, 0);
      body.add(foot);
      limbs.push(foot);
      box(foot, outline, [0, 0, 0], [0.3, 0.33, 0.37], 0.07);
      box(foot, blue, [0, 0.02, 0.022], [0.255, 0.28, 0.35], 0.06);
    }
  } else if (c.id === "gemini") {
    // Reference: cream folded-ear cat, huge black eyes, pink cheeks and open grin.
    const fur = "#e5dbc6", cream = "#fff3de";
    ball(body, fur, [0, 1.46, 0], [0.8, 0.67, 0.49]);
    ball(body, cream, [0, 1.23, 0.15], [0.7, 0.43, 0.39]);
    for (const side of [-1, 1]) {
      const ear = ball(body, fur, [side * 0.64, 1.87, -0.04], [0.29, 0.16, 0.23]);
      ear.rotation.z = -side * 0.38;
      ball(body, "#cbb6ac", [side * 0.69, 1.845, 0.095], [0.13, 0.06, 0.05]);
      ball(body, "#b6aa93", [side * 0.31, 1.68, 0.414], [0.22, 0.247, 0.055]);
      const eye = ball(body, "#110f10", [side * 0.31, 1.675, 0.456], [0.181, 0.2, 0.09]);
      const eyeMat = material("#110f10").clone();
      eyeMat.roughness = 0.13; eyeMat.clearcoat = 1;
      eye.material = eyeMat;
      ball(body, "#fffdf3", [side * 0.31 - 0.043, 1.735, 0.54], [0.035, 0.027, 0.012]);
      ball(body, "#ffb8c4", [side * 0.56, 1.365, 0.396], [0.195, 0.105, 0.032]);
      for (let i = 0; i < 3; i++)
        curve(body, "#eedde0", [[side * 0.46, 1.4 - i * 0.033, 0.43], [side * 0.67, 1.43 - i * 0.048, 0.375]], 0.015);
    }
    // A broad open mouth and tongue, with the muzzle overlapping its top edge.
    sculpt(body, "#39201d", [0, 1.02, 0.48], (s) => {
      s.moveTo(-0.34, 0.25);
      s.bezierCurveTo(-0.13, 0.16, 0.16, 0.18, 0.34, 0.26);
      s.bezierCurveTo(0.29, 0.07, 0.12, -0.13, 0, -0.12);
      s.bezierCurveTo(-0.14, -0.12, -0.28, 0.08, -0.34, 0.25);
    }, 0.016, 0.02);
    ball(body, "#c58486", [0, 0.992, 0.524], [0.145, 0.072, 0.026]);
    for (const side of [-1, 1]) {
      ball(body, cream, [side * 0.18, 1.325, 0.465], [0.265, 0.145, 0.125]);
      mesh(body, new T.ConeGeometry(0.044, 0.09, 12), material("#fffaf0"), [side * 0.265, 1.18, 0.533]).rotation.z = Math.PI;
      for (let i = 0; i < 3; i++)
        curve(body, "#c7bca8", [[side * 0.36, 1.3 - i * 0.054, 0.53], [side * 0.61, 1.31 - i * 0.07, 0.47], [side * 0.88, 1.37 - i * 0.11, 0.35]], 0.008);
    }
    sculpt(body, "#735046", [0, 1.405, 0.592], (s) => {
      s.moveTo(-0.09, 0.016); s.quadraticCurveTo(0, 0.045, 0.09, 0.016);
      s.quadraticCurveTo(0.065, -0.044, 0, -0.058); s.quadraticCurveTo(-0.065, -0.044, -0.09, 0.016);
    }, 0.01, 0.012);
    for (const x of [-0.2, 0, 0.2]) {
      const stripe = ball(body, "#c3b89e", [x, 1.99, 0.225], [0.044, 0.105, 0.023]);
      stripe.rotation.z = x * 1.2;
    }
    ball(body, fur, [0, 0.63, -0.04], [0.46, 0.48, 0.35]);
    ball(body, cream, [0, 0.61, 0.24], [0.34, 0.35, 0.16]);
    for (const x of [-0.49, 0.49])
      limbs.push(ball(body, fur, [x, 0.7, 0.04], [0.19, 0.29, 0.2]));
    for (const x of [-0.26, 0.26])
      limbs.push(ball(body, cream, [x, 0.2, 0.12], [0.23, 0.2, 0.28]));
    curve(body, fur, [[0.35, 0.4, -0.2], [0.79, 0.47, -0.24], [0.85, 0.89, -0.2], [0.68, 1.02, -0.15]], 0.105);
    for (const [x, y, color] of [[-0.98, 1.95, "#8fb0ff"], [0.97, 1.52, "#d7a1e7"]] as const)
      mesh(orbit, starShape(), material(color, 0.35, 0.5), [x, y, 0], [0.12, 0.16, 0.25]);
  } else if (c.id === "qwen") {
    // Official Qwen bear reference: tan fur, round ears, serious brow, white tee.
    const fur = "#bea077",
      dark = "#956f4f";
    ball(body, fur, [0, 1.42, 0], [0.68, 0.62, 0.47]);
    for (const x of [-0.49, 0.49]) {
      ball(body, fur, [x, 1.94, 0], [0.24, 0.25, 0.18]);
      ball(body, dark, [x, 1.95, 0.135], [0.14, 0.15, 0.055]);
    }
    ball(body, dark, [0, 1.28, 0.44], [0.23, 0.29, 0.105]);
    ball(body, "#2d241c", [0, 1.43, 0.54], [0.09, 0.063, 0.04]);
    curve(
      body,
      "#3a2d21",
      [
        [0, 1.4, 0.55],
        [0, 1.24, 0.55],
        [-0.07, 1.18, 0.55],
      ],
      0.023,
    );
    curve(
      body,
      "#3a2d21",
      [
        [0, 1.24, 0.55],
        [0.07, 1.18, 0.55],
      ],
      0.023,
    );
    for (const side of [-1, 1]) {
      const brow = box(
        body,
        "#2d241c",
        [side * 0.31, 1.57, 0.435],
        [0.22, 0.075, 0.04],
        0.025,
      );
      brow.rotation.z = side * 0.22;
    }
    ball(body, "#f3f3ed", [0, 0.7, 0], [0.51, 0.47, 0.35]);
    for (const x of [-0.59, 0.59]) {
      limbs.push(ball(body, fur, [x, 0.78, 0], [0.24, 0.34, 0.23]));
      ball(body, "#f3f3ed", [x * 0.86, 0.95, 0], [0.24, 0.19, 0.25]);
    }
    for (const x of [-0.28, 0.28])
      limbs.push(ball(body, fur, [x, 0.22, 0.08], [0.25, 0.23, 0.28]));
    ball(body, fur, [0.02, 2.03, 0], [0.09, 0.17, 0.1]);
    for (let i = 0; i < 3; i++) {
      const r = mesh(
        body,
        new T.TorusGeometry(0.115, 0.032, 5, 3),
        material("#7261b8"),
        [
          Math.cos(i * 2.094) * 0.073,
          0.75 + Math.sin(i * 2.094) * 0.073,
          0.351,
        ],
      );
      r.rotation.z = i * 2.094;
    }
  } else if (c.id === "grok") {
    // A satirical Musk-like vinyl figure: swept hair, raised eyebrows, X shirt, rocket pack.
    ball(body, "#f0c8ac", [0, 1.53, 0], [0.52, 0.6, 0.43]);
    ball(body, "#d6a584", [0, 1.3, 0.18], [0.45, 0.29, 0.3]);
    ball(body, "#6a4b39", [0, 1.96, -0.08], [0.5, 0.24, 0.38]);
    for (let i = 0; i < 5; i++) {
      const hair = ball(
        body,
        i % 2 ? "#73513a" : "#62422f",
        [-0.31 + i * 0.14, 1.99 + i * 0.022, 0.16],
        [0.18, 0.15, 0.22],
      );
      hair.rotation.z = -0.3;
    }
    for (const x of [-0.49, 0.49])
      ball(body, "#e7b899", [x, 1.52, 0], [0.105, 0.17, 0.11]);
    eyes(body, 1.6, 0.409, 0.2, 0.057);
    for (const side of [-1, 1]) {
      const brow = box(
        body,
        "#77533e",
        [side * 0.2, 1.73, 0.39],
        [0.2, 0.038, 0.035],
        0.01,
      );
      brow.rotation.z = side * 0.13;
    }
    ball(body, "#e3b08d", [0, 1.45, 0.43], [0.09, 0.12, 0.1]);
    curve(
      body,
      "#9c6d53",
      [
        [-0.16, 1.27, 0.406],
        [0, 1.245, 0.445],
        [0.19, 1.31, 0.39],
      ],
      0.021,
    );
    ball(body, "#20232b", [0, 0.84, 0], [0.46, 0.43, 0.31]);
    for (const side of [-1, 1]) {
      limbs.push(
        ball(body, "#ebbc9b", [side * 0.55, 0.77, 0], [0.17, 0.32, 0.18]),
      );
      ball(body, "#24272e", [side * 0.46, 1.0, 0], [0.2, 0.23, 0.23]);
      limbs.push(
        box(body, "#252b39", [side * 0.25, 0.36, 0], [0.28, 0.45, 0.3], 0.07),
      );
      ball(body, "#121724", [side * 0.25, 0.12, 0.09], [0.21, 0.13, 0.28]);
    }
    curve(
      body,
      "#eceef1",
      [
        [-0.13, 0.99, 0.31],
        [0.14, 0.7, 0.33],
      ],
      0.027,
    );
    curve(
      body,
      "#eceef1",
      [
        [0.14, 0.99, 0.31],
        [-0.13, 0.7, 0.33],
      ],
      0.027,
    );
    for (const x of [-0.38, 0.38]) {
      mesh(
        body,
        new T.CylinderGeometry(0.13, 0.15, 0.76, 12),
        material("#b7c3c9", 0.8),
        [x, 0.99, -0.32],
      );
      mesh(body, new T.ConeGeometry(0.13, 0.28, 12), material("#e2e4e7", 0.7), [
        x,
        1.51,
        -0.32,
      ]);
      mesh(
        body,
        new T.ConeGeometry(0.1, 0.28, 10),
        material("#ffa862", 0.2, 1),
        [x, 0.48, -0.32],
      );
    }
  } else if (c.id === "doubao") {
    // Reference: asymmetric chestnut bob, almond eyes, peach skin and coral lips.
    const skin = "#edb49f", hair = "#382822";
    box(body, hair, [0, 1.54, -0.15], [1.12, 1.08, 0.61], 0.17);
    ball(body, hair, [0, 1.99, -0.09], [0.56, 0.36, 0.39]);
    ball(body, skin, [0.03, 1.58, 0.12], [0.455, 0.57, 0.365]);
    ball(body, skin, [0.035, 1.3, 0.14], [0.305, 0.3, 0.29]);
    ball(body, skin, [0.51, 1.55, 0.12], [0.115, 0.155, 0.09]);
    ball(body, "#db9e8e", [0.53, 1.55, 0.2], [0.047, 0.081, 0.015]);
    ball(body, skin, [0.025, 1.035, 0], [0.145, 0.25, 0.14]);
    // One continuous swept fringe, with a clear side part and flat bob ends.
    sculpt(body, hair, [0, 0, 0.31], (s) => {
      s.moveTo(0.16, 2.15);
      s.bezierCurveTo(0.03, 2.46, -0.38, 2.33, -0.52, 2.01);
      s.bezierCurveTo(-0.65, 1.75, -0.56, 1.32, -0.55, 1.12);
      s.lineTo(-0.3, 1.1);
      s.bezierCurveTo(-0.33, 1.34, -0.34, 1.57, -0.31, 1.79);
      s.bezierCurveTo(-0.23, 1.96, -0.02, 2.09, 0.16, 2.15);
    }, 0.12, 0.04);
    sculpt(body, "#412e28", [0, 0, 0.3], (s) => {
      s.moveTo(0.15, 2.15);
      s.bezierCurveTo(0.22, 2.33, 0.48, 2.22, 0.53, 1.98);
      s.bezierCurveTo(0.61, 1.8, 0.52, 1.7, 0.46, 1.68);
      s.bezierCurveTo(0.44, 1.87, 0.32, 2.08, 0.15, 2.15);
    }, 0.1, 0.035);
    curve(body, "#574038", [[-0.48, 1.26, 0.46], [-0.49, 1.73, 0.49], [-0.31, 2.1, 0.49], [-0.07, 2.22, 0.44]], 0.012);
    // Almond-shaped whites and brown irises under a curved upper lash line.
    for (const side of [-1, 1]) {
      const eye = new T.Group();
      eye.position.set(0.03 + side * 0.204, 1.66, 0.45);
      eye.rotation.y = side * 0.19;
      body.add(eye);
      sculpt(eye, "#fff9f3", [0, 0, 0], (s) => {
        s.moveTo(-0.139, 0); s.bezierCurveTo(-0.075, 0.12, 0.065, 0.13, 0.139, 0.025);
        s.bezierCurveTo(0.09, -0.105, -0.073, -0.12, -0.139, 0);
      }, 0.012, 0.006);
      ball(eye, "#614438", [0.008, 0, 0.026], [0.085, 0.103, 0.025]);
      ball(eye, "#211b1a", [0.009, 0.005, 0.048], [0.047, 0.071, 0.012]);
      ball(eye, "#fffdf5", [-0.018, 0.047, 0.061], [0.023, 0.029, 0.008]);
      curve(eye, "#30221f", [[-0.14, 0.005, 0.031], [-0.074, 0.087, 0.035], [0.055, 0.092, 0.035], [0.142, 0.024, 0.031]], 0.017);
      curve(eye, "#30221f", [[side * 0.1, 0.069, 0.035], [side * 0.167, 0.092, 0.025]], 0.014);
      curve(body, "#51382f", [[0.03 + side * 0.09, 1.856, 0.435], [0.03 + side * 0.2, 1.89, 0.429], [0.03 + side * 0.31, 1.86, 0.381]], 0.022);
      ball(body, "#eead9f", [0.03 + side * 0.285, 1.435, 0.396], [0.095, 0.05, 0.014]);
    }
    ball(body, "#f2bca7", [0.03, 1.51, 0.478], [0.062, 0.107, 0.054]);
    ball(body, "#f7c9b5", [0.03, 1.47, 0.517], [0.068, 0.046, 0.039]);
    sculpt(body, "#c9655d", [0.03, 1.325, 0.44], (s) => {
      s.moveTo(-0.13, 0.014); s.quadraticCurveTo(-0.06, 0.038, -0.024, 0.044);
      s.lineTo(0, 0.028); s.quadraticCurveTo(0.052, 0.047, 0.125, 0.014);
      s.quadraticCurveTo(0, -0.002, -0.13, 0.014);
    }, 0.016, 0.008);
    sculpt(body, "#ed8d7d", [0.03, 1.322, 0.447], (s) => {
      s.moveTo(-0.12, 0.009); s.quadraticCurveTo(0, -0.015, 0.12, 0.009);
      s.quadraticCurveTo(0.03, -0.074, -0.06, -0.035); s.lineTo(-0.12, 0.009);
    }, 0.018, 0.009);
    // Black round-neck tee echoes the reference portrait, with a playable toy body.
    ball(body, "#202123", [0, 0.81, 0], [0.45, 0.33, 0.28]);
    ball(body, skin, [0.015, 1.065, 0.2], [0.14, 0.05, 0.05]);
    for (const side of [-1, 1]) {
      ball(body, "#202123", [side * 0.41, 0.86, 0], [0.17, 0.18, 0.19]);
      limbs.push(ball(body, skin, [side * 0.48, 0.65, 0.015], [0.105, 0.24, 0.12]));
      limbs.push(box(body, "#303239", [side * 0.2, 0.35, 0], [0.25, 0.4, 0.28], 0.065));
      ball(body, "#ede7df", [side * 0.2, 0.11, 0.085], [0.17, 0.115, 0.23]);
    }
  } else if (c.id === "glm") {
    // Niu Lai meme: orange upright calf, broad pale muzzle, side-eye, dark little horns.
    const hide = material("#ca6c15");
    hide.roughness = 0.57;
    hide.clearcoat = 0.12;
    hide.flatShading = true;
    const low = (pos: number[], scale: number[]) =>
      mesh(body, new T.SphereGeometry(1, 12, 9), hide, pos, scale);
    mesh(
      body,
      new RoundedBoxGeometry(1.12, 1.09, 0.77, 2, 0.2),
      hide,
      [0, 1.47, 0],
    );
    low([0, 0.7, 0], [0.42, 0.49, 0.3]);
    ball(body, "#eac394", [0.04, 1.14, 0.35], [0.5, 0.33, 0.31]);
    ball(body, "#e1bd8d", [0.03, 0.91, 0.36], [0.34, 0.2, 0.2]);
    for (const side of [-1, 1]) {
      const ear = low([side * 0.65, 1.57, 0], [0.31, 0.14, 0.14]);
      ear.rotation.z = side * 0.25;
      ball(body, "#ba7d34", [side * 0.66, 1.58, 0.09], [0.19, 0.075, 0.07]);
      const horn = mesh(
        body,
        new T.ConeGeometry(0.09, 0.2, 7),
        material("#665039"),
        [side * 0.38, 2.03, -0.13],
      );
      horn.rotation.z = -side * 0.32;
      ball(body, "#f5ead2", [side * 0.27, 1.63, 0.37], [0.19, 0.105, 0.08]);
      ball(
        body,
        "#3e3321",
        [side * 0.27 + 0.055, 1.635, 0.439],
        [0.065, 0.077, 0.023],
      );
      const brow = box(
        body,
        "#665039",
        [side * 0.27, 1.79, 0.37],
        [0.32, 0.055, 0.045],
        0.005,
      );
      brow.rotation.z = side * 0.23;
      ball(body, "#a98965", [side * 0.21, 1.19, 0.606], [0.065, 0.043, 0.025]);
      limbs.push(low([side * 0.44, 0.83, 0], [0.13, 0.41, 0.14]));
      limbs.push(low([side * 0.22, 0.26, 0], [0.12, 0.31, 0.14]));
      box(
        body,
        "#796443",
        [side * 0.22, 0.08, 0.06],
        [0.23, 0.17, 0.28],
        0.035,
      );
    }
    curve(
      body,
      "#9b7445",
      [
        [-0.25, 1.005, 0.56],
        [0.02, 0.985, 0.61],
        [0.31, 1.035, 0.54],
      ],
      0.018,
    );
    curve(
      body,
      "#b88131",
      [
        [0.28, 0.52, -0.2],
        [0.54, 0.4, -0.24],
        [0.62, 0.67, -0.22],
      ],
      0.043,
    );
    ball(body, "#795433", [0.63, 0.72, -0.22], [0.09, 0.14, 0.08]);
  } else {
    ball(body, "#343955", [0, 1.38, 0], [0.6, 0.53, 0.46]);
    for (const x of [-0.4, 0.4]) {
      mesh(body, new T.ConeGeometry(0.24, 0.57, 4), material("#343955"), [
        x,
        1.91,
        0,
      ]);
      mesh(body, new T.ConeGeometry(0.13, 0.33, 4), material("#b4adff"), [
        x,
        1.95,
        0.13,
      ]);
    }
    for (const x of [-0.24, 0.24]) {
      ball(body, "#dcd7ff", [x, 1.4, 0.43], [0.11, 0.14, 0.05]);
      ball(body, "#292841", [x, 1.4, 0.48], [0.035, 0.11, 0.02]);
    }
    ball(body, "#b8aeef", [0, 1.2, 0.47], [0.06, 0.045, 0.03]);
    ball(body, "#535677", [0, 0.69, 0], [0.4, 0.45, 0.31]);
    for (const x of [-0.26, 0.26])
      limbs.push(ball(body, "#343955", [x, 0.24, 0.1], [0.2, 0.21, 0.25]));
    for (const x of [-0.48, 0.48])
      limbs.push(ball(body, "#535677", [x, 0.7, 0], [0.17, 0.28, 0.17]));
    curve(
      body,
      "#8f88ba",
      [
        [0.32, 0.55, -0.15],
        [0.8, 0.51, -0.2],
        [0.88, 1.02, -0.15],
        [0.68, 1.13, -0.1],
      ],
      0.095,
    );
    const moon = mesh(
      orbit,
      new T.TorusGeometry(0.3, 0.065, 10, 40, Math.PI * 1.5),
      material("#eee2ff", 0.2, 0.3),
      [-0.82, 1.98, 0],
    );
    moon.rotation.z = 0.5;
    mesh(
      body,
      starShape(),
      material("#ece5ff"),
      [0, 0.78, 0.31],
      [0.11, 0.11, 0.2],
    );
  }
  if (["deepseek", "gemini", "doubao", "gpt"].includes(c.id)) {
    body.traverse((obj) => {
      if (!(obj instanceof T.Mesh) || !(obj.material instanceof T.MeshPhysicalMaterial)) return;
      const source = obj.material;
      // Keep the cat's wet eyes; soften cloth, skin and hair under the arena lights.
      if (source.clearcoat === 1) return;
      if (!softMaterials.has(source)) {
        const soft = source.clone();
        soft.metalness = 0;
        soft.roughness = 0.72;
        soft.clearcoat = 0.06;
        soft.envMapIntensity = 0.25;
        softMaterials.set(source, soft);
      }
      obj.material = softMaterials.get(source)!;
    });
  }
  if (alternate) {
    const tinted = new Map<T.Material, T.MeshPhysicalMaterial>();
    const target = new T.Color(c.color);
    body.traverse((obj) => {
      if (!(obj instanceof T.Mesh) || !(obj.material instanceof T.MeshPhysicalMaterial)) return;
      const source = obj.material;
      if (!tinted.has(source)) {
        const mat = source.clone(), hsl = { h: 0, s: 0, l: 0 };
        source.color.getHSL(hsl);
        // Preserve dark facial details and tiny white eye highlights.
        if (hsl.l > 0.045 && hsl.l < 0.95) {
          mat.color.lerp(target, hsl.s < 0.12 ? 0.5 : 0.72);
          mat.emissive.copy(mat.color);
        }
        tinted.set(source, mat);
      }
      obj.material = tinted.get(source)!;
    });
  }
  limbs.forEach((l) => {
    l.userData.restZ = l.rotation.z;
    l.userData.restPosition = l.position.clone();
  });
  // All toys share the same animated three-quarter fighting stance.
  return {
    root,
    body,
    limbs,
    orbit,
    melee: createMelee(root, body, limbs, c.id, c.color),
    animate(t, speed, attack, hurt, guard) {
      body.position.x = 0;
      body.rotation.y = 0;
      root.getObjectByName(`melee-${c.id}`)!.visible = false;
      body.position.y =
        Math.sin(t * 2.6) * 0.045 +
        Math.abs(Math.sin(t * 10)) * Math.min(Math.abs(speed) * 0.018, 0.09);
      body.rotation.z =
        Math.sin(t * 3) * 0.025 -
        speed * 0.015 +
        Math.sin(attack * Math.PI) * -0.22;
      body.scale.set(1 + attack * 0.07, 1 - attack * 0.06, 1 + attack * 0.03);
      body.rotation.x = guard ? -0.14 : 0;
      limbs.forEach((l, i) => {
        l.position.copy(l.userData.restPosition);
        l.rotation.z = l.userData.restZ;
        l.rotation.x =
          Math.sin(t * (speed ? 11 : 2.5) + i * 2) *
          (0.05 + Math.abs(speed) * 0.065);
      });
      orbit.rotation.y = Math.sin(t * 0.8) * 0.18;
      orbit.position.y = Math.sin(t * 2) * 0.055;
      root.visible = hurt <= 0 || Math.floor(hurt * 24) % 2 === 0;
    },
  };
}
