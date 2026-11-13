import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { postSchema } from "@virtool/changelog";

const manual = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/manual" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().optional(),
  }),
});

// The glob reads the posts through the package link, so the site follows the
// package wherever the workspace keeps it.
const posts = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "./node_modules/@virtool/changelog/posts",
  }),
  schema: postSchema,
});

export const collections = { manual, posts };
