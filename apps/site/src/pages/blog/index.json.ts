import type { APIContext } from "astro";
import { loadPosts } from "@utils/loadPosts";
import { getFirstImage, getImagePath } from "@utils/posts";
import type { BlogIndex } from "@virtool/contracts";

// The web app shows the first image of each post, so the build emits every post
// image as an asset that this index can link to.
const images = import.meta.glob<string>(
  "/node_modules/@virtool/changelog/posts/**/*.{gif,jpeg,jpg,png,svg,webp}",
  { eager: true, import: "default", query: "?url" },
);

export async function GET({ site }: APIContext): Promise<Response> {
  const { entries, released } = await loadPosts();

  const index: BlogIndex = {
    posts: released.map((post) => {
      const entry = entries.find(({ id }) => id === post.slug);
      const image = entry?.body ? getFirstImage(entry.body) : undefined;
      const url =
        image && entry?.filePath
          ? images[getImagePath(entry.filePath, image.src)]
          : undefined;

      if (!image || !url) {
        throw new Error(`Post "${post.slug}" has no image`);
      }

      return {
        date: new Date(post.date),
        image: { alt: image.alt, url: new URL(url, site).href },
        slug: post.slug,
        summary: post.summary,
        title: post.title,
        version: post.version,
      };
    }),
  };

  return Response.json(index);
}
