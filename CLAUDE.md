This is repository for Fundamento's command line interface.

Context includes:

@README.md

## Releases and changelog

Versions and `CHANGELOG.md` are automated. `package.json`'s `version` is the single
source of truth — `funcli --version` reads it, and `.github/workflows/publish.yml`
publishes it to the `latest` dist-tag. **release-please owns that field; never bump it
by hand.**

Every PR carries its own changelog entry in its title and description. See
`.claude/rules/changelog.md` for the conventions, and run `/changelog` to classify a
change. Merging the `chore(master): release X.Y.Z` PR tags the release, publishes to
GitHub Packages and writes the release notes.
