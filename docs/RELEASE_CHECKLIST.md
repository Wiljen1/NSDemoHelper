# Release Checklist

Use this checklist before promoting changes between environments.

## Before Merging To Staging

- [ ] App starts successfully.
- [ ] Existing tests pass.
- [ ] Prep flow works.
- [ ] SC guide generation works.
- [ ] Demo Intelligence works.
- [ ] Pre-Demo Intelligence works.
- [ ] Saved state still works.
- [ ] Exports still work if available.
- [ ] No obvious console errors.
- [ ] No secrets committed.
- [ ] Version and changelog updated if needed.

## Before Merging To Production/Main

- [ ] Staging has been tested.
- [ ] Release notes are written.
- [ ] Version number is confirmed.
- [ ] Rollback tag exists.
- [ ] Critical flows validated.
- [ ] Known issues documented.
- [ ] Production merge approved.

## Critical MVP Flows

- [ ] Load the app locally.
- [ ] Confirm version and environment are visible.
- [ ] Run Pre-Demo Scoring with sample notes.
- [ ] Run Learn / Create Demo.
- [ ] Review SC Guide output.
- [ ] Review Pre-Demo Intelligence output.
- [ ] Review Demo Intelligence output.
- [ ] Confirm website context is reused rather than rescanned unnecessarily.
- [ ] Confirm Admin content still loads.
- [ ] Confirm live demo functionality toggle hides live-demo controls when disabled.

## Rollback Readiness

- [ ] Current production tag is known.
- [ ] Previous stable tag is known.
- [ ] Revert strategy is clear.
- [ ] Any risky migration or local state change has a fallback plan.
