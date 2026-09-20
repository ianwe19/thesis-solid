import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { HeroScene } from './HeroScene'

// How far the hero text drifts (in px) when the mouse hits the screen edge.
// Negative = opposite the mouse, so it reads as a layer *in front of* the model.
const TEXT_DRIFT_X = -1
const TEXT_DRIFT_Y = 1

export function HeroSection() {
  const [loaded, setLoaded] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  // Mouse parallax for the DOM layer. We write style.transform directly
  // instead of using state: a setState on every mousemove would re-render
  // the entire section (including the Canvas) 60+ times a second.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = textRef.current
      if (!el) return
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = (1 - e.clientY / window.innerHeight) * 2 - 1 // flip so y points up
      el.style.transform = `translate3d(${x * TEXT_DRIFT_X}px, ${y * TEXT_DRIFT_Y}px, 0)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <section className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#111' }}
        >
          <Suspense fallback={null}>
            <HeroScene onLoaded={() => setLoaded(true)} />
          </Suspense>
        </Canvas>
      </div>

      {/* Hero text — drifts opposite the pointer to sell depth */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div ref={textRef} className="text-center will-change-transform">
          <h1 className="font-serif text-6xl md:text-8xl font-bold text-black tracking-tight">
            Something About Light
          </h1>
          <p className="mt-4 text-xl text-black">Your subtitle goes here</p>
        </div>
      </div>

      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <span className="text-white/60 text-lg tracking-widest animate-pulse">
            Loading…
          </span>
        </div>
      )}
    </section>
  )
}
