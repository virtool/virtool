import { cn } from "@app/cn";
import { type ComponentProps, useId, useState } from "react";
import { FieldContext } from "./FieldContext";

/** Props for a `Field`: a `div` that connects one form control to its label, description, and error. */
export type FieldProps = ComponentProps<"div"> & {
	/** Lays a checkbox or switch out beside its label instead of above it. */
	orientation?: "vertical" | "horizontal";
};

/**
 * A single form control with its label, description, and error.
 *
 * Child `FieldLabel`, `FieldTitle`, `FieldDescription`, `FieldError`, and form
 * controls read the generated ids from context, so they connect without manual
 * `id`, `htmlFor`, `aria-invalid`, `aria-describedby`, or `aria-labelledby`
 * props.
 */
export default function Field({
	className,
	orientation = "vertical",
	...props
}: FieldProps) {
	const id = useId();
	const [hasDescription, setHasDescription] = useState(false);
	const [hasTitle, setHasTitle] = useState(false);
	const [invalid, setInvalid] = useState(false);

	return (
		<FieldContext.Provider
			value={{
				controlId: `${id}-control`,
				descriptionId: `${id}-description`,
				errorId: `${id}-error`,
				hasDescription,
				hasTitle,
				invalid,
				setHasDescription,
				setHasTitle,
				setInvalid,
				titleId: `${id}-title`,
			}}
		>
			<div
				className={cn(
					"group/field",
					orientation === "vertical"
						? "mb-4 pb-2"
						: "flex items-center gap-3 [&>[data-slot=field-label]]:mb-0",
					className,
				)}
				data-invalid={invalid || undefined}
				data-orientation={orientation}
				data-slot="field"
				{...props}
			/>
		</FieldContext.Provider>
	);
}
