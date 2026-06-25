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

## Architecture

Before making structural changes, review `CLAUDE.md` at the repo root and the `docs/` folder. Key things to know:

- The codebase uses **row-level multi-tenancy** — every database query must be tenant-scoped. Extend `TenantAwareRepository` for any new entities that hold tenant data.
- The group hierarchy has four purposes (`fellowship`, `location`, `serving_team`, `structure`) — understand this before touching group or attendance logic.
- Attendance tracking (individual check-in) and aggregate reporting are intentionally separate systems. Do not add reporting fields to `ServiceInstance` or `FellowshipInstance`.
