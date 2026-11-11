// Post-processing: bloom (so glow materials and flashlights actually glow),
// a light colour grade with a vignette, then tone mapping + sRGB output.
//
// Quality is adaptive: if the frame rate stays low the effects switch
// themselves off and the game falls back to plain forward rendering, so weak
// GPUs keep their frame rate. P toggles it by hand.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const STORAGE_KEY = "heist-postfx";
const LOW_FPS = 40;            // below this...
const LOW_FPS_SECONDS = 4;     // ...for this long, effects are switched off

// Saturation, contrast and vignette in linear HDR, before tone mapping.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.14 },
    contrast: { value: 1.05 },
    vignette: { value: 0.32 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
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
    this.auto = true;         // adaptive quality still allowed to turn effects off
    this.enabled = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) { this.enabled = saved === "1"; this.auto = false; }   // respect an explicit choice
    } catch { /* storage unavailable */ }

    // HDR target with MSAA, so bloom has headroom and edges stay anti-aliased.
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    // Bloom at half resolution: threshold above 1.0 means only "glow" materials
    // and hot highlights bleed, not ordinary lit surfaces.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.65, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());
  }

  setSize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
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
    if (this.enabled) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
