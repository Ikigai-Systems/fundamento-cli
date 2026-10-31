# Dependabot

Read together with the `dependabot-triage` skill (`dependabot@release-kit`) and the comments in
`.github/dependabot.yml`. This repository is public: nothing production-specific in PRs or
comments.

## What CI covers

`Run Tests` runs lint, a smoke test (`bin/funcli.js --version` must print exactly the package
version) and the unit tests on Node 24 and 25; `Integration Tests` start a local stack and run
`npm run test:integration`; `Changelog` skips bot PRs. There is no build step. The smoke test
catches a dependency that logs on load or an argument-parser change that breaks startup; it does
not exercise `--help` output or unusual arguments, which is where major bumps of the parser show
up, so for those also run the binary by hand.

## Known quirks

- `dotenv` 17+ prints an `injected env` line on every load; `src/config.js` passes
  `quiet: true`. `--version` and other output must stay clean.
- `commander` 15 errors on extra positional arguments instead of ignoring them. Mention
  behaviour changes like this in the release notes of the next `funcli` release.
- Third-party actions are pinned to commit SHAs; Dependabot bumps the SHA together with the
  version comment. Check the comment still names the new version.
- Merging a PR that edits `.github/workflows/*` needs the `workflow` scope on your `gh` token.
