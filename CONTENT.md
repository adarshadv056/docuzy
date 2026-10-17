# Docuzy — Content Architecture & SEO Source of Truth

> **Purpose:** Define the approved messaging, page structure, user-facing copy, and SEO rules for Docuzy's marketing website and public tool pages. This document is about **what we say and in what order**—not how the interface looks or how the product is implemented.
>
> **Status:** Homepage copy v1 — ready for implementation, with product claims subject to the checks below.

---

## 1. How to use this file

Before changing public-facing copy:

1. Read `PRODUCT.md` for the product's actual launch scope, supported files, available features, pricing, and claims we can truthfully make.
2. Read `USER-FLOWS.md` for real routes, navigation behavior, authentication, and where each CTA must lead.
3. Read `AGENTS.md` for repository and coding-agent workflow.
4. Read `DESIGN.md` for visual hierarchy and presentation rules.
5. Use this file as the source of truth for the marketing message, section order, approved copy, metadata, and SEO content patterns.

Do not duplicate the product specification here. Do not invent features, routes, integrations, pricing, limits, privacy promises, file compatibility, or launch status. If a claim is not confirmed in `PRODUCT.md` or the running product, leave it out or label it honestly.

If a feature changes status, update the copy here rather than improvising new wording in a component.

---

## 2. Content strategy

### Core message

**Docuzy is an AI-powered document workspace where students can organize their files, work with everyday document tools, and ask questions about supported documents.**

### What a visitor should understand in five seconds

1. Docuzy is a **workspace for documents**, not only a PDF utility or a standalone AI chatbot.
2. The workspace brings together three main jobs: **organize documents, work on files, and understand document content with AI**.
3. Students are the primary audience, while people who regularly work with documents can also benefit.

### Message hierarchy

1. **Workspace:** where documents live and are managed.
2. **Tools:** practical PDF and image utilities for common file tasks.
3. **AI:** ask questions about supported document content and get contextual help.
4. **Student workflows:** lecture notes, assignments, research papers, projects, and career documents.

Use the hierarchy to explain the product. Do not give every feature equal weight on the homepage.

### Brand voice

- Clear, capable, calm, and human.
- Confident without hype.
- Product-led: explain what the user can do, then show the interface that does it.
- Specific rather than abstract.
- Written for a smart student who wants to get work done, not for an AI researcher.
- Use short sentences and concrete verbs: **store, organize, edit, convert, find, ask, understand**.
- Use “AI” where it adds meaning. Do not put “AI-powered” in every heading.
- Use “you” and “your” naturally, but avoid forced motivational language.

### Avoid these writing patterns

Do not use:

- “Revolutionize your workflow,” “unlock your potential,” “supercharge productivity,” “seamless experience,” “next-generation,” “all-in-one solution,” or other interchangeable SaaS filler.
- Several consecutive sentences repeating the same promise with different words.
- A headline in the eyebrow and the same headline repeated immediately below it.
- A separate homepage section for every small feature.
- Unsupported claims such as “the best,” “the fastest,” “unlimited,” “100% secure,” “military-grade encryption,” or “trusted by thousands.”
- Fake testimonials, fake customer counts, invented reviews, fabricated logos, or unverified savings/time claims.
- Keyword lists visible to users, hidden SEO paragraphs, or unnatural keyword repetition.
- “Ask your documents, not the internet” as a literal guarantee that Docuzy never uses general model knowledge. The phrase is a positioning line for document-focused Q&A; supporting copy must accurately describe the product's real behavior.

---

## 3. Homepage architecture — final order

The homepage should stay focused. Do **not** add a separate “Product Story” section directly after the hero: it repeats the hero's “one workspace” promise. The next section should explain the problem and show the change Docuzy offers.

Approved sequence:

1. Navigation
2. Hero
3. Problem → solution
4. AI document chat
5. PDF and image tools
6. Document organization
7. How it works
8. Final CTA
9. Footer

This is the default launch version. Do not insert new sections unless they answer a distinct user question or the product owner approves them.

### Section jobs

| Section | Its one job | Do not use it to |
|---|---|---|
| Hero | Explain what Docuzy is and state the main promise | List every feature or describe implementation details |
| Problem → solution | Make fragmented document work relatable and show the consolidated alternative | Repeat the hero headline or become a long essay |
| AI | Demonstrate document Q&A with a specific interaction | Claim every file type is supported or promise perfect answers |
| Tools | Show the everyday PDF/image tasks available in Docuzy | Explain each tool in a separate marketing block |
| Organization | Show how documents are kept findable | Repeat the general “everything in one place” message without detail |
| How it works | Make the basic workflow easy to understand | Introduce new features or lengthy onboarding instructions |
| Final CTA | Give the visitor one clear next action | Add a new product pitch or unverified social proof |

---

## 4. Homepage copy — approved draft

Use this wording as the baseline. Minor edits for line length are acceptable; changes to the product promise or section hierarchy are not. Keep the copy concise and let the product visuals carry the explanation.

## 4.1 Navigation

**Logo:** Docuzy

Recommended links (use only routes/anchors that actually exist):

- AI Workspace
- PDF & Image Tools
- Organization
- How It Works

Actions:

- Sign In
- **Get Started Free**

Use section anchors for links that stay on the homepage. Use the real auth/app routes from `USER-FLOWS.md`; do not invent destinations. If pricing is not finalized, do not show a pricing link merely because other SaaS sites do.

## 4.2 Hero

**Eyebrow:**

`Docuzy · Live`

**H1:**

`Your Entire Workspace.`

`Organized & AI-Powered.`

**Supporting copy:**

> Every editing tool you need, in one place. Organize your files, share your work, and let our AI handle the heavy lifting with Docuzy.

**Primary CTA:** `Get Started Free`

**Secondary CTA:** `Explore the Workspace`

**Small supporting labels:**

`PDFs · Documents · Images · AI`

### Hero content rules

- Keep the established centered composition, type treatment, badge, restrained indigo gradient, and soft indigo glow from the existing waitlist hero, adapted to the **light-only** system in `DESIGN.md`.
- This remains the only H1 on the homepage.
- Do not add another paragraph, feature-card row, waitlist language, social proof, or statistics to the hero.
- The product preview below the hero should use a real Docuzy screenshot when available. Until then, use a clearly identified, code-built mock interface based on real planned UI—not a random stock dashboard and not a fake screenshot presented as live software.
- Only use “Get Started Free” if the live signup and free access are genuinely available. Otherwise use an accurate CTA such as “Get Started” or “Join the Waitlist.”
- Document sharing is confirmed for launch (see `PRODUCT.md`), so the hero may reference sharing your work. Keep other capability claims limited to features confirmed at launch.

## 4.3 Problem → solution

**Eyebrow:**

`WHY DOCUZY`

**H2:**

`Your documents are everywhere. Your workspace shouldn't be.`

**Intro:**

> Files in one place. PDF tools in another. AI somewhere else. Docuzy brings them together into one workspace.

### Before Docuzy

**Short line:**

`Files here. Tools there. AI somewhere else.`

Use these labels in the visual if needed:

- PDF Tool
- Cloud Folder
- Image Converter
- AI Chat
- Downloads
- Document Editor

**Closing line:**

`Too many tools. Too many tabs. Too much friction.`

### With Docuzy

**Short line:**

`Store your documents. Work with them. Use the right tools. Ask AI when you need it.`

Use these small labels in the product visual:

`Documents · Tools · AI`

### Content rules

- Make this a concise before/after comparison, not two long blocks of copy.
- Use generic representations of other tools. Do not use third-party logos or imply partnerships.
- The “With Docuzy” visual must show a believable workspace UI, not only a Docuzy logo inside a purple card.
- Do not repeat “Everything you work on, in one place” as a separate product-story section. The hero and this problem/solution section already establish the unified-workspace promise.

## 4.4 AI document chat

**Eyebrow:**

`AI DOCUMENT CHAT`

**H2:**

`Ask your documents, not the internet.`

**Supporting copy:**

> Upload a PDF or supported document, ask a question, and get contextual answers based on its content. Summarize a chapter, explain a concept, or find key points without searching page by page.

**Small subheading beside the UI:**

`Understand more. Search less.`

**Suggested example prompts inside the interface:**

- `Summarize this chapter.`
- `What are the main findings?`
- `Explain this concept in simple terms.`

**Small supporting label:**

`Answers grounded in your document content.`

### Content rules

- Do not repeat the H2 in the left column or directly below the eyebrow. Use “Understand more. Search less.” as the secondary heading where the layout needs one.
- The central visual should explain the relationship between a document and its AI conversation: document content on one side, question and answer on the other.
- Prefer a realistic code-built UI mockup until a real screenshot exists. Use legible sample content rather than endless grey skeleton lines.
- If the product only supports specific file types for AI, say “supported documents” or name verified formats. Do not imply that every uploaded file can be queried.
- Citations and source references are verified in the live chat (answers cite `[n]` excerpts and a Sources list is derived from them), so a grounded answer and a Sources reference may be shown. Do not promise perfect accuracy or hallucination-free answers, and do not imply exact passage-level highlighting or page-number accuracy before those are implemented.
- Do not make voice interaction a headline promise unless it is implemented and available at launch.

## 4.5 PDF and image tools

**Eyebrow:**

`PDF & IMAGE TOOLS`

**H2:**

`Handle file tasks without breaking your flow.`

**Supporting copy:**

> Merge or compress PDFs, add page numbers, convert PDF pages to images, or crop and resize images. Docuzy brings everyday PDF and image tools together so common file tasks take fewer steps.

**Tool groups and labels**

PDF:

- Merge PDF
- Compress PDF
- Add Page Numbers
- PDF to Images
- Sign PDF
- Image to PDF

Images:

- Compress Image
- Crop Image
- Resize Image
- Convert to JPG
- Convert to PNG
- Convert to WebP
- Add Watermark

### Content rules

- Only show tools confirmed as implemented and usable. Hide or clearly mark unavailable tools; never style a non-functional tool as live.
- Use the exact feature name the user would recognize. Prefer “PDF to Images” over vague labels like “Conversion.”
- The tools area should be a compact tool shelf or directory preview, not an identical grid of oversized feature cards.
- Tool labels can link to their actual tool routes. Derive paths from the application/repository and `USER-FLOWS.md`; do not invent route slugs in this file.
- Do not use “free” in headings or metadata unless the relevant tool is genuinely free under current product rules.

## 4.6 Document organization

**Eyebrow:**

`YOUR DOCUMENTS`

**H2:**

`Everything has a place.`

**Supporting copy:**

> Keep lecture notes, assignments, research papers, and project files easy to find. Use folders, tags, and search to organize your documents around the way you study and work.

**Suggested short labels for the UI visual:**

- Folders
- Tags
- Search
- Recent Documents

### Content rules

- Keep the focus on storing and finding documents; do not repeat the broader hero promise here.
- Prefer a real file-manager screenshot once the workspace is implemented.
- Until then, use a code-built mock interface with plausible filenames and a clear placeholder in the source, for example: `[PLACEHOLDER: Replace with real Docuzy file manager screenshot]`.
- Never use a random image from the internet to stand in for the Docuzy interface. Copyright-free editorial imagery may be used only when an image genuinely helps explain a concept; product UI is the priority here.
- Mention sharing, collaboration, cloud-sync, storage limits, or file recovery only if the live product supports those features and `PRODUCT.md` confirms them.

## 4.7 How it works

**Eyebrow:**

`HOW IT WORKS`

**H2:**

`From file to finished work.`

**Intro:**

> One straightforward workflow for organizing documents, working with files, and understanding their content.

**Step 01 — Upload**

`Bring your PDFs and other supported files into Docuzy.`

**Step 02 — Organize**

`Use folders, tags, and search to keep documents easy to find.`

**Step 03 — Work**

`Use available editing, PDF, and image tools for everyday file tasks.`

**Step 04 — Ask AI**

`Ask questions about supported documents and explore the information inside them.`

### Content rules

- Keep each step to a short title and one sentence.
- Use one connected workflow or an aligned sequence, not four large feature cards.
- Do not imply that every file follows the same processing pipeline if supported formats or tool workflows differ.

## 4.8 Final CTA

**H2:**

`Make your documents easier to work with.`

**Supporting copy:**

> Bring your files, everyday tools, and document Q&A together in Docuzy.

**Primary CTA:**

`Get Started Free`

**Optional quiet line:**

`Your documents. Your workspace. Your AI.`

### Content rules

- Keep this block short. Do not introduce another feature, list of tools, testimonial, or statistic.
- Use the same primary CTA as the hero.
- Confirm the destination and availability of the free plan before publishing.

## 4.9 Footer

**Brand description:**

`The AI-powered document workspace for students.`

**Product links:**

- AI Document Chat
- PDF & Image Tools
- Document Workspace

**Resources:**

- Blog (only if published)
- Help / Support (only if available)

**Legal:**

- Privacy Policy
- Terms of Service

**Social:**

Include only real, maintained profiles.

**Copyright line:**

`© {current year} Docuzy. All rights reserved.`

### Footer rules

- Remove placeholder links before launch.
- Do not link to empty pages, empty blog categories, or social profiles that do not exist.
- Use the current year dynamically rather than hardcoding it permanently.

---

## 5. Homepage SEO

SEO should clarify the product for search engines and users. It must not distort the visible design or turn the homepage into keyword-heavy copy.

### Homepage metadata

**Title:**

`Docuzy — AI Document Workspace & PDF Tools for Students`

**Meta description:**

`Organize your documents, use PDF and image tools, and ask AI questions about your files in one workspace built for students.`

**Canonical URL:**

`https://docuzy.app/`

Confirm the canonical domain and deployment hostname before launch.

**Open Graph title:**

`Docuzy — Your Entire Workspace. Organized & AI-Powered.`

**Open Graph description:**

`Store, organize, and work with your documents using built-in PDF and image tools and AI-powered document Q&A.`

**Suggested social preview alt text:**

`Docuzy document workspace showing organized files, PDF tools, and an AI document conversation.`

### Heading structure

- One visible H1: `Your Entire Workspace. Organized & AI-Powered.`
- Use H2s for the main page sections.
- Use H3s for “Before Docuzy,” “With Docuzy,” individual tool groups, and workflow steps where semantically appropriate.
- Do not use headings merely to style text. Use the visual hierarchy in `DESIGN.md` for typography.

### Homepage keyword themes

Use these naturally in the visible copy and related metadata. Do not force every phrase onto the homepage.

**Primary theme**

- AI document workspace for students

**Supporting themes**

- document management for students
- organize documents online
- AI document chat
- ask questions about PDFs
- chat with PDF / AI PDF Q&A
- online PDF tools
- PDF and image tools
- merge PDF online
- compress PDF
- convert PDF to images
- image resizing and conversion tools
- student productivity tools

Individual utilities should target their own dedicated pages rather than competing with the homepage for every specific tool query.

### SEO implementation checklist

- Write a distinct, descriptive title and meta description for each indexable public page.
- Set the canonical URL to the preferred production URL, not localhost or a preview deployment.
- Ensure the main content is available in rendered HTML and not solely inside an image or a client-only canvas.
- Give meaningful, concise alt text to informative product imagery. Use empty alt text for purely decorative visuals.
- Use descriptive internal links such as “Compress PDF” instead of “Click here.”
- Avoid duplicate H1s and duplicate metadata across tool pages.
- Add structured data only when it accurately represents visible, factual content. Do not fabricate ratings, reviews, offer prices, organization details, or FAQs.
- Create an XML sitemap and configure `robots.txt` based on the real public routes. Do not index private workspace, account, upload, or user-specific URLs.
- Avoid publishing thin pages that merely repeat a tool name and a button. Each indexable tool page should provide useful instructions and accurate details.
- Track Search Console coverage and real search queries after launch; update copy based on evidence rather than guessing keyword density.

---

## 6. Public tool pages — reusable content pattern

The tool pages can attract specific search intent. Keep their content useful and compact: the actual tool should be prominent, followed by clear instructions and relevant details. Do not create a long SEO article before the user can reach the tool.

### Tool page order

1. Breadcrumb: `Home / Tools / {Tool Name}`
2. One unique H1 that names the task.
3. One or two sentences stating what the tool does.
4. The working tool interface near the top of the page.
5. Short “How to {task}” instructions (normally three steps).
6. Relevant supported formats, limits, or output details—only if verified.
7. A short, genuinely useful FAQ only when it answers actual user questions.
8. Links to closely related tools.

### Tool page title and description template

**Title:** `{Primary task} Online — Docuzy`

**Meta description:** `Use Docuzy to {perform task} online. {Describe the useful result clearly}.`

Use a unique, natural description for each tool. Do not repeat “fast, easy, free, secure” in every metadata description. Only use those claims where verified.

### Suggested H1/title directions for the currently planned tools

Use these as draft SEO labels, not as authority over actual routes or feature scope. Publish only tools that are genuinely functional at launch.

| Tool | Suggested H1 | Search intent to answer |
|---|---|---|
| Merge PDF | Merge PDF Files Online | Combine multiple PDF files into one document |
| Split PDF | Split a PDF Online | Extract a page range or specific pages into a new PDF |
| Compress PDF | Compress a PDF Online | Reduce PDF file size at one of three quality levels (High, Medium, Low) |
| Add page numbers | Add Page Numbers to a PDF | Number PDF pages before sharing or submitting |
| PDF to images | Convert PDF Pages to Images | Export pages from a PDF as image files |
| Sign PDF | Sign a PDF Online | Add a signature to a PDF using the actual supported workflow |
| Watermark PDF | Add a Watermark to a PDF | Stamp text or an image across PDF pages |
| Image to PDF | Convert Images to PDF | Combine or convert supported images into a PDF |
| Compress image | Compress an Image Online | Reduce an image's file size |
| Crop image | Crop an Image Online | Crop an image to the required frame or dimensions supported by the tool |
| Resize image | Resize an Image Online | Change image dimensions to a chosen size |
| Convert to JPG | Convert an Image to JPG | Convert supported image formats to JPG |
| Convert to PNG | Convert an Image to PNG | Convert supported image formats to PNG |
| Convert to WebP | Convert an Image to WebP | Convert supported image formats to WebP |
| Watermark | Add a Watermark to an Image | Add a watermark using the actual controls provided |
| HTML to Image | Convert HTML to an Image | Render an HTML snippet into a PNG or JPG image |
| JSON to CSV | Convert JSON to CSV | Turn a JSON file into a CSV spreadsheet |

These labels are stored per tool in `lib/tools-catalog.ts` (`seo.title` / `seo.description`) and rendered by the `/tools/[slug]` route. Update the catalog — not this table — when a tool's metadata changes; keep the two in sync.

### Related-tool links

Use links to help users move to the next likely task. Examples:

- Merge PDF ↔ Compress PDF ↔ Add Page Numbers to PDF
- PDF to Images ↔ Images to PDF
- Compress Image ↔ Resize Image ↔ Convert Image Format

Do not generate every possible cross-link on every page. A few contextual links are enough.

### FAQ policy for tool pages

Add questions only when they are relevant to the tool and can be answered accurately, for example:

- “How do I merge PDF files?”
- “Which image formats can I convert?”
- “Does resizing change image quality?”

Answers must reflect the implementation's actual supported formats, processing method, limits, and behavior. Do not claim local/browser-only processing, automatic deletion, encryption, or a privacy guarantee unless technically confirmed.

---

## 7. Content for later public pages

These are content requirements, not approval to create extra homepage sections. Follow the actual route inventory in `USER-FLOWS.md` and only build pages that are in scope.

### Tools directory page

**Purpose:** Help users find a tool quickly and create a useful index for tool-specific pages.

**Suggested H1:** `PDF & Image Tools for Everyday File Tasks`

**Suggested intro:** `Find the PDF and image tool you need—from merging and compressing PDFs to cropping, resizing, and converting images.`

Route: `/tools`. Organize tools by category — **PDF Tools**, **Image Tools**, **Other Tools** — with a working search field, and link each item to its real route. Avoid long descriptions for every tool.

The directory is driven by the single source of truth in `lib/tools-catalog.ts`; the landing tools shelf, navbar, footer, the `/tools/[slug]` tool routes, per-page metadata, and the sitemap all derive from that same catalog. Tools whose `status` is `available` link to their real `/tools/<slug>` route; everything else appears as a non-clickable **Coming soon** entry so users are never misled about what works.

### AI workspace / AI chat page

**Purpose:** Explain document-based Q&A and lead users into the actual AI workflow.

**Suggested H1:** `Ask Questions About Your Documents`

**Suggested intro:** `Upload a supported document and ask questions about its content. Use Docuzy AI to summarize information, clarify concepts, and locate key points.`

Show the actual Q&A flow. Make supported file types, limits, processing status, and answer behavior clear from the live implementation. Never present sample AI answers as real user output or imply perfect accuracy.

### Product / workspace page, if one is needed

Avoid creating a separate page that only repeats the homepage. It must have a distinct purpose, such as a real product tour or interactive demo. If the only goal is to explain the same three pillars, use the homepage anchors instead.

### Blog / learning content, if launched

Only create the Blog navigation item when the blog has published, maintained content. Each article should answer a real question related to document workflows, studying, PDF tasks, or using AI with documents. Do not publish thin, mass-generated posts whose main purpose is keyword coverage.

---

## 8. Launch-truth and claim-control checklist

Before any page ships, verify the following against `PRODUCT.md` and the running app:

- Is the feature implemented, enabled, and usable for the audience implied by the copy?
- Are supported file types accurate for this exact workflow? Upload support and AI-query support may differ.
- Does the CTA lead to a real destination with the expected behavior?
- Is “free” accurate for this specific action and current usage rules?
- Are storage amounts, file-size limits, conversion quality, processing speed, or export behavior stated only when verified?
- Are sharing, collaboration, reminders, flashcards, voice input, grammar checking, PDF annotation, or rich-text editing advertised only if each is available at launch?
- Are privacy/security statements backed by the real technical and legal implementation?
- Are statistics, testimonials, customer logos, and reviews real and approved?
- Are unavailable features omitted or clearly marked as unavailable rather than described as working?

When in doubt, prefer a clear description of what users can do today over a longer promise about the eventual product.

---

## 9. Anti-slop review before accepting generated copy

Reject generated content if any of the following are true:

- Two adjacent sections make essentially the same point.
- The heading could be pasted unchanged onto any AI productivity website.
- A paragraph describes the UI instead of giving the user a reason to care.
- The copy lists features that are not visible, functional, or approved.
- The page adds cards or sections simply because the model found another phrase to explain.
- A CTA is repeated multiple times within the same viewport without a reason.
- SEO phrases sound unnatural when read aloud.
- The copy uses invented proof or unsupported superlatives.
- The page would still make sense if “Docuzy” were replaced with the name of any competitor.

### Final editorial test

Every section must answer a different question:

- **Hero:** What is Docuzy?
- **Problem → solution:** Why does it help?
- **AI:** What can I do with a document using AI?
- **Tools:** What file tasks can I do here?
- **Organization:** How do I keep files findable?
- **How it works:** How do I start using it?
- **Final CTA:** What should I do next?

If a section does not answer one of these questions, remove it or merge it into another section.
