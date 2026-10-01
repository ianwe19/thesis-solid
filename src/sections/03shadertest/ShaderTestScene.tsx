import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector2, type ShaderMaterial } from 'three'

/* ════════════════════════════════════════════════════════════════════
   A GLSL crash course, in working code
   ════════════════════════════════════════════════════════════════════

   This file is one flat plane covering the whole section, with a custom
   shader — two tiny programs the GPU runs for it:

   1. The VERTEX shader runs once per *corner* of the plane (4 times).
      It decides where each corner lands on screen and forwards each
      corner's UV coordinate (a 0..1 position across the plane).

   2. The FRAGMENT shader runs once per *pixel* — millions of times a
      frame. Its entire job: say "this pixel is this color." No images,
      no sprites, no meshes: a look is just math over pixel
      coordinates. That is the whole trick of shader art, and
      everything below is built from it.

   How to study this file:
   - Read the numbered stages in the fragment shader top to bottom.
   - Every stage ships with a "try" hint: switch the stage off (usually
     a 0.0 multiplier) and look at the screen. Before/after is how
     shader artists develop a look.
   - The numbers are dials. Change them, look, change them back.

   The one rule of JS -> GLSL communication: GLSL cannot read
   JavaScript variables. Data crosses the bridge only through
   UNIFORMS — values declared in the shader and filled from here,
   every frame, in the useFrame loop below.
   ════════════════════════════════════════════════════════════════════ */

// ── The vertex shader ──────────────────────────────────────────────
// "position" and "uv" are built-in attributes three.js supplies for
// every geometry (a corner's 3D location, its 0..1 position on the
// plane). "modelViewMatrix" and "projectionMatrix" are built-in
// uniforms three.js fills in with the camera math. gl_Position is the
// one output we must produce: where the corner lands.
//
// "varying" is the other half of the bridge: a value declared
// varying in both stages flows vertex -> fragment, and the GPU
// *interpolates* it across every pixel in between. That is how a
// four-corner plane gets a smooth per-pixel coordinate.
const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv; // forward this corner's 0..1 position to the pixel stage
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// ── The fragment shader ────────────────────────────────────────────
// Runs once per pixel. The image is assembled in eight numbered
// stages, each with a "try" hint that switches it off so you can see
// exactly what it contributes.
//
// The toolkit — every function this shader uses, in plain English:
//   length(v)         distance from the origin — the "how far from
//                     the center" that makes radial shapes possible
//   mix(a, b, t)      blend two numbers or colors: t=0 gives a,
//                     t=1 gives b, and it slides smoothly between
//   smoothstep(a, b, x) a smooth ramp 0 -> 1 between edges a and b
//                     (reversed edge order = reversed ramp). THE
//                     workhorse: it turns hard math into soft shapes
//   sin(x)            oscillates -1..1. Feed it time, you get motion
//   hash(p)           a deterministic "random" number: same input,
//                     same output, computable per pixel, no CPU help
//
// GLSL note: three.js compiles this as legacy GLSL, where the
// required output is the built-in gl_FragColor. (A modern GLSL 3
// shader would instead declare "out vec4 color" and assign that.)
const fragmentShader = /* glsl */ `
  uniform float uTime;        // seconds since the page loaded
  uniform vec2  uResolution;  // the canvas' size in device pixels
  varying   vec2 vUv;         // this pixel's position, 0..1

  // One of two classic "fake random" recipes: sin of a weird number,
  // keep the fractional part. Random-looking, rock-solid
  // deterministic — the grain in stage 8 is built on it.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // ── Stage 1 · coordinates ─────────────────────────────────
    // vUv is 0..1 with the origin at a corner, but length() and
    // sin() think in terms of the *center*. Shift the origin:
    // now every pixel knows where it is, relative to the middle.
    // (Corners sit 0.707 out — the half-diagonal of a 1x1 square.)
    vec2 p = vUv - 0.5;

    // ── Stage 2 · the breath ──────────────────────────────────
    // sin() gives -1..1; * 0.5 + 0.5 folds it into 0..1.
    // 0.5 rad/s is one full swell every ~12s — slow on purpose.
    // (try: float breath = 0.5;  — a still, unbreathing light)
    float breath = sin(uTime * 0.5) * 0.5 + 0.5;

    // ── Stage 3 · the warp ────────────────────────────────────
    // THE core shader trick: you never move pixels — you move the
    // *coordinate space the image is sampled from*. Nudge every
    // pixel's position with two slow, independent sine waves, and
    // everything built after this line ripples along with them.
    // (try: 0.035 -> 0.0  — the light becomes a perfect circle)
    vec2 w = p + 0.035 * vec2(
      sin(p.y * 7.0 + uTime * 0.5),
      sin(p.x * 7.0 - uTime * 0.4)
    );

    // ── Stage 4 · the pool of light ───────────────────────────
    // Distance from the (warped) center. smoothstep turns that
    // distance into a soft 0..1 falloff: 1 at the heart, 0 past
    // the pool's edge. The breath pushes the cutoff in and out, so
    // the pool swells and recedes.
    // (try: float pool = 1.0;  — the light at full strength)
    float d = length(w);
    float pool = smoothstep(0.75 + breath * 0.15, 0.0, d);

    // ── Stage 5 · ripple rings ────────────────────────────────
    // A sine of *distance* = concentric rings. Minus time makes
    // them drift outward. smoothstep reshapes each raw cycle into a
    // soft band, and * pool fades the rings to the lit center, so
    // they only exist where the light does.
    // (try: 0.12 -> 0.0  — kill the rings)
    float rings = sin(d * 28.0 - uTime * 0.8) * 0.5 + 0.5;
    rings = smoothstep(0.3, 0.7, rings) * 0.12 * pool;

    // ── Stage 6 · the color ───────────────────────────────────
    // Three stops, mixed in two passes: deep maroon at the edge,
    // brick red in the middle, warm coral at the heart — the
    // Balatro palette. pool * pool makes the core arrive last,
    // like approaching a light, not a painted circle.
    vec3 edge = vec3(0.14, 0.04, 0.06);
    vec3 mid  = vec3(0.55, 0.16, 0.13);
    vec3 core = vec3(1.00, 0.60, 0.44);
    vec3 color = mix(mix(edge, mid, pool), core, pool * pool);
    // the rings add a little extra warmth on top
    color += vec3(0.9, 0.45, 0.3) * rings;

    // ── Stage 7 · the vignette ────────────────────────────────
    // Multiply, don't mix: full light at the center, darkness at
    // the corners. Measured on the *unwarped* p so the frame stays
    // still while the light moves.
    // (try: comment this line out — it's standalone, safe to remove)
    color *= smoothstep(0.95, 0.4, length(p));

    // ── Stage 8 · the grain ───────────────────────────────────
    // Smooth gradients band on real displays: 8 bits can't hold a
    // gentle ramp, so it steps. Sprinkle per-pixel random +-2.5%
    // and the steps dissolve — the same reason film grain exists.
    // floor(uTime * 24) re-rolls the pattern 24x a second, so it
    // flickers like film.
    // (try: comment this line out — the banding returns)
    float grain = hash(vUv * uResolution + floor(uTime * 24.0)) - 0.5;
    color += grain * 0.05;

    // That's it — the color this pixel shows.
    gl_FragColor = vec4(color, 1.0);
  }
`

// ── The uniforms, from the JS side ─────────────────────────────────
// Hoisted out of the component on purpose: a React re-render (say,
// a window resize) must not hand the material a brand-new uniforms
// object — it would reset every value inside it.
const uniforms = {
  uTime: { value: 0 },
  uResolution: { value: new Vector2(1, 1) },
}
// A scratch Vector2 reused every frame, so we don't allocate one
// 60 times a second.
const drawingBuffer = new Vector2()

export function ShaderTestScene() {
  const { viewport } = useThree()
  const material = useRef<ShaderMaterial>(null)

  // Uniforms are how JS talks to GLSL: every frame, fill in the
  // values the shader declared. Swap what you feed and the design
  // changes.
  useFrame((state) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = state.clock.elapsedTime
    state.gl.getDrawingBufferSize(drawingBuffer)
    material.current.uniforms.uResolution.value.copy(drawingBuffer)
  })

  return (
    <mesh>
      {/* Sized to fill the view exactly: the camera sits at z=5 with
          fov 45, so the visible rectangle at the origin is
          viewport.width x viewport.height. Because the plane's aspect
          matches the screen's, vUv maps 1:1 to the display — a circle
          drawn in shader space stays round on screen. */}
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}

/* ── Now you try ─────────────────────────────────────────────────
   1. THE POINTER — add "uniform vec2 uPointer;" to the fragment
      shader, uPointer: { value: new Vector2(0.5, 0.5) } to the
      uniforms, and in useFrame feed it from R3F's normalized mouse
      (state.pointer is -1..1, so scale into vUv space):
        material.current.uniforms.uPointer.value.set(
          state.pointer.x * 0.5 + 0.5,
          state.pointer.y * 0.5 + 0.5,
        )
      Then bend stage 1:
        vec2 p = vUv - 0.5 - (uPointer - 0.5) * 0.3;
      and the light pulls toward your cursor.
   2. SCROLL — the same dance with the scroll ref from 01hero.
   3. AUDIO — the Web Audio API's getByteFrequencyData into a
      uniform, and the light starts listening.
   ──────────────────────────────────────────────────────────────── */