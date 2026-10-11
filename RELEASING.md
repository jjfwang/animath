# Releasing animath

Release checklist for `@jjfwang/animath`. The registry publish step is an
owner action (needs `npm login` on the releasing machine); everything else is
plain git/npm. No tags or GitHub Releases exist yet — the first run of this
checklist ships the first release.

## Prerequisites

- Clean working tree on `main`; the test gate is green
  (`CONTRIBUTING.md`: full suite + `node --check` + coverage).
- `CHANGELOG.md` `## [Unreleased]` holds the release notes.

## Steps

1. **Changelog.** Move the `Unreleased` entries into a new dated version
   section (`## [X.Y.Z] - YYYY-MM-DD`), per the `CHANGELOG.md` header
   convention (Keep a Changelog, semver). Leave an empty `## [Unreleased]`
   section at the top.
2. **Version bump.** Run `npm version <patch|minor|major>` — it bumps
   `package.json`, commits, and creates the tag `vX.Y.Z` in one step.
   (`patch` = fixes, `minor` = new capabilities, `major` = breaking
   `SPEC.md` contract changes.)
3. **Push.** Push `main` and the tag to GitHub
   (`git push && git push vX.Y.Z`).
4. **Tarball check.** `npm pack --dry-run` and confirm the tarball holds
   `generator/`, `player/`, `web/embed.js`, `web/embed.d.ts`, `README.md`,
   `CHANGELOG.md`, `LICENSE`, `PROMPTS.md`, and `SPEC.md` (the `files` list
   in `package.json`).
5. **GitHub Release.** Create a release from tag `vX.Y.Z`; the release notes
   are the new `CHANGELOG.md` version section, copied verbatim.
6. **Publish.** `npm publish --access public` (the scoped name needs
   `--access public`; owner action — requires `npm login`).
7. **Verify from the registry.** `npm view @jjfwang/animath version` must
   print `X.Y.Z`; then in a fresh temp dir run
   `npm install @jjfwang/animath` and confirm
   `node -e "require('@jjfwang/animath')"` loads, plus an ESM smoke test of
   the documented import pattern for the charts entry
   (`import charts from '@jjfwang/animath/charts'`; see README
   "Install as a library").
8. **Docs follow-up.** Once the registry route works, update README
   "Install as a library" to lead with `npm install @jjfwang/animath` —
   it currently leads with the `github:` fallback and marks the registry
   route pending.
