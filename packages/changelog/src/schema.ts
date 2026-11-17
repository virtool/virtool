import { z } from "zod";

const postFields = { title: z.string(), summary: z.string() };

/**
 * The frontmatter schema of a post. A post is an MDX file in `posts/`. A post
 * with images is a directory with an `index.mdx` and the images beside it. The
 * directory or file name is the slug. `summary` is one sentence, because post
 * lists show it.
 *
 * The site publishes the title, summary, and first image of each released post
 * in a blog index, and the web app shows them.
 *
 * A `release` post shows users one new feature and why it is useful. Write one
 * only for a change that users must know about; the changelog lists the rest.
 *
 * - The title is a noun phrase that names the feature with the words the UI
 *   uses, such as "Time format".
 * - The summary tells what the user gets. The body tells why they need it.
 * - The body opens with the current behaviour and its cost to the user, as
 *   facts, with no persuasion.
 * - The next paragraph starts with "You can now" and gives examples of each
 *   case, not steps.
 * - One image shows the new state, cropped to the change, with data that shows
 *   why the feature is useful.
 * - The post ends with the scope and default if they matter, then one line
 *   that links to the manual for instructions.
 *
 * A release post cannot name its version, because Knope calculates the version
 * later. Set `pr` to the pull request that makes the change. That pull request
 * needs a change file that names `virtool`, or the changelog will not contain
 * it. The site build hides the post until that release exists and logs a
 * warning for each hidden post. The site dev server shows it as unreleased.
 *
 * A `research` post tells users about work outside a release, such as a paper.
 */
export const postSchema = z.discriminatedUnion("type", [
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
]);
