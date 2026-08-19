# Virtool.ca Website

The product [website](https://www.virtool.ca) for Virtool.

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
