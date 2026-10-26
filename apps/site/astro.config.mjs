import mdx from "@astrojs/mdx";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { hastLegacyVersion } from "./src/hast/hast-legacy-version";
import { getLatestLegacyVersion, getRepoReleases } from "./src/utils/releases";

const releases = await getRepoReleases("virtool");
const version = getLatestLegacyVersion(releases);

export default defineConfig({
  integrations: [mdx({}), sitemap()],
  markdown: {
    processor: satteri({ hastPlugins: [hastLegacyVersion(version)] }),
  },
  prefetch: true,
  site: "https://www.virtool.ca",
  vite: {
    plugins: [tailwindcss()],
  },
});
