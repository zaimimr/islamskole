---
version: 1
slug: "src-app-locale-admin"
primary_target: "src/app/[locale]/admin"
related_targets: ["src/app/[locale]/pamelding"]
---

# Familiebordet

## Scope and Mode

- Primary surface: principal and administrator operations under `src/app/[locale]/admin`.
- Related surface: public enrollment under `src/app/[locale]/pamelding`.
- Mode: operate. This release does not include a parent or student portal.

## Audience and Job

The principal needs one trusted place to find a family, understand every guardian and child relationship, see admission, placement, enrollment, fee, payment, and history separately, and complete the next required action without checking paper or Google Sheets.

## Approved Direction

- Direction: Familiebordet.
- Approved: 2026-08-28 by the product owner.
- Approved comp: `.impeccable/mocks/decision/family-desk.png`.
- Memorable moment: one connected family workspace keeps the relationship tree, child-level facts, and next action visible at the same time.
- Scalable placement: class capacity and bulk placement remain a dedicated workflow. The family surface shows the selected child's placement context and direct action, not every class at once.

## Composition Contract

The desktop admin shell has grouped navigation and a utility bar with active school year and global family search. A family detail route uses three connected regions: relationship context, the dominant family record, and next/recent activity. Cross-school attention remains available without competing with the current family. Mobile collapses these regions into a task-first sequence with family identity and the next action first.

The dashboard uses the same grammar but leads with unresolved work. The public enrollment flow creates or matches the durable family, flexible guardian roles, and children before immediate Vipps payment.

## Comp Translation

The following are conceptual and must not be literalized: sample names, sample addresses, sample amounts, avatar drawings, exact comp text, and the static number of children. Core text and controls remain semantic HTML. Relationship lines and status marks use the existing icon library or authored CSS, not raster crops from the comp.

## Visual Record

Sampled from interior pixels of the approved comp:

| Role | Value |
| --- | --- |
| Page ground | `#FCFAF5` |
| Working surface | `#FEFEFE` |
| Primary ink | `#090D13` |
| Strong action green | `#3C8F44` |
| Active navigation field | `#DCEDDD` |
| Warm folder layer | `#FEEDCA` |
| Attention field | `#FFF8E9` |

Component grammar uses medium rounded working surfaces, fine warm-gray borders, near-flat elevation, Fredoka headings, Nunito interface text, compact semantic status labels, and full-width task actions. The type ramp is a compact 30 to 36 pixel page title, 20 to 24 pixel section headings, 14 to 16 pixel interface text, and 12 to 13 pixel metadata.

## Ingredient Inventory

| Ingredient | Commitment | Medium |
| --- | --- | --- |
| Grouped admin navigation | Six primary destinations with website, administration, and account separated below | Semantic HTML, CSS, Lucide icons |
| Active school year | Persistent selector in the utility bar | Semantic HTML and existing select primitives |
| Global family search | Search by family, child, guardian, email, or phone | Semantic combobox and server query |
| Relationship context | Flexible guardians and every sibling connected to the family | Semantic HTML, CSS relationship rule, Lucide icons |
| Family record | Dominant surface with overview, children, admission, payments, and history | Semantic HTML, route tabs, server-rendered data |
| Child summaries | Separate admission, placement, enrollment, fee, and payment facts | Semantic HTML and reusable status components |
| Primary next action | The most important unresolved family task | Button or link with explicit consequence copy |
| Recent history | Append-only operational and financial events | Semantic ordered list with pagination |
| Cross-school attention | Compact access to unresolved work outside the selected family | Semantic links and live counts |
| Public enrollment | Three-step child, guardian, review-and-pay flow | Accessible forms and server actions |
| Brand reference | Existing public identity source, not a shipping admin asset | Existing repository assets |

## Constraints

- Preserve immediate intentional Vipps capture.
- Preserve all current administrative and public enrollment capabilities.
- Build first-class family, guardian, sibling, and child relationships without portal UI.
- Do not hard-code mother and father roles.
- Do not delete captured financial history.
- Keep admission, placement, enrollment, fee, payment, refund, and settlement as distinct facts.
- Use Norwegian bokmål in the admin system and maintain Norwegian and English public localization.
- No unresolved product decisions remain for implementation.
