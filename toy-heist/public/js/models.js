// Low-poly placeholder characters. Both models are built with their origin at
// the feet and their front facing -Z, matching the shared movement code's yaw
// convention, so `group.rotation.y = body.yaw` is all the orientation needed.
import * as THREE from "three";
import { ROLE_STATS, ROLE_GUARD, ROLE_TOY, VISION_RANGE, VISION_HALF_ANGLE } from "./shared/constants.js";

const TOY_COLORS = [0xef476f, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf78c6b, 0xb5179e, 0x90be6d, 0xf9c74f];
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...extra });

function shadowed(mesh) { mesh.castShadow = true; return mesh; }

/** Stylized toy runner: a chunky capsule with eyes and a wind-up key. */
export function createToyModel(nid = 0) {
  const { radius, height } = ROLE_STATS[ROLE_TOY];
  const g = new THREE.Group();

  const body = shadowed(new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, height - radius * 2, 3, 8),
    flat(TOY_COLORS[nid % TOY_COLORS.length]),
  ));
  body.position.y = height / 2;
  g.add(body);

  const eyeGeo = new THREE.SphereGeometry(0.09, 6, 4);
  const eyeMat = flat(0x111111);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.15, height * 0.72, -radius * 0.88);
    g.add(eye);
  }

  // Wind-up key on the back (+Z)
  const keyMat = flat(0xdddddd, { metalness: 0.6, roughness: 0.3 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), keyMat);
  stem.rotation.x = Math.PI / 2;
  stem.position.set(0, height * 0.5, radius + 0.12);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 4, 8), keyMat);
  handle.position.set(0, height * 0.5, radius + 0.3);
  handle.rotation.y = Math.PI / 2;
  g.add(stem, handle);

  return g;
}

/** Guard: taller, bulkier, with a cap and a flashlight (visible cone + real spotlight). */
export function createGuardModel() {
  const { radius, height } = ROLE_STATS[ROLE_GUARD];
  const g = new THREE.Group();

  const torso = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, height * 0.7, 8), flat(0x1d3557)));
  torso.position.y = height * 0.35;
  const head = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.6, 0), flat(0xf1c9a5)));
  head.position.y = height * 0.84;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.66, 0.2, 8), flat(0x0b1d33));
  cap.position.y = height * 0.98;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.0, 0.06, radius * 0.6), flat(0x0b1d33));
  brim.position.set(0, height * 0.92, -radius * 0.7);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.04), flat(0xffd166, { emissive: 0x7a5c00 }));
  badge.position.set(-0.22, height * 0.55, -radius * 0.9);
  g.add(torso, head, cap, brim, badge);

  // Flashlight, held at chest height pointing forward and slightly down.
  const torch = new THREE.Group();
  torch.position.set(radius * 0.75, height * 0.5, -radius * 0.7);
  torch.rotation.x = -0.14;

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.45, 6), flat(0x333333));
  barrel.rotation.x = Math.PI / 2;
  torch.add(barrel);

  // The visible beam matches the server's detection cone (VisionSystem.js).
  const CONE_LEN = VISION_RANGE, CONE_ANGLE = VISION_HALF_ANGLE;
  const coneGeo = new THREE.ConeGeometry(Math.tan(CONE_ANGLE) * CONE_LEN, CONE_LEN, 16, 1, true);
  coneGeo.translate(0, -CONE_LEN / 2, 0);   // apex at origin
  coneGeo.rotateX(Math.PI / 2);             // open towards -Z
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xfff3b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  cone.position.z = -0.25;
  torch.add(cone);

  const light = new THREE.SpotLight(0xfff3b0, 400, CONE_LEN * 1.6, CONE_ANGLE, 0.35, 1.6);
  light.position.z = -0.25;
  light.target.position.set(0, 0, -CONE_LEN);
  torch.add(light, light.target);

  g.add(torch);
  return g;
}

export function createPlayerModel(role, nid) {
  return role === ROLE_GUARD ? createGuardModel() : createToyModel(nid);
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
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
}
