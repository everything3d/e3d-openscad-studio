# Plan 001: Introduce versioned canonical designs and clean chat workspaces

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat b5bdd8c..HEAD -- src/lib/db src/lib/types.ts src/lib/agents src/app/api src/app/studio src/components/studio README.md package.json package-lock.json drizzle`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. A material mismatch is
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L (multi-day; land as the ordered slices below)
- **Risk**: MED — schema, authorization, and the Studio entry flow all change
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `b5bdd8c`, 2026-08-21

## Product decision

The product has two different durable concepts and must stop representing both as
one `project`:

1. A **canonical design** is a reusable, versioned package: OpenSCAD code,
   workspace files, title, description, preview image, and instructions for the
   agent about common modifications and gotchas. It contains no chat messages.
2. A **workspace** is one mutable customer job: a copy of a canonical version (or
   the blank starter), its own live code/files, and its own chat history.

Opening a canonical uses the verb **Start design**, not Fork. It copies only the
canonical artifacts and begins with an empty conversation. Fork remains available
for branching an existing workspace and may continue copying its conversation.

Publishing or improving a canonical creates an immutable new canonical version.
Existing customer workspaces remain attached to the exact version they started
from. There is no automatic merge or upstream synchronization in the MVP.

## Why this matters

The current model makes the latest customer-specific code and the full accumulated
conversation the only available starting point. That makes the next customer job
worse and causes every new prompt to resend irrelevant history. At the same time,
useful improvements discovered during a customer job have no reviewed route back
into the reusable design.

This plan gives users a MakerWorld-like starter gallery, with AI chat replacing the
parameter panel. It also makes "save as starter" a publishing boundary: the system
stores reviewed design state and distilled guidance, never the source chat.

## Reference interaction model

MakerWorld Parametric Model Maker was reviewed on 2026-08-21. Borrow these ideas:

- The default signed-in surface is a searchable visual starter gallery.
- A starter has identity and explanatory detail before the user customizes it.
- Selecting a starter opens a focused creation surface with a large live preview.
- Recent customizations are separate from the starter catalog.

Do not copy its social metrics or parameter controls. E3D's primary action is
`Start design`, and its customization surface is the existing chat + code + preview
studio.

## Current state

- `src/lib/db/schema.ts:12-31` explicitly defines a project as a chat and stores
  mutable code and lineage on the same row:

  ```ts
  /**
   * A project *is* a chat: conversation history, the current OpenSCAD source,
   * and the workspace files it imports.
   */
  export const projects = pgTable('projects', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(''),
    name: text('name').notNull(),
    code: text('code').notNull(),
    forkedFrom: text('forked_from'),
  })
  ```

- `src/lib/db/queries.ts:16-22` defines `ProjectSnapshot` as code, files, and
  messages. `loadProjectSnapshot` and `materializeProjectCopy` therefore make every
  copy operation conversation-bearing.
- `src/lib/db/queries.ts:234-245` forks by copying that full snapshot.
- `src/components/studio/studio.tsx:70-95` automatically opens the most recent
  project or creates a new one. There is no persistent Studio home state.
- `src/components/studio/sidebar.tsx:97-99` tells users “Projects are chats.”
- `src/app/studio/page.tsx:14-17` loads projects only and selects a project before
  rendering Studio.
- `src/lib/agents/studio-agent.ts:30-40` constructs agent context from current code
  and file names only. It has no reusable design-specific guidance.
- `src/app/api/chat/route.ts:41-58` authorizes the project, loads its artifacts, and
  creates the agent; this is the correct place to add immutable canonical-version
  guidance.
- `src/components/studio/preview.tsx:79-143` owns the Three.js renderer canvas. Reuse
  this boundary to capture a small reviewed gallery thumbnail; do not add a second
  renderer stack.
- There is no test runner or test directory. `npm run typecheck` and `npm run build`
  both pass at commit `b5bdd8c`.

### Conventions to preserve

- Route handlers authenticate with Clerk on the server and delegate persistence to
  `src/lib/db/queries.ts`; follow `src/app/api/projects/route.ts`.
- All owner-scoped mutations include `userId` in the database predicate; follow
  `updateProjectCode` and `renameProject`.
- Multi-row copies and publishing operations use `db.transaction`; follow
  `replaceProjectShare` and `materializeProjectCopy`.
- API-facing timestamps are numbers in milliseconds; follow `getProject` and
  `listProjects`.
- UI uses existing shadcn primitives, Tailwind tokens, and sentence-case action
  labels.
- Git commits use short imperative subjects, for example
  `Add cross-account project sharing`.

## Target domain model

Add two tables and two nullable project references.

### `canonical_designs`

- `id`: text primary key
- `ownerId`: Clerk user ID; the owner is the editor
- `title`: user-facing title
- `description`: what the design is and when to start from it
- `category`: nullable short text for filtering; no category-management UI yet
- `visibility`: `private` or `published`, default `private`
- `currentVersionId`: the immutable version used by new workspaces
- `archivedAt`: nullable; canonicals are archived, never hard-deleted while
  referenced
- `createdAt`, `updatedAt`

### `canonical_versions`

- `id`: text primary key
- `canonicalDesignId`: parent identity
- `versionNumber`: monotonically increasing integer, unique per canonical
- `code`: complete OpenSCAD source
- `files`: JSONB array in the existing `WorkspaceFile` JSON shape
- `modificationGuide`: concise agent-only guidance for common edits and gotchas
- `thumbnail`: nullable, bounded WebP/JPEG data URL for the gallery
- `changeSummary`: nullable explanation of the reusable improvement
- `sourceProjectId`: nullable provenance to the workspace that was published
- `createdBy`, `createdAt`

### Add to `projects`

- `canonicalDesignId`: nullable canonical identity
- `canonicalVersionId`: nullable exact version copied at workspace creation

The project continues to own a complete mutable copy of code/files. Rendering and
chat must not depend on a canonical remaining available. A project fork inherits
these two provenance fields. A blank workspace leaves them null.

### Access rules

- Any authenticated user can create and edit private canonicals they own.
- A published canonical is readable and startable by every signed-in user.
- Only its owner can add a version or change metadata.
- Moving a canonical from private to published additionally requires the caller's
  Clerk ID in `CANONICAL_PUBLISHER_USER_IDS` (comma-separated). Enforce this only on
  the server and document the variable in `.env.example` and `README.md`.
- Never trust a client-provided owner ID, source code, or file list when publishing
  from a project. Load the source project through an owner-scoped server query.

## API contracts

Implement these route families using Zod request validation and narrow response
types in `src/lib/types.ts`:

- `GET /api/canonicals` — list the caller's private canonicals plus all published
  canonicals; exclude archived rows; include current-version thumbnail and version
  number but not code/files.
- `POST /api/canonicals` — create a private canonical from an owned project and its
  reviewed metadata. Create identity + version 1 atomically.
- `GET /api/canonicals/[id]` — return readable metadata and current version detail.
- `PATCH /api/canonicals/[id]` — owner-only metadata, archive, and visibility edits;
  publishing applies the publisher allowlist.
- `POST /api/canonicals/[id]/start` — create an owned project from the current
  version with copied code/files and **zero messages**; return `FullProject`.
- `POST /api/canonicals/[id]/versions` — owner-only; snapshot an owned source
  project as the next immutable version, then atomically advance `currentVersionId`.
- `POST /api/projects/[id]/starter-draft` — return an AI-generated, non-persisted
  draft containing `title`, `description`, `modificationGuide`,
  `reusableChanges[]`, and `customerSpecificRisks[]`. Bound the history and code
  sent to the model; failures fall back to empty editable fields and never block
  manual publishing.

## Visual and interaction direction

Keep the Studio's dark workshop identity rather than cloning MakerWorld. The page's
single job is: **choose a reliable starting point for the next customer job**.

- Palette: printer-bed black `#0F1115`, graphite `#1C1F24`, steel `#323741`, paper
  `#F4F5F7`, action blue `#6E9BFF`, rendered green `#58C48D`. Reuse existing tokens
  where they already resolve to these roles; do not scatter raw colors.
- Type: Geist for titles/actions; the existing monospace stack for version labels,
  dimensions, and file counts.
- Layout: persistent narrow sidebar; starter library in the center; search and the
  `Blank design` tile first; recent work below the starter grid. Opening a workspace
  returns to the current chat/preview split.
- Signature element: every starter tile has a small machine-plate strip reading
  `STARTER · vN · N FILES`. It communicates provenance and versioning rather than
  adding decorative badges or social statistics.
- Hover/focus: reveal a slightly shifted 3D thumbnail and the action `View starter`;
  respect reduced motion and provide visible keyboard focus.

Suggested desktop hierarchy:

```text
┌──────────────┬─────────────────────────────────────────────────────┐
│ Home         │  Start from a proven design        [ Search      ] │
│ Recent work  │                                                     │
│              │  [ Blank design ] [ Name plaque ] [ Coin bank ]   │
│ Customer A   │  [ STARTER · v3 ] [ STARTER · v2 ] [ STARTER · v5]│
│ Customer B   │                                                     │
│              │  Recent work                                       │
│              │  [ customer jobs with source starter + date ]      │
└──────────────┴─────────────────────────────────────────────────────┘
```

Selecting a tile opens a detail panel/dialog with the large preview, title,
description, version, modification guide presented as “Good for… / Common changes…”,
and one primary action: `Start design`.

## Scope

**In scope**:

- `src/lib/db/schema.ts`, `src/lib/db/queries.ts`, new generated Drizzle migration
- `src/lib/types.ts`
- `src/lib/agents/studio-agent.ts` and a new starter-draft agent module
- `src/app/api/chat/route.ts`
- new `src/app/api/canonicals/**` routes
- new `src/app/api/projects/[id]/starter-draft/route.ts`
- `src/app/studio/page.tsx`
- `src/components/studio/studio.tsx`, `sidebar.tsx`, `preview.tsx`
- new focused Studio components for the library, starter detail, and publish flow
- `package.json`, `package-lock.json` for a minimal Vitest setup
- `.env.example` and `README.md`

**Out of scope**:

- Automatically merging arbitrary customer changes into a canonical
- Deleting or truncating an existing customer chat
- Copying chat messages when starting from a canonical
- Public anonymous access, community publishing, likes/download counts, or comments
- Category administration; categories are optional data only in this release
- Changing project-share snapshot semantics
- Replacing the public marketing page with the gallery; `/studio` is the MVP home
- Object storage. Thumbnails remain tightly bounded data URLs for the small curated
  library; move them to object storage only when volume justifies it

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 |
| Generate migration | `npm run db:generate` | one new reviewed migration + snapshot |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Unit tests | `npm test` | all new tests pass |
| Production build | `npm run build` | exit 0 and route list includes canonical APIs |

Do not run `npm run db:migrate` against an unknown or production URL. For migration
verification, use an explicitly disposable local database and state its name before
running the command.

## Git workflow

- Branch: `codex/001-canonical-design-library`
- Commit after each slice below with imperative subjects.
- Do not push or open a PR unless instructed.
- Do not mix unrelated formatting or dependency upgrades into the feature.

## Ordered implementation slices

### Slice 1: Add characterization tests and pure domain contracts

Add Vitest and `npm test`. Extract or introduce pure helpers for:

- visibility/ownership decisions;
- selecting a readable canonical;
- building a project seed from a canonical version (artifacts + provenance, no
  messages);
- thumbnail MIME/decoded-size validation;
- detecting whether a project started from an older canonical version.

Write tests before wiring queries. Preserve existing project fork/share behavior in
tests: a project fork still carries its conversation; a canonical start never does.

**Verify**: `npm test && npm run typecheck` → exit 0.

### Slice 2: Add the versioned schema and split snapshot boundaries

Add the schema above and generate one migration. Refactor the existing
`ProjectSnapshot` into two explicit concepts:

- `ProjectArtifacts`: code + files only;
- `ProjectCopySnapshot`: artifacts + messages, used only by project fork/share.

Add owner-scoped canonical queries and transactions. Version creation must allocate
the next version and update `currentVersionId` atomically. Handle a concurrent
version-number collision explicitly; do not silently overwrite.

Preserve all current `forkProject`, share import/export, project CRUD, and chat save
behavior.

**Verify**: `npm run db:generate && npm test && npm run typecheck` → one migration,
all tests pass, no type errors.

### Slice 3: Add authorized canonical APIs

Implement the API contracts above. Validate body sizes before parsing/storing image
data. Limit title, description, guide, category, and thumbnail sizes with named
constants shared by route validation and tests. Return 404 for unreadable canonicals
so private IDs are not disclosed.

Starting a canonical must load its current version inside the same transaction that
creates the project and copies its files. The returned workspace must contain zero
messages and exact canonical/version provenance.

**Verify**: `npm test && npm run typecheck && npm run build` → all pass; build route
list contains `/api/canonicals`, `/api/canonicals/[id]`,
`/api/canonicals/[id]/start`, and `/api/canonicals/[id]/versions`.

### Slice 4: Feed version-specific guidance to the agent

When a project has `canonicalVersionId`, load that immutable version's
`modificationGuide` and pass it into `createStudioAgent`. Add it as a clearly marked
design-specific section after the stable base rules. It is guidance, not permission
to violate tool or safety rules. Blank projects and legacy projects behave exactly
as before.

Do not load the canonical's newest guide for an old workspace; use the version that
seeded that workspace.

**Verify**: unit tests cover no-guide, exact-version guide, and missing/archived
canonical fallback; `npm test && npm run typecheck` exits 0.

### Slice 5: Make the signed-in Studio home a starter library

Change `/studio` so absence of `?project=` means Home. Do not auto-open the first
project and do not auto-create a blank project. Load canonical summaries and recent
projects server-side, then render:

- Home and recent-work navigation in the sidebar;
- Blank design as the first tile;
- searchable canonical cards;
- starter detail panel/dialog;
- `Start design`, which calls the start endpoint and opens the new project;
- source/version labels in project headers and recent-work rows;
- a non-blocking “Newer starter available” indicator when provenance is stale.

Keep the existing three-pane workspace intact once a project is selected. Make
`+ New` explicitly mean `Blank design`; do not make it compete visually with the
starter library.

**Verify**: `npm test && npm run typecheck && npm run build` exits 0. Manual keyboard
QA confirms Home → detail → Start design → empty chat, and Back to starters does not
delete or mutate the workspace.

### Slice 6: Add reviewed “Save as starter” and version publishing

Add a workspace-header action named `Save as starter`. Its dialog:

1. requests a best-effort AI starter draft from the owned project;
2. shows editable title, description, modification guide, and change summary;
3. shows the model's reusable-change suggestions and customer-specific risk list;
4. captures a bounded thumbnail from the existing Preview renderer;
5. offers `Create new starter`; if the caller owns the source canonical, also offer
   `Publish new version`;
6. requires an explicit review checkbox when customer-specific risks are present.

Publishing snapshots current server-owned code/files but stores no messages. It
does not delete or compact the current workspace. On success, return to the starter
detail and display the new immutable version.

The AI draft is advisory. It must not publish, edit code, or decide which customer
details are safe. Model failure leaves a fully usable manual form.

**Verify**: tests cover create-new, owner update, non-owner denial, publisher denial,
model failure, risk acknowledgement, empty-message start, and old-version detection;
`npm test && npm run typecheck && npm run build` exits 0.

### Slice 7: Update product language and migration notes

Replace “Projects are chats” with the new vocabulary:

- **Starter** in user-facing action copy where “canonical” would sound internal;
- **Workspace** or **recent work** for customer chats;
- **Canonical design/version** in code and technical metadata only.

Update README architecture, features, environment variables, and the distinction
between workspace fork and starter start. Document how to create the first private
starter and how an allowed publisher makes it visible.

**Verify**: `rg -n "Projects are chats|project \*is\* a chat" README.md src` returns
no matches; `npm test && npm run typecheck && npm run build` exits 0.

## Test plan

Follow Vitest's node environment for domain/query-helper tests; use jsdom only for
small UI behavior where necessary. Required cases:

- readable: owner-private, owner-published, other-user-published;
- unreadable: other-user-private and archived;
- start copies code/files, records exact canonical/version IDs, and creates no
  messages;
- project fork still copies messages and keeps provenance;
- new version is immutable, increments monotonically, and advances current version;
- older workspace is detected after publication, but its code/guidance do not
  change;
- only owner updates metadata/versions; only publisher allowlist publishes;
- thumbnail type and decoded-size limits reject invalid input;
- starter-draft model failure returns editable fallback data;
- Save as starter never persists chat messages in either canonical table;
- blank design path stays canonical-free and works with the existing agent.

Manual acceptance scenarios:

1. Open `/studio` with existing projects: the starter Home is shown, not the latest
   customer chat.
2. Start the same canonical twice: two independent workspaces, both with empty
   chats and identical initial artifacts.
3. Customize one workspace: the canonical and second workspace are unchanged.
4. Publish a reusable improvement as version 2: version-1 workspaces show an update
   hint but remain unchanged; new starts use version 2.
5. Create a starter from a customer workspace: AI flags customer literals, user
   edits the draft, and the published canonical contains no conversation.

## Done criteria

- [ ] `npm test` exits 0 with all cases above represented.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run build` exits 0.
- [ ] Exactly one reviewed Drizzle migration introduces canonical tables and project
      provenance fields.
- [ ] A canonical-start project has zero message rows.
- [ ] Existing fork and share behavior remains characterized and passing.
- [ ] Existing workspaces continue rendering if their canonical is archived.
- [ ] No canonical mutation trusts client-supplied ownership or project artifacts.
- [ ] `/studio` without a project shows the starter library and Blank design.
- [ ] Publishing creates an immutable version and never stores chat history.
- [ ] No files outside the Scope list are modified except `plans/README.md` status.

## STOP conditions

Stop and report instead of improvising if:

- the current project/share snapshot shape has changed materially since `b5bdd8c`;
- product direction requires canonicals to be globally writable or community
  published in the first release;
- a canonical must remain hard-deletable despite existing workspace provenance;
- thumbnail capture requires a second rendering implementation instead of adapting
  the existing Preview boundary;
- migration generation proposes destructive changes to existing project/message/
  workspace-file data;
- a correct start/publish transaction requires weakening owner checks;
- verification fails twice after a reasonable fix attempt.

## Deferred follow-up: selective upstream improvement

Do not hide an automatic merge inside this release. After the library/publishing
model is proven, add an `Improve original starter` flow:

1. start a clean maintenance workspace from the canonical's latest version;
2. compare the customer workspace to that version;
3. let AI propose a short list of reusable changes while explicitly identifying
   customer-specific literals/files;
4. let the user choose which proposals enter the clean maintenance conversation;
5. publish the reviewed result as a new canonical version.

This keeps the customer history out of the canonical and turns “port this useful
part back” into an explicit review operation rather than an unsafe merge.

## Maintenance notes

- The existing project-share snapshot should eventually include canonical
  provenance if shared copies need “newer starter available” hints across accounts;
  this is deliberately deferred to avoid changing share semantics now.
- If canonical volume grows, move thumbnails and version files to object storage and
  retain stable URLs in Postgres. Do not prematurely add object storage for a small
  curated library.
- Reviewers should scrutinize owner predicates, publication authorization,
  transaction boundaries, decoded thumbnail size checks, and any path that could
  accidentally copy messages into a canonical.

