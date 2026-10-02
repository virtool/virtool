import { cn } from "@app/cn";
import type { ComponentProps } from "react";
import { useFieldContext, useRegisterFieldPart } from "./FieldContext";

/** Props for a `FieldDescription`. */
export type FieldDescriptionProps = ComponentProps<"p">;

/** Help text that describes the control in the surrounding `Field`. */
export default function FieldDescription({
	className,
	...props
}: FieldDescriptionProps) {
	const field = useFieldContext();

	useRegisterFieldPart(field?.setHasDescription);

	return (
		<p
			className={cn("text-gray-600 text-sm mt-1 mb-0", className)}
			data-slot="field-description"
			id={field?.descriptionId}
			{...props}
		/>
	);
}
