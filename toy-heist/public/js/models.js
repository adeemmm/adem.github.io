// Low-poly placeholder characters. Both models are built with their origin at
// the feet and their front facing -Z, matching the shared movement code's yaw
// convention, so `group.rotation.y = body.yaw` is all the orientation needed.
import * as THREE from "three";
import { ROLE_STATS, ROLE_GUARD, ROLE_TOY, VISION_RANGE, VISION_HALF_ANGLE } from "./shared/constants.js";
import { DEFAULT_TOY_SKIN, DEFAULT_GUARD_SKIN } from "./shared/cosmetics.js";

// Saturated toy-box colours; faceted low-poly shading with a glossy plastic finish.
const TOY_COLORS = [0xff3b5c, 0xffc531, 0x16db93, 0x18d6ff, 0xff7a2f, 0xd13bff, 0x8ee53f, 0xff5fb7];
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.05, flatShading: true, ...extra });

// Flashlight beam: a cone that is brightest along its axis, fades towards its
// silhouette and along its length, so it reads as light scattering in dusty
// air instead of a flat transparent shape. Shared by every guard.
const BEAM_MATERIAL = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(0xfff0a8) }, strength: { value: 0.55 } },
  vertexShader: /* glsl */`
    uniform float beamLength;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vAlong;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      vAlong = clamp(-position.z / beamLength, 0.0, 1.0);   // 0 at the lens, 1 at the far end
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform float strength;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vAlong;
    void main() {
      float facing = abs(dot(normalize(vNormal), normalize(vView)));   // 1 looking through the middle, 0 at the edge
      float core = pow(facing, 2.2);
      float falloff = pow(1.0 - vAlong, 1.6) * smoothstep(0.0, 0.04, vAlong);
      gl_FragColor = vec4(color * strength * core * falloff, 1.0);
    }
  `,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
});
BEAM_MATERIAL.uniforms.beamLength = { value: VISION_RANGE };
BEAM_MATERIAL.userData.shared = true;   // never disposed with an individual model

function shadowed(mesh) { mesh.castShadow = true; return mesh; }

// ------------------------------------------------------------- toy skins --

const GLINT_GEO = new THREE.SphereGeometry(0.028, 5, 4);
const GLINT_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
GLINT_MAT.userData.shared = true;

function addEyes(g, height, radius, mat) {
  const eyeGeo = new THREE.SphereGeometry(0.09, 6, 4);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, mat);
    eye.position.set(side * 0.15, height * 0.72, -radius * 0.88);
    const glint = new THREE.Mesh(GLINT_GEO, GLINT_MAT);   // tiny highlight: makes the eyes read at a distance
    glint.position.set(side * 0.15 + 0.03, height * 0.72 + 0.035, -radius * 0.88 - 0.075);
    g.add(eye, glint);
  }
}

// Wind-up key on the back (+Z), shared by every toy skin.
function addWindUpKey(g, height, radius) {
  const keyMat = flat(0xdddddd, { metalness: 0.6, roughness: 0.3 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), keyMat);
  stem.rotation.x = Math.PI / 2;
  stem.position.set(0, height * 0.5, radius + 0.12);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 4, 8), keyMat);
  handle.position.set(0, height * 0.5, radius + 0.3);
  handle.rotation.y = Math.PI / 2;
  g.add(stem, handle);
}

function capsuleBody(g, height, radius, material) {
  const body = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(radius, height - radius * 2, 3, 8), material));
  body.position.y = height / 2;
  g.add(body);
}

const TOY_BUILDERS = {
  // Default Capsule: a chunky capsule in one of eight colours.
  default(g, height, radius, nid) {
    capsuleBody(g, height, radius, flat(TOY_COLORS[nid % TOY_COLORS.length]));
    addEyes(g, height, radius, flat(0x111111));
  },

  // Party Hat Toy: the capsule plus a striped cone hat and pom-pom.
  party_hat(g, height, radius, nid) {
    TOY_BUILDERS.default(g, height, radius, nid);
    const hat = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 8), flat(0xff4fa3)));
    hat.position.y = height + 0.2;
    g.add(hat);
    for (const [y, r] of [[height + 0.05, 0.2], [height + 0.24, 0.12]]) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 4, 10), flat(0xfff275));
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = y;
      g.add(stripe);
    }
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), flat(0xffffff));
    pom.position.y = height + 0.5;
    g.add(pom);
  },

  // Robot Toy: boxy metal chassis, glowing visor, antenna.
  robot(g, height, radius) {
    const metal = flat(0xb4c1d1, { metalness: 0.3, roughness: 0.4 });
    const chassis = shadowed(new THREE.Mesh(new THREE.BoxGeometry(radius * 1.7, height * 0.55, radius * 1.5), metal));
    chassis.position.y = height * 0.3;
    const head = shadowed(new THREE.Mesh(new THREE.BoxGeometry(radius * 1.4, height * 0.36, radius * 1.3), metal));
    head.position.y = height * 0.8;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.1, 0.12, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x4df3ff }),
    );
    visor.position.set(0, height * 0.82, -radius * 0.66);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.8, 0.22, 0.04), flat(0x2b3440));
    panel.position.set(0, height * 0.32, -radius * 0.76);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff5252 }));
    light.position.set(-0.1, height * 0.34, -radius * 0.78);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 4), flat(0x2b3440));
    antenna.position.y = height + 0.14;
    const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: 0xff5252 }));
    bulb.position.y = height + 0.32;
    g.add(chassis, head, visor, panel, light, antenna, bulb);
  },

  // Royal Toy: polished gold capsule wearing a crown.
  royal(g, height, radius) {
    // (Low metalness on purpose: with no environment map, a fully metallic surface renders nearly black.)
    const gold = flat(0xffc933, { metalness: 0.3, roughness: 0.35, emissive: 0x6b4a00 });
    capsuleBody(g, height, radius, gold);
    addEyes(g, height, radius, flat(0x3a1d5c));
    const band = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.14, 8, 1, true), flat(0xffb300, { metalness: 0.3, roughness: 0.3, emissive: 0x7a5200, side: THREE.DoubleSide })));
    band.position.y = height + 0.02;
    g.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), band.material);
      spike.position.set(Math.cos(a) * 0.25, height + 0.17, Math.sin(a) * 0.25);
      const jewel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: 0xff2e63 }));
      jewel.position.set(Math.cos(a) * 0.27, height + 0.03, Math.sin(a) * 0.27);
      g.add(spike, jewel);
    }
  },
};

/** Stylized toy runner. `skin` picks the mesh variant (see shared/cosmetics.js). */
export function createToyModel(nid = 0, skin = DEFAULT_TOY_SKIN) {
  const { radius, height } = ROLE_STATS[ROLE_TOY];
  const g = new THREE.Group();
  (TOY_BUILDERS[skin] || TOY_BUILDERS.default)(g, height, radius, nid);
  addWindUpKey(g, height, radius);
  g.userData.skin = TOY_BUILDERS[skin] ? skin : DEFAULT_TOY_SKIN;
  return g;
}

// ----------------------------------------------------------- guard skins --

const GUARD_PALETTES = {
  guard_default: { uniform: 0x1d3557, cap: 0x0b1d33, badge: 0xffd166, metal: 0 },
  gold_guard:    { uniform: 0xe6b422, cap: 0xffd84d, badge: 0xffffff, metal: 0.3 },
};

/** Guard: taller, bulkier, with a cap and a flashlight (visible cone + real spotlight). */
export function createGuardModel(skin = DEFAULT_GUARD_SKIN) {
  const { radius, height } = ROLE_STATS[ROLE_GUARD];
  const palette = GUARD_PALETTES[skin] || GUARD_PALETTES.guard_default;
  const shiny = palette.metal ? { metalness: palette.metal, roughness: 0.35, emissive: 0x6b4a00 } : {};
  const g = new THREE.Group();
  g.userData.skin = GUARD_PALETTES[skin] ? skin : DEFAULT_GUARD_SKIN;

  const torso = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, height * 0.7, 8), flat(palette.uniform, shiny)));
  torso.position.y = height * 0.35;
  const head = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.6, 0), flat(0xf1c9a5)));
  head.position.y = height * 0.84;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.66, 0.2, 8), flat(palette.cap, shiny));
  cap.position.y = height * 0.98;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.0, 0.06, radius * 0.6), flat(palette.cap, shiny));
  brim.position.set(0, height * 0.92, -radius * 0.7);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.04), flat(palette.badge, { emissive: 0x7a5c00 }));
  badge.position.set(-0.22, height * 0.55, -radius * 0.9);
  g.add(torso, head, cap, brim, badge);

  if (palette.metal) {   // Gold Guard extras: epaulettes and a star on the cap
    for (const side of [-1, 1]) {
      const epaulette = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.34), flat(0xffffff, { metalness: 0.6, roughness: 0.3 }));
      epaulette.position.set(side * radius * 0.78, height * 0.7, 0);
      g.add(epaulette);
    }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    star.position.set(0, height * 1.0, -radius * 0.66);
    g.add(star);
  }

  // Flashlight, held at chest height pointing forward and slightly down.
  const torch = new THREE.Group();
  torch.position.set(radius * 0.75, height * 0.5, -radius * 0.7);
  torch.rotation.x = -0.14;

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.45, 6), flat(0x333333));
  barrel.rotation.x = Math.PI / 2;
  // A hot lens disc: bright enough to bloom, so you can spot a guard's torch across the room.
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a8).multiplyScalar(4) }));
  lens.position.z = -0.24;
  lens.rotation.y = Math.PI;
  torch.add(barrel, lens);

  // The visible beam matches the server's detection cone (VisionSystem.js).
  const CONE_LEN = VISION_RANGE, CONE_ANGLE = VISION_HALF_ANGLE;
  const coneGeo = new THREE.ConeGeometry(Math.tan(CONE_ANGLE) * CONE_LEN, CONE_LEN, 16, 1, true);
  coneGeo.translate(0, -CONE_LEN / 2, 0);   // apex at origin
  coneGeo.rotateX(Math.PI / 2);             // open towards -Z
  const cone = new THREE.Mesh(coneGeo, BEAM_MATERIAL);
  cone.position.z = -0.25;
  cone.userData.beam = true;   // lets previews hide the beam
  torch.add(cone);

  const light = new THREE.SpotLight(0xfff0a8, 420, CONE_LEN * 1.6, CONE_ANGLE, 0.45, 1.5);
  light.shadow.mapSize.set(512, 512);   // only used if the owner enables castShadow (local guard)
  light.shadow.bias = -0.002;
  g.userData.flashlight = light;
  light.position.z = -0.25;
  light.target.position.set(0, 0, -CONE_LEN);
  torch.add(light, light.target);

  g.add(torch);
  return g;
}

/** Build the avatar for a role wearing `skin` (a skin id valid for that role). */
export function createPlayerModel(role, nid, skin) {
  return role === ROLE_GUARD ? createGuardModel(skin) : createToyModel(nid, skin);
}

/** Floating name tag sprite. */
export function createNameTag(text, role) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,.75)";
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = role === ROLE_GUARD ? "#ff8fa3" : "#ffffff";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(3, 0.75, 1);
  sprite.position.y = ROLE_STATS[role].height + 0.6;
  return sprite;
}

export function disposeModel(root) {
  root.traverse((o) => {
    if (o.geometry && o.geometry !== GLINT_GEO) o.geometry.dispose();
    if (o.material && !o.material.userData.shared) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
}
