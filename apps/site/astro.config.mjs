import mdx from "@astrojs/mdx";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [mdx({}), sitemap()],
  markdown: {
    processor: satteri(),
  },
  prefetch: true,
  site: "https://www.virtool.ca",
  vite: {
    plugins: [tailwindcss()],
  },
});
