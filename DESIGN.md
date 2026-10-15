# Docuzy — Design System & UI/UX Direction

> **Purpose:** This file defines how Docuzy should look, feel, and behave across its marketing website and application. It is the visual and interaction source of truth for implementation. It intentionally does **not** define product requirements, user flows, page copy, content architecture, or SEO; those belong in the related project documents listed below.

## 1. How to use this file

Before designing or implementing a screen:

1. Read `PRODUCT.md` for product scope, terminology, target users, and which capabilities are actually supported.
2. Read `USER-FLOWS.md` for routes, navigation, user journeys, and access/redirect rules.
3. Read `AGENTS.md` for coding-agent workflow and repository rules.
4. Read `CONTENT.md` for approved page structure, messaging, copy, and SEO.
5. Use **this file** for visual decisions, layout patterns, component behavior, motion, responsive rules, and visual QA.

Do not duplicate product facts or rewrite page copy inside this file. When documents conflict, follow the source responsible for that concern rather than inventing a compromise. Product truth comes from `PRODUCT.md`; flow truth comes from `USER-FLOWS.md`; implementation workflow comes from `AGENTS.md`; wording and SEO come from `CONTENT.md`; visual truth comes from `DESIGN.md`.

If filenames differ in the repository, use the repository's actual casing and spelling without creating duplicate documents.

---

## 2. Design north star

### The desired result

Docuzy should look like a carefully art-directed, product-led SaaS workspace: **minimal, bright, confident, typography-led, and unmistakably indigo**. It should feel finished because the hierarchy, spacing, product visuals, and details are deliberate—not because it has gradients, floating cards, or animation everywhere.

The visual language should combine:

- The **type scale, compact badge, centered hero, soft glow, and indigo gradient treatment** of the existing Docuzy waitlist hero.
- The **light canvas, generous whitespace, refined UI components, clear borders, and product-led presentation** in the supplied light-mode references.
- The practical density and clarity of a real document workspace, rather than the decorative style of a generic AI landing-page template.

### The non-negotiable theme

**Light mode only.** Do not use the former waitlist's near-black page background, and do not alternate between dark and light marketing sections. Preserve the waitlist's brand signature while adapting it to a light surface:

- Soft white/off-white canvas.
- Near-black typography.
- The same Tailwind indigo family used by the current hero code.
- A very soft indigo radial glow behind a small number of focal moments.
- A single, restrained lime accent for rare visual emphasis.
- Light product mockups and light application surfaces.

Do not interpret “keep the old hero style” as permission to recreate the old dark background. Keep the **style**, not the dark canvas.

### Design principles

1. **Product before decoration.** The actual workflow or interface should be the primary visual asset wherever it can explain the product.
2. **One focal point per viewport.** Every screen or section needs one dominant message or interaction; secondary items must remain secondary.
3. **Fewer, better components.** Prefer one convincing product composition over many generic feature cards.
4. **Consistent, not monotonous.** Reuse the same tokens and component language, but vary layouts to serve the information—not to create visual noise.
5. **Whitespace is functional.** Use it to create hierarchy and pacing, not to leave oversized empty areas around undersized content.
6. **Realistic interface detail.** Product mockups need believable labels, hierarchy, file names, spacing, and states. Avoid meaningless grey skeletons as a permanent marketing visual.
7. **Quiet confidence.** No exaggerated sales graphics, fake proof, unnecessary urgency, or “AI magic” decoration.
8. **Useful motion only.** Movement should clarify a relationship, show a state change, or support the flow of reading.

---

## 3. Reference interpretation

The supplied references are direction, not templates to copy literally.

### Keep from the original Docuzy waitlist hero

- Geist-style bold geometric typography.
- Tight tracking and close headline line-height.
- Centered, high-impact headline.
- Compact rounded eyebrow badge with a small sparkle icon.
- A word/phrase highlighted with an indigo gradient.
- Subtle indigo ambient glow behind the content.
- A clean CTA row and small supporting metadata below it.

### Keep from the light SaaS references

- Light backgrounds and well-separated white surfaces.
- Strong content hierarchy and generous but controlled whitespace.
- A clear product canvas or UI mockup as a section's main visual.
- Fine neutral borders, limited shadows, and precise spacing.
- Occasional asymmetry or a broad feature panel when it helps explain the product.
- High-quality UI previews rather than a succession of abstract illustrations.

### Do not copy

- Decorative cloud/landscape backgrounds that are unrelated to document work.
- Cryptocurrency/dashboard cards from unrelated concepts.
- Stock-photo-led sections where a product UI would be more informative.
- Giant, colorful section backgrounds, rainbow gradients, or several competing accent colors.
- Repeated three-card grids for every feature.
- Floating elements whose only purpose is to make a page seem “AI-designed.”
- Competitor logos, screens, or branded components presented as Docuzy.

---

## 4. Brand color system

Use the **same Tailwind Zinc and Indigo color families already present in the hero code**. Do not introduce a new purple/blue palette or hand-pick near-duplicate indigo values per component.

### Core tokens

| Token | Value | Intended use |
|---|---|---|
| `--docuzy-canvas` | `#FAFAFA` | Primary page background; clean soft white |
| `--docuzy-surface` | `#FFFFFF` | Cards, panels, inputs, modals, app surfaces |
| `--docuzy-surface-subtle` | `#F4F4F5` | Secondary panels and quiet component backgrounds; Tailwind Zinc 100 |
| `--docuzy-surface-hover` | `#F4F4F5` | Neutral hover background |
| `--docuzy-text` | `#18181B` | Main headings and primary labels; Zinc 900 |
| `--docuzy-text-secondary` | `#52525B` | Body text; Zinc 600 |
| `--docuzy-text-muted` | `#71717A` | Metadata and low-emphasis labels; Zinc 500 |
| `--docuzy-border` | `#E4E4E7` | Standard borders; Zinc 200 |
| `--docuzy-border-strong` | `#D4D4D8` | More visible separators; Zinc 300 |
| `--docuzy-indigo-300` | `#A5B4FC` | Light end of brand gradient, decorative glow, non-text details |
| `--docuzy-indigo-400` | `#818CF8` | Icon accents and decorative indigo detail |
| `--docuzy-indigo-500` | `#6366F1` | Brand gradient endpoint and emphasis |
| `--docuzy-indigo-600` | `#4F46E5` | High-contrast interactive brand color, links, active controls |
| `--docuzy-indigo-700` | `#4338CA` | Pressed/darker interactive state when needed |
| `--docuzy-indigo-tint` | `#EEF2FF` | Active navigation, quiet AI surfaces, selected states |
| `--docuzy-indigo-glow` | `rgba(79, 70, 229, 0.14)` | Subtle radial glow on light backgrounds |
| `--docuzy-accent-lime` | `#D9F99D` | One secondary accent, used rarely and never as a large surface |

Functional status colors are not decorative brand colors:

| Token | Value | Use |
|---|---|---|
| `--docuzy-success` | `#15803D` | Success/complete states |
| `--docuzy-warning` | `#A16207` | Warning states |
| `--docuzy-danger` | `#B91C1C` | Errors/destructive actions |
| `--docuzy-info` | `#1D4ED8` | Informational states where needed |

### Color proportions and rules

- Approximately **85–92% neutral** across a typical screen. Indigo should guide attention, not paint every element.
- Use indigo for primary actions, active navigation, focused controls, links, selected tabs, and the AI-specific focal detail.
- Use lime as a tiny optional accent: a small marker, a dot, or one isolated detail. Do not use it as a second primary color, a full section background, or a functional status color.
- Keep most cards white. Use very light Zinc or indigo tint to group related controls.
- No rainbow palettes; no neon purple; no cyan-to-purple gradient system; no gradient on every button/card.
- The soft indigo glow is an atmospheric effect, not an excuse to add multiple gradients throughout the page.
- Text must remain readable over every surface. Do not use Indigo 300 as small text on white; reserve it for decorative gradients, highlights, and non-text details.

### Hero-specific color treatment

The current waitlist code uses Zinc text treatment plus the `from-indigo-300 to-indigo-500` gradient. Preserve that identity, adapting contrast for the light theme:

- Canvas: `#FAFAFA` or `#FFFFFF`.
- Main headline: use a **Zinc 800 → Zinc 500** treatment (`#27272A` to `#71717A`) or use Zinc 900 solid text if the gradient falls below comfortable contrast. Never reuse Zinc 100 → Zinc 500 on a white canvas; it becomes too pale.
- “AI-Powered.”: use the same Indigo family, preferably Indigo 500 → Indigo 600 for readable text on light mode. The lighter Indigo 300 may appear in glow/decoration, not as the only readable text color.
- Glow: broad, low-opacity indigo radial gradient centered behind the headline/CTA; it should dissolve into white, with no visible circular edge.
- Badge: white surface, fine Zinc border, near-black label, sparkle icon in Indigo. No dark pill merely because the original waitlist badge was dark.

---

## 5. Typography system

### Typeface: keep the existing family

**Geist is the primary Docuzy typeface.** Use the font already configured in the repository. It is loaded via `next/font/google` in `app/layout.tsx`, which exposes **Geist** as `--font-geist-sans` and **Geist Mono** as `--font-geist-mono`; `app/globals.css` maps them to Tailwind's `font-sans` and `font-mono`. Do not silently swap to a trendy font or add a second display family. If the font is not available, use the existing project fallback and flag it for review rather than importing a new font without checking the repository first.

Recommended stack:

```css
font-family: var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Use `var(--font-geist-mono)` (Tailwind `font-mono`) for code, numerics, and technical values.

> **Implementation note:** `app/globals.css` currently also sets `body { font-family: Arial, Helvetica, sans-serif; }`, which overrides the Geist variables anywhere `font-sans` is not applied explicitly. Treat **Geist** as the intended typeface and flag that override for removal so the configured font actually renders.

### Preserve the hero's actual proportions

The supplied hero code establishes these visual traits:

- Desktop headline around `text-7xl` (72px in Tailwind's default scale).
- Mobile headline around `text-5xl` (48px in Tailwind's default scale), adjusted if needed for small screens.
- `font-bold` / weight 700.
- `tracking-tight`.
- Line-height close to `1.05`.
- Centered composition and a two-line desktop headline.

Preserve these proportions unless the actual font metrics or breakpoint cause clipping. Use `clamp()` or responsive utilities to keep a deliberate wrap across viewport sizes; do not force an awkward `<br>` at every breakpoint.

### Type scale

| Role | Desktop target | Mobile target | Rule |
|---|---|---|---|
| Hero H1 | `64–76px` | `38–50px` | 700 weight, tight tracking, line-height `1.00–1.08` |
| Marketing section H2 | `44–56px` | `30–38px` | 600–700 weight, line-height `1.08–1.16` |
| Page H1 inside app/tool page | `32–40px` | `27–32px` | Clear, practical, less theatrical than marketing hero |
| Feature heading | `22–28px` | `20–24px` | 600–650 weight |
| Body lead | `18–20px` | `16–18px` | Regular/medium, line-height `1.55–1.7` |
| Body | `15–17px` | `15–16px` | Comfortable reading, line-height `1.5–1.7` |
| UI label | `13–15px` | `13–15px` | Keep controls legible |
| Metadata | `12–13px` | `12–13px` | Use muted color, never for essential instruction |
| Eyebrow | `12–13px` | `11–12px` | Uppercase, weight 650–750, letter spacing ~`0.08em` |

### Typography rules

- Use sentence case for headings except short eyebrow labels.
- Don't bold whole paragraphs. Use hierarchy rather than emphasis on every phrase.
- Keep marketing body text at roughly `45–68ch` per line; UI body text should follow the needs of the component.
- Use a gradient on one short hero phrase at most. Do not gradient-fill entire paragraphs or every section heading.
- Do not use a decorative serif or italic display face simply to make the site appear more “premium.” The brand direction is a strong modern grotesk.
- Avoid ultra-thin gray text on off-white, oversized text that wraps into orphan words, and unnatural letter spacing.

---

## 6. Layout, spacing, and page rhythm

### Containers

| Context | Recommended width |
|---|---:|
| Main marketing container | `1200–1280px` |
| Narrow reading/copy column | `620–740px` |
| Hero copy | `780–1000px` depending on headline wrap |
| Large UI/product preview | `1080–1240px` |
| App content column | `min(100%, 1440px)` with consistent gutters |
| Individual tool task panel | `760–960px` for a focused workflow |

### Spacing scale

Use a consistent 4px base and an 8px primary rhythm:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 112, 128`

Default marketing rhythm:

- Desktop section padding: `88–120px` top/bottom; adjust when two visual sections are closely related.
- Tablet section padding: `64–88px`.
- Mobile section padding: `48–64px`.
- Eyebrow → heading: `12–16px`.
- Heading → lead: `16–24px`.
- Lead → CTA: `24–32px`.
- Distinct sections need enough separation to read as distinct, but don't leave entire screens of whitespace between small content blocks.

### Grid and alignment

- Use a 12-column grid for large screens when it helps maintain consistent alignment.
- Use a consistent horizontal page gutter: `24–40px` desktop, `20–24px` tablet, `16–20px` mobile.
- Align major headings, preview frames, and CTA edges to the same content container.
- Feature split layouts usually use a `5/7` or `6/6` split, depending on the interface visual's needs.
- Use asymmetry only when it clarifies the relationship between copy and product UI.
- Don't center-align every section by default. The hero can be centered; feature/product sections should vary layout to maintain visual rhythm.

---

## 7. Shapes, surfaces, borders, and elevation

### Radius system

| Component | Radius |
|---|---:|
| Small badge | Pill or `8px` |
| Inputs and compact controls | `8–10px` |
| Buttons | `10–12px` |
| Tool/file cards | `10–14px` |
| Product preview frame | `14–20px` |
| Dialog/sheet | `14–18px` |
| Large showcase panel | `18–22px` |

Rounded corners should support the hierarchy. Do not make every card, control, image, and outer section use the same large `rounded-3xl` shape.

### Borders and shadows

- Base border: `1px solid #E4E4E7`.
- Emphasized border: `1px solid #D4D4D8`.
- Use shadows only to communicate elevation or separate a preview from the canvas.
- Common shadow: `0 8px 28px rgba(24, 24, 27, 0.06)`.
- Product preview shadow: `0 20px 60px rgba(24, 24, 27, 0.10)`.
- Popover/dialog shadow: `0 12px 36px rgba(24, 24, 27, 0.12)`.
- Prefer surface contrast and fine borders over shadow stacks.
- No glassmorphism as a default surface treatment. No glow around every panel.

### Buttons

- **Primary:** near-black (`#18181B`) with white label, or Indigo 600 when the action is explicitly AI/brand related. Choose one primary treatment per context.
- **Secondary:** white surface, near-black label, neutral border.
- **Tertiary:** text button/link with a small arrow or icon where useful.
- **Focus:** visible 2px Indigo focus ring with offset.
- **Touch target:** minimum 44×44px.
- **Hover:** small color/border shift; avoid scale jumps that make layouts feel unstable.
- **Pressed:** slightly darken or translate by no more than 1px where appropriate.
- Use clear action labels. Do not use icon-only primary CTAs if a text label fits.
- Don't place two competing filled buttons side by side.

### Inputs and search

- White or Zinc 50 surface with a clear neutral border.
- Always provide a visible label or an accessible name; placeholders are examples, not labels.
- Search fields should make clear what they search and support a visible focus state.
- Errors should explain the problem and how to recover.
- Use one consistent height for similar control types; don't mix arbitrary heights in the same toolbar.

### Cards and panels

- A card must group a meaningful unit of content/action. Don't wrap every paragraph in a card.
- Use compact, scan-friendly tool/file items rather than oversized tiles with huge empty icon areas.
- Repeated cards must have equal alignment and predictable internal padding.
- A visually dominant product preview should be one coherent interface frame, not a collage of unrelated cards.

---

## 8. Icons, logos, and illustration

### Icons

- Use the project's existing Lucide React (`lucide-react`) icons consistently.
- Default UI icon size: `16–20px`; feature icon: `20–24px`; rarely larger than `28px` unless the icon is the main visual.
- Use a consistent stroke weight, approximately 1.75–2px.
- Use icons to support labels, not replace necessary labels.
- Avoid emoji as interface iconography. Do not mix Lucide outline icons, emoji, 3D icons, and a second unrelated icon library.

### Logo and brand mark

- Keep the existing Docuzy wordmark/brand mark if the repository already has it.
- Don't redraw or approximate the logo inside every section.
- Maintain its clear space and don't place it over visually noisy backgrounds.

### Illustration and photography

- Default to product UI, document thumbnails, and small UI crops rather than stock photography.
- Use illustration only where it explains a concept better than the product interface.
- When an illustration or photo is genuinely required, use an asset with a verifiable reuse license from an appropriate source (for example, Unsplash/Pexels for photography or an appropriately licensed illustration library) and keep a source/license note. Do not assume an image is free because it appears in search results.
- Don't use external images as substitutes for the actual Docuzy interface.
- Never copy a competitor's screenshots, logos, brand illustrations, or distinctive assets.

---

## 9. Preventing generic AI-generated design

This section is mandatory for any AI coding/design agent working on Docuzy. Treat these as **rejection criteria**, not optional suggestions.

### Do not generate these patterns by default

- The familiar AI landing-page recipe: centered eyebrow + huge headline + gradient blob + two buttons + three cards, repeated for every section.
- A row of three equally sized feature cards after every heading.
- Random blobs, sparkles, stars, floating pills, orbiting icons, glass panels, or decorative UI fragments without a clear product/story function.
- Multiple color gradients competing on one page.
- An overuse of rounded rectangles where every section looks like a card inside another card inside another card.
- Huge empty mockup cards containing only a generic file icon or pale skeleton bars.
- Tiny fake dashboards with unreadable text used as decoration.
- Stock photos of students/laptops when a real product visual would be more credible.
- Decorative statistics, fake customer logos, fabricated social proof, fake testimonials, made-up usage counts, or fictional ratings.
- Every section using centered copy followed by a symmetric grid.
- Repeating the same value proposition in multiple sections because the design lacks visual ideas.
- Unnecessary animations added solely to make the page look expensive.
- New fonts, accent colors, border styles, radii, shadows, or background treatments invented for a single section.

### Required design process before implementation

For a new landing section or app screen, the agent must:

1. Identify the single user question/job the screen must resolve, using `PRODUCT.md`, `USER-FLOWS.md`, and `CONTENT.md` as applicable.
2. Choose the best visual form for that job: real UI preview, split layout, tool grid, file list, workflow, comparison, editor, or plain copy—not the default card grid.
3. Reuse the defined typography, colors, grid, radii, and controls.
4. Decide the content density and dominant focal point before adding secondary elements.
5. If a real product UI does not exist yet, insert a clearly labelled placeholder with a precise replacement brief. Do not invent a finished-looking product flow and imply it's implemented.
6. Check the design at mobile and desktop widths.
7. Remove any decoration that does not improve comprehension, hierarchy, usability, or brand recognition.

### Visual review questions

Before accepting an AI-generated design, ask:

- Could this design belong to any random AI SaaS with only the logo changed? If yes, reject it and add product-specific structure.
- Is the interface visual relevant to the exact Docuzy workflow being described?
- Does every card, glow, icon, and animation have a job?
- Is there a clear visual hierarchy without making every item bold or colorful?
- Have we repeated a layout pattern just because it was easy for the model to generate?
- Are the product labels, sample filenames, and interaction states credible?
- Are we making a claim or showing a feature that does not exist yet?

If a screen looks polished but generic, don't add more effects. Rework its composition around the user's task and the actual product UI.

---

## 10. Marketing-site visual patterns

> This section describes the **visual treatment** of the marketing site. The source of truth for the homepage section order, copy, claims, metadata, and SEO is `CONTENT.md`.

### Global site shell

- Use the light theme throughout the marketing site; there are no full-width dark sections.
- Keep navigation compact, calm, and consistent with the app's typography.
- Use a white/off-white canvas, fine divider/border, and near-black text.
- Navigation should have a clear primary action, not several equally weighted buttons.
- Keep the header's height and horizontal alignment consistent across marketing pages.

### Hero composition

Preserve the original hero's composition as closely as practical, with the dark canvas removed:

- Centered layout and ample top/bottom space, but avoid a full viewport of empty canvas if the product preview can anchor the first screen.
- Compact rounded eyebrow with Sparkles icon and a short status/product label.
- Two-line large headline at desktop, bold Geist, tight tracking, close line-height.
- Main heading uses a legible Zinc gradient/solid treatment; the final emphasized phrase uses the existing Indigo gradient family.
- One narrow body paragraph beneath the heading.
- One primary CTA and one quiet secondary CTA; don't make both visually dominant.
- Small metadata row beneath CTAs.
- Soft indigo radial glow behind the main content—wide, very low opacity, no visible blob edge.
- The light background must remain visibly light at all viewport sizes.
- Put the workspace preview below the hero copy with a controlled overlap. The preview must have enough real detail to reward scrolling and should not overwhelm the heading.

**Hero implementation guardrails**

- Keep the `text-5xl md:text-7xl`, `font-bold`, `tracking-tight`, and approximately `leading-[1.05]` character of the existing hero unless responsive testing proves a change is needed.
- Reuse the current Indigo 300/500 brand gradient treatment, with a contrast-safe endpoint for text on white.
- The old white primary button must be adapted to the light canvas; use a near-black primary or a white button with a definite border and shadow over the indigo halo so its edge remains clear.
- Do not add a hero video, abstract illustration, logo wall, testimonials, animated particles, or extra text unless the product/content docs specifically call for it.
- Don't use a global page `scrollY` mapping to create effects that behave oddly after scrolling past the hero. Scope scroll transforms to the intended element/section, and respect reduced-motion preferences.

### Problem/solution comparison

- Use two contrasting surfaces on a light canvas: a quiet neutral “before” side and a cleaner, more resolved “with Docuzy” side.
- Show a small set of fragmented tool/file windows in the first visual; keep it composed, not chaotic.
- Show one coherent, light-mode Docuzy workspace visual in the second. It should visibly contain the relevant destinations/features rather than only a Docuzy logo card.
- Indigo should emphasize the resolved state, selected destinations, or one key connection—not fill the entire panel with saturated purple.
- The comparison should still communicate without animation. Optional animation may gently converge the fragmented items toward the workspace.

### AI document interaction showcase

- Use a clear document-reader + AI-panel composition so the relationship between source document and response is immediately visible.
- Show a readable title, believable text density, one selected/highlighted passage, a question, and a contextual answer.
- The UI must not imply source citations, precise passage attribution, or features unless the actual implementation supports them.
- Favor a horizontal split on wide screens; stack or provide a sensible switcher on mobile.
- Indigo can mark the question focus, selected passage, AI icon, or one answer detail. Keep most panels white.

### Tools showcase

- Use a tool launcher/directory composition with clear categories, search, and compact action items.
- Tool names should scan quickly. One icon and a short title are usually sufficient in a grid.
- Avoid oversized empty tool cards and explanatory paragraphs inside every tile.
- Use the same icon size, title position, hit target, and hover behavior for every tool.
- Only show live tools as available. The live tool list and status must come from `PRODUCT.md` and `CONTENT.md`, not be invented by the design agent.

### Organization/workspace showcase

- Use a realistic light-mode file manager: navigation/folders, search, recent or all files, recognizable file types, and believable file names.
- Keep rows/cards compact enough to resemble a working application. Don't render all files as giant empty document placeholders.
- Use realistic but fictional sample names such as `Research Paper.pdf`, `Lecture Notes.pdf`, or `Project Report.docx` when real screenshots are unavailable.
- Never use private user documents or real personal data in promotional previews.

### Workflow/how-it-works visual

- Prefer a connected sequence with one small UI crop or icon per step over a row of giant cards.
- The current step may use Indigo; inactive steps remain neutral.
- Scrolling may reveal each step, but normal scrolling must never be blocked or hijacked.

### Student/use-case visual

- Prefer small document thumbnails, file-type labels, or simple line icons; avoid generic student stock photos by default.
- Use a compact layout that relates each use case to a specific document workflow.
- Do not expand each audience/use case into another long landing section unless `CONTENT.md` deliberately specifies it.

### Final CTA and footer

- Keep both light mode. The CTA may use a white surface, neutral border, or gentle indigo halo; no full-width dark slab.
- Use a clear CTA hierarchy and a compact footer.
- Avoid invented customer counts, ratings, testimonials, and partner logos.

---

## 11. Product UI design system

The marketing site and signed-in app should clearly belong to the same product. The marketing site may be more expressive; the application must prioritize clarity, file handling, and efficient work.

### App foundations

- Default to a light canvas with white work surfaces, near-black labels, muted metadata, and subtle dividers.
- Indigo communicates focus, active destination, selection, links, and AI-related actions.
- Lime is decorative only and must not replace semantic success/error colors.
- Keep the workspace calm and information-dense enough to be useful, without compressing labels or actions.
- Never use visual flair to obscure filenames, format, size, location, modified time, or the next action.

### App shell

Desktop starting point (adapt after testing with the real routes):

- Left navigation: approximately `220–252px`.
- Top bar: consistent search/command field and profile/menu actions that are actually implemented.
- Main content: flexible, with consistent horizontal gutters and sensible max width.
- Optional right-side panel: AI chat or context only where the flow benefits from it; it must be possible to close/collapse it when implemented.

Do not show navigation items that lead to unavailable routes. The canonical navigation order and access conditions come from `USER-FLOWS.md`.

### Workspace/home screen

Prioritize orientation and next actions:

- Clear page title.
- Compact primary action row for the actions supported by the product.
- Recently opened/updated files or a helpful empty state.
- Folder/file overview.
- Storage usage only when accurate quota/usage data exists.

When the actual screen is not ready, use a labelled placeholder rather than a fabricated finished dashboard:

`[PRODUCT UI PLACEHOLDER — Workspace home. Replace with an actual screenshot after this screen is implemented. Show navigation, primary actions, recent files, folders/files, search, and the AI entry point only if each is implemented.]`

### Files and folders

- Offer list/grid views only if both are implemented and meaningfully useful.
- Show relevant metadata consistently: name, type, modified time, and size when available.
- Keep common actions in a concise menu/toolbar; don't put many icons into every row.
- Make search/filter easy to find.
- Support loading, empty, no-results, error, and disabled states.

Placeholder:

`[PRODUCT UI PLACEHOLDER — All files. Show folders, recognizable file types, search/filter controls, file metadata, and a useful empty state. Replace when implemented.]`

### Document reader and AI panel

- Give the document/content area the space needed for reading; don't let the chat panel dominate by default.
- Keep the selected document/context visible.
- Differentiate user and AI messages through hierarchy and spacing first; use colored bubbles sparingly.
- Include conversation loading, streaming, no-context, failure, and retry states where relevant.
- Only show highlighting/citations/source navigation when those behaviors actually exist.

Placeholder:

`[PRODUCT UI PLACEHOLDER — Document reader + AI chat. Show the selected file, document content, conversation, and composer. Do not imply unsupported citations or source-highlighting behavior.]`

### Tools directory and individual tool pages

Directory:

- Clear title and concise task orientation from `CONTENT.md`.
- Search field and logical groups (for example, PDF and Images when those categories match the live product).
- Compact consistent tool items with icon and name.
- No unrelated promotional cards around the tool chooser.

Individual tool page composition:

1. Breadcrumb.
2. Direct task heading.
3. One brief description of the outcome.
4. Dominant upload/drop zone.
5. Selected-file list and necessary options after upload.
6. One primary action.
7. Processing, success/download, and error/retry states.
8. Optional concise help content below the task interface.

Placeholder:

`[TOOL UI PLACEHOLDER — Upload/drop area, accepted formats, selected-file list, required options, primary action, progress, result/download, and error states. Implement the relevant states before removing this label.]`

Do not show planned tools as if functional. Use `PRODUCT.md` for the launch feature truth.

### Rich-text editing/document creation

- Optimize for legibility, a comfortable content width, predictable toolbar behavior, and clear save status.
- Group editor actions logically and avoid overcrowding the toolbar.
- Keep marketing copy out of the editor canvas.
- For an empty document, provide a direct prompt or first action rather than a large decorative illustration.

### Authentication and onboarding

- Keep sign-in/sign-up focused and visually consistent with the rest of Docuzy.
- List only enabled authentication providers.
- Make errors, next steps, and return paths clear.
- Don't expose the full complexity of the workspace before the user needs it.

### Settings and account pages

- Group related settings, with a simple sub-navigation if needed.
- Keep destructive actions separate and confirm irreversible changes.
- Don't use brand accent as decoration on every row.

---

## 12. Component behavior and states

Every interactive component should have deliberate states. Applicable states include:

- Default
- Hover
- Keyboard focus
- Active/selected
- Disabled
- Loading/processing
- Empty
- No results
- Success
- Error with recovery action

### Empty states

- Explain what is missing.
- Offer one relevant next action.
- Do not display fake document counts or pretend data to make a new account look busy.
- Avoid giant generic illustrations that overpower the next action.

### Loading states

- Use skeletons only for genuinely loading content and match their size to the final layout.
- Do not leave skeleton-like empty cards as the permanent landing-page visual.
- Keep loading feedback calm and informative; prevent layout shifts where possible.

### Error states

- State what happened in plain language and what the user can do next.
- Keep destructive/error color confined to the relevant message/action.
- Preserve user input or selected files when safe to do so.

### Disabled/unavailable features

- Do not make disabled or planned features look like active CTAs.
- Do not populate marketing sections with “Coming Soon” cards simply to make a page appear larger.
- Follow `PRODUCT.md` and `USER-FLOWS.md` for actual launch scope and access conditions.

---

## 13. Motion and interaction

Motion should be subtle, sparse, and subordinate to content. It must not make the experience resemble a motion-template demo.

### Allowed motion

- Section reveal: opacity plus `12–20px` upward movement, once.
- Large product preview: a restrained scale from `0.98` to `1` or a slight reveal.
- Button/icon hover: small color, border, or icon position change.
- AI showcase: question appears → relevant passage highlights → answer appears, once or on a deliberate replay.
- Problem/solution composition: small fragmented windows converge toward the workspace, only if the effect is smooth and understandable.
- Menus, tabs, side panels, and file selections: short transitions that clarify state changes.

### Timing

| Motion | Duration |
|---|---:|
| Hover/micro-interaction | `120–200ms` |
| Menu/popover/panel | `160–240ms` |
| Section reveal | `350–550ms` |
| Showcase sequence | `500–900ms` total, unless real interaction requires longer |

Use a restrained easing curve near `cubic-bezier(0.2, 0.7, 0.2, 1)`.

### Motion to reject

- Constant floating cards across the whole page.
- Cursor-following blobs or background effects.
- Infinite typing animations that repeat while the user is reading.
- Spinning 3D objects, particle fields, scroll-jacking, or large parallax unrelated to the content.
- Different animation personalities for every section.
- Animation as the only way to understand a state.

Respect `prefers-reduced-motion`. Reduced-motion users must get the complete layout/content immediately, without parallax or required movement.

### Scroll implementation guardrails

When implementing with Framer Motion:

- Scope scroll progress to the intended section/preview with a target ref and offsets. Avoid mapping the entire page's `scrollY` directly to an element's opacity/position unless that global behavior is intentional and verified.
- Keep transforms small enough that content does not drift out of alignment or become unreachable.
- Avoid large negative margins plus large transform values that cause overlap to differ unpredictably by viewport.
- Check that animation does not alter reading order, hit targets, sticky navigation, or document flow.

---

## 14. Responsive behavior

Design mobile as a deliberate composition, not a desktop screenshot scaled down.

Suggested breakpoints, subject to the repository's actual Tailwind config:

- Mobile: `< 640px`
- Tablet: `640–1023px`
- Desktop: `1024–1279px`
- Wide: `1280px+`

Rules:

- Hero headline wraps naturally into two or three intentional lines; never clip horizontally or leave a single short orphan line.
- Reduce the glow size and opacity on mobile so it doesn't wash out the content or create horizontal overflow.
- Stack hero CTAs on narrow screens when needed; keep them comfortably tappable.
- Bring the product preview closer to the hero content on mobile; do not create a huge empty gap.
- Convert split feature sections to a clear vertical order. Choose whether copy or visual comes first based on comprehension.
- Use `16–20px` mobile page gutters.
- Tool/file grids should step from 3–4 columns to 2 columns and then 1 where labels or interactions need room.
- On mobile, a document/AI split should stack or expose a clear way to switch between the document and chat.
- App navigation should collapse into a drawer or compact navigation; never squeeze a full desktop sidebar into a narrow viewport.
- Hide decoration before hiding meaningful content.
- Check `320px`, `375px`, `768px`, `1024px`, and `1440px` widths, plus at least one wide desktop viewport.

---

## 15. Accessibility and usability

- Use one H1 per page and a meaningful heading hierarchy.
- Meet WCAG AA contrast targets for text and essential controls wherever possible.
- Do not use Indigo 300 as small text on white; use a contrast-safe Indigo shade.
- Every meaningful image requires appropriate alt text; decorative glow/decoration should be hidden from assistive technology.
- Every icon-only control needs an accessible name.
- Keyboard focus must be clearly visible; do not remove outlines without a replacement.
- Color must not be the only indicator of file state, error, selection, or completion.
- Don't rely on hover for essential functions.
- Ensure dialogs, dropdowns, upload flows, and tool controls are keyboard usable.
- Keep marketing copy as real HTML text rather than embedding essential text inside screenshot images.
- Ensure motion can be reduced or disabled without losing information.

---

## 16. Asset and placeholder policy

### Product screenshots come first

For Docuzy, a coherent product UI is usually more valuable than stock photography. Since some screens are still being built, placeholders are expected during development—but they must be precise and temporary.

Use this placeholder format:

```text
[PRODUCT UI PLACEHOLDER
Replace with: <specific screen/state and what must be visible>.
Capture after: <route/component is implemented>.
Preferred ratio: 16:10 or 16:9 unless the layout requires another ratio.
Do not ship this placeholder as a finished marketing visual.
]
```

Placeholder requirements:

- Say exactly what UI should appear, not simply “add screenshot here.”
- State whether the image is a crop of a real screen, a composed preview, or a temporary illustration.
- Keep the placeholder inside the same frame/aspect ratio as the intended asset to avoid layout shifts when replaced.
- Use fictional sample filenames and data.
- Never imply a planned feature is live.

### Using copyright-free external assets

Use external photography only if it materially helps explain the product or use case. Verify the exact asset's license and keep an attribution/source note. Don't use a random search-engine image, competitor screenshot, or unrelated stock visual just to fill whitespace. Icons should come from the project's installed Lucide set unless there is a documented reason otherwise.

---

## 17. Design tokens for implementation

Centralize tokens in the project's current CSS variables/theme/Tailwind setup. Do not sprinkle almost-identical hard-coded colors through components. Adapt variable naming to the existing codebase rather than adding a competing token layer.

```css
:root {
  color-scheme: light;

  --docuzy-canvas: #FAFAFA;
  --docuzy-surface: #FFFFFF;
  --docuzy-surface-subtle: #F4F4F5;
  --docuzy-surface-hover: #F4F4F5;

  --docuzy-text: #18181B;
  --docuzy-text-secondary: #52525B;
  --docuzy-text-muted: #71717A;

  --docuzy-border: #E4E4E7;
  --docuzy-border-strong: #D4D4D8;

  --docuzy-indigo-300: #A5B4FC;
  --docuzy-indigo-400: #818CF8;
  --docuzy-indigo-500: #6366F1;
  --docuzy-indigo-600: #4F46E5;
  --docuzy-indigo-700: #4338CA;
  --docuzy-indigo-tint: #EEF2FF;
  --docuzy-indigo-glow: rgba(79, 70, 229, 0.14);

  --docuzy-accent-lime: #D9F99D;

  --docuzy-success: #15803D;
  --docuzy-warning: #A16207;
  --docuzy-danger: #B91C1C;
  --docuzy-info: #1D4ED8;

  --docuzy-radius-control: 0.625rem;
  --docuzy-radius-card: 0.875rem;
  --docuzy-radius-panel: 1.125rem;

  --docuzy-shadow-card: 0 8px 28px rgba(24, 24, 27, 0.06);
  --docuzy-shadow-preview: 0 20px 60px rgba(24, 24, 27, 0.10);
  --docuzy-shadow-popover: 0 12px 36px rgba(24, 24, 27, 0.12);
}
```

Use the closest existing token/component before introducing a new one. If a genuinely new token is needed, add it here (and to the implementation theme) with a short explanation.

---

## 18. Implementation rules for design agents

When asked to implement a page or component:

1. Inspect the existing repository and reuse current components, font setup, theme, icon package, and animations where appropriate.
2. Read `PRODUCT.md` and `USER-FLOWS.md` before deciding what the UI should do. Read `CONTENT.md` for copy and SEO.
3. Use the visual style and tokens in this file; do not invent a new visual direction or reinterpret the palette.
4. Preserve existing application behavior unless the task explicitly requests a behavior change.
5. Build real responsive HTML/CSS components—not a single image of a website and not a collection of decorative boxes.
6. Use real supported data/behavior where available. Otherwise mark the relevant interface as a labelled placeholder and don't make it seem production-ready.
7. Prefer small, reusable components that match actual repeated patterns; don't abstract one-off decoration into a sprawling design system.
8. Do not add dependencies, fonts, icon libraries, image libraries, or animation packages without checking whether the repository already has an equivalent.
9. Keep animation restrained and accessible. Check reduced motion and mobile behavior.
10. After implementation, compare the page against the stated reference direction and the live design tokens—not only against the AI's own generated preview.

### Before calling a design complete

- Check desktop and mobile layouts.
- Check the actual font loaded and the intended type wrap.
- Verify all important text/controls have sufficient contrast.
- Verify active, hover, focus, disabled, loading, empty, error, and success states where relevant.
- Check that images/screenshots are accurate, licensed, and appropriately labelled.
- Remove duplicated headlines, repeated value propositions, redundant cards, and decorative elements with no job.
- Confirm no dark marketing section has slipped into the design.
- Confirm no fictional feature or product claim has been introduced.

---

## 19. Related documentation and ownership

| File | Owns |
|---|---|
| `PRODUCT.md` | Product definition, launch scope, users, capabilities, constraints, and product truth |
| `USER-FLOWS.md` | User journeys, routes, navigation, redirect/access rules, and states across flows |
| `AGENTS.md` | Instructions and workflow rules for AI coding agents |
| `CONTENT.md` | Page architecture, approved marketing copy, naming, content hierarchy, metadata, SEO, FAQs, and SEO-oriented tool-page content |
| `DESIGN.md` | Visual system, layout/composition, components, interaction design, motion, responsive behavior, accessibility, and visual QA |

Do not move page copy, SEO keyword lists, meta descriptions, or content architecture into `DESIGN.md`. Do not copy product requirements from `PRODUCT.md` into it. Keep these files complementary and link to the relevant source instead of maintaining duplicate versions.

---

## 20. Final design review

A design is ready only when the answer to each relevant question is yes:

- Does it clearly use the Docuzy visual identity: light canvas, Geist, Zinc neutrals, and the existing Tailwind Indigo family?
- Is the old hero's typography and indigo treatment preserved without bringing back the dark background?
- Is there one clear visual focal point, with a meaningful product UI where appropriate?
- Does the layout serve the task rather than repeating a generic AI-SaaS template?
- Are color, spacing, borders, radii, buttons, and icon use consistent with the tokens?
- Are mockups accurate or explicitly labelled as placeholders?
- Are all represented features supported by `PRODUCT.md` and flows by `USER-FLOWS.md`?
- Is visible text concise and owned by `CONTENT.md`?
- Does the page work on mobile, with keyboard navigation, and with reduced motion?
- Have unsupported claims, fake proof, irrelevant imagery, and decoration without purpose been removed?

**When in doubt, simplify the composition, strengthen the product visual, and refine hierarchy before adding another card, color, gradient, or animation.**
