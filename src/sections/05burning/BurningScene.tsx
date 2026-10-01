import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { GLSL3, Vector2, type ShaderMaterial } from "three"

/* ════════════════════════════════════════════════════════════════════
   "burning" — a 3D FBM noise field with domain warping, converted from
   the standalone WebGL2 page (burning.html) into an R3F scene.

   The pipeline, per pixel:
     1. Domain warping — a 2D FBM displaces the UVs fed into a 3D FBM.
     2. fbm3 — 7 octaves of 3D gradient noise, absolute-valued, with
        a slow morph phase (time as the Z axis).
     3. paletteLookup — maps the result through an 110-step amber->black
        ramp -> warm, ember-like tones.

   Conversion notes:
     - glslVersion={GLSL3} on the material: the shader uses WebGL2-only
       features (dynamic indexing into PALETTE).
     - The vertex shader writes clip coords directly (2x2 plane).
     - The pattern lives in a fixed 640x360 space. winToPattern maps
       window pixels into it with a uniform "cover" scale.
     - Pixelation is replicated by snapping to the cell grid in pattern
       space (the original rendered a 640x360 buffer CSS-upscaled with
       image-rendering: pixelated).
     - main() calls shade() directly — the original mainImage's coordinate
       math assumed iResolution was the canvas size, which breaks in R3F.

   The dials live in the const/#define block at the top of the fragment
   shader. hover* is live (the cursor morphs the field); click* is off
   until you wire up clicks.
   ════════════════════════════════════════════════════════════════════ */

// ── The vertex shader ──────────────────────────────────────────────
// A 2x2 plane spans clip space exactly (-1..1), so writing position.xy
// straight into gl_Position covers the screen with no camera math.
const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// ── The fragment shader ────────────────────────────────────────────
// The original shader body, minus the #version/precision lines that
// three.js now supplies. main() maps gl_FragCoord into pattern space,
// snaps to the cell grid for pixelation, then calls shade() directly.
const fragmentShader = /* glsl */ `
uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;
out vec4 oColor;

#define uResolution iResolution.xy
#define uTime iTime
// Map window pixels (bottom-left origin) into the fixed 640x360 pattern
// space with a uniform "cover" scale — the same transform mainImage uses,
// so pattern and mouse stay proportioned together at any window size.
vec2 winToPattern(vec2 w) {
  float s = max(iResolution.x / 640.0, iResolution.y / 360.0);
  return (w - iResolution.xy * 0.5) / s + vec2(640.0, 360.0) * 0.5;
}
// iMouse is bottom-left origin pixels. Map through winToPattern (same as
// pixels), then flip to top-left origin for shade().
vec2 mousePattern() {
  vec2 pm = winToPattern(iMouse);
  return vec2(pm.x, 360.0 - pm.y);
}
#define mousePos mousePattern()

const vec2 clickPos[8] = vec2[8](vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0));
const float clickAge[8] = float[8](1e6,1e6,1e6,1e6,1e6,1e6,1e6,1e6);
#define time uTime
const float noiseScale = 1.0;
#define screenSize vec2(640.0, 360.0)
#define sampleOffset vec2(0.0)
#define renderSize vec2(640.0, 360.0)
const float cellSize = 3.0;
const float octaves = 7.0;
const float gain = 0.8;

#define morphPhase (uTime*0.12)
#define scrollSpeed vec2(-0.15, 0.15)
const vec2 loopD = vec2(0.0, 0.0);
const float loopZ = 0.0;

const float hoverEnable = 1.0;
const float hoverTarget = 1.0;
const float hoverStrength = 0.5;
const float hoverRadius = 50.0;
const float hoverFalloff = 1.0;
const float hoverScatter = 0.8;
const float hoverDragOnly = 0.0;
const vec2 dragVec = vec2(0.0);
const float dragActive = 0.0;
const float clickEnable = 0.0;
const float clickTarget = 0.0;
const float clickStrength = 0.5;
const float clickRadius = 80.0;
const float clickDecay = 1.0;
const float clickFalloff = 0.5;
const float warpStrength = 0.2;
const float warpScale = 3.0;
const float pinchStrength = 0.0;
#define warpPhase (uTime*0.0)
const float rotate = 315.0;

const vec4 PALETTE[110] = vec4[110](
  vec4(1.0,0.553917,0.0,1.0),
  vec4(1.0,0.557118,0.0,1.0),
  vec4(1.0,0.563755,0.0,1.0),
  vec4(1.0,0.573865,0.0,1.0),
  vec4(1.0,0.586962,0.0,1.0),
  vec4(1.0,0.602311,0.0,1.0),
  vec4(1.0,0.652691,0.0,1.0),
  vec4(1.0,0.757083,0.241558,1.0),
  vec4(1.0,0.87232,0.558065,1.0),
  vec4(1.0,0.979142,0.862557,1.0),
  vec4(0.914005,0.951902,0.982278,1.0),
  vec4(0.844573,0.907846,0.982278,1.0),
  vec4(0.916047,0.96208,0.982278,1.0),
  vec4(1.0,0.995158,0.858978,1.0),
  vec4(1.0,0.894196,0.556585,1.0),
  vec4(1.0,0.783841,0.249986,1.0),
  vec4(1.0,0.684087,0.00590009,1.0),
  vec4(1.0,0.615293,0.0,1.0),
  vec4(1.0,0.587761,0.0,1.0),
  vec4(1.0,0.560092,0.0,1.0),
  vec4(1.0,0.557516,0.0,1.0),
  vec4(1.0,0.554551,0.0,1.0),
  vec4(1.0,0.551109,0.0,1.0),
  vec4(1.0,0.54706,0.0,1.0),
  vec4(1.0,0.542233,0.0,1.0),
  vec4(1.0,0.536374,0.0,1.0),
  vec4(1.0,0.529113,0.0,1.0),
  vec4(1.0,0.519886,0.0,1.0),
  vec4(1.0,0.507758,0.0,1.0),
  vec4(1.0,0.491119,0.0,1.0),
  vec4(1.0,0.466862,0.0,1.0),
  vec4(1.0,0.428217,0.0,1.0),
  vec4(1.0,0.356976,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0),
  vec4(1.0,0.181819,0.0,1.0)
);
vec4 paletteLookup(float x){
  int i = clamp(int(clamp(x,0.0,1.0)*256.0),0,255);
  return PALETTE[clamp(int(float(i)/255.0*110.0),0,109)];
}

#define TAU 6.28318530718
#define MAX_OCTAVES 10

#define MAX_CLICKS 8

#define MORPH_AMT   2.0
#define ZOOM_AMT    1.0
#define REPEL_AMT   0.3
#define SCATTER_FREQ 60.0

vec2 frameC(vec2 uv) {
    vec2 r = renderSize;
    return (uv - 0.5) * screenSize / r.y;
}
vec2 frameUV(vec2 c) {
    vec2 r = renderSize;
    return 0.5 + c * r.y / screenSize;
}

vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return -1.0 + 2.0 * fract((p.xxy + p.yxx) * p.zyx);
}

float gnoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0)),
                dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
            mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)),
                dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
        mix(mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)),
                dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
            mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)),
                dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y),
        u.z);
}

float basisSample(vec3 p, vec2 d, float pz) {
    
    return gnoise3(p);
}

float fbm3(vec3 p) {
    float v = 0.0, a = 0.5, norm = 0.0;
    vec2  d  = loopD;
    float pz = loopZ;
    int oct = int(octaves + 0.5);
    for (int i = 0; i < MAX_OCTAVES; i++) {
        if (i >= oct) break;
        float sn = basisSample(p, d, pz);
        float t;
        {
            t = abs(sn);
        }
        v    += a * t;
        norm += a;
        p     = p * 2.0 + vec3(5.3, 1.7, 3.1);
        d    *= 2.0;
        pz   *= 2.0;
        a    *= gain;
    }
    return v / norm;
}

#define DOMAIN_AMP  0.35
#define PINCH_R     0.8
#define PINCH_K     0.9
#define PINCH_PULSE 0.5

float whash2(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * 43.32);
}
float wnoise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(whash2(i + vec2(0.0, 0.0)), whash2(i + vec2(1.0, 0.0)), u.x),
               mix(whash2(i + vec2(0.0, 1.0)), whash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float wfbm2(vec2 p) {
    float v = 0.0, a = 0.5, norm = 0.0;
    for (int i = 0; i < 3; i++) {
        v += a * (wnoise2(p) * 2.0 - 1.0);
        norm += a; p = p * 2.0 + vec2(5.3, 1.7); a *= 0.5;
    }
    return v / norm;
}

vec2 warpField(vec2 uv) {
    vec2 fp = vec2(warpPhase);
    
    return vec2(wfbm2(uv * warpScale + fp), wfbm2(uv * warpScale + fp + vec2(31.4, 17.7)));
}
vec2 warpUV(vec2 uv) {
    
    {
        vec2 q = warpField(uv);
        return uv + warpStrength * DOMAIN_AMP * warpField(uv + warpStrength * q);
    }
    vec2  c   = frameC(uv);
    float r   = length(c);
    if (r > 1e-5) {
        float k  = pinchStrength * (1.0 + PINCH_PULSE * sin(warpPhase * TAU));
        float rn = min(r / PINCH_R, 1.0);
        float factor;
        if (k >= 0.0) {
            factor = pow(rn, k * PINCH_K);
        } else {
            factor = 1.0 + (-k) * PINCH_K * (1.0 - rn * rn); 
        }
        c *= factor;
    }
    return frameUV(c);
}

vec2 rotateUV(vec2 uv) {
    
    float ang = rotate * TAU / 360.0;
    float asp = screenSize.x / screenSize.y;
    vec2  c   = (uv - 0.5) * vec2(asp, 1.0);
    float s = sin(ang), co = cos(ang);
    c = mat2(co, -s, s, co) * c;
    return 0.5 + c / vec2(asp, 1.0);
}

float fieldN(vec2 uv, float mzExtra) {
    float mz = morphPhase + mzExtra;

    vec2 nsv = vec2(noiseScale);
    return fbm3(vec3(uv * nsv + time * scrollSpeed, mz));
}

float inflMask(vec2 block, vec2 uv, vec2 center, float radius, float falloff, float scatter) {
    float d     = length(block - center);
    float inner = radius * (1.0 - falloff);
    float m     = 1.0 - smoothstep(inner, max(radius, inner + 0.5), d);
    if (scatter > 0.001) m *= mix(1.0, wnoise2(uv * SCATTER_FREQ), scatter);
    return m;
}

float clickRingMask(vec2 block, vec2 uv) {
    float thick = clickRadius * mix(0.06, 0.5, clickFalloff) + 0.5;
    float acc = 0.0;
    for (int i = 0; i < MAX_CLICKS; i++) {
        float life = clickAge[i] / max(clickDecay, 0.05);
        if (life >= 1.0) continue;
        float d     = length(block - clickPos[i]);
        float ringR = clickRadius * life;
        acc += (1.0 - smoothstep(0.0, thick, abs(d - ringR))) * (1.0 - life);
    }
    
    return acc;
}

void route(float target, float amp, vec2 uv, vec2 centerUV, vec2 smearPx,
           inout float mzAdd, inout float valAdd, inout vec2 uvDisp) {
    if (target < 0.5) {
        valAdd += amp;
    } else if (target < 1.5) {
        mzAdd += amp * MORPH_AMT;
    } else if (target < 2.5) {
        uvDisp += (uv - centerUV) * amp * ZOOM_AMT;
    } else {
        vec2 dir = (length(smearPx) > 1e-4) ? smearPx / screenSize : (uv - centerUV);
        float L = length(dir);

        if (L > 1e-5) uvDisp -= (dir / L) * amp * REPEL_AMT;
    }
}

vec4 shade(vec2 screen_coords) {
    vec2 block = floor((screen_coords + sampleOffset) / cellSize) * cellSize;
    vec2 uv0   = warpUV(block / screenSize);

    float mzAdd = 0.0, valAdd = 0.0;
    vec2  uvDisp = vec2(0.0);
    float hgate  = hoverEnable * ((hoverDragOnly > 0.5) ? dragActive : 1.0);
    vec2  hsmear = (hoverDragOnly > 0.5) ? dragVec : vec2(0.0);
    float mH = hgate * inflMask(block, uv0, mousePos, hoverRadius, hoverFalloff, hoverScatter);
    route(hoverTarget, hoverStrength * mH, uv0, mousePos / screenSize, hsmear,
          mzAdd, valAdd, uvDisp);
    float mC = clickRingMask(block, uv0);
    vec2  clickCenter = clickPos[0];
    float freshest = clickAge[0];
    for (int i = 1; i < MAX_CLICKS; i++) {
        if (clickAge[i] < freshest) { freshest = clickAge[i]; clickCenter = clickPos[i]; }
    }
    route(clickTarget, clickStrength * mC * clickEnable, uv0, clickCenter / screenSize, vec2(0.0),
          mzAdd, valAdd, uvDisp);

    float n = fieldN(rotateUV(uv0 + uvDisp), mzAdd);
    n = clamp(n + valAdd, 0.0, 1.0);
    return paletteLookup(n);
}


void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv = fragCoord / iResolution.xy;
  vec4 c = shade(vec2(uv.x, 1.0 - uv.y) * vec2(640.0, 360.0));
  fragColor = vec4(c.rgb * c.a, 1.0);
}

void main() {
  // Map window pixels into the fixed 640x360 pattern space with a uniform
  // "cover" scale (like CSS background-size: cover): the pattern keeps its
  // proportions at any window size. The y flip converts to the top-left
  // origin shade() expects.
  vec2 pm = winToPattern(gl_FragCoord.xy);
  
  // Snap to the cell grid in pattern space to replicate the original's
  // low-res buffer look (640x360 rendered, CSS-upscaled pixelated).
  // Snapping in pattern space keeps blocks square on non-16:9 windows.
  vec2 snapped = floor(pm / cellSize) * cellSize;
  
  // Call shade() directly (mainImage's coordinate math assumed iResolution
  // was the 640x360 canvas size; in R3F it's the window size, so that
  // path is broken).
  vec4 c = shade(vec2(snapped.x, 360.0 - snapped.y));
  oColor = vec4(c.rgb * c.a, 1.0);
}
`

// ── The uniforms, from the JS side ─────────────────────────────────
// Hoisted out of the component on purpose: a React re-render must not
// hand the material a brand-new uniforms object — it would reset every
// value inside. iMouse starts at the buffer center, like the original.
const uniforms = {
  iTime: { value: 0 },
  iResolution: { value: new Vector2(1, 1) },
  iMouse: { value: new Vector2(320, 180) },
}
// A scratch vector reused every frame — no allocation at 60fps.
const drawingBuffer = new Vector2()

export function BurningScene() {
  const material = useRef<ShaderMaterial>(null)

  useFrame((state) => {
    if (!material.current) return
    state.gl.getDrawingBufferSize(drawingBuffer)
    material.current.uniforms.iTime.value = state.clock.elapsedTime
    material.current.uniforms.iResolution.value.copy(drawingBuffer)
    // iMouse is Shadertoy-style: pixels, bottom-left origin. state.pointer
    // is -1..1 with y pointing UP (y=+1 at the top of the window), so it's
    // already bottom-left origin — just scale to buffer pixels. The shader
    // flips Y itself, so we must not flip here (double flip = mirrored).
    const px = (state.pointer.x * 0.5 + 0.5) * drawingBuffer.x
    const py = (state.pointer.y * 0.5 + 0.5) * drawingBuffer.y
    material.current.uniforms.iMouse.value.set(px, py)
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        glslVersion={GLSL3}
      />
    </mesh>
  )
}
