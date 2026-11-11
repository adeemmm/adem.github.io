// Post-processing: selective bloom, a light colour grade with a vignette, then
// tone mapping + sRGB output.
//
// Selective bloom: only materials tagged `userData.glow` (see markGlow) feed
// the bloom. Each frame the scene is drawn a second time at half resolution
// with every other object swapped to flat black, so glowing things are still
// correctly hidden behind walls, but a brightly lit toy block can never bloom
// no matter how saturated it is. That black-out image is blurred and added on
// top of the normal render.
//
// Quality is adaptive: if the frame rate stays under LOW_FPS for
// LOW_FPS_SECONDS, every effect here (the extra scene pass included) switches
// off and the game falls back to plain forward rendering. P toggles by hand.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const STORAGE_KEY = "heist-postfx";
const LOW_FPS = 40;            // below this...
const LOW_FPS_SECONDS = 4;     // ...for this long, effects are switched off
const BLOOM_SCALE = 0.5;       // bloom source is rendered at half resolution

/** Tag a material as a light source for the bloom pass. Returns the material. */
export function markGlow(material) {
  material.userData.glow = true;
  return material;
}

const DARK = new THREE.MeshBasicMaterial({ color: 0x000000 });
const BLACK = new THREE.Color(0x000000);

// Adds the blurred glow image over the normal render.
const CompositeShader = {
  uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, intensity: { value: 1.0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
      // Soft-clip the glow so a light source that fills the screen (standing
      // inside a chute) saturates gently instead of whiting everything out.
      vec3 glow = texture2D(tBloom, vUv).rgb * intensity;
      glow = glow / (1.0 + glow * 0.9);
      gl_FragColor = texture2D(tDiffuse, vUv) + vec4(glow, 0.0);
    }
  `,
};

// Saturation, contrast and vignette in linear HDR, before tone mapping.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.14 },
    contrast: { value: 1.05 },
    vignette: { value: 0.34 },
  },
  vertexShader: CompositeShader.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation, contrast, vignette;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float luma = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 color = mix(vec3(luma), texel.rgb, saturation);
      color = (color - 0.18) * contrast + 0.18;          // pivot on mid grey
      vec2 d = vUv - 0.5;
      color *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.0);
      gl_FragColor = vec4(max(color, 0.0), texel.a);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.lowTime = 0;
    this.auto = true;           // adaptive quality still allowed to turn effects off
    this.autoDisabled = false;  // true once the adaptive fallback has fired
    this.enabled = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) { this.enabled = saved === "1"; this.auto = false; }   // respect an explicit choice
    } catch { /* storage unavailable */ }

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());

    // 1. Glow-only image -> blur. Not drawn to the screen.
    const bloomTarget = new THREE.WebGLRenderTarget(size.x * BLOOM_SCALE, size.y * BLOOM_SCALE, { type: THREE.HalfFloatType });
    this.bloomComposer = new EffectComposer(renderer, bloomTarget);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(scene, camera));
    // Threshold 0: everything that survives the black-out is meant to glow.
    // Strength and radius are deliberately modest: a tight halo around light
    // sources, not a haze over the whole frame.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * BLOOM_SCALE, size.y * BLOOM_SCALE), 0.32, 0.3, 0.0);
    this.bloomComposer.addPass(this.bloom);

    // 2. Normal render (HDR, MSAA) + glow -> grade -> tone map.
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composite = new ShaderPass(CompositeShader);
    this.composite.uniforms.tBloom.value = this.bloomComposer.renderTarget2.texture;
    this.composer.addPass(this.composite);
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());

    // Scratch state for the black-out pass (reused every frame: no garbage).
    this.swapped = [];      // [object, originalMaterial, object, originalMaterial, ...]
    this.hidden = [];       // objects temporarily made invisible
    this.savedBackground = new THREE.Color();
    this.savedFog = new THREE.Color();
    this.blackOut = (object) => this.blackOutObject(object);
  }

  setSize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bloomComposer.setPixelRatio(pixelRatio * BLOOM_SCALE);
    this.bloomComposer.setSize(width, height);
  }

  /** Manual toggle (P). Returns the new state and stops the automatic downgrade. */
  toggle() {
    this.enabled = !this.enabled;
    this.auto = false;
    try { localStorage.setItem(STORAGE_KEY, this.enabled ? "1" : "0"); } catch { /* storage unavailable */ }
    return this.enabled;
  }

  /** Draw the frame. `fps` is the smoothed frame rate, used for adaptive quality. */
  render(dt, fps) {
    if (this.enabled && this.auto) {
      this.lowTime = fps < LOW_FPS ? this.lowTime + dt : 0;
      if (this.lowTime > LOW_FPS_SECONDS) { this.enabled = false; this.autoDisabled = true; }
    }
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);   // fallback: no extra passes at all
      return;
    }
    this.renderGlow(dt);
    this.composer.render(dt);
  }

  // ------------------------------------------------------------ internals --

  /** Render only the glowing materials (everything else black) and blur the result. */
  renderGlow(dt) {
    const { scene, renderer } = this;

    scene.traverse(this.blackOut);
    // Black background and black fog: distant glows still fade with the fog,
    // but the fog colour itself contributes nothing to the bloom.
    const background = scene.background, fog = scene.fog;
    if (background && background.isColor) { this.savedBackground.copy(background); background.copy(BLACK); }
    if (fog) { this.savedFog.copy(fog.color); fog.color.copy(BLACK); }
    const shadowUpdates = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;   // nothing lit in this pass: skip the shadow maps

    this.bloomComposer.render(dt);

    renderer.shadowMap.autoUpdate = shadowUpdates;
    if (fog) fog.color.copy(this.savedFog);
    if (background && background.isColor) background.copy(this.savedBackground);
    for (let i = 0; i < this.swapped.length; i += 2) this.swapped[i].material = this.swapped[i + 1];
    for (let i = 0; i < this.hidden.length; i++) this.hidden[i].visible = true;
    this.swapped.length = 0;
    this.hidden.length = 0;
  }

  blackOutObject(object) {
    if (object.isSprite) { this.hide(object); return; }   // name tags and signs never glow
    if (!(object.isMesh || object.isPoints || object.isLine)) return;
    const material = object.material;
    if (!material || Array.isArray(material) || material.userData.glow) return;
    // See-through non-glow surfaces must not block the glow behind them.
    if (material.transparent) { this.hide(object); return; }
    this.swapped.push(object, material);
    object.material = DARK;
  }

  hide(object) {
    if (!object.visible) return;
    object.visible = false;
    this.hidden.push(object);
  }
}
