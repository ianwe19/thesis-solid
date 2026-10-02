import { Canvas } from '@react-three/fiber'
import { Shader2Scene } from './Shader2Scene'
import { useSectionFrameloop } from '../../components/ui/useSectionFrameloop'

// No Suspense or loading overlay needed: the shader has no async assets.
export function Shader2Section() {
  const [sectionRef, frameloop] = useSectionFrameloop() // "never" once the section is off-screen — stops its GPU work
  return (
    <section ref={sectionRef} className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas
          frameloop={frameloop}
          dpr={1} // fixed 640x360 pattern: a retina 2x buffer re-draws the same pixels 4x over — no quality gained, only cost
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#000' }}
        >
          <Shader2Scene />
        </Canvas>
      </div>

      {/* Section label — pointer-events-none so it never intercepts the view */}
      <div className="absolute bottom-8 left-8 z-10 pointer-events-none">
        <span className="text-white/40 text-sm tracking-[0.3em] uppercase">04 — shader test two</span>
      </div>
    </section>
  )
}
