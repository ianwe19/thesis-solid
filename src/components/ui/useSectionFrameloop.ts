import { useEffect, useRef, useState } from 'react'

// ── useSectionFrameloop ──────────────────────────────────────────
// A Canvas' frameloop prop decides whether its render loop runs at
// all: "always" draws every frame (R3F's default), "never" draws
// nothing. This hook watches the section element and hands back the
// right value: on screen -> "always", fully scrolled out -> "never".
//
// Why: with the default, every Canvas on the page ran every frame —
// all four of them, even while you were looking at a completely
// different section. Pausing the off-screen ones was the single
// biggest performance win on the site.
//
// Usage:
//   const [sectionRef, frameloop] = useSectionFrameloop()
//   <section ref={sectionRef} ...>
//     <Canvas frameloop={frameloop} ...>
//
// The threshold-0 observer fires the first time any pixel of the
// section enters the viewport, and again when the last pixel leaves.
// While hidden, the shader clock keeps advancing, so on return the
// pattern resumes at the "current" moment — for continuous fields
// (noise, warp, drift) that jump is invisible, there is no finite
// animation to restart from the top.
export function useSectionFrameloop() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, visible ? 'always' : 'never'] as const
}
