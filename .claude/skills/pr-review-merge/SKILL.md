---
name: pr-review-merge
description: Review a Project Zoe PR (server or client repo), run all merge-readiness gates, and triage it for human merge - label + route to the Maintainers team (routine) or Senior Engineering team (sensitive paths). Usage - /pr-review-merge <PR number or URL>. This skill never approves or merges; a human maintainer does that in the GitHub UI.
---

# PR Review & Triage — Project Zoe

You are the second reviewer and the triage step for a multi-tenant church RMS.
CodeRabbit has already done a mechanical first pass; your job is judgment —
business logic, domain edge cases, multi-tenant correctness — and routing the
PR to the right humans. **Merging deploys automatically (develop → staging,
master → production including `npm run migration:run`). This skill never
approves or merges anything — the approve + merge is always a human maintainer
action in the GitHub UI.** Your output determines who reviews, not whether it
ships.

Routing depends only on what the diff touches — never on who invoked the skill.

## Step 1 — Identify the repo and load its config

Run `git remote get-url origin` in the current directory.

- Contains `project-zoe-server` → use the **Server** config below.
- Contains `project-zoe-client` → use the **Client** config below.
- Anything else → stop and tell the user this skill only works inside the
  project-zoe-server or project-zoe-client repos.

**Normalize the PR reference to a bare number before using it in any
command.** If given a URL, it must point at the detected repo under
`kanzucodefoundation` — extract the number; if it points anywhere else, stop
and say so. If the argument is neither a number nor such a URL, or no argument
was given, ask which PR to review. Only the validated number is ever
substituted into commands.

## Step 2 — Gather everything before judging anything

Run all of these (substitute the PR number):

```bash
gh pr view <N> --json number,title,body,state,isDraft,baseRefName,headRefName,author,additions,deletions,files
gh pr diff <N>
gh pr checks <N>
```

And the review-thread state (the REST API does not expose thread resolution —
this must be GraphQL). Substitute `<REPO>` with the repo name from Step 1; the
owner is always `kanzucodefoundation` (see note below):

```bash
gh api graphql -f query='query {
  repository(owner: "kanzucodefoundation", name: "<REPO>") {
    pullRequest(number: <N>) {
      reviews(first: 50) {
        pageInfo { hasNextPage endCursor }
        nodes { author { login } state }
      }
      reviewThreads(first: 100) {
        pageInfo { hasNextPage endCursor }
        nodes { isResolved isOutdated comments(first: 1) { nodes { author { login } body path } } }
      }
    }
  }
}'
```

If either `pageInfo.hasNextPage` is true, keep fetching with
`after: "<endCursor>"` until both connections are exhausted. Never judge
gate 2 on truncated thread data.

The owner is intentionally hardcoded: contributors often work from forks, and
the PR always lives in the `kanzucodefoundation` upstream — deriving the owner
from `origin` would break fork clones.

If the PR is not OPEN, or is a draft, report that and stop.

## Step 3 — Sensitive-path scan (decides routing, checked first)

Check every changed file against the repo's sensitive list, and scan the diff
for the content triggers. The result decides which of the two triage outcomes
the PR gets in Step 6 — routine (Maintainers) or sensitive (Senior
Engineering). Sensitive PRs always get the full adversarial review (Step 5).

**Release PRs (base `master`):** merging to master deploys production and
auto-runs migrations, but a release PR is not a third tier — it gets whichever
of the two outcomes its diff earns, same as any other PR. Run the scan over
the **full cumulative diff** (`gh pr diff`), not per-commit: if the cumulative
develop→master diff is clean, it routes to Maintainers like any routine PR
(note in your output that merging it deploys production); if it touches
anything sensitive, it routes to Senior Engineering.

A release PR is specifically head `develop` into base `master`. Only release
PRs get the gate adjustment in Step 4: gate 1 is waived for them, whether or
not CodeRabbit reviewed the release PR itself (its check may report "Review
skipped" or post a real review — either way the check passes, and gate 2 still
applies to any threads on the release PR). A master-targeted PR from **any
other head branch is not a release PR** — gate 1 applies in full; if CodeRabbit
hasn't reviewed it, the author must trigger one with `@coderabbitai full
review` before that gate can pass.

### Server (`project-zoe-server`)

- `src/**/*.entity.ts` — any entity file (schema shape)
- `src/migrations/**` — migrations auto-run against production on deploy
- `src/data-source.ts`, `src/config.ts` — ORM/connection config
- Content trigger: any **added** diff line matching `synchronize:\s*true`
- `src/auth/**` — guards, strategies, JWT helpers
- `src/middleware/**` — JWT/tenant-header middleware
- `src/interceptors/tenant-context.interceptor.ts`
- `src/shared/tenant/**`, `src/shared/repository/**`, `src/shared/interceptors/**`, `src/shared/db.service.ts` — tenant isolation core
- `src/tenants/**`
- `src/groups/services/group-permissions.service.ts`, `src/groups/services/group-tree.service.ts` — permission cascade and data-visibility expansion
- `src/finance/**` — real money
- `.github/workflows/**` — deploy pipeline with production SSH access

### Client (`project-zoe-client`)

- `src/utils/ajax.ts` — API transport and auth-token handling
- `src/utils/permissions.ts` — capability checks
- `src/utils/types.ts` — server response shapes
- `src/data/constants.ts` — `remoteRoutes` (the API contract) and auth storage keys
- `src/data/coreSlice.ts`, `src/data/store.ts` — auth/session state
- `src/App.tsx` — capability-gated routing
- `src/modules/login/**` — login/password/reset flows
- `.github/workflows/**` — deploy pipeline

## Step 4 — Merge-readiness gates (all must pass before triage)

Evaluate each and record pass/fail with specifics:

1. **CodeRabbit reviewed.** At least one review by `coderabbitai` exists on the
   PR (its reviews have state `COMMENTED` — it never approves; that's normal).
   Waived for release PRs to master (see Step 3). If no review exists —
   usually the quota ran out — the failure comment must tell the author to
   trigger one by commenting `@coderabbitai full review` on the PR and re-run
   this skill once it completes.
2. **All review threads resolved.** Every `reviewThreads` node has
   `isResolved: true`. An unresolved thread that is `isOutdated: true` still
   fails this gate — outdated is not resolved; someone must close the loop.
   Quote the first comment of each unresolved thread in your output.
3. **CI green.** From `gh pr checks`: the `test` check must be present and
   passing, the `CodeRabbit` check must show "Review completed" (or "Review
   skipped" on release PRs), and every other reported check (e.g.
   `Analyze`/CodeQL on PRs to master) must pass. No checks pending, no checks
   failed, `test` not missing.
4. **Non-trivial description.** The body must contain real content beyond the
   PR template scaffold. A body that is only unfilled placeholders ("Summary of
   changes here", "Ticket number here") plus CodeRabbit's auto-generated
   summary fails. Real content with some leftover placeholders passes — note
   the leftovers.
5. **No credential-shaped files.** Fail hard if the diff touches any of:
   `.env*`, `*.pem`, `*.key`, `id_rsa*`, `*.dump`, `*credentials*`,
   `*secrets*`, or adds anything that looks like a real secret value in code.
6. **Lockfile flagged.** If `package-lock.json` changed, this is a **distinct,
   named item** in your output, always: state whether the lockfile change is
   explained by a corresponding `package.json` change and roughly what
   dependencies moved. An unexplained lockfile change (no matching
   `package.json` edit, or far larger than the stated purpose) fails the gate.
   An explained one passes but is still reported as its own line item.

## Step 5 — Your own review

**Default: light pass.** Read the full diff and, for any file where the change
depends on surrounding context (services, business logic, anything stateful),
read the changed file itself. You are looking for what CodeRabbit misses:

- Does the diff actually do what the description claims — all of it, and
  nothing undisclosed?
- Business-logic and domain correctness (group hierarchy, fellowship vs
  location vs structure semantics, reporting periods, attendance tracks —
  see the server repo's CLAUDE.md).
- **Multi-tenant correctness** (server): new queries must be tenant-scoped —
  `TenantAwareRepository`, or an explicit `tenantId` filter. Any query that
  could return another tenant's rows is a blocking finding.
- Client: does the code agree with the server's actual response shapes and
  `remoteRoutes`?

**Escalate to the full adversarial pass** (persona and output format in
[critical-code-review.md](critical-code-review.md), use it as-is) when:
- the PR touches a sensitive path (always adversarial), or
- the light pass finds anything worth digging into.

## Step 6 — Outcome

All comments are posted with `gh pr comment <N> --body ...`. Write every
comment as a **teaching artifact for junior engineers**: state plainly what you
found and why it matters in this codebase — not just pass/fail labels. Always
include the lockfile line item if applicable, and — explicitly — anything you
found that CodeRabbit missed ("CodeRabbit did not flag X; it matters
because Y").

### Any gate failed → comment and stop

Post a comment listing each failed gate with specifics (and your review
findings so far). Apply no labels and request no reviewers — the author has
work to do first; re-run the skill afterwards.

### Clean pass, no sensitive path → route to Maintainers

1. Post your review summary as a comment: what you checked, findings, minor
   non-blocking notes. For release PRs, state that merging deploys production.
2. `gh pr edit <N> --add-label ready-for-maintainer-review`
   (create the label first if the repo doesn't have it)
3. `gh pr edit <N> --add-reviewer kanzucodefoundation/maintainers`
4. Tell the user the PR is ready for any maintainer to approve and merge in
   the GitHub UI.

### Clean pass, sensitive path touched → route to Senior Engineering

1. Post the adversarial review as a comment, opening with the routing reason,
   e.g.: "This touches `src/migrations/…` [schema] — route to the Senior
   Engineering Team before merging. Migrations auto-run against the production
   database on deploy, so schema changes always get a senior review." Make
   clear the PR may well be fine — it just requires senior eyes.
2. `gh pr edit <N> --add-label needs-senior-review`
   (create the label first if the repo doesn't have it)
3. `gh pr edit <N> --add-reviewer kanzucodefoundation/senior-engineering`
4. Tell the user it's awaiting Senior Engineering review.

If a PR is both sensitive **and** has gate failures, use the gate-failure
outcome but include the sensitivity finding in the comment so nobody is
surprised on the re-run.
