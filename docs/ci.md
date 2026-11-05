# Continuous integration

## Images

CI builds the six images listed in the [image table](../README.md#images). Each
app builds inside Docker from the shared image-build stages, so an image holds
exactly the production closure that the workspace graph records. A release
publishes only the images whose app version changed.

To add an image:

1. Add the app Dockerfile, and its build and image targets in the Bake file.
2. Add a `build` matrix entry. Its `image` value must be the Bake target and
   the app directory name.
3. Add the app `package.json` to the `versioned_files` of a Knope package.

Only pushes to `main` write the image build caches. A cache that a pull request
writes is visible only to that pull request, and it pushes the layers of `main`
out of the 10 GB Actions cache. The release reuses the caches of `main`, so it
does not rebuild the Rust crates and bioinformatics tools.

## Affected jobs

The `changes` job selects each workspace that changed since a base commit, and
every workspace that depends on one. Build and test jobs run only for the
selected workspaces. `Checks` runs on every change.

- On a pull request, the base is `origin/main`.
- On a push to `main`, the base is the head commit of the last successful push
  run. This makes sure that a cancelled or failed run does not let the next
  push skip what it broke. If no such run exists, CI selects every workspace.
- A change to a file outside every workspace, such as the lockfile or a
  workflow, selects every workspace.

The Rust crates and the shared native-tool recipe are private workspaces. Each
app that uses one lists it as a dependency, so the graph selects that app when
the crate or recipe changes.

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

The job opens the Release pull request as the `virtool-releaser` GitHub App,
because a pull request opened with `GITHUB_TOKEN` does not start CI. The app
can write contents, pull requests, and workflows on this repository only. The
`RELEASER_CLIENT_ID` Actions variable and the `RELEASER_PRIVATE_KEY` secret
identify it. Only the `Release / GitHub` job asks for workflows access: GitHub
refuses a new tag on a commit whose workflow files differ from `main` without
it.

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

## Change-file check

`Knope / Check` runs in its own workflow, so that a label change runs only this
check and not all of CI. It skips the Release pull request.

The check fails a pull request when:

- a change file has incorrect front matter, an unknown package, an unknown
  change type, or no summary on one line;
- a change file that uses `maintenance` contains `**Action required:**`;
- an image app that the pull request affects has no change file that names it.

Changes to tests, test data, Markdown, and dependencies that ship nothing do
not affect an app. A bundled app that is affected only through a shared package
needs no change file when its built code and production dependencies stay the
same.

The `no-release` label waives the second rule. It does not waive the first.

`Knope / Test` tests this check and the Renovate change-file task.

## Dependency updates

Renovate runs in the **Renovate** workflow every two hours. It opens these
pull requests:

- Each Monday, one for minor and patch updates of production dependencies,
  and one for development dependencies.
- One for each major update. Packages from the same monorepo move together.
- One for `better-auth` and SimpleWebAuthn together, for all update types. The
  passkey plugin must use the same SimpleWebAuthn copy as the app.
- On the first day of each month, one for GitHub Actions.
- At any time, one for the Node base image digest. Other Docker images do not
  go into published images, so Renovate ignores them. Node versions change only
  by hand.
- At any time, one for each security fix in the OSV database.

Renovate does not change the pnpm overrides. Each override pins a vulnerable
range of a transitive dependency, so it changes only by hand. The
**Dependency Dashboard** issue lists pending and postponed updates.

Renovate writes the change file in the same commit as each bump. A bump is a
`maintenance` change, and it releases a patch of each Knope package that it
affects. A bump that ships nothing gets no change file. A group lists its bumps
once in the `virtool` changelog. Dependency updates come last in the Maintenance
section of each release.

Renovate opens pull requests as the `virtool-renovator` GitHub App. The
`RENOVATOR_CLIENT_ID` Actions variable and the `RENOVATOR_PRIVATE_KEY` secret
identify it.
