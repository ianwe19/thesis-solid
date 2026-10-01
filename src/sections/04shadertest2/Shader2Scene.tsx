import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { GLSL3, Vector2, type ShaderMaterial } from 'three'

/* ════════════════════════════════════════════════════════════════════
   "enchanted sky" — a Voronoi cell field, converted from the standalone
   WebGL2 page (enchanted_sky.html) into an R3F scene.

   The pipeline, per pixel:
     1. cellVolume — a 3x3x3 neighborhood of hashed lattice points;
        keeps the two closest distances -> a field where each cell's
        core is bright and the gaps are dark.
     2. cellFBM — layers that field (octaves/gain dials).
     3. paletteLookup — maps the result through a 110-step white->black
        ramp -> sparse light on dark.

   Conversion notes (the only differences from the original file):
     - glslVersion={GLSL3} on the material: the shader uses WebGL2-only
       features (dynamic indexing into PALETTE). three.js prepends
       `#version 300 es` and the precision lines itself, so those are
       gone from the source here. In GLSL3 mode you declare your own
       `out` (oColor) — there is no gl_FragColor.
     - The vertex shader uses three.js' built-in `position` on a 2x2
       plane instead of the original custom fullscreen triangle.
     - The shader is driven by gl_FragCoord (pixels), not UVs, so the
       plane just needs to cover the screen.
     - The pattern lives in a fixed 640x360 space. mainImage maps window
       pixels into it with a uniform "cover" scale (like CSS
       background-size: cover), so the look keeps its proportions at any
       window size — wider windows see more of it, taller ones less.

   The dials live in the const/#define block at the top of the fragment
   shader. hover* is live (the cursor zooms the field); click* is off
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
// The original file's body, minus the #version/precision lines that
// three.js now supplies. Functional changes: mainImage maps the window
// into 640x360 pattern space with a uniform "cover" scale, and the mouse
// goes through the same mapping (mousePattern). Everything else untouched.
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

const vec2 clickPos[8] = vec2[8](vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0),vec2(0.0));
const float clickAge[8] = float[8](1e6,1e6,1e6,1e6,1e6,1e6,1e6,1e6);
#define time uTime
const float noiseScale = 16.0;
#define screenSize vec2(640.0, 360.0)
#define sampleOffset vec2(0.0)
#define renderSize vec2(640.0, 360.0)
const float cellSize = 0.5;

#define morphPhase (uTime*0.65)
#define spinPhase (uTime*0.0)
#define scrollSpeed vec2(0.1, 0.5)
const vec2 loopD = vec2(0.0, 0.0);
// The cursor in pattern space, flipped to the top-left origin shade() uses.
vec2 mousePattern() {
  vec2 pm = winToPattern(iMouse); // iMouse is bottom-left origin, like gl_FragCoord
  return vec2(pm.x, 360.0 - pm.y);
}
#define mousePos mousePattern()
const float hoverEnable = 1.0;
const float hoverTarget = 2.0;
const float hoverStrength = 0.5;
const float hoverCount = 2.0;
const float hoverRadius = 50.0;
const float hoverFalloff = 1.0;
const float hoverScatter = 0.0;
const float hoverDragOnly = 0.0;
const vec2 dragVec = vec2(0.0);
const float dragActive = 0.0;
const float clickEnable = 0.0;
const float clickTarget = 0.0;
const float clickStrength = 0.5;
const float clickCount = 2.0;
const float clickRadius = 80.0;
const float clickDecay = 1.0;
const float clickFalloff = 0.5;
const float jitter = 0.7;
const float minkowskiP = 0.8;
const float starPoints = 4.0;
const float starDepth = 0.0;
const float cellStretch = 0.7;
const float cellAngle = 90.0;
const float cellRadius = 2.0;
const float smoothK = 0.0;
const float edgeSharpen = 1.5;
const float octaves = 1.0;
const float gain = 0.3;
const float pinchStrength = -0.1;
#define warpPhase (uTime*0.5)

const vec4 PALETTE[110] = vec4[110](
  vec4(1.0,1.0,1.0,1.0),
  vec4(1.0,1.0,1.0,1.0),
  vec4(1.0,1.0,1.0,1.0),
  vec4(1.0,1.0,1.0,1.0),
  vec4(0.7356,0.773733,0.783996,1.0),
  vec4(0.551266,0.623978,0.644262,1.0),
  vec4(0.472514,0.534838,0.552225,0.857143),
  vec4(0.393761,0.445699,0.460187,0.714286),
  vec4(0.315009,0.356559,0.36815,0.571429),
  vec4(0.236257,0.267419,0.276112,0.428571),
  vec4(0.157505,0.178279,0.184075,0.285714),
  vec4(0.0787523,0.0891397,0.0920374,0.142857),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0),
  vec4(0.0,0.0,0.0,0.0)
);
vec4 paletteLookup(float x){
  int i = clamp(int(clamp(x,0.0,1.0)*256.0),0,255);
  return PALETTE[clamp(int(float(i)/255.0*110.0),0,109)];
}

#define TAU 6.28318530718
#define MAX_OCTAVES 10
#define VOLUME_Z    0.7

#define MAX_CLICKS 8          

#define ZOOM_AMT     1.0
#define REPEL_AMT    0.3
#define SCATTER_FREQ 60.0

vec2 frameC(vec2 uv) {
    vec2 r = renderSize;
    return (uv - 0.5) * screenSize / r.y;
}
vec2 frameUV(vec2 c) {
    vec2 r = renderSize;
    return 0.5 + c * r.y / screenSize;
}

vec2 latticeOffset(vec2 cell) {
    float row = floor(cell.y);
    return vec2(0.0);
}

vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453);
}

vec2 wrapCell(vec2 cell, float angN, vec2 d) {
    if (angN > 0.5) cell.x = mod(cell.x, angN);
    
    return cell;
}
vec3 wrapCell3(vec3 cell, float angN, vec2 d) {
    cell.xy = wrapCell(cell.xy, angN, d);
    
    return cell;
}

float metricDist3(vec3 d, float ang) {
    float s = sin(ang), c = cos(ang);
    d.xy = mat2(c, -s, s, c) * d.xy;
    d.x *= cellStretch; d.y /= cellStretch;
    float p  = max(minkowskiP, 0.1);
    float md = pow(pow(abs(d.x), p) + pow(abs(d.y), p) + pow(abs(d.z), p), 1.0 / p);
    return md * (1.0 + starDepth * cos(starPoints * atan(d.y, d.x)));
}

float cellSpin(vec2 cell) {
    float turns = cellAngle / 360.0;
    turns += spinPhase;
    return -turns * TAU;
}

float smin(float a, float b, float k) {
    if (k <= 0.0) return min(a, b);
    float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
    return mix(a, b, h) - k * h * (1.0 - h);
}

void consider(float d, inout float f1, inout float f2) {
    if      (d < f1) f2 = f1;
    else if (d < f2) f2 = d;
    f1 = smin(f1, d, smoothK);
}

float comboValue(float f1, float f2) {
    float s = 1.0 / max(cellRadius, 0.001);
    f1 *= s; f2 *= s;
    float v;
    v = f1 * 1.4;
    v = clamp(v, 0.0, 1.0);
    v = pow(v, edgeSharpen);
    
    return clamp(v, 0.0, 1.0);
}

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

vec2 warpUV(vec2 uv) {

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
    return uv;
}

#define CELL_EMPTY_LO 4.0
#define CELL_EMPTY_HI 7.0
#define CELL_EMPTY_VALUE 1.0

vec2 cBaseMouse;

float cellFinish(float f1, float f2, bool doCells) {
    float v = comboValue(f1, f2);
    if (doCells) v = mix(v, CELL_EMPTY_VALUE, smoothstep(CELL_EMPTY_LO, CELL_EMPTY_HI, f1));
    
    return v;
}

float cellVolume(vec2 p, float angN, vec2 d, float zScale, bool isBase) {

    vec3 P  = vec3(p, morphPhase);
    vec3 ip = floor(P), fp = fract(P);
    float f1 = 8.0, f2 = 8.0;
    for (int k = -1; k <= 1; k++) {
        for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
                vec3 g    = vec3(float(i), float(j), float(k));
                vec3 cell = wrapCell3(ip + g, angN, d);
                vec3 rnd  = hash3(cell);
                vec3 pt   = g + vec3(mix(vec2(0.5), rnd.xy, jitter), rnd.z);
                pt.xy += latticeOffset(cell.xy) * (1.0 - jitter);
                
                vec3 d    = pt - fp;
                d.z      *= zScale;
                float dd  = metricDist3(d, cellSpin(cell.xy));
                
                consider(dd, f1, f2);
            }
        }
    }
    
    return cellFinish(f1, f2, false);
}

float cellEval(vec2 p, float angN, vec2 d, bool isBase) {
    return cellVolume(p, angN, d, VOLUME_Z, isBase);
}

float cellFBM(vec2 p, float angN) {
    float v = 0.0, a = 0.5, norm = 0.0;
    vec2  d = loopD;
    int oct = int(octaves + 0.5);
    for (int i = 0; i < MAX_OCTAVES; i++) {
        if (i >= oct) break;
        v    += a * cellEval(p, angN, d, i == 0);
        norm += a;
        p     = p * 2.0 + vec2(5.3, 1.7);
        a    *= gain;
        if (angN > 0.5) angN *= 2.0;

        d    *= 2.0;
    }
    return v / norm;
}

float inflMask(vec2 block, vec2 uv, vec2 center, float radius, float falloff, float scatter) {
    float d     = length(block - center);
    float inner = radius * (1.0 - falloff);
    float m     = 1.0 - smoothstep(inner, max(radius, inner + 0.5), d);
    if (scatter > 0.001) m *= mix(1.0, wnoise2(uv * SCATTER_FREQ), scatter);
    return m;
}

float clickRingMaskAt(vec2 block, vec2 uv, int i) {
    float life = clickAge[i] / max(clickDecay, 0.05);
    if (life >= 1.0) return 0.0;
    float thick = clickRadius * mix(0.06, 0.5, clickFalloff) + 0.5;
    float d     = length(block - clickPos[i]);
    float ringR = clickRadius * life;
    float m     = (1.0 - smoothstep(0.0, thick, abs(d - ringR))) * (1.0 - life);
    
    return m;
}

void route(float target, float strength, float mask, float count, vec2 uv, vec2 centerUV, vec2 smearPx,
           inout float valAdd, inout vec2 uvDisp) {
    float amp = strength * mask;
    if (target < 0.5) {
        valAdd += amp;
    } else if (target < 1.5) {
        uvDisp += (uv - centerUV) * amp * ZOOM_AMT;
    } else if (target < 2.5) {
        vec2 dir = (length(smearPx) > 1e-4) ? smearPx / screenSize : (uv - centerUV);
        float L = length(dir);

        if (L > 1e-5) uvDisp -= (dir / L) * amp * REPEL_AMT;
    } else if (target > 6.5) {
        float n = max(count, 1.0);
        float k = (target < 7.5) ? (1.0 / n) : n;
        uvDisp += (uv - centerUV) * (k - 1.0) * mask;
    }
}

vec4 shade(vec2 screen_coords) {
    vec2 block = floor((screen_coords + sampleOffset) / cellSize) * cellSize;
    vec2 uv0   = warpUV(block / screenSize);

    float valAdd = 0.0;
    vec2  uvDisp = vec2(0.0);
    float hgate  = hoverEnable * ((hoverDragOnly > 0.5) ? dragActive : 1.0);
    vec2  hsmear = (hoverDragOnly > 0.5) ? dragVec : vec2(0.0);
    float mH = hgate * inflMask(block, uv0, mousePos, hoverRadius, hoverFalloff, hoverScatter);
    route(hoverTarget, hoverStrength, mH, hoverCount, uv0, mousePos / screenSize, hsmear, valAdd, uvDisp);
    for (int i = 0; i < MAX_CLICKS; i++) {
        float mC = clickRingMaskAt(block, uv0, i) * clickEnable;
        route(clickTarget, clickStrength, mC, clickCount, uv0, clickPos[i] / screenSize, vec2(0.0),
              valAdd, uvDisp);
    }

    vec2 uv = rotateUV(uv0 + uvDisp);

    vec2  p;
    float angN = 0.0;
    {
        p = uv * noiseScale + time * scrollSpeed;
    }
    p.y *= 1.0;

    float v = cellFBM(p, angN);
    v = clamp(v + valAdd, 0.0, 1.0);

    return paletteLookup(v);
}


void mainImage(out vec4 fragColor, in vec2 fragCoord){
  // Map window pixels into the fixed 640x360 pattern space with a uniform
  // "cover" scale (like CSS background-size: cover): the pattern keeps its
  // proportions at any window size — wider windows see more of it, taller
  // ones less. The y flip converts to the top-left origin shade() expects.
  vec2 pm = winToPattern(fragCoord);
  vec4 c = shade(vec2(pm.x, 360.0 - pm.y));
  fragColor = vec4(c.rgb * c.a, 1.0);
}

void main() {
  vec4 c;
  mainImage(c, gl_FragCoord.xy);
  oColor = c;
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

export function Shader2Scene() {
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
