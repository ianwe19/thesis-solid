import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { HeroScene } from './HeroScene'

export function HeroSection() {
  const [loaded, setLoaded] = useState(false)

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

      {/* Hero text */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tight">
            Hero Title
          </h1>
          <p className="mt-4 text-xl text-gray-300">Your subtitle goes here</p>
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
