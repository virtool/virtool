import { cn } from "@app/cn";
import type { ComponentProps } from "react";
import { useFieldContext } from "./FieldContext";

/**
 * Turns a label that wraps a whole `Field` into a bordered, clickable card that
 * highlights when its radio or checkbox is checked.
 */
const choiceCardClasses =
	"has-[[data-slot=field]]:flex has-[[data-slot=field]]:mb-0 has-[[data-slot=field]]:cursor-pointer has-[[data-slot=field]]:rounded-md has-[[data-slot=field]]:border has-[[data-slot=field]]:border-gray-300 has-[[data-slot=field]]:p-4 has-[[data-state=checked]]:border-blue-600 has-[[data-state=checked]]:bg-blue-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500/50";

/** Props for a `FieldLabel`. */
export type FieldLabelProps = ComponentProps<"label">;

/**
 * The label for the control in the surrounding `Field`.
 *
 * Wrap a whole `Field` in a `FieldLabel` to make a clickable choice card.
 */
export default function FieldLabel({
	className,
	htmlFor,
	...props
}: FieldLabelProps) {
	const field = useFieldContext();

	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: htmlFor comes from the surrounding Field, or the label wraps its control
		<label
			className={cn(
				"font-medium mb-2 inline-block group-data-[disabled=true]/field:opacity-50",
				choiceCardClasses,
				className,
			)}
			data-slot="field-label"
			htmlFor={htmlFor ?? field?.controlId}
			{...props}
		/>
	);
}
