import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { easing } from 'maath'
import { ToneMappingMode } from 'postprocessing'

import { useEffect, useRef, type RefObject } from 'react'
import type { Group } from 'three'

// How far the model tilts (in radians) when the mouse hits the screen edge.
// Tune these to taste: bigger = more dramatic.
const TILT_X = -0.1 // up/down
const TILT_Y = -0.2 // left/right
// How lazily it settles: higher = snappier, lower = floatier.
const SMOOTHING = 0.45

// Intro sweep: deliberately lazier than SMOOTHING, so the arrival reads as a
// set piece while mouse/scroll stay responsive. After INTRO_DURATION the
// damping hands back to SMOOTHING (same targets, so the handoff is invisible).
const SMOOTHING_INTRO = 1
const INTRO_DURATION = 3 // seconds

// Scroll recession: the page scroll already carries the canvas up out of the
// window, so we push the model *up* in 3D to partially counteract it. It then
// exits slower than the page and reads as a layer *behind* the text.
const SCROLL_LIFT = 1.8 // world units of rise at full scroll
const SCROLL_LEAN = 0.35 // radians of extra lean-back at full scroll

// COMPOSITING
// Bloom
const BLOOM_INTENSITY = 5.0 // how strong the glow is

function Model({ onLoaded, scroll }: { onLoaded: () => void; scroll: RefObject<number> }) {
  const { scene } = useGLTF('/models/bulb_test.glb')
  const group = useRef<Group>(null)
  const intro = useRef(0) // seconds elapsed in the intro phase

  // Re-runs if onLoaded's identity changes:
  useEffect(() => {
    onLoaded()
  }, [onLoaded])

  // Mouse parallax + scroll recession, both eased toward their targets each frame.
  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    intro.current = Math.min(intro.current + delta, INTRO_DURATION)
    const smoothing = intro.current < INTRO_DURATION ? SMOOTHING_INTRO : SMOOTHING
    easing.damp(g.position, 'y', scroll.current * SCROLL_LIFT, smoothing, delta)
    easing.damp(
      g.rotation,
      'x',
      -state.pointer.y * TILT_X - scroll.current * SCROLL_LEAN,
      smoothing,
      delta,
    )
    easing.damp(g.rotation, 'y', state.pointer.x * TILT_Y, smoothing, delta)
  })

  // Intro: the group mounts (GLTF loaded, overlay about to lift) in its full
  // recession state — above, leaning back — and the damping above sweeps it
  // down to rest. The intro is the scroll exit, played in reverse.
  return (
    <group ref={group} position={[0, SCROLL_LIFT, 0]} rotation={[-SCROLL_LEAN, 0, 0]}>
      <primitive object={scene} />
    </group>
  )
}

export function HeroScene({ onLoaded, scroll }: { onLoaded: () => void; scroll: RefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.05} />
      <Model onLoaded={onLoaded} scroll={scroll} />
      <EffectComposer>
            {/* intensity = how strong the glow is
            luminanceThreshold = what counts as bright enough to glow.
            The library default of 1.0 glows nothing, so keep this below 1. So far I don't think this actually does anything
            radius = how far the glow spreads */}
        <Bloom mipmapBlur intensity={BLOOM_INTENSITY} luminanceThreshold={0.1} radius={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

      </EffectComposer>
    </>
  )
}
