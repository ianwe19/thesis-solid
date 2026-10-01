import { Lenis } from 'lenis/react'
import { HeroSection } from './sections/01hero/HeroSection'
import { SecondSection } from './sections/02second/SecondSection'
import { ShaderTestSection } from './sections/03shadertest/ShaderTestSection'
import { Shader2Section } from './sections/04shadertest2/Shader2Section'
import { BurningSection } from './sections/05burning/BurningSection'

// Must live outside the component: Lenis re-creates the instance whenever
// this object changes (it's stringified into the effect's dependency list).
const lenisOptions = {
  lerp: 0.07, // wheel floatiness — raise for a heavier, floatier glide
  duration: 1.2, // seconds for programmatic scrolls — snap (task 2) rides on this
}

export default function App() {
  return (
    <Lenis root options={lenisOptions}>
      <HeroSection />
      <SecondSection />
      <ShaderTestSection />
      <Shader2Section />
      <BurningSection />
    </Lenis>
  )
}
