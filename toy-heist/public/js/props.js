// Decorative playroom set dressing. Nothing here collides or affects gameplay:
// the megastructures all stand outside the arena walls, and the extraction
// chute effects sit on top of zones defined in shared/map.js.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ARENA_SIZE, EXTRACTION_ZONES } from "./shared/map.js";
import { plastic, glow } from "./world.js";
import { markGlow } from "./postfx.js";

const HALF = ARENA_SIZE / 2;
const CHUTE_GREEN = 0x19ff9c;

function canvasTexture(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ------------------------------------------------------------ the bedroom --

function createRoom() {
  const g = new THREE.Group();

  // Wooden floorboards stretching away under the playmat.
  const boards = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = "#5a3d2b";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ["#644531", "#573a28", "#6b4a34", "#5e402d"][i];
      ctx.fillRect(0, i * (s / 4) + 2, s, s / 4 - 4);
    }
  });
  boards.wrapS = boards.wrapT = THREE.RepeatWrapping;
  boards.repeat.set(14, 14);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ map: boards, roughness: 0.75 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  g.add(floor);

  // Far bedroom walls, mostly lost in the night fog.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2f6b, roughness: 0.95 });
  for (const [x, z, ry] of [[0, -230, 0], [0, 230, Math.PI], [-230, 0, Math.PI / 2], [230, 0, -Math.PI / 2]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(520, 160), wallMat);
    wall.position.set(x, 80, z);
    wall.rotation.y = ry;
    g.add(wall);
  }

  // A moonlit window on the north wall: the brightest thing in the room.
  const windowGroup = new THREE.Group();
  windowGroup.position.set(40, 70, -228);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(70, 56), glow(0x9fc4ff, 1.5, { fog: false }));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 32), glow(0xfff6d8, 4, { fog: false }));
  moon.position.set(14, 8, 0.5);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 });
  const bars = [[74, 3, 0, 29.5], [74, 3, 0, -29.5], [3, 60, -36, 0], [3, 60, 36, 0], [3, 56, 0, 0], [70, 2.5, 0, 0]];
  for (const [w, h, x, y] of bars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), frameMat);
    bar.position.set(x, y, 1);
    windowGroup.add(bar);
  }
  windowGroup.add(pane, moon);
  g.add(windowGroup);
  return g;
}

// ------------------------------------------------------- megastructures ----

const LETTER_COLORS = [0xff3b5c, 0x2d9bf0, 0x16db93, 0xffe14d, 0xa259ff, 0xff7a2f];

/** A giant alphabet block: coloured faces with a white inset and a big letter. */
function alphabetBlock(size, letter, colorIndex) {
  const color = LETTER_COLORS[colorIndex % LETTER_COLORS.length];
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  const face = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#fff7e6";
    ctx.fillRect(26, 26, s - 52, s - 52);
    ctx.fillStyle = hex;
    ctx.font = "bold 170px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, s / 2, s / 2 + 10);
  });
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(size, size, size, 3, size * 0.06),
    new THREE.MeshStandardMaterial({ map: face, roughness: 0.45, metalness: 0.03 }),
  );
  return mesh;
}

// Stacks of alphabet blocks towering over the arena walls.
function createBlockTowers() {
  const g = new THREE.Group();
  const towers = [
    { x: -62, z: -58, letters: "TOY", size: 15 },
    { x: 64, z: -30, letters: "HE", size: 17 },
    { x: 60, z: 62, letters: "IST", size: 14 },
    { x: -66, z: 40, letters: "AB", size: 18 },
    { x: 8, z: 70, letters: "C", size: 16 },
  ];
  let n = 0;
  for (const t of towers) {
    [...t.letters].forEach((letter, i) => {
      const block = alphabetBlock(t.size, letter, n++);
      block.position.set(t.x + (i % 2 ? 1.8 : -1.2), t.size / 2 + i * t.size, t.z + (i % 2 ? -1 : 1.4));
      block.rotation.y = 0.35 * (i % 2 ? -1 : 1) + n;
      g.add(block);
    });
  }
  return g;
}

// A ring-stacking toy the size of a lighthouse.
function createRingStacker() {
  const g = new THREE.Group();
  g.position.set(-70, 0, -10);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 2.5, 24), plastic(0xfff7e6));
  base.position.y = 1.25;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 40, 12), plastic(0xfff7e6));
  pole.position.y = 22;
  g.add(base, pole);
  const colors = [0xff3b5c, 0xff7a2f, 0xffe14d, 0x16db93, 0x2d9bf0, 0xa259ff];
  colors.forEach((color, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(11 - i * 1.4, 2.6 - i * 0.2, 10, 28), plastic(color));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 5 + i * 5;
    g.add(ring);
  });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), plastic(0xff5fb7));
  knob.position.y = 43;
  g.add(knob);
  return g;
}

// A beach ball that rolled up against the wall.
function createBall() {
  const stripes = canvasTexture(256, (ctx, s) => {
    const colors = ["#ff3b5c", "#fff7e6", "#2d9bf0", "#fff7e6", "#ffe14d", "#fff7e6"];
    colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect((i * s) / colors.length, 0, s / colors.length + 1, s); });
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(12, 28, 20), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.3 }));
  ball.position.set(66, 12, 18);
  ball.rotation.set(0.5, 0.8, 0.3);
  return ball;
}

// Crayons leaning against the outside of the south wall.
function createCrayons() {
  const g = new THREE.Group();
  const colors = [0x16db93, 0xff3b5c, 0x2d9bf0];
  colors.forEach((color, i) => {
    const crayon = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 30, 10), plastic(color, { roughness: 0.6 }));
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(1.56, 1.56, 12, 10), plastic(0xfff7e6, { roughness: 0.8 }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4.5, 10), plastic(color, { roughness: 0.6 }));
    tip.position.y = 17.2;
    crayon.add(body, wrap, tip);
    crayon.position.set(-34 + i * 9, 13, HALF + 12 + i * 1.5);
    crayon.rotation.set(-0.55 - i * 0.06, 0, 0.12 * (i - 1));
    g.add(crayon);
  });
  return g;
}

// ------------------------------------------------------ extraction chutes --

// Neon tube shader, shared by all chutes and driven by a single `time` uniform:
//   - rim lighting: the tube is brightest where you look along its surface,
//     so it reads as a glass cylinder with glowing edges;
//   - chevrons that stream downwards ("loot goes in here");
//   - a slow brightness pulse travelling down its length.
const TUBE_MATERIAL = markGlow(new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(CHUTE_GREEN) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */`
    uniform float time;
    uniform vec3 color;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      // Neon rim: 0 facing the camera, 1 at the silhouette.
      float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.5);

      // Downward-streaming chevrons: 8 around the tube, V-shaped via |u - 0.5|.
      float u = fract(vUv.x * 8.0);
      float v = fract(vUv.y * 4.0 + time * 0.6 - abs(u - 0.5) * 0.9);
      float chevron = smoothstep(0.0, 0.06, v) * (1.0 - smoothstep(0.16, 0.24, v));

      float pulse = 0.65 + 0.35 * sin(time * 3.0 + vUv.y * 7.0);   // band of light sinking into the hole
      float fade = smoothstep(1.0, 0.55, vUv.y);                   // dissolve towards the top
      gl_FragColor = vec4(color * (rim * 0.75 + chevron * 0.4 + 0.02) * pulse * fade, 1.0);
    }
  `,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
}));

function createChute(zone, rimMat) {
  const g = new THREE.Group();
  g.position.set(zone.x, 0, zone.z);
  const TUBE_H = 16;

  const hole = new THREE.Mesh(new THREE.CircleGeometry(zone.r, 32), new THREE.MeshBasicMaterial({ color: 0x021a12 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.02;

  // Glowing rim on the floor, plus a hoop high above so the chute reads from afar.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(zone.r, 0.14, 8, 40), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(zone.r, 0.22, 8, 40), rimMat);
  hoop.rotation.x = Math.PI / 2;
  hoop.position.y = TUBE_H;

  const tube = new THREE.Mesh(new THREE.CylinderGeometry(zone.r, zone.r, TUBE_H, 32, 1, true), TUBE_MATERIAL);
  tube.position.y = TUBE_H / 2;

  // Rings that sink into the hole in a loop.
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(zone.r * 0.8, 0.07, 6, 32), glow(CHUTE_GREEN, 1.4, { transparent: true }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    rings.push(ring);
  }

  // Green spill light on the floor and on players standing in the zone.
  const light = new THREE.PointLight(CHUTE_GREEN, 60, 16, 1.8);
  light.position.y = 2.5;

  g.add(hole, rim, hoop, tube, light);
  return { group: g, rings, light, height: TUBE_H };
}

// ----------------------------------------------------------------- public --

/** Adds all set dressing to `scene`. Returns { update(time) } for the animated parts. */
export function buildProps(scene) {
  scene.add(createRoom(), createBlockTowers(), createRingStacker(), createBall(), createCrayons());

  const rimMat = glow(CHUTE_GREEN, 1.6);   // shared by every rim and hoop, pulsed below
  const rimBase = rimMat.color.clone();
  const chutes = EXTRACTION_ZONES.map((zone) => createChute(zone, rimMat));
  for (const chute of chutes) scene.add(chute.group);

  return {
    /** time in milliseconds. */
    update(time) {
      const t = time * 0.001;
      TUBE_MATERIAL.uniforms.time.value = t;                    // drives rim pulse + chevron flow in the shader
      rimMat.color.copy(rimBase).multiplyScalar(0.8 + 0.3 * Math.sin(t * 3));   // neon rims breathe in step
      chutes.forEach((chute, n) => {
        chute.light.intensity = 50 + Math.sin(t * 3 + n) * 14;
        chute.rings.forEach((ring, i) => {
          const k = (t * 0.35 + i / chute.rings.length + n * 0.2) % 1;   // 0 = top, 1 = floor
          ring.position.y = (1 - k) * (chute.height * 0.6);
          ring.scale.setScalar(1 - k * 0.5);
          ring.material.opacity = Math.sin(k * Math.PI);
        });
      });
    },
  };
}
