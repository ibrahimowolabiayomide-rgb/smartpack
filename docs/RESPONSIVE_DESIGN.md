# Responsive design

Verified in Chromium at 1440, 1280, 768, 390 and 360 px wide. Emulated viewports only: no physical
devices, Safari or Firefox.

| Width        | Layout                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------- |
| 1280 and up  | Navigation rail, top bar, content column; tables for lists with up to eight columns                |
| 1024 to 1279 | Navigation rail; lists with five or more columns use cards, because the content column is narrower |
| 768 to 1023  | No rail; menu button and drawer; lists with four or fewer columns use a table, others use cards    |
| below 768    | Drawer navigation; stacked page headings; every list as labelled cards; single-column filters      |

Decisions:

- A table is never squeezed. Where it would not fit, the same records are shown as cards
  (`RecordsView`), so no information is lost on a phone.
- Tables that do scroll sit in a focusable, named region.
- The drawer is full height with safe-area padding (`viewportFit: cover`).
- On touch devices buttons, links in navigation and menu items are at least 44 px high.
- Long text wraps; the end-to-end suite fails a page that overflows horizontally at any width.
