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
