import { Canvas } from "@react-three/fiber"
import { BurningScene } from "./BurningScene"
import { useEffect, useRef } from "react"

// How far the hero text drifts (in px) when the mouse hits the screen edge.
// Negative = opposite the mouse, so it reads as a layer *in front of* the model.
const TEXT_DRIFT_X = -3
const TEXT_DRIFT_Y = 3

// No Suspense or loading overlay needed: the shader has no async assets.
export function BurningSection() {
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
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: "#000" }}
        >
          <BurningScene />
        </Canvas>
      </div>

      {/* Hero text — drifts opposite the pointer to sell depth */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div ref={textRef} className="text-center will-change-transform">
          <h1 className="text-8xl md:text-12xl font-[1000] text-white tracking-tighter">
            FIXTURE
          </h1>
          <p className="mt-4 text-xl text-white">Working title</p>
        </div>
      </div>

      {/* Section label — pointer-events-none so it never intercepts the view */}
      <div className="absolute bottom-8 left-8 z-10 pointer-events-none">
        <span className="text-white/40 text-sm tracking-[0.3em] uppercase">05 — burning</span>
      </div>
    </section>
  )
}
