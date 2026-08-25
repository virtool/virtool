import Circle from "@base/Circle";

import { BaseSampleLabel } from "./BaseSampleLabel";

type SampleLabelProps = {
	/** The class name being used for the component */
	className?: string;
	/** The color assigned to the label */
	color?: string;
	/** The name of the label */
	name: string;
	/** The size variant */
	size?: "sm" | "md";
};

/**
 * Displays the label and the color associated with it
 */
export default function SampleLabel({
	className,
	color,
	name,
	size = "md",
}: SampleLabelProps) {
	return (
		<BaseSampleLabel className={className} color={color} size={size}>
			{color && <Circle />}
			{name}
		</BaseSampleLabel>
	);
}
