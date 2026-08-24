import { cva } from "class-variance-authority";

/**
 * Variants for IconButton. `color` sets the resting/hover/focus treatment;
 * `gray` is `text-gray-500` (4.84:1) so control icons meet WCAG 1.4.11. The
 * `onDark` axis restyles the button for a dark background — a white icon and a
 * white focus ring — rather than a one-off `white` colour member.
 */
export const iconButtonVariants = cva(
	"bg-inherit border-none cursor-pointer items-center outline-none p-2.5 rounded-full text-inherit",
	{
		variants: {
			color: {
				black: "text-black hover:bg-black/10 focus:bg-black/20",
				blue: "text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 focus:bg-blue-500/20",
				gray: "text-gray-500 hover:text-gray-600 hover:bg-gray-500/10 focus:bg-gray-500/20",
				green:
					"text-green-500 hover:text-green-600 hover:bg-green-500/10 focus:bg-green-500/20",
				orange:
					"text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 focus:bg-orange-500/20",
				purple:
					"text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 focus:bg-purple-500/20",
				red: "text-red-500 hover:text-red-600 hover:bg-red-500/10 focus:bg-red-500/20",
			},
			onDark: {
				true: "text-white hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-virtool focus-visible:ring-white",
			},
		},
		defaultVariants: { color: "black" },
	},
);
