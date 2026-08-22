# Cloupanz APK Builder v2

Website builder + API + GitHub Actions.

## Important
The API skeleton included here triggers GitHub Actions using `repository_dispatch`.
For a production builder, the ZIP/logo should be stored in a temporary object store or GitHub release/branch with strict size limits, then the workflow downloads that payload.

Environment variables:
- GITHUB_OWNER
- GITHUB_REPO
- GITHUB_TOKEN
- GITHUB_WORKFLOW

Never expose `GITHUB_TOKEN` in frontend JavaScript.
