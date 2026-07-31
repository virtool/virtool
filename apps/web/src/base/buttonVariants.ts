import { cva } from "class-variance-authority";

export const buttonVariants = cva(
	[
		"cursor-pointer items-center inline-flex font-medium px-4 rounded-md select-none",
		// Every button-like control gets the icon-to-label gap, not just `Button`
		// — a toggle carrying an icon needs it just as much.
		"gap-1.5",
		// A squeezed toolbar shrinks its buttons before it shrinks its search
		// input. Wrapping the label mid-word makes the button two lines tall and
		// shifts everything below it down the page; overflowing is the tamer
		// failure, and the caller decides what collapses before it comes to that.
		"whitespace-nowrap",
		"transition-colors",
		// Dims whatever the button currently is, so one rule covers every colour
		// and the on state below, which a `bg-` utility could not.
		"active:brightness-90",
		// Offset, so the ring reads against a filled button of any colour.
		"outline-none",
		"focus-visible:ring-2",
		"focus-visible:ring-blue-600",
		"focus-visible:ring-offset-2",
		// Keyed to the attribute that announces the state, so the two cannot drift.
		// The shift is in lightness rather than hue, so it survives greyscale.
		"aria-checked:bg-gray-700",
		"aria-checked:text-white",
		"aria-checked:hover:bg-gray-800",
		"aria-checked:hover:text-white",
		"aria-pressed:bg-gray-700",
		"aria-pressed:text-white",
		"aria-pressed:hover:bg-gray-800",
		"aria-pressed:hover:text-white",
	],
	{
		variants: {
			color: {
				gray: "bg-gray-200 text-black hover:bg-gray-300 hover:text-black",
				blue: "bg-blue-600 text-white hover:bg-blue-700 hover:text-white",
				green: "bg-green-600 text-white hover:bg-green-700 hover:text-white",
				orange: "bg-orange-600 text-white hover:bg-orange-700 hover:text-white",
				red: "bg-red-600 text-white hover:bg-red-700 hover:text-white",
				purple: "bg-purple-600 text-white hover:bg-purple-700 hover:text-white",
			},
			size: {
				large: "min-h-10 text-lg",
				small: "min-h-8 text-sm",
			},
		},
		defaultVariants: { color: "gray", size: "large" },
	},
);
