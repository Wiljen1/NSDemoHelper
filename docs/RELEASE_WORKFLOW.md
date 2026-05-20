# Release Workflow

NetSuite Demo Helper should use a controlled release process so active development can continue without destabilizing the live version.

## Branch Structure

- `main` or `production`: live/stable version only.
- `staging`: tested release candidate before production.
- `develop`: active development integration branch.
- `feature/*`: individual feature branches.
- `bugfix/*`: normal bug fixes.
- `hotfix/*`: urgent production fixes.
- `mvp/baseline-v0.1.0`: preserved MVP fallback branch.

The current `mvp/baseline-v0.1.0` branch is a stable internal MVP fallback point. Do not merge experimental changes into this branch unless explicitly requested.

## Promotion Flow

Use this promotion path:

```text
feature branch -> develop -> staging -> production/main
```

Rules:

- New work starts from `develop`.
- Completed features merge into `develop`.
- Release candidates are promoted from `develop` into `staging`.
- Completed features merge into `staging` only when they are ready for validation.
- Only tested `staging` builds merge into `production/main`.
- `staging` should represent the next possible live release.
- `production/main` should always be rollback-safe.
- Do not do direct feature work on `production/main`.
- Do not do direct experimental work on `staging`.
- `production/main` should contain only approved releases.

## Commit Message Conventions

Use clear commit prefixes:

- `feat:` new feature
- `fix:` bug fix
- `chore:` maintenance or tooling
- `docs:` documentation only
- `refactor:` code change without behavior change
- `test:` tests added or changed
- `style:` visual/styling changes only
- `release:` release preparation
- `revert:` rollback/revert commit

Examples:

- `feat: add demo workspace snapshots`
- `fix: preserve SC guide after page refresh`
- `docs: add white-label readiness notes`
- `refactor: separate NetSuite prompt constants`
- `release: prepare v0.2.0 staging build`
- `revert: rollback intelligence card redesign`

## Environments

The app should support three named environments:

- `development`
- `staging`
- `production`

Use `APP_ENV` to identify the current environment:

```bash
APP_ENV=development npm run control
APP_ENV=staging npm run control
APP_ENV=production npm run control
```

Use `APP_PROFILE` to identify the local product profile:

```bash
npm run mvp
npm run whitelabel
```

Default local profiles:

- `mvp`: stable NetSuite MVP profile on port `4173`.
- `whitelabel`: future white-label development profile on port `4182`.

The app may also receive optional build metadata:

- `APP_COMMIT` or `GIT_COMMIT`
- `APP_BUILD_DATE` or `BUILD_DATE`

This metadata is shown unobtrusively in the app header and returned in the manifest payload. Do not expose secrets or user data in build metadata.

## Version And Build Metadata

The release metadata structure is:

```text
Version: v0.1.0-alpha
Environment: development | staging | production
Commit: abc1234 if available
Build Date: 2026-05-19 if available
```

Every release should confirm:

- app version
- environment
- current commit SHA
- build date
- changelog entry
- rollback tag

## Tags

Stable production releases should be tagged. Tags are rollback points.

Examples:

- `v0.1.0-alpha`
- `v0.2.0-beta`
- `v1.0.0`

Tags should point to the exact commit that was approved for release.

## Rollback Guidance

Rollback options:

- Roll back from a previous Git tag.
- Roll back by reverting a commit.
- Roll back by resetting `develop` or `staging` if the bad change has not been released.
- Never force-push `production/main` unless explicitly approved.

### Rollback From A Tag

Use a known-good release tag as the rollback target:

```bash
git checkout main
git pull
git revert <bad-commit>
```

For a redeploy workflow, deploy the commit referenced by the previous stable tag.

### Rollback By Reverting

Prefer `git revert` for production-safe rollback because it preserves history:

```bash
git revert <commit-sha>
```

### Resetting Development Or Staging

If the change has not reached production, `develop` or `staging` may be reset or cleaned up according to the team workflow. Do not use this approach on production without explicit approval.

## Rollback Before Production Release

If staging testing fails, rollback should happen on `staging` and/or `develop` before promotion to production.

Do not promote a known-bad staging build. Fix, revert, or remove the failing change before merging to `production/main`.

## MVP Baseline Preservation

`mvp/baseline-v0.1.0` exists as a preserved fallback branch for the first internal MVP. It should remain untouched unless the explicit goal is to patch the baseline itself.
