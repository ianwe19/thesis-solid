import { useGLTF } from '@react-three/drei'
import { useEffect } from 'react'

function Model({ onLoaded }: { onLoaded: () => void }) {
  const { scene } = useGLTF('/models/bulb_test.glb')

  // Re-runs if onLoaded's identity changes:
  useEffect(() => {
    onLoaded()
  }, [onLoaded])

  return <primitive object={scene} />
}

export function HeroScene({ onLoaded }: { onLoaded: () => void }) {
  return (
    <>
      <ambientLight intensity={0.05} />
      <Model onLoaded={onLoaded} />
    </>
  )
}
