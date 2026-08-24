import { cva } from "class-variance-authority";

/**
 * Text-color classes shared by Icon and Circle. `gray` is `text-gray-500`
 * (4.84:1 on white) so meaningful icons meet WCAG 1.4.11 non-text contrast.
 */
export const iconVariants = cva("", {
	variants: {
		color: {
			black: "text-black",
			blue: "text-blue-500",
			gray: "text-gray-500",
			green: "text-green-500",
			orange: "text-orange-500",
			purple: "text-purple-500",
			red: "text-red-500",
		},
	},
});
