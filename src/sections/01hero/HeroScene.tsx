import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useRef } from 'react'
import type { Group } from 'three'

// How far the model tilts (in radians) when the mouse hits the screen edge.
// Tune these to taste: bigger = more dramatic.
const TILT_X = -0.1 // up/down
const TILT_Y = -0.2 // left/right
// How lazily it settles: higher = snappier, lower = floatier.
const SMOOTHING = 0.45

function Model({ onLoaded }: { onLoaded: () => void }) {
  const { scene } = useGLTF('/models/bulb_test.glb')
  const group = useRef<Group>(null)

  // Re-runs if onLoaded's identity changes:
  useEffect(() => {
    onLoaded()
  }, [onLoaded])

  // Mouse parallax: R3F keeps state.pointer in sync with the cursor
  // (-1..1 across the canvas, y pointing up), so we don't need any
  // manual mouse listeners here.
  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    easing.damp(g.rotation, 'x', -state.pointer.y * TILT_X, SMOOTHING, delta)
    easing.damp(g.rotation, 'y', state.pointer.x * TILT_Y, SMOOTHING, delta)
  })

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

export function HeroScene({ onLoaded }: { onLoaded: () => void }) {
  return (
    <>
      <ambientLight intensity={0.05} />
      <Model onLoaded={onLoaded} />
    </>
  )
}
