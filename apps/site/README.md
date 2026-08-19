# Virtool.ca Website

The product [website](https://www.virtool.ca) for Virtool.

## Configuration

The site has one optional build-time environment variable. It does not use the
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
| `pnpm --filter @virtool/site deploy`          | Build and deploy to Cloudflare Workers         |
| `pnpm --filter @virtool/site astro -- --help` | Run the Astro CLI                              |
