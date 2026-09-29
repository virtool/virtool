import { createContext, useContext } from "react";

/** The ids and state a `Field` shares with its label, description, error, and control. */
export type FieldContextValue = {
	controlId: string;
	descriptionId: string;
	errorId: string;
	hasDescription: boolean;
	invalid: boolean;
	setHasDescription: (hasDescription: boolean) => void;
	setInvalid: (invalid: boolean) => void;
};

export const FieldContext = createContext<FieldContextValue | null>(null);

FieldContext.displayName = "FieldContext";

export function useFieldContext(): FieldContextValue | null {
	return useContext(FieldContext);
}

/** Attributes that connect a form control to its surrounding `Field`. */
export type FieldControlProps = {
	id?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
};

/**
 * Get the `id`, `aria-invalid`, and `aria-describedby` a form control needs to
 * connect to its surrounding `Field`. Explicit props take precedence.
 */
export function useFieldControl({
	id,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
}: {
	id?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
}): FieldControlProps {
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
	};
}
