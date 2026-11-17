# Continuous integration

## Affected jobs

The `changes` job selects each workspace that changed since a base commit, and
every workspace that depends on one. Build and test jobs run only for the
selected workspaces, and the build jobs cover the images in the
[image table](../README.md#images). `Checks` runs on every change.

- On a pull request, the base is `origin/main`.
- On a push to `main`, the base is the head commit of the last successful push
  run, so a failed or cancelled run does not let the next push skip what it
  broke. If CI finds no usable base, it selects every workspace.
- A change to a root build input, such as the lockfile, the root manifest, or
  the CI workflow, selects every workspace. A change to any other file outside
  every workspace selects none.

## Releases

[Knope](https://knope.tech) sets the versions, and CI publishes the images.
Nothing publishes to npm. [CONTRIBUTING.md](../CONTRIBUTING.md#change-files)
lists the Knope packages. Other workspaces have no releases.

`virtool` holds the web and internal apps, with one version and one changelog
in `apps/web`. Its tags are the plain version, such as `42.61.2`, which
continues the earlier tags. The other packages have their own versions and
changelogs, and tags such as `create-sample@42.61.2`.

The `release` job runs on every push to `main` after all build and test jobs
pass or skip:

1. Each pull request adds change files in `.changeset/`. See
   [CONTRIBUTING.md](../CONTRIBUTING.md#change-files).
2. While change files exist, the job opens or updates the **Release** pull
   request. It applies the version bumps and updates the changelogs. The job
   rebuilds the branch from `main` on each push, so do not push to it.
3. When you merge the Release pull request, the job publishes each version
   that has no tag. It pushes the image, then creates the tag and a GitHub
   Release. Only the `virtool` Release is marked as the latest.

If a release fails, re-run the failed jobs of that workflow run. A later push
to `main` also tries the release again. Each image builds from the commit that
set its version, so changes merged after the release do not go into it.

The job opens the Release pull request as the `virtool-releaser` GitHub App. The
app can write contents, pull requests, and workflows on this repository only.
The `RELEASER_CLIENT_ID` Actions variable and the `RELEASER_PRIVATE_KEY` secret
identify it.

Knope is installed with `mise`. Renovate does not update it. See
[CONTRIBUTING.md](../CONTRIBUTING.md#upgrade-knope).

## Site

The `Site` workflow publishes [virtool.ca](https://www.virtool.ca) to Cloudflare
Workers. It always builds from the tag of the latest `virtool` Release, so a
push to `main` does not change the live site. A site-only fix goes live with the
next release.

The workflow runs:

- after `Release / GitHub`, as the `Release / Site` job
- daily, to get new data from GitHub Releases, such as `/releases/hmms.json`
- when you start it manually

The `CLOUDFLARE_API_TOKEN` secret and the `CLOUDFLARE_ACCOUNT_ID` Actions
variable identify the Cloudflare account. The token needs permission to edit
Workers. Only the deploy step can read it.

`pnpm build` and `pnpm knip` skip the site. `pnpm check` uses Prettier to check
only the site Markdown and MDX content.

## Change-file check

`Knope / Check` applies the [change-file rules](../CONTRIBUTING.md#change-files).
It runs in its own workflow, so a label change runs only this check and not all
of CI. It skips the Release pull request. `Knope / Test` tests the release
scripts.

## Dependency updates

Renovate runs in the **Renovate** workflow. It opens grouped pull requests for
production and development dependencies each week, and for GitHub Actions each
month. Each major update gets its own pull request. Node base image digests and
security fixes can arrive at any time. The **Dependency Dashboard** issue lists
pending and postponed updates.

Renovate does not change the pnpm overrides or Node versions. Change them by
hand.

Renovate writes the change file in the same commit as each bump. A bump is a
`maintenance` change, and it releases a patch of each Knope package that it
affects. A bump that ships nothing gets no change file.

Renovate opens pull requests as the `virtool-renovator` GitHub App. The
`RENOVATOR_CLIENT_ID` Actions variable and the `RENOVATOR_PRIVATE_KEY` secret
identify it.
