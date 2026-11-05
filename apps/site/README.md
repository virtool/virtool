# Virtool.ca website

The product [website](https://www.virtool.ca) for Virtool.

## Configuration

The site has one optional build-time environment variable. It doesn't use the
Virtool service `_FILE` convention.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | String | Unset | Authenticate GitHub API requests that load release data, increasing the API rate limit. |

## Astro

The website uses [Astro](https://docs.astro.build) as a site builder. It lives
in the `virtool` monorepo as the `@virtool/site` workspace package.

### Commands

All commands are run from the monorepo root:

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

The `/changelog` page shows the `virtool` releases. The build reads them from
the web app changelog, which Knope generates, so the page needs no separate
content. The page leaves out dependency entries: `Update … dependencies`
sections, and bullets that bump a dependency or update a digest.

The page shows ten releases at a time, and later pages are at
`/changelog/<page>`. The left menu lists every release and links to it on its
page.

## Deployment

GitHub Actions publishes the site from the latest `virtool` release, not from
`main`. A site change goes live with the next release. See
[Site](../../docs/ci.md#site) in the CI documentation.
