# Docker Node Application Template

## Key Documentation

Refer to these docs before performing setup, deployment, secrets, or
integration work. They are the single source of truth — do not improvise
procedures that are already documented here.

| Guide | When to consult |
|-------|-----------------|
| [docs/setup.md](docs/setup.md) | First-time checkout, running the install script, starting the dev server, running tests |
| [docs/template-spec.md](docs/template-spec.md) | Technology decisions, project structure, backend/frontend/database conventions, Docker architecture |
| [docs/deployment.md](docs/deployment.md) | Production builds, Swarm deployment, rolling updates, rollback |
| [docs/secrets.md](docs/secrets.md) | SOPS + age setup, onboarding new developers, adding/rotating secrets, Swarm secret loading |
| [docs/api-integrations.md](docs/api-integrations.md) | GitHub OAuth, Google OAuth, Pike 13 API — setup, endpoints, callback URLs |
| [docs/testing.md](docs/testing.md) | Test pyramid, auth bypass for tests, database/API/E2E test setup, test helpers |
| [docs/contracts.md](docs/contracts.md) | Data contract types for all domain entities, canonical JSON wire formats |

## Architecture Rules

### Service Layer

All database access and business logic MUST go through the service
layer (`server/src/services/`). Route handlers, MCP tools, import/export,
and the AI chat interface are consumers of the service layer — they
MUST NOT call Prisma directly or contain business logic.

Route handlers must be thin HTTP adapters:
1. Parse and validate HTTP inputs (params, body, query).
2. Call the appropriate service function.
3. Return the result (which is already a contract type).
4. Pass errors to `next(err)` — the error handler maps `ServiceError`
   subclasses to HTTP status codes automatically.

Data contracts (`server/src/contracts/`) define the canonical JSON shapes.
Service functions accept contract input types and return contract record
types. This decouples the API surface from the database schema.

### Version Management

Every commit MUST bump the version in the root `package.json` and create
a matching git tag. The version scheme is **`0.YYYYMMDD.N`** where:

- `0` — major version (stays 0 during pre-1.0 development)
- `YYYYMMDD` — today's date
- `N` — sequential build number for the day (starts at 1, increments
  with each commit)

**On every commit:**

1. Read the current version from the root `package.json`.
2. If the date portion matches today, increment `N`.
   Otherwise, set the version to `0.<today>.1`.
3. Update **both** `package.json` (root) and `server/package.json` with
   the new version.
4. Stage both files alongside the other changes.
5. After committing, tag the commit: `git tag v<version>`.

Example: if the current version is `0.20260309.2` and you commit again
on 2026-03-09, the new version is `0.20260309.3`. If it's now 2026-03-10,
the new version is `0.20260310.1`.

The version is exposed at runtime via `GET /api/admin/env` and displayed
on the admin Environment page.

<!-- CLASI:START -->
## CLASI Software Engineering Process

This project uses the **CLASI** (Claude Agent Skills Instructions)
software engineering process, managed via an MCP server.

**The SE process is the default.** Any activity that results in changes
to the codebase — or plans to change the codebase — falls under this
process. Follow it unless the stakeholder explicitly says "out of
process" or "direct change".

Activities that trigger the SE process include:

- Building a new feature or adding functionality
- Fixing a bug or resolving an issue
- Refactoring, restructuring, or reorganizing code
- Writing, updating, or removing tests
- Updating documentation that describes code behavior
- Planning, scoping, or designing an implementation
- Reviewing code or architecture
- Creating, modifying, or closing sprints and tickets
- Merging, branching, or tagging releases

**If it touches code, tests, TODOS,  docs about code, or plans for code — use
the process.**

### Process

Work happens at two levels: **project initiation** and **sprints**.

**Project initiation** (once per project):

1. Interview the stakeholder to understand the project goals and scope.
   → `get_skill_definition("project-initiation")`
2. Generate project initiation documents (overview, spec, use cases).
   → `get_skill_definition("elicit-requirements")`
3. Break the project into sprints — either all at once if the spec is
   complete, or incrementally (one or two sprints at a time) so the
   stakeholder can adjust later sprints as the project evolves.
   → `get_skill_definition("plan-sprint")`

**Sprint lifecycle** (repeated per sprint):

1. **Sprint definition** — Write a sprint document describing what the
   sprint will accomplish. Get stakeholder approval.
   → `get_skill_definition("plan-sprint")`, `create_sprint(title)`
2. **Requirements & architecture** — Identify the use cases and
   architecture changes for this sprint. Get stakeholder approval.
   → `get_skill_definition("create-technical-plan")`
3. **Ticketing** — Break the approved plan into actionable tickets.
   → `get_skill_definition("create-tickets")`, `create_ticket(sprint_id, title)`
4. **Implementation** — Execute tickets one at a time.
   → `get_skill_definition("execute-ticket")`

Use `/se` or call `get_se_overview()` for full process details and MCP
tool reference.

### MANDATORY: Ticket and Sprint Completion

**Agents MUST complete these steps. No exceptions. No skipping.**

Agents have repeatedly failed to move tickets to done and close sprint
branches. This creates inconsistent state. These rules are non-negotiable.

**After finishing a ticket's code changes, you MUST:**

1. Run the full test suite and confirm all tests pass.
2. Set ticket `status` to `done` in YAML frontmatter.
3. Check off all acceptance criteria (`- [x]`).
4. Move the ticket file to `tickets/done/` — use `move_ticket_to_done`.
5. Move the ticket plan file to `tickets/done/` if it exists.
6. Commit the moves: `chore: move ticket #NNN to done`.

**Finishing the code is NOT finishing the ticket.** The ticket is not done
until the file is in `tickets/done/` and committed.

**After finishing all tickets in a sprint, you MUST close the sprint:**

1. Merge the sprint branch into main.
2. Call `close_sprint` MCP tool (archives directory, releases lock).
3. Commit the archive.
4. Push tags (`git push --tags`).
5. Delete the sprint branch (`git branch -d sprint/NNN-slug`).

**Never merge a sprint branch without archiving the sprint directory.**
**Never leave a sprint branch dangling after the sprint is closed.**

### Stakeholder Corrections

When the stakeholder corrects your behavior or expresses frustration
("that's wrong", "why did you do X?", "I told you to..."):

1. Acknowledge the correction immediately.
2. Run `get_skill_definition("self-reflect")` to produce a structured
   reflection in `docs/plans/reflections/`.
3. Continue with the corrected approach.

Do NOT trigger on simple clarifications, new instructions, or questions
about your reasoning.
<!-- CLASI:END -->
