# Virtool.ca website

The product [website](https://www.virtool.ca) for Virtool. It uses
[Astro](https://docs.astro.build) and lives in the monorepo as the
`@virtool/site` workspace package.

## Configuration

The site has one optional build-time environment variable. It doesn't use the
Virtool service `_FILE` convention.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | String | Unset | Authenticate GitHub API requests that load release data, increasing the API rate limit. |

## Commands

Run all commands from the monorepo root.

| Command                                       | Action                                         |
| :-------------------------------------------- | :--------------------------------------------- |
| `pnpm install`                                | Install dependencies (whole monorepo)          |
| `pnpm --filter @virtool/site dev`             | Start the local dev server                     |
| `pnpm --filter @virtool/site build`           | Build the production site to `apps/site/dist/` |
| `pnpm --filter @virtool/site preview`         | Build, then preview locally with Wrangler      |
| `pnpm --filter @virtool/site test`            | Run the Vitest suite                           |
| `pnpm --filter @virtool/site run deploy`      | Build and deploy to Cloudflare Workers         |
| `pnpm --filter @virtool/site astro -- --help` | Run the Astro command-line tool                |

## Changelog

The `/changelog` page lists all `virtool` releases, newest first. Each release
has a page at `/changelog/<version>`. This link does not change, so the web app
uses it. The build reads the releases from the web app changelog, which Knope
generates, so the pages need no separate content.

## Posts

The `/posts` page lists all posts, newest first. Each post is at
`/posts/<slug>`. The slug comes from the file name, and the web app links to
posts by slug, so do not rename a post after it is published.

A `release` post names a pull request. The build gets the version and date from
the `virtool` release that contains it, and hides the post if no release
contains it. A `research` post has no release, and its author gives the date.

See [Posts](../../CONTRIBUTING.md#posts) for how to write a post.

## Deployment

GitHub Actions publishes the site from the latest `virtool` release, not from
`main`. A site change goes live with the next release. See
[Site](../../docs/ci.md#site) in the CI documentation.
