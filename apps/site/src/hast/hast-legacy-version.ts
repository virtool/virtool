import { defineHastPlugin } from "satteri";

/** Replaces every LEGACY_VERSION in MDX-generated HTML text with the given version. */
export function hastLegacyVersion(version: string) {
  return defineHastPlugin({
    name: "hast-legacy-version",
    text(node, ctx) {
      if (!node.value.includes("LEGACY_VERSION")) {
        return;
      }

      ctx.replaceNode(node, {
        ...node,
        value: node.value.replaceAll("LEGACY_VERSION", version),
      });
    },
  });
}
