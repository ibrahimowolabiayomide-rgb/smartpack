# Design system

A restrained, document-like enterprise interface: warm stone surfaces, a dark charcoal navigation
rail, one forest-green accent, and plain borders instead of shadows.

## Tokens

Colour is defined once, in `apps/web/src/styles/tokens.css`, and exposed to Tailwind through
`@theme`. The Tailwind theme is cleared, so an off-system class (`bg-purple-500`, `shadow-lg`) does
nothing.

| Role       | Tokens                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------- |
| Surfaces   | `ground #efebe2` (page), `surface #f7f4ee` (panels), `sunken #e6e1d5`, `line`, `line-strong` |
| Text       | `ink #1c222b`, `ink-muted #4a5160`, `ink-subtle #565d68`                                     |
| Navigation | `nav #171d26`, `nav-raised`, `nav-line`, `nav-text`, `nav-muted`, `nav-dim`                  |
| Accent     | `accent #2b6a4c`, `accent-hover`, `accent-tint`, `accent-text`                               |
| Status     | `warn-*` (amber), `danger-*` (brick), `neutral-*` (stone); always with a text label          |
| Focus      | `focus` (ink on light surfaces), `focus-on-dark` (stone on the rail)                         |

No pure white or black is used. `src/styles/tokens.test.ts` parses `tokens.css` and fails if any
text pair drops below WCAG AA or any control border or focus ring below 3:1.

## Type

Self-hosted from `src/app/fonts/` (no third-party requests). Licences are kept beside the files.

| Role                      | Typeface       | Licence     |
| ------------------------- | -------------- | ----------- |
| Interface text            | IBM Plex Sans  | SIL OFL 1.1 |
| Page titles, panel titles | Source Serif 4 | SIL OFL 1.1 |
| Identifiers, versions     | IBM Plex Mono  | SIL OFL 1.1 |

Sizes: `meta` (small labels), `ui` (body and controls), `lead`, `title`, `display`.

## Shape and spacing

Radii are 2, 4 and 6 px. There are no shadows. Panels are bordered surfaces. The content column is
at most 72 rem wide with 16, 24 and 40 px side gutters by breakpoint.

## Icons

Drawn in-house on a 24 px grid with a 1.5 px stroke, square caps and mitred joins
(`src/components/icons`). Icons are decorative (`aria-hidden`); a visible text label carries the
meaning. No icon library is used.

## Status language

| Label               | Meaning                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| Implemented         | Built, connected to its real backend and covered by automated tests             |
| Planned for Phase N | The page exists to fix its place; the capability is built in the phase shown    |
| Not configured      | The capability exists but has not been set up, for example a GPS source         |
| Not available       | A value that cannot be shown because the module that supplies it does not exist |

Status never relies on colour alone: every badge has a text label and a small square marker.

## Interaction

- Focus: a visible 2 px ring on every interactive element; never removed.
- Touch: controls grow to 44 px on coarse pointers (`pointer-coarse:`).
- Motion: no decorative animation; `prefers-reduced-motion` is honoured.
- Dialogs and drawers use the native `<dialog>` element for the focus trap, Escape and focus return.
- Success messages are announced politely and dismiss after 8 seconds; errors persist and are
  announced as alerts.

## Branding

A company can supply a name, logo and accent colour through server environment variables
(`BRAND_*`, see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)). Only the accent is
overridable; the accent is checked for WCAG AA and ignored if it fails. Surfaces, text and status
colours are fixed.

## Accessibility

Targets WCAG 2.2 AA where practical: skip link, one `h1` per page, landmarks (two named `nav`
regions), labelled form fields with `aria-describedby` and `aria-invalid`, keyboard-focusable scroll
regions, real links and buttons. axe-core runs on every route in the end-to-end suite. A manual
screen-reader audit has **not** been done.
