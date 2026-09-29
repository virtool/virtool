import { cn } from "@app/cn";
import { type ComponentProps, useLayoutEffect } from "react";
import { useFieldContext } from "./FieldContext";

/** Props for a `FieldDescription`. */
export type FieldDescriptionProps = ComponentProps<"p">;

/** Help text that describes the control in the surrounding `Field`. */
export default function FieldDescription({
	className,
	...props
}: FieldDescriptionProps) {
	const field = useFieldContext();
	const setHasDescription = field?.setHasDescription;

	useLayoutEffect(() => {
		if (!setHasDescription) {
			return;
		}

		setHasDescription(true);

		return () => setHasDescription(false);
	}, [setHasDescription]);

	return (
		<p
			className={cn("text-gray-600 text-sm mt-1", className)}
			data-slot="field-description"
			id={field?.descriptionId}
			{...props}
		/>
	);
}
