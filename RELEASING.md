# Releasing teachkit

Release checklist for `@jjfwang/teachkit`. The registry publish step is an
owner action (needs `npm login` on the releasing machine); everything else is
plain git/npm. The first release has shipped: `0.2.0-beta.0`, published to
npm on 2026-10-11 under tag `v0.2.0-beta.0`, with a matching GitHub Release
("0.2.0-beta.0 (beta)"). This checklist now describes the NEXT release.

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
   `--access public`; owner action — requires `npm login`). For a
   prerelease (e.g. a beta), publish under its dist-tag instead —
   `npm publish --tag beta --access public` — so `latest` keeps pointing
   at the current stable line; that is how `0.2.0-beta.0` shipped.
7. **Verify from the registry.** `npm view @jjfwang/teachkit version` must
   print `X.Y.Z`; then in a fresh temp dir run
   `npm install @jjfwang/teachkit` and confirm
   `node -e "require('@jjfwang/teachkit')"` loads, plus an ESM smoke test of
   the documented import pattern for the charts entry
   (`import charts from '@jjfwang/teachkit/charts'`; see README
   "Install as a library"). For a prerelease, verify the dist-tag instead:
   `npm view @jjfwang/teachkit@beta version` must print the prerelease
   version, and consumers track the prerelease line with
   `npm install @jjfwang/teachkit@beta`.
8. **Docs follow-up.** Done for the first release (2026-10-11): README
   "Install as a library" leads with `npm install @jjfwang/teachkit` and
   names `0.2.0-beta.0` as the first published line. For later releases,
   update that section only if the install route or the named current
   line changes.
