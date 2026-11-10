import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const manual = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/manual" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().optional(),
  }),
});

const postFields = { title: z.string(), summary: z.string() };

/**
 * Optional articles on the site. A post with images is a directory with an
 * `index.mdx` and the images beside it. `summary` is one sentence, because the
 * post list shows it.
 *
 * A `release` post shows users a new feature and why it is useful. It links to
 * the manual for instructions and does not repeat them. It
 * cannot name its version, because Knope calculates the version later. Set `pr`
 * to the pull request that makes the change. That pull request needs a change
 * file that names `virtool`, or the changelog will not contain it. The build
 * hides the post until that release exists and logs a warning for each hidden
 * post. The dev server shows it as unreleased.
 *
 * A `research` post tells users about work outside a release, such as a paper.
 */
const posts = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/posts" }),
  schema: z.discriminatedUnion("type", [
    z.object({
      ...postFields,
      type: z.literal("release"),
      pr: z.number().int().positive(),
    }),
    z.object({
      ...postFields,
      type: z.literal("research"),
      date: z.coerce.date().transform((date) => date.toISOString().slice(0, 10)),
    }),
  ]),
});

export const collections = { manual, posts };
