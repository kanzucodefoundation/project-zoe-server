# Contributing to Project Zoe Server

Thank you for your interest in contributing! Please read this guide before opening a pull request.

## Before you start

- Get the project running locally by following the [README](./README.md).
- Check the [open issues](https://github.com/kanzucodefoundation/project-zoe-server/issues) to see if someone is already working on what you have in mind.
- For significant changes, open an issue first to discuss the approach before writing code.

## Workflow

```
feature branch → develop (staging) → master (production)
```

1. **Branch from `develop`** — never from `master`:

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes.** Keep commits small and focused.

3. **Test your changes locally** before opening a PR. Make sure the server starts cleanly and existing behaviour is not broken.

4. **Open a PR against `develop`** and fill in every section of the PR template — especially _how to test_. Incomplete PRs will be sent back.

5. Your PR will be reviewed. Address any feedback, then it will be merged into `develop` and deployed automatically to staging.

6. Once the change is verified on staging, it is promoted to `master` via a separate PR, which triggers the production deploy.

## PR review & merge

Every PR passes through three layers before it can merge. `develop` and `master` are protected: direct pushes are blocked, one approving review is required (pushing new commits dismisses earlier approvals), the `test` and `CodeRabbit` checks must pass, and only the Maintainers team can merge.

1. **CodeRabbit** reviews automatically when the PR is opened. Resolve every thread it raises — unresolved threads (even outdated ones) block the next step. If it reports "Review rate limited" (quota exhausted), trigger it later by commenting `@coderabbitai full review` on the PR.

2. **Run `/pr-review-merge <PR number>`** from Claude Code inside this repo. This is the second, judgment-based review plus triage: it checks the gates (CodeRabbit reviewed, threads resolved, CI green, real PR description, no credential-shaped files, lockfile changes explained), reviews the diff, and routes the PR with a label and a team review request. If any gate fails, the skill stops immediately, posts the failures, and applies no label or reviewer requests:

   - `ready-for-maintainer-review` — nothing sensitive touched; any maintainer can approve and merge.
   - `needs-senior-review` — the diff touches sensitive paths (entities, migrations, ORM config, auth/tenant code, group permissions, finance, deploy workflows); the Senior Engineering team must review first.

   The full gate and sensitive-path list lives in [`.claude/skills/pr-review-merge/SKILL.md`](./.claude/skills/pr-review-merge/SKILL.md). The skill never approves or merges anything.

3. **A maintainer approves and merges** in the GitHub UI (squash merge). The approving reviewer must be a member of the Maintainers team — general write access is not sufficient, and the PR author cannot approve their own PR.

To run the skill you need Claude Code started inside the repo (pull first — the skill ships in `.claude/skills/`), an authenticated `gh` CLI (`gh auth login`), and write access for the labelling step. If you work from a fork, run `gh repo set-default kanzucodefoundation/project-zoe-server` once so `gh` resolves PRs against the upstream repo.

Releases (`develop` → `master`) follow the same process — the skill scans the full cumulative diff and routes it like any other PR. Merging to `master` deploys production, including migrations. If a hotfix ever lands on `master` directly, back-merge it into `develop` immediately, using a merge commit (not squash).

## Branch naming

```
{type}/{short-summary}
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, dependencies, config |
| `docs` | Documentation only |
| `refactor` | Code restructure without behaviour change |

**Examples:** `feat/bulk-contact-import`, `fix/attendance-query`, `chore/update-deps`

## Code style

ESLint and Prettier are configured. Run `npm run lint` before pushing. The pre-commit hook will catch most issues automatically.

Use conventional commit messages:

```
feat: add bulk contact import endpoint
fix: correct attendance count query
chore: upgrade NestJS to v10
```

## Database migrations

Schema changes must always be captured in a TypeORM migration file. Staging and production never use `DB_SYNCHRONIZE` — the only way schema changes reach those environments is through a committed migration run by CI on deploy.

### When you change an entity

1. Make your entity change as normal and restart the dev server (`DB_SYNCHRONIZE=true` will apply it locally).

2. Generate a migration file from the diff between your entities and the local database:

   ```bash
   npm run migration:generate -- src/migrations/DescriptiveName
   ```

   Replace `DescriptiveName` with something that describes the change, e.g. `AddContactStatusColumn` or `WidenUsernameField`.

3. **Review the generated file** before committing it. TypeORM's diff is usually correct but occasionally generates `DROP COLUMN / ADD COLUMN` instead of `ALTER COLUMN TYPE` for simple type changes — if you see that pattern on a column with existing data, rewrite it as `ALTER TABLE ... ALTER COLUMN ... TYPE`.

4. Test the migration against your local database with synchronize turned off:

   ```bash
   # In .env, temporarily set DB_SYNCHRONIZE=false
   npm run migration:run
   # Verify the app still starts and behaves correctly
   # Restore DB_SYNCHRONIZE=true when done
   ```

5. Commit the migration file in the same PR as the entity change. CI will run it automatically on deploy.

### If the database already has something your migration creates

If an object (type, column, index) was added manually on staging or production outside of a migration, wrap that specific step in a guard so the migration skips it rather than failing:

```typescript
// For CREATE TYPE
await queryRunner.query(`
  DO $$ BEGIN
    CREATE TYPE "public"."my_enum" AS ENUM('A', 'B');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
`);

// For ADD COLUMN
await queryRunner.query(
  `ALTER TABLE "my_table" ADD COLUMN IF NOT EXISTS "my_col" text`,
);

// For CREATE INDEX
await queryRunner.query(
  `CREATE INDEX IF NOT EXISTS "IDX_..." ON "my_table" ("col")`,
);
```

Only guard the steps that already exist — leave everything else as plain SQL.

## Architecture

Before making structural changes, review `CLAUDE.md` at the repo root and the `docs/` folder. Key things to know:

- The codebase uses **row-level multi-tenancy** — every database query must be tenant-scoped. Extend `TenantAwareRepository` for any new entities that hold tenant data.
- The group hierarchy has four purposes (`fellowship`, `location`, `serving_team`, `structure`) — understand this before touching group or attendance logic.
- Attendance tracking (individual check-in) and aggregate reporting are intentionally separate systems. Do not add reporting fields to `ServiceInstance` or `FellowshipInstance`.
