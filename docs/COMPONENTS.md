# Components

All in `apps/web/src`. Each has tests in the file shown or beside it.

## Shell (`components/shell`)

| Component       | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `AppShell`      | Rail, top bar, preview banner, content column, toast provider            |
| `Sidebar`       | Brand mark and the Main and Secondary navigation (from `lg`)             |
| `NavList`       | Two `nav` landmarks of real links; `aria-current`; "Planned" tags        |
| `MobileNav`     | Menu button and navigation drawer below `lg`; closes on navigation       |
| `TopBar`        | Menu button, wordmark, Help menu                                         |
| `HelpMenu`      | Help & Documentation, Diagnostics, Privacy, Terms                        |
| `PreviewBanner` | States that sign-in is not enabled and the area contains no company data |

## Interface (`components/ui`)

| Group    | Components                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------- |
| Actions  | `Button`, `ButtonLink` (primary, secondary, quiet; loading and disabled states)                   |
| Fields   | `TextField`, `PasswordField` (show/hide), `SelectField`, `SearchField`, `DateField`, `FieldShell` |
| Layout   | `Panel`, `PageTitle`, `Breadcrumbs`, `Tabs`                                                       |
| Data     | `DataTable`, `RecordsView` (table plus mobile cards), `Pagination`, `FilterBar`                   |
| Status   | `StatusBadge`, `Notice`, `EmptyState`, `UnavailableState`, `LoadingState`, `ErrorState`           |
| Overlays | `Dialog`, `ConfirmDialog`, `Drawer`, `DropdownMenu`, `ToastProvider` / `useToast`                 |

Notes:

- `RecordsView` renders the same records as a table or as labelled cards, chosen by width, and
  shows its empty state once.
- `FilterBar` disables every control inside it and states the reason, which is how planned modules
  stay honest.
- `ConfirmDialog` is built and tested but not used by any screen yet (no destructive action exists).
- A tooltip component was not built because nothing needed one.

## Features (`features`)

| Folder            | Contents                                               |
| ----------------- | ------------------------------------------------------ |
| `modules`         | `ModuleHeader`, `ListWorkspace`, planned-column helper |
| `platform-status` | Live status view, refresh button                       |
| `diagnostics`     | Diagnostics text builder and dialog                    |
| `auth`            | Sign-in validation and form                            |

## Library (`lib`)

`api/` (client, health, base URL), `brand/` (colour maths, config, server reader), `modules.ts`,
`cn.ts`, `app-info.ts`.
