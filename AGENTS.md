# AGENTS.md

Guidance for AI agents (and new collaborators) working in this repo. Read before making changes.

## What this project is

"Something about light" (working title) — a bold, designer-y, interactive narrative
single-page website. It is the web component of a Graphic Design BFA thesis: part
portfolio piece, part demonstration of development skill. The page is a sequence of
full-viewport sections (currently: 01hero, 02second), most of which are
DOM + Three.js hybrids.

## The user

- Graphic Design BFA student, not a professional developer.
- Has programming background but is rusty and new to this specific stack
  (React 19, Vite, TypeScript, Tailwind v4, React Three Fiber).
- Learning as they go: wants to understand every change, not just receive them.

## Working agreements (important)

- **Do not edit files directly.** Present changes as code blocks in chat; the user
  applies them themselves. Only write to files when the user explicitly asks you to.
- **Present code as clean, paste-ready blocks.** Code blocks contain only what the
  user pastes — no line numbers or `+`/`-` markers inside. State the location in
  prose before each block ("add after line N" / "replace lines N–M"); apply
  bottom-up so line numbers stay valid. Only reproduce a full file for genuinely
  new files, or full rewrites the user has approved.
- **Explain each change in one line** — the "why" matters as much as the code.
- **Keep changes minimal and scoped.** No drive-by refactors, no unrequested
  abstractions or dependencies. If a change seems to require restructuring,
  propose it first and wait for approval.
- **Don't remind the user to verify.** They run `npm run lint` and `npm run build`
  at regular intervals; don't end responses with "run X and paste the output" or
  offers to verify. When they do report results, the success bar is zero lint
  problems and a clean build (the ~1.2 MB chunk warning from three.js is expected,
  not a failure). When I write files directly (explicit request), I run both
  myself before declaring done.

## Project conventions (established deliberately — do not "fix" these)

- **Sections are numbered folders:** `src/sections/01hero/`, `src/sections/02second/`…
  The number prefix keeps sections in narrative order in the file browser.
  New section = next number, lowercase name (e.g., `03title/`).
- **Each section folder is self-contained:** the DOM component (`HeroSection.tsx`)
  and its 3D scene (`HeroScene.tsx`) live side by side. Sections are
  DOM/Three.js hybrids by design — keep both halves together.
- **`src/components/ui/`** is only for pieces reused across 2+ sections
  (nav, buttons…). Don't promote a component to shared until it's actually duplicated.
- **GLTF models live in `public/models/`** and are referenced by absolute URL string
  (`useGLTF('/models/bulb_test.glb')`). This is a deliberate choice — the user
  evaluated importing models from `src/` (assetsInclude + d.ts) and rejected it as
  overkill. Do not move models into `src/`.
- **Styling is Tailwind v4 utility classes only** (via `@tailwindcss/vite`;
  design tokens live in the `@theme` block of `src/index.css`). No CSS modules,
  no component-level style files.
- **The hero model is emissive** — the dim `ambientLight intensity={0.05}` in
  HeroScene is intentional, not a lighting bug.
- **Staged dependencies** (gsap, framer-motion, lenis, zustand, @react-three/cannon,
  @react-three/postprocessing) are installed for future sections. Use them when a
  section calls for them; don't add new dependencies without asking.

## Commands

| Command           | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Dev server with HMR at http://localhost:5173     |
| `npm run build`   | Type-check + production build to `dist/`         |
| `npm run preview` | Serve the production build locally               |
| `npm run lint`    | ESLint (must stay clean)                         |

## Git

Small, focused commits with messages that explain *why*. The initial commit
establishes the baseline: project setup + hero (3D) + second section.

## Documentation (live docs access)

- Agents can read current documentation online (web search + page extraction).
  Verified working: R3F docs (`r3f.docs.pmnd.rs`), drei docs
  (`drei.docs.pmnd.rs`, e.g. `/loaders/gltf-use-gltf`), three.js docs.
- Before using an API you're not confident about — especially the staged deps
  (postprocessing, cannon) and drei helpers — check the current docs rather than
  relying on training data.
- For stable APIs already in use (e.g. `useFrame`, basic JSX elements), the
  codebase is the source of truth; no need to re-verify.
- If a docs URL fails to extract, fall back to searching for the correct path
  or reading the source on GitHub.
