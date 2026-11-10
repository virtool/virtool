# `@virtool/changelog`

The release posts, the post schema, and the parser for the `virtool`
changelog. The site and the web app read posts from this package. Knope writes
the changelog in the web app, and each consumer gives the changelog text to the
parser.

`Knope / Check` treats a post as a shipped file, because a post is MDX, not
Markdown. A pull request that changes a post needs a change file for each image
app that depends on this package.

See [Posts](../../CONTRIBUTING.md#posts) for how to write a post.

## Commands

Run from the monorepo root.

| Command                                         | Action                       |
| ----------------------------------------------- | ---------------------------- |
| `pnpm --filter @virtool/changelog test`         | Run tests.                   |
| `pnpm --filter @virtool/changelog typecheck`    | Type-check the package.      |
| `pnpm --filter @virtool/changelog format`       | Format the posts.            |
| `pnpm --filter @virtool/changelog format:check` | Find posts that need format. |
