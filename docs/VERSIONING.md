# Versioning Strategy

NetSuite Demo Helper uses semantic versioning with a staged product maturity model.

## Version Bands

- `0.x.x` = experimental/internal development
- `1.x.x` = stable internal SC platform
- `2.x.x` = white-label platform architecture

## Suggested Roadmap

- `v0.1.0-alpha`: current MVP baseline
- `v0.2.0`: intelligence UI redesign
- `v0.3.0`: improved workspace/snapshot handling
- `v0.4.0`: stronger content pack separation
- `v1.0.0`: stable internal NetSuite SC platform
- `v2.0.0`: white-label-ready platform

## Release Notes

Every meaningful release should update:

- `package.json` version
- visible app version
- `CHANGELOG.md`
- any relevant product or architecture documentation

## Tagging

Stable baselines may be tagged in Git using the same version name, for example:

```bash
git tag v0.1.0-alpha
```

Tags should only be created after tests pass and the baseline branch is committed.
