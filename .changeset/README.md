# Changesets

This directory holds [changesets](https://github.com/changesets/changesets):
one Markdown file per pending change, each recording which workspaces to bump
and by how much. `pnpm changeset` writes one; the automated **Version
Packages** pull request consumes them, applies the version bumps, and updates
each workspace's `CHANGELOG.md`.

See [docs/ci.md](../docs/ci.md#releases) for how a merged changeset flows
through to a published image.
