import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

export function renderMarkdown(text: string): string {
  return micromark(text, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
}
