import type { ReactNode } from "react";

type FilterChipProps = {
	/** What the active filter is shown as. */
	children: ReactNode;

	/** Deselects the filter this chip stands for. */
	onRemove: () => void;

	/** The accessible name of the chip, which is a remove button. */
	removeLabel: string;
};

/**
 * A single active filter, shown in its group and removed by clicking it.
 */
export default function FilterChip({
	children,
	onRemove,
	removeLabel,
}: FilterChipProps) {
	return (
		<button
			aria-label={removeLabel}
			className="inline-flex cursor-pointer items-center gap-1.5 border-gray-300 border-l px-2 py-0.5 hover:bg-gray-100"
			onClick={onRemove}
			type="button"
		>
			{children}
		</button>
	);
}
