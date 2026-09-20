import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useRef, type RefObject } from 'react'
import type { Group } from 'three'

// How far the model tilts (in radians) when the mouse hits the screen edge.
// Tune these to taste: bigger = more dramatic.
const TILT_X = -0.1 // up/down
const TILT_Y = -0.2 // left/right
// How lazily it settles: higher = snappier, lower = floatier.
const SMOOTHING = 0.45

// Scroll recession: the page scroll already carries the canvas up out of the
// window, so we push the model *up* in 3D to partially counteract it. It then
// exits slower than the page and reads as a layer *behind* the text.
const SCROLL_LIFT = 1.8 // world units of rise at full scroll
const SCROLL_LEAN = 0.35 // radians of extra lean-back at full scroll

function Model({ onLoaded, scroll }: { onLoaded: () => void; scroll: RefObject<number> }) {
  const { scene } = useGLTF('/models/bulb_test.glb')
  const group = useRef<Group>(null)

  // Re-runs if onLoaded's identity changes:
  useEffect(() => {
    onLoaded()
  }, [onLoaded])

  // Mouse parallax + scroll recession, both eased toward their targets each frame.
  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    easing.damp(g.position, 'y', scroll.current * SCROLL_LIFT, SMOOTHING, delta)
    easing.damp(
      g.rotation,
      'x',
      -state.pointer.y * TILT_X - scroll.current * SCROLL_LEAN,
      SMOOTHING,
      delta,
    )
    easing.damp(g.rotation, 'y', state.pointer.x * TILT_Y, SMOOTHING, delta)
  })

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

export function HeroScene({ onLoaded, scroll }: { onLoaded: () => void; scroll: RefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.05} />
      <Model onLoaded={onLoaded} scroll={scroll} />
    </>
  )
}
