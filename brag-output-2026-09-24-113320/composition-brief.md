# Hyperframes Composition Brief: AI Interview Prep Kit

## Objective
Create a short launch-style brag video for AI Interview Prep Kit (Prep Kit).

## Output
- Composition directory: `brag-output-2026-09-24-113320/composition/`
- Rendered video: `brag-output-2026-09-24-113320/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21 seconds (must be 15-25s)

## Source Material
- Project root: `/Users/darshankarthikeya/Desktop/Trao`
- Primary files read: `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/ui.ts`, `README.md`, `package.json`
- Product name: Prep Kit (AI Interview Prep Kit)
- Tagline / strongest claim: “Turn a posting into a defensible prep plan.”
- Hook claim: “A prep plan that won’t gaslight you.”
- Key UI or visual moment to recreate: landing `KitDossier` (coverage meter, day chips, flashcard, Weak spots + Sources floating chips), neo-brutalist `.card-raised` / `.btn` hard shadows
- Copy that must appear verbatim:
  - Turn a posting into a defensible prep plan.
  - Free to run locally with Ollama — no API key required.
  - Create account
  - What lands in your kit
  - The model is not asked to allocate your schedule or decide final coverage

## Creative Direction
- Tone preset: polished
- Creative direction: premium paper dossier product film — restrained confidence, hard neo-brutal shadows, dry honesty over hype
- Interpretation: 4 scenes, longer holds, soft crossfades; Geist extrabold type at scale; energy from card motion and layout, not loud caps
- Angle: The kit is a defensible dossier — model drafts questions, deterministic code owns schedule and coverage. Honesty is the product.
- Hook: “A prep plan that won’t gaslight you.”
- Outro / punchline: Prep Kit + tagline + free Ollama line
- Avoid:
  - Generic SaaS language (“streamline”, “supercharge”)
  - Abstract filler motion graphics
  - Unrelated visual redesign — stay on cream/ink paper system
  - Real emails, API keys, localhost secrets, personal names

## Visual Identity
- Background: `#F7F4EC`
- Surface: `#FFFDF7`
- Text / ink / borders / shadows: `#17130D`
- Soft text: `#5C5346`
- Success: `#1A7F37` · Warn: `#B45309` · Bad: `#B42318`
- Focus/amber accent: `#F59E0B`
- Display font: Geist or Geist-like geometric sans extrabold (fallback Inter/system-ui)
- Body font: Geist / system-ui
- Mono: Geist Mono / ui-monospace
- Visual references: 2px solid ink borders; `box-shadow: 4px 4px 0` / `8px 8px 0` hard shadows; pill buttons; rounded 16–20px cards; chips with borders; monogram-style day badges.

## Storyboard
Use the storyboard in `brag-output-2026-09-24-113320/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 4.0s — Headline slam + tagline on cream; Prep Kit wordmark
2. Kit dossier reveal — 5.5s — KitDossier rebuild; meter fills Clear; day chips; Weak spots/Sources chips
3. Honest pipeline + practice — 6.5s — checklist ticks, Check passes: 2, flashcard flip + ratings
4. Outro / logo — 5.0s — ink band, Prep Kit, tagline, Ollama line, Create account pill

## Audio
- Audio role: warm bed with sparse professional accents
- Audio arc: clean open → product presence mid → one success accent → soft resolve/fade
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: volume ~0.32; fade-in ~0.8s; fade-out last 1.5s under logo; never above 0.5
- Music cue guidance: bundled preset `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (copy JSON path relative into composition if used); strong cues 8.74s, 17.47s, 22.93s; beats ~0.55s grid; 1-3 strong cue locks max; ignore cues that hurt readability
- Audio-reactive treatment: subtle; coverage meter fill and hard-shadow card presence may breathe with RMS; no waveform/equalizer visuals
- Audio-coupled moments:
  - Scene 1 — typed/settling headline — light key ticks optional
  - Scene 2 — coverage meter fill / Clear chip — soft success near 8.74s if natural
  - Scene 3 — sequential checklist rows — clicks on beat-grid; flashcard flip soft; passes:2 success bell
  - Scene 4 — logo land — soft impact near 22.93s if natural; music fades
- SFX selection guidance: prefer low HF risk from skill `sfx-analysis.md` — impactSoft_medium for reveals, interface/click_003 for UI, interface/bong_001 or impactBell_heavy_000 sparingly for success/logo
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density, volume after animation exists
- Audio files: copy music into `composition/assets/music/`; copy only selected SFX under `composition/assets/sfx/`
- Voice: **disabled** (no --voice)

## Hyperframes Instructions
Load domain skills: `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. This is a `/brag` handoff — do **not** enter the hyperframes entry-point intent interview or generic product-launch workflow interview.

Requirements:
- Show at least one real UI element from the source project (KitDossier / paper cards / pills).
- All text readable in final render (WCAG contrast must pass `hyperframes check`).
- Total duration 15-25 seconds (target 21s).
- Include planned music/SFX layer.
- Treat `/brag` audio notes as guidance; Hyperframes owns exact timing/SFX.
- Major reveals may snap to strong cues ±0.15s (use at most 1-3).
- Sequential events may snap to beats ±0.10s when readable.
- Use local relative asset paths only (never absolute `/Users/...`).
- Run `npx hyperframes check` before render — zero errors required.
- Bake poster as frame 0 is handled in Step 4 by the brag workflow after render.
