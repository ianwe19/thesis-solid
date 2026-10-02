import { Canvas } from '@react-three/fiber'
import { ShaderTestScene } from './ShaderTestScene'
import { useSectionFrameloop } from '../../components/ui/useSectionFrameloop'

// No Suspense or loading overlay needed: the shader has no async assets.
export function ShaderTestSection() {
  const [sectionRef, frameloop] = useSectionFrameloop() // "never" once the section is off-screen — stops its GPU work
  return (
    <section ref={sectionRef} className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas
          frameloop={frameloop}
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#000' }}
        >
          <ShaderTestScene />
        </Canvas>
      </div>

      {/* Section label — pointer-events-none so it never intercepts the view */}
      <div className="absolute bottom-8 left-8 z-10 pointer-events-none">
        <span className="text-white/40 text-sm tracking-[0.3em] uppercase">03 — shader test</span>
      </div>
    </section>
  )
}
