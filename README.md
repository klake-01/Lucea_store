# STORE BLUEPRINT — Build Any E-commerce Brand From Zero

> A complete, brand-agnostic operating system for taking ANY brand from "we
> know nothing about the buyer" to a deployed, secure, self-improving,
> product-led-SEO e-commerce store built with an AI agent.
>
> **Core thesis**: the code structure is the same for every store. What changes
> from client to client is the STARTING INFORMATION. Get the start point right
> and everything after it is implementation.
>
> **Anti-slop thesis**: an AI asked to "design something nice" produces an
> average. Every design, architecture, security and SEO decision in this system
> cites a **named law** from `_knowledge/`, distilled from 20 reference books.

---

## 👉 Start here

| If you are… | Open |
|---|---|
| **Running the build** (manager) | `MANAGER-OPERATIONS-CONSOLE.html` — what to do, what to paste, what to verify |
| **The AI agent** | `ORCHESTRATOR.md` — read first, every session |
| **Meeting a client** | `start-point/CLIENT-DISCOVERY-PRESENTATION.html` |
| **Judging quality** | `_knowledge/00-KNOWLEDGE-INDEX.md` — the laws + the anti-slop test |
| **Running a recurring check** | `_skills/00-SKILLS-INDEX.md` — DB · SEC · DOCSYNC · VERIFY |

## The three moving parts

| Part | What it is | Cadence |
|---|---|---|
| **Phases** (`00`…`11`) | built once, in order, each gated | once per project |
| **Laws** (`_knowledge/`) | the citable rules that make output real, not generic | read per phase |
| **Skills** (`_skills/`) | runnable procedures with triggers and pass/fail results | **forever, on every trigger** |

Every phase file carries a **`▣ LIVE STATUS` ledger** at the bottom: status,
exit-gate tally, skill freshness, and an append-only step log. The agent updates
it after **every step**; the orchestrator's entry gate refuses to advance when a
ledger is incomplete or stale. That ledger is how "we verified it" stops being a
claim and becomes a record.

## The 13 phases (strict order — see `ORCHESTRATOR.md`)

```
 0  start-point/            client discovery + intake     ← the root of every fact
 1  00-foundation/          contracts before code
 2  01-research/            problems → personas → entities → intent → clusters
 3  02-architecture/        IA, journey map, keyword ownership, link system
 4  03-brand-identity/      positioning, personality, palette/type/space system
 5  04-system-design/       domain model, DB schema, API, threat model   ← BACKEND FIRST
 6  05-design-system/       tokens, component library, UX flows
 7  06-build-storefront/    page templates, CRO, schema, content engine  ┐ parallel
 8  07-build-admin/         dashboards, product control, content console ┘
 9  08-integrations/        AI pipeline, SEO contract, commerce + tracking
10  09-security-hardening/  security test plan, SEO risk register        ← BLOCKS LAUNCH
11  10-launch/              pre-deploy audit, deploy, indexing
12  11-growth-loops/        weekly GSC loop, page/article loops, audits, trackers
```

**Rule #1: never skip a level, and never start a phase before the previous one
is APPROVED.** Every expensive mistake traces to a skipped or rushed earlier
phase — never to the code itself.

**Why backend before UI**: a database shaped by whatever the first screen
needed is the most expensive rework in the project (law A-B1).
**Why the threat model precedes features**: security retrofitted is security
absent (law S-A1).

## File map

| Folder | File | Produces |
|---|---|---|
| **root** | `ORCHESTRATOR.md` | phase order, gates, agent rules, the 8 commands |
| | `MANAGER-OPERATIONS-CONSOLE.html` | your internal operating manual |
| | `PROGRESS.md` *(create per project)* | where the build stands; only a human writes APPROVED |
| **_skills** | `00-SKILLS-INDEX.md` | the trigger matrix + staleness rule |
| | `01-DATABASE-SKILL.md` (DB) | schema/field/relationship/index/migration/backup run |
| | `02-SECURITY-SKILL.md` (SEC) | authz matrix, money-path, XSS, auth, secrets run |
| | `03-DOC-SYNC-SKILL.md` (DOCSYNC) | mutation → register write-back + consistency assertions |
| | `04-VERIFICATION-SKILL.md` (VERIFY) | the ledger protocol + evidence standards |
| **_knowledge** | `00-KNOWLEDGE-INDEX.md` | how laws are used + the anti-slop test |
| | `01-DESIGN-LAWS.md` (D-*) | color, type, spacing, hierarchy, depth, usability |
| | `02-ARCHITECTURE-LAWS.md` (A-*) | boundaries, data modeling, backend/frontend patterns |
| | `03-SECURITY-LAWS.md` (S-*) | defense model, vulnerability classes, test methodology |
| | `04-SEO-LAWS.md` (E-*) | programmatic scale + the risk-tiered tactics register |
| | `05-PRODUCT-LAWS.md` (P-*) | outcomes over outputs, engagement ethics, domain entities |
| **start-point** | `CLIENT-DISCOVERY-PRESENTATION.html` | the client meeting (also the sales asset) |
| | `CLIENT-INTAKE-TEMPLATE.pdf` / `.md` | the starting-information contract |
| | `inputs/` | filled intake, client docs, `references/` |
| **00-foundation** | `01` `02` `03` | AGENT-RULES · tracking contract · tech architecture |
| **01-research** | `01`…`05` | problems · personas · vocabulary+entities · intent · demand |
| **02-architecture** | `01`…`04` | IA · journey map · keyword ownership · internal linking |
| **03-brand-identity** | `01` `02` `03` | brand strategy · color/type/space system · reference intake |
| **04-system-design** | `01`…`04` | domain model · DB schema · API+modules · threat model |
| **05-design-system** | `01` `02` `03` | tokens+foundations · component library · UX patterns |
| **06-build-storefront** | `01`…`04` | page templates · UX/CRO · schema graph · content engine |
| **07-build-admin** | `01`…`05` | dashboard doctrine · product management (full lifecycle) · content console · client management · admin architecture & scale |
| **08-integrations** | `01` `02` `03` | AI pipeline · SEO integration contract · commerce+tracking |
| **09-security-hardening** | `01` `02` | security test plan · SEO risk register |
| **10-launch** | `01` `02` | pre-deploy audit · post-deploy playbook |
| **11-growth-loops** | `01`…`05` | weekly GSC · page loop · article loop · audits · trackers |
| **books_knowledge** | 20 PDFs | the source material `_knowledge/` is distilled from |

## The 8 laws (apply to every file in this kit)

1. **The intake is the root of everything.** No blank is filled by guessing.
2. **One source of truth per fact** — brand name, price, keyword owner, event
   name each live in exactly ONE place.
3. **Docs ship in the same commit as the code they govern.**
4. **One keyword = one page**, enforced before pages exist.
5. **Links are code-owned and crawlable** — no LLM-written links, no hidden
   link blocks, every page ≥3 real contextual inlinks.
6. **Never fabricate** — no fake stats, reviews, photos, urgency or scarcity.
   `[OWNER TODO]` instead.
7. **Log every new mistake class** in `00-foundation/01` § 11.
8. **Cite a law, or mark it UNGOVERNED.** A decision with no citable law is an
   opinion — and opinions are how slop gets in.

## The AI propagation pass (after the intake is filled)

```
Read everything in start-point/inputs/. Then:
1. Populate every <blank> in 00-foundation from Sections A, H, I.
2. Seed 01-research/01 problem rows from Sections D + E (mark UNVERIFIED
   claims for research confirmation).
3. Seed persona cards (01-research/02) from Section D buyer groups.
4. Seed vocabulary/banned-words (01-research/03) from Sections E + J.
5. Seed brand inputs (03-brand-identity/01) from Sections A, C, D, J.
6. Seed domain-model entities (04-system-design/01) from Sections B + I.
7. Fill launch-priority inputs (01-research/05 §3) from Sections B + G.
8. Flag every intake answer that is missing, contradictory, or too vague to
   act on — as a numbered list for the client follow-up call.
Do NOT invent any fact not present in the inputs.
```

## Minimum viable timeline (a brand in a hurry)

| When | Phases |
|---|---|
| Day 1 | 0 — the meeting + intake (non-negotiable) |
| Days 2-4 | 1-2 — foundation + research |
| Days 5-6 | 3-4 — architecture + brand |
| Week 2 | 5-6 — system design + design system |
| Weeks 3-5 | 7-9 — storefront, admin, integrations |
| Week 6 | 10-11 — security, audit, launch |
| Forever | 12 — growth loops, weekly |

Launch = the top 3-5 clusters done **completely**. Half-built clusters rank for
nothing; complete clusters rank as a unit.
