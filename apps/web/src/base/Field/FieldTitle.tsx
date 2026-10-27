import { cn } from "@app/cn";
import type { ComponentProps } from "react";
import { useFieldContext, useRegisterFieldPart } from "./FieldContext";

/** Props for a `FieldTitle`. */
export type FieldTitleProps = ComponentProps<"span">;

/**
 * The accessible name of the control in the surrounding `Field`.
 *
 * Use it in a row or card `FieldLabel`, so that the full row is clickable but
 * the control gets only the title as its name, not the description too.
 */
export default function FieldTitle({ className, ...props }: FieldTitleProps) {
	const field = useFieldContext();

	useRegisterFieldPart(field?.setHasTitle);

	return (
		<span
			className={cn("block font-medium", className)}
			data-slot="field-title"
			id={field?.titleId}
			{...props}
		/>
	);
}
