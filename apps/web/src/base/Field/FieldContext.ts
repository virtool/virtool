import { createContext, useContext, useLayoutEffect } from "react";

/** The ids and state a `Field` shares with its label, title, description, error, and control. */
export type FieldContextValue = {
	controlId: string;
	descriptionId: string;
	errorId: string;
	hasDescription: boolean;
	hasTitle: boolean;
	invalid: boolean;
	setHasDescription: (hasDescription: boolean) => void;
	setHasTitle: (hasTitle: boolean) => void;
	setInvalid: (invalid: boolean) => void;
	titleId: string;
};

export const FieldContext = createContext<FieldContextValue | null>(null);

FieldContext.displayName = "FieldContext";

export function useFieldContext(): FieldContextValue | null {
	return useContext(FieldContext);
}

/**
 * Tell the surrounding `Field` whether a part, such as a description, is
 * present, so that the control refers to the part only when it exists.
 */
export function useRegisterFieldPart(
	register: ((present: boolean) => void) | undefined,
	present = true,
): void {
	useLayoutEffect(() => {
		if (!register) {
			return;
		}

		register(present);

		return () => register(false);
	}, [register, present]);
}

/** Attributes that connect a form control to its surrounding `Field`. */
export type FieldControlProps = {
	id?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
	"aria-labelledby"?: string;
};

/** The props of a form control that `useFieldControl` merges with its `Field`. */
type FieldControlInput = {
	id?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
	"aria-label"?: string;
	"aria-labelledby"?: string;
};

/**
 * Get the `id`, `aria-invalid`, `aria-describedby`, and `aria-labelledby` a
 * form control needs to connect to its surrounding `Field`. Pass the control's
 * own props and spread the result after them. Explicit props take precedence,
 * and an explicit `aria-label` stops the `FieldTitle` from naming the control.
 */
export function useFieldControl({
	id,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
}: FieldControlInput): FieldControlProps {
	const field = useFieldContext();

	const describedBy = [
		field?.hasDescription ? field.descriptionId : undefined,
		field?.invalid ? field.errorId : undefined,
		ariaDescribedBy,
	].filter(Boolean);

	const invalid =
		ariaInvalid === undefined
			? field?.invalid
			: ariaInvalid !== false && ariaInvalid !== "false";

	return {
		id: id ?? field?.controlId,
		"aria-describedby": describedBy.length ? describedBy.join(" ") : undefined,
		"aria-invalid": invalid || undefined,
		"aria-labelledby":
			ariaLabelledBy ??
			(field?.hasTitle && !ariaLabel ? field.titleId : undefined),
	};
}
