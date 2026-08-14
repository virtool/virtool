/**
 * Allowed colors for an instance banner.
 *
 * `instance_messages.color` is a `text` column closed by the
 * `ck_instance_messages_color` CHECK constraint; this is the one declaration
 * of what that constraint admits, imported by the schema mirror rather than
 * restated there.
 */
export const bannerColors = [
	"red",
	"yellow",
	"blue",
	"purple",
	"orange",
	"grey",
] as const;

/** One of the allowed banner colors. */
export type BannerColor = (typeof bannerColors)[number];
