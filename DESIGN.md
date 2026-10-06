# Trace design system

## Overview

Trace is a compact workspace for on-chain researchers. It uses a nearly black canvas, slightly raised neutral panels, a lime action color and restrained status labels. The main hierarchy is: address search, scope and network, summary counts, activity and connection views, then transaction evidence. The visual interpretation was chosen because the requested reference site could not be reached; no pixel-match claim is made.

The canonical implementation is `src/styles.css`; shared primitives are in `src/components.tsx`, and the product-specific layouts are in `src/App.tsx`. The interface has one dark theme and no theme switch. Confidence is always expressed in text as well as color. Counts are derived from the captured evidence, not decorative dashboard numbers.

## Colors

CSS defines neutral, lime, mint, amber and purple primitives, then semantic aliases in `:root`.

| Semantic token | Implemented value | Use |
| --- | --- | --- |
| `--color-page` | `#101211` | Page canvas, inputs, inset controls |
| `--color-sidebar` | `#141615` | Navigation and context strip |
| `--color-surface` | `#181b19` | Panels and metrics |
| `--color-hover` | `#1d211e` | Hover surfaces and neutral badges |
| `--color-border` | `#272c28` | Structural separators and panel borders |
| `--color-control-border` | `#394039` | Input and secondary action outlines |
| `--color-text` | `#f0f2ed` | Headings, main values |
| `--color-secondary` | `#cbd0ca` | Body and interactive text |
| `--color-muted` | `#a0a79f` | Supporting copy and metadata |
| `--color-accent`, `--color-focus` | `#c1f17a` | Primary action, active navigation, focus perimeter |
| `--color-accent-surface` | `#283420` | Selected navigation and factory node |
| `--color-on-accent` | `#101211` | Text on lime buttons |
| `--color-success` | `#9fd6ac` | Verified facts; paired with `#233127` badge background |
| `--color-warning`, `--color-warning-surface` | `#e3bd7a`, `#342c20` | Review signals and coverage caveats |
| `--color-related`, `--color-related-surface` | `#c0aee3`, `#2e2838` | Recurring participation categories |
| `--color-error` | `#f3a6a0` | Recoverable validation/provider errors |

Pool identity circles use distinct blue, gold, mint and orange hues; these identify assets, not risk levels. Chart buys use lime; sell/other segments use `#5b7050`, with a text legend and an accessible chart description. Dashed graph lines encode observed connections, not causation.

Measured rendered WCAG contrast pairs: muted copy/page **7.63:1**, muted metric label/surface **7.05:1**, metric value/surface **15.40:1**, success badge **8.24:1**, primary button **14.45:1**, selected tab/surface **13.33:1**. These are measured pairs, not a claim that every graphical mark or state was independently measured. See `docs/validation/browser-validation.json`.

## Typography

- **Inter variable**, normal weights 100–900, bundled as `src/assets/inter-latin.woff2`. The UI uses weights 400, 450, 500, 550 and 600; no italic face is requested. `font-display: swap`; synthesis is disabled. Fallback: Apple system, BlinkMacSystemFont, Segoe UI, sans-serif. The loaded Inter face was verified in Chromium.
- Root size 16px. Body 13px (`--text-body`), 1.55 line-height. Main headings 28px, weight 550, 1.2 line-height, −1px tracking. They reduce to 26/25/24px at narrower breakpoints.
- Panel headings generally 14px, weight 550, 1.4 line-height. Dialog headings 20px. Metrics 34px desktop, 28–31px at narrower widths; tabular numerals prevent shifts.
- Compact research metadata uses 8–11px; table rows and controls become larger on mobile. This is a deliberately dense terminal layout. Essential mobile inputs and the investigation textarea use **16px** to avoid iOS focus zoom.
- Addresses, block numbers and changing counts use `SFMono-Regular, Consolas, Liberation Mono, monospace` or tabular numerals. No remote monospace font is needed.
- Headings use balanced wrapping; prose uses pretty wrapping. Methodology copy is limited to 72ch. Full addresses wrap anywhere and remain selectable in the evidence dialog; abbreviated links expose the complete address in their accessible name and title.

## Layout

The named spacing steps in `:root` are 4, 8, 12, 16, 20, 24 and 32px. Panels mostly use 16–20px inner spacing; main groups use 20–25px gaps. Controls are inset from viewport edges.

Desktop: fixed 218px sidebar, 72px top bar, main content with 32px inline padding and a 1680px maximum. Four metrics share one row. The activity/connection pair uses a 1.28:1 grid; the evidence/insight pair reserves 285px for the aside. Tables maintain real header and row semantics.

| Breakpoint | Adaptation |
| --- | --- |
| ≥1500px | Main padding becomes 42px; insight column 320px; taller charts and table rows |
| ≤1230px | Sidebar 190px, main padding 24px, smaller panel gaps |
| ≤1080px | Evidence and insights stack; metrics become two columns; insights spread horizontally; coverage panels stack |
| ≤800px | Sidebar becomes a 66px icon rail with explicit accessible link names; main padding 22px; compact four-column metrics fit the reclaimed width |
| ≤620px | Navigation moves into a horizontal top bar; main padding 16px; headings and network selector stack; metrics return to two columns; chart panels and insight cards stack; form actions stack |
| ≤360px | Tighter horizontal navigation and metric padding; middle chart-axis label is hidden to prevent collision |

The evidence table keeps a 545px minimum width on mobile and scrolls **inside its named, keyboard-focusable region**. Category buttons can scroll horizontally. The document itself had no horizontal overflow at 1440, 1024, 768, 390 or 320px. Viewports are browser emulations, not physical-device tests. Native 200% zoom and RTL/localization were not verified.

## Elevation & Depth

Most structure is flat: tonal surfaces and one-pixel separators, without decorative panel shadows. The small segmented selection has a subtle shadow. Toasts use `0 8px 24px #0005`; native dialogs use `0 24px 80px #0008` with a translucent `#060a08b8` backdrop and 4px blur. Sidebar z-index is 20, notification 50; the native modal uses the browser top layer. The factory node has a subtle ring to distinguish its central role.

## Shapes

Standard panels use `--radius: 10px`. Buttons use 6px, inputs 7px, status chips 4px, the modal 14px. Pool icons and profile initials are circles. Nested investigation surfaces use 7px with clear inset spacing. Lucide icons share `currentColor`, generally 13–20px and 1.65px CSS strokes. Branding and graph geometry are code-native; no raster artwork is required.

## Components

| Component / pattern | Source | Behavior |
| --- | --- | --- |
| `Badge` | `src/components.tsx` | Neutral, green, amber and purple variants; verified state includes a check icon and text |
| `Address`, `EvidenceLink` | `src/components.tsx` | Public Blockscout links; full accessible address; external-tab notice; transaction evidence has a visible underline |
| `Modal` | `src/components.tsx` | Native `dialog.showModal()`, initial focus, browser focus containment, Escape/backdrop/close button, return to triggering control |
| `Empty` | `src/components.tsx` | Heading, explanation and contextual next action |
| `CopyButton`, `download` | `src/components.tsx` | Clipboard result feedback; local JSON exports without external submission |
| Buttons | `src/styles.css` | `.primary-button`, `.secondary-button`, `.text-button`, `.icon-button`; hover, active, disabled and focus states; modal owns primary emphasis while open |
| `Metric` | `src/App.tsx` | Derived count, label and textual evidence scope; acts as a shortcut to the corresponding evidence view |
| `ActivityChart` | `src/App.tsx` | 32 block bins derived from captured swaps, shared y-scale, accessible text summary, counts on each bar's title |
| Connection map | `src/App.tsx` | Deployments/buyer-overlap buttons use `aria-pressed`; pool nodes open transaction evidence |
| Evidence panel | `renderTable` in `src/App.tsx` | Category buttons, text filter, oldest/newest sort, semantic table, explicit empty state, export, watch controls |
| Search | `search` / `liveLookup` in `src/App.tsx`, `src/api.ts` | Native form, address validation and associated error, abortable loading, public API lookup, explicit captured/live distinction |
| Monitoring | `renderMonitor` / `checkActivity` in `src/App.tsx` | Native checkbox with styled switch; paused/running text; 60-second visible-tab polling; first-pass baseline; manual check; status announcement |
| Notices | `src/App.tsx`, `.notice` | Persistent polite live region; explicit dismiss button; no time-limited actions |

Focus uses a 2px solid lime outline with 4px offset. The skip link focuses the main region without changing the current route. Icons on mobile navigation retain accessible names when visible labels are hidden. Native input labels and buttons carry behavior; no clickable `div` substitutes are used.

Transitions are limited to background, color and border color at 120ms when reduced motion is not requested. Primary/secondary buttons scale to 0.96 on press in that same media guard. The loading spinner rotates over one second only under `prefers-reduced-motion: no-preference`; it becomes static with textual loading feedback under reduced motion. There are no staged page entrances or autoplay sequences.

## Do's and Don'ts

- Start another research page with `.page-heading`, `.panel`, `.panel-heading` and `.evidence-body`. Reuse the same main content edges and spacing.
- Keep a visible distinction between captured evidence, live responses and unavailable coverage. Derive displayed counts from data.
- Use green “Confirmed” only for a narrowly supported fact. Use “Observed” and the amber review state for participation signals; never turn a graph edge into an ownership claim.
- Keep one clearly emphasized primary action per context. Do not add equally prominent colored actions to the same panel.
- Keep charts in their data units. Do not smooth or invent activity merely to fill empty space.
- Preserve full addresses in evidence/export even when abbreviating table labels. Do not truncate the only available copy of evidence.
- Reuse locally bundled typography and one icon family. Do not introduce a remote font, wallet connection or trading action.
- When adding another network, implement and verify its adapter before replacing its unsupported state. Do not reuse Ethereum results under another network label.
