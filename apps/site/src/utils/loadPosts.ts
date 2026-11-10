import { parseChangelog } from "@utils/changelog";
import {
  getHiddenPosts,
  getPublishedPosts,
  getReleasedPosts,
} from "@utils/posts";
import { getCollection } from "astro:content";
import changelog from "../../../web/CHANGELOG.md?raw";

export async function loadPosts() {
  const entries = await getCollection("posts");
  const releases = parseChangelog(changelog);
  // The slug is the file name. The web app links to posts by slug, so a
  // published post must keep its file name.
  const posts = entries.map(({ id, data }) => ({ ...data, slug: id }));
  const unreleased = getHiddenPosts(posts, releases);
  const published = getPublishedPosts(posts, releases);

  // The dev server lists unreleased posts first so that authors can see them
  // before their release exists. The build hides them.
  return {
    entries,
    hidden: import.meta.env.DEV ? [] : unreleased,
    listed: import.meta.env.DEV ? [...unreleased, ...published] : published,
    released: getReleasedPosts(posts, releases),
    releases,
  };
}
